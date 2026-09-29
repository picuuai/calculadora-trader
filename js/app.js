// Inicialização: carrega os dados locais, QR do Pix, boas-vindas,
// instalação (PWA) e aviso de nova versão.
'use strict';

var PIX_CHAVE='+5535991051736';

function renderPixQR(){
  var el=document.getElementById('v4-pix-qr');
  if(!el||typeof window.qrcode!=='function')return;
  function crc16(str){
    var crc=0xFFFF;
    for(var i=0;i<str.length;i++){
      crc^=(str.charCodeAt(i)<<8);
      for(var b=0;b<8;b++)crc=(crc&0x8000)?((crc<<1)^0x1021)&0xFFFF:(crc<<1)&0xFFFF;
    }
    return crc.toString(16).toUpperCase().padStart(4,'0');
  }
  function tlv(tag,value){return tag+String(value.length).padStart(2,'0')+value}
  try{
    var mai=tlv('00','br.gov.bcb.pix')+tlv('01',PIX_CHAVE);
    var body=tlv('00','01')+tlv('26',mai)+tlv('52','0000')+tlv('53','986')+
      tlv('58','BR')+tlv('59','RECEBEDOR')+tlv('60','BRASIL')+tlv('62',tlv('05','***'))+'6304';
    var qr=window.qrcode(0,'M');
    qr.addData(body+crc16(body));
    qr.make();
    el.innerHTML=qr.createSvgTag({cellSize:4,margin:0});
  }catch(e){el.style.display='none'}
}

// ---------------- Boas-vindas (primeiro uso) ----------------
function showWelcome(show){document.getElementById('welcome').style.display=show?'block':'none'}
document.getElementById('welcome-folder').onclick=function(){
  connectBackupFolder().then(function(ok){
    if(!ok)return;
    showWelcome(false);
    renderSnapshots();
    backupMsg(st.entries.length
      ?'Dados carregados da pasta ('+st.entries.length+' lançamento(s)). A pasta segue recebendo cópia automática.'
      :'Pasta conectada. Não havia dados nela; comece cadastrando um contribuinte.');
    if(!st.people.length)openPeopleModal();
  }).catch(function(e){if(e&&e.name!=='AbortError')alert('Não foi possível conectar a pasta: '+e.message)});
};
document.getElementById('welcome-file').onclick=function(){document.getElementById('backup-file').click()};
document.getElementById('welcome-new').onclick=function(){
  kvSet('welcomeDone',true).catch(function(){});
  showWelcome(false);
  openPeopleModal();
};

// ---------------- Instalação e atualização ----------------
var installPrompt=null;
window.addEventListener('beforeinstallprompt',function(ev){
  ev.preventDefault();installPrompt=ev;
  document.getElementById('install-btn').style.display='';
});
document.getElementById('install-btn').onclick=function(){
  if(!installPrompt)return;
  installPrompt.prompt();
  installPrompt.userChoice.finally(function(){installPrompt=null;document.getElementById('install-btn').style.display='none'});
};
window.addEventListener('appinstalled',function(){document.getElementById('install-btn').style.display='none';requestPersistentStorage()});

function registerServiceWorker(){
  if(!('serviceWorker' in navigator)||location.protocol==='file:')return;
  navigator.serviceWorker.register('sw.js').then(function(reg){
    function offer(w){
      var banner=document.getElementById('update-banner');
      banner.style.display='flex';
      document.getElementById('update-btn').onclick=function(){w.postMessage({type:'skip-waiting'})};
    }
    if(reg.waiting&&navigator.serviceWorker.controller)offer(reg.waiting);
    reg.addEventListener('updatefound',function(){
      var w=reg.installing;
      w.addEventListener('statechange',function(){
        if(w.state==='installed'&&navigator.serviceWorker.controller)offer(w);
      });
    });
  }).catch(function(){});
  // Recarrega só quando uma versão NOVA assume (atualização). Na primeira
  // visita não havia service worker controlando a página: nada a recarregar.
  var hadController=!!navigator.serviceWorker.controller,reloading=false;
  navigator.serviceWorker.addEventListener('controllerchange',function(){
    if(!hadController||reloading)return;reloading=true;location.reload();
  });
}

// ---------------- Início ----------------
(async function init(){
  renderPixQR();
  setTopStatus('carregando…');
  try{
    var loaded=await storageLoad();
    if(loaded)st=loaded;
  }catch(e){
    setTopStatus('ERRO ao ler dados');
    alert('Não foi possível ler os dados salvos neste computador: '+e.message+'\n\nSe tiver um backup (.json), use "Restaurar arquivo".');
  }
  render();
  renderStorageStatus();
  setTopStatus('pronto');
  await restoreBackupFolder();
  var welcomeDone=false;
  try{welcomeDone=!!(await kvGet('welcomeDone'))}catch(e){}
  showWelcome(!st.people.length&&!st.entries.length&&!welcomeDone);
  renderSnapshots();
  requestPersistentStorage();
  registerServiceWorker();
})();
