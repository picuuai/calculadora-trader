// Armazenamento local do app.
//
// Principal: IndexedDB do próprio app, neste computador. Não depende de pasta
// nem de permissão. Os dados nunca saem da máquina do usuário.
// Segurança extra:
//   - versões internas (snapshots) no IndexedDB, criadas automaticamente;
//   - pasta de backup OPCIONAL (File System Access). Grava o mesmo arquivo
//     dados/calculadora-trader-dados.json usado pela versão portátil (HTML único),
//     então as duas versões continuam compatíveis.
// Depende de: util.js, state.js. Usa render()/setTopStatus() definidos em ui.js.
'use strict';

var DB_NAME='calculadora-trader-app', DB_VERSION=1;
var DATA_DIR_NAME='dados';
var DATA_FILE_NAME='calculadora-trader-dados.json';
var CURRENT_BACKUP_FILE='calculadora-trader-backup.json';
var SNAPSHOT_MIN_MS=10*60*1000;   // intervalo mínimo entre versões automáticas
var SNAPSHOT_KEEP=40;             // quantas versões internas manter

var backupHandle=null;            // pasta de backup escolhida (pode estar sem permissão)
var backupReady=false;            // pasta conectada e com permissão de escrita
var saveFailed=false;
var lastPersisted='';             // último estado gravado com sucesso (JSON)
var lastSnapshotAt=0;
var saveChain=Promise.resolve();
var folderChain=Promise.resolve();
var folderTimer=null;
var persistentStorage=false;
var syncChannel=('BroadcastChannel' in window)?new BroadcastChannel('calculadora-trader'):null;

// ---------------- IndexedDB ----------------
function idbOpen(){
  return new Promise(function(resolve,reject){
    if(!window.indexedDB){reject(new Error('IndexedDB indisponível neste navegador'));return}
    var req=indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=function(){
      var db=req.result;
      if(!db.objectStoreNames.contains('kv'))db.createObjectStore('kv');
      if(!db.objectStoreNames.contains('snapshots'))db.createObjectStore('snapshots',{keyPath:'id'});
    };
    req.onsuccess=function(){resolve(req.result)};
    req.onerror=function(){reject(req.error||new Error('Falha ao abrir o banco local'))};
  });
}
function idbTx(store,mode,fn){
  return idbOpen().then(function(db){
    return new Promise(function(resolve,reject){
      var tx=db.transaction(store,mode),req=fn(tx.objectStore(store));
      tx.oncomplete=function(){db.close();resolve(req?req.result:undefined)};
      tx.onerror=function(){db.close();reject(tx.error)};
      tx.onabort=function(){db.close();reject(tx.error||new Error('gravação cancelada'))};
    });
  });
}
function kvGet(k){return idbTx('kv','readonly',function(s){return s.get(k)})}
function kvSet(k,v){return idbTx('kv','readwrite',function(s){return s.put(v,k)})}
function kvDel(k){return idbTx('kv','readwrite',function(s){return s.delete(k)})}

// ---------------- Estado principal ----------------
async function storageLoad(){
  var raw=await kvGet('state');
  if(!raw)return null;
  lastPersisted=raw;
  return normalizeLoadedState(JSON.parse(raw));
}
async function storageWrite(){
  // Versão automática do estado ANTERIOR à alteração (no máximo a cada 10 min).
  if(lastPersisted&&Date.now()-lastSnapshotAt>=SNAPSHOT_MIN_MS){
    await addSnapshot('auto',lastPersisted);
  }
  st.savedAt=new Date().toISOString();
  var payload=JSON.stringify(st,null,2);
  await kvSet('state',payload);
  lastPersisted=payload;
  saveFailed=false;
  if(syncChannel)syncChannel.postMessage({type:'saved',at:st.savedAt});
  scheduleFolderBackup();
}
// Chamado pela interface após qualquer alteração. Grava em sequência.
function save(){
  setTopStatus('salvando…');
  saveChain=saveChain.then(storageWrite).then(function(){
    setTopStatus('salvo');
  }).catch(function(e){
    var first=!saveFailed;
    saveFailed=true;
    setTopStatus('NÃO SALVO');
    if(first)alert('Atenção: não foi possível salvar os dados neste computador ('+(e&&e.message||e)+').\n\nBaixe um backup (.json) antes de fechar o app.');
  });
  return saveChain;
}

// Outra janela do app salvou: recarrega para não sobrescrever com dados antigos.
if(syncChannel)syncChannel.onmessage=function(ev){
  if(!ev.data||ev.data.type!=='saved')return;
  storageLoad().then(function(s){if(s){st=s;render();setTopStatus('atualizado por outra janela')}});
};

// ---------------- Versões internas ----------------
function backupStamp(d){
  d=d||new Date();
  return d.getFullYear()+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0')+'-'+
    String(d.getHours()).padStart(2,'0')+String(d.getMinutes()).padStart(2,'0')+String(d.getSeconds()).padStart(2,'0');
}
async function addSnapshot(label,data){
  var now=new Date();
  lastSnapshotAt=now.getTime();
  var snap={id:backupStamp(now)+'-'+label+'-'+Math.random().toString(36).slice(2,6),createdAt:now.toISOString(),label:label,data:data};
  await idbTx('snapshots','readwrite',function(s){return s.put(snap)});
  var all=await listSnapshots();
  var extra=all.slice(SNAPSHOT_KEEP);
  if(extra.length)await idbTx('snapshots','readwrite',function(s){extra.forEach(function(x){s.delete(x.id)});return null});
  if(backupReady)writeVersionedFolderBackup(snap.id,data);
  return snap;
}
async function listSnapshots(){
  var all=await idbTx('snapshots','readonly',function(s){return s.getAll()})||[];
  return all.sort(function(a,b){return b.createdAt.localeCompare(a.createdAt)});
}
// Cópia do estado ATUAL antes de uma mudança destrutiva (apagar, restaurar...).
function backupBeforeChange(label){
  return addSnapshot(label,JSON.stringify(st,null,2)).catch(function(){});
}

// ---------------- Armazenamento persistente ----------------
async function requestPersistentStorage(){
  try{
    if(navigator.storage&&navigator.storage.persist){
      persistentStorage=await navigator.storage.persisted();
      if(!persistentStorage)persistentStorage=await navigator.storage.persist();
    }
  }catch(e){}
  renderStorageStatus();
}

// ---------------- Pasta de backup (opcional) ----------------
function folderSupported(){return typeof window.showDirectoryPicker==='function'}
async function getDataDir(dir){return await dir.getDirectoryHandle(DATA_DIR_NAME,{create:true})}
async function writeTextFile(dir,name,data){
  var fh=await dir.getFileHandle(name,{create:true});
  var wr=await fh.createWritable();
  await wr.write(data);
  await wr.close();
}
async function readFolderData(dir){
  try{
    var dataDir=await dir.getDirectoryHandle(DATA_DIR_NAME);
    var f=await (await dataDir.getFileHandle(DATA_FILE_NAME)).getFile();
    return{raw:await f.text(),modified:f.lastModified};
  }catch(e){return null}
}
function canonical(x){
  return JSON.stringify({people:x.people,entries:x.entries,paid:x.paid,closed:x.closed});
}
async function writeFolderData(){
  if(!backupReady||!backupHandle)return;
  var payload=lastPersisted||JSON.stringify(st,null,2);
  var dataDir=await getDataDir(backupHandle);
  await writeTextFile(dataDir,DATA_FILE_NAME,payload);
  await writeTextFile(dataDir,CURRENT_BACKUP_FILE,payload);
  await kvSet('folderWrittenAt',Date.now());
  renderStorageStatus();
}
function writeVersionedFolderBackup(id,data){
  folderChain=folderChain.then(async function(){
    if(!backupReady||!backupHandle)return;
    var dir=await backupHandle.getDirectoryHandle('backups',{create:true});
    await writeTextFile(dir,'backup-'+id+'.json',data);
  }).catch(function(){});
}
function scheduleFolderBackup(){
  if(!backupReady)return;
  clearTimeout(folderTimer);
  folderTimer=setTimeout(function(){
    folderChain=folderChain.then(writeFolderData).catch(function(e){
      backupReady=false;
      renderStorageStatus('Falha ao gravar o backup na pasta: '+e.message);
    });
  },1200);
}
// Compara o arquivo da pasta com os dados do app. Se a pasta foi alterada por
// fora (ex.: versão portátil), pergunta qual manter. Nunca descarta sem cópia.
async function reconcileWithFolder(){
  var disk=await readFolderData(backupHandle);
  if(!disk){await writeFolderData();return}
  var diskState;
  try{diskState=normalizeLoadedState(JSON.parse(disk.raw))}catch(e){await writeFolderData();return}
  if(canonical(diskState)===canonical(st)){await kvSet('folderWrittenAt',Date.now());return}
  var appEmpty=!st.people.length&&!st.entries.length;
  var writtenAt=(await kvGet('folderWrittenAt'))||0;
  var folderIsNewer=disk.modified>writtenAt+2000;
  if(appEmpty||(folderIsNewer&&confirm(
    'O arquivo da pasta de backup foi alterado fora do app (talvez pela versão portátil) e está diferente dos dados do app.\n\n'+
    'Pasta: '+diskState.people.length+' contribuinte(s), '+diskState.entries.length+' lançamento(s)\n'+
    'App: '+st.people.length+' contribuinte(s), '+st.entries.length+' lançamento(s)\n\n'+
    'OK = usar os dados da PASTA (os dados atuais do app ficam guardados nas versões internas)\n'+
    'Cancelar = manter os dados do APP (o arquivo da pasta vai para a subpasta backups)'))){
    if(!appEmpty)await backupBeforeChange('antes-carregar-pasta');
    st=diskState;
    await save();
    render();
  }else{
    writeVersionedFolderBackup(backupStamp()+'-pasta-substituida',disk.raw);
    await writeFolderData();
  }
}
async function connectBackupFolder(){
  if(!folderSupported()){alert('Este navegador não permite escolher pasta. Use Chrome ou Edge — ou use "Baixar backup".');return false}
  var handle=null;
  if(backupHandle){
    var p=await backupHandle.queryPermission({mode:'readwrite'});
    if(p!=='granted')p=await backupHandle.requestPermission({mode:'readwrite'});
    if(p==='granted')handle=backupHandle;
  }
  if(!handle)handle=await window.showDirectoryPicker({id:'calculadora-trader-backup',mode:'readwrite'});
  var perm=await handle.queryPermission({mode:'readwrite'});
  if(perm!=='granted')perm=await handle.requestPermission({mode:'readwrite'});
  if(perm!=='granted')return false;
  backupHandle=handle;
  backupReady=true;
  await kvSet('folderHandle',handle);
  await reconcileWithFolder();
  renderStorageStatus();
  return true;
}
// Na abertura: reconecta sem perguntar se o navegador manteve a permissão
// (app instalado + "Permitir sempre"). Caso contrário, só mostra o botão.
async function restoreBackupFolder(){
  if(!folderSupported())return;
  try{
    var h=await kvGet('folderHandle');
    if(!h)return;
    backupHandle=h;
    if(await h.queryPermission({mode:'readwrite'})==='granted'){
      backupReady=true;
      await reconcileWithFolder();
    }
  }catch(e){backupReady=false}
  renderStorageStatus();
}
async function forgetBackupFolder(){
  backupHandle=null;backupReady=false;
  await kvDel('folderHandle');
  renderStorageStatus();
}

// ---------------- Indicadores na tela ----------------
function renderStorageStatus(extra){
  var el=document.getElementById('storage-status');
  if(el){
    el.textContent='dados: neste computador';
    el.title=persistentStorage
      ?'Os dados ficam no armazenamento do app neste computador, marcado como persistente.'
      :'Os dados ficam no armazenamento do app neste computador. Instale o app para o navegador protegê-lo contra limpeza automática.';
  }
  var bk=document.getElementById('backup-status');
  if(bk){
    bk.textContent=backupReady?'backup: pasta '+backupHandle.name:(backupHandle?'backup: pasta sem permissão':'backup: sem pasta');
    bk.className='pill'+(backupReady?'':' warn-pill');
    bk.title=extra||(backupReady?'Cada alteração também é gravada em '+backupHandle.name+'/dados/'+DATA_FILE_NAME:'Conecte uma pasta (ex.: no OneDrive) para ter uma cópia automática fora do app.');
  }
  var fb=document.getElementById('folder-btn');
  if(fb){
    fb.style.display=folderSupported()?'':'none';
    fb.textContent=backupReady?'Pasta de backup: '+backupHandle.name:(backupHandle?'Reautorizar pasta: '+backupHandle.name:'Conectar pasta de backup');
  }
  var ff=document.getElementById('folder-forget');
  if(ff)ff.style.display=backupHandle?'':'none';
  var msg=document.getElementById('backup-msg');
  if(msg&&extra)msg.textContent=extra;
}
