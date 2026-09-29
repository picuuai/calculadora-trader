// Interface: renderização das seções, importação de PDFs em lote e eventos.
// Depende de todos os outros módulos (carregar por último, antes de app.js).
'use strict';

// Aviso de DARF perto do vencimento (7 dias) ou vencido, para todos os CPFs.
function renderDueBanner(){
  var el=document.getElementById('due-banner');if(!el)return;
  var list=dueAlerts();
  if(!list.length){el.style.display='none';el.innerHTML='';return}
  el.style.display='block';
  el.innerHTML=list.map(function(a){
    var late=a.daysLeft<0;
    var quando=late?'venceu em '+a.due+' — emita pelo Sicalc com multa e juros':(a.daysLeft===0?'vence HOJE ('+a.due+')':'vence em '+a.daysLeft+' dia(s) ('+a.due+')');
    return'<div class="activebar" style="margin-bottom:8px;justify-content:space-between;border-color:'+(late?'var(--critical)':'var(--warning)')+';background:'+(late?'var(--critical-soft)':'var(--warning-soft)')+'">'+
      '<span><strong>DARF '+ymlabel(a.ym)+' — '+brl(a.darf)+'</strong> <span class="small">'+esc(a.person.name)+' • '+quando+'</span></span>'+
      '<button type="button" class="ghost" data-due-go="'+esc(a.person.id)+'|'+a.ym+'">Ver competência</button></div>';
  }).join('');
}
document.getElementById('due-banner').addEventListener('click',function(ev){
  var b=ev.target.closest('[data-due-go]');if(!b)return;
  var parts=b.getAttribute('data-due-go').split('|');
  if(st.active!==parts[0]){st.active=parts[0];save();render()}
  var sel=document.getElementById('close-month');sel.value=parts[1];renderClosePanel(ledger(activeEntries()));
  sel.scrollIntoView({behavior:'smooth',block:'center'});
});
document.getElementById('irpf-report').addEventListener('click',function(){gerarRelatorioAnual(document.getElementById('irrf-year').value)});

function setTopStatus(t){var e=document.getElementById('v3-top-status');if(e)e.textContent=t}

function render(){renderPeople();renderSelects();var L=ledger(activeEntries());renderCloseMonths(L);renderStats(L);renderIrrfAnnual(L);renderIssues();renderFilters();renderHistory();renderDueBanner();renderCash()}
function renderPeople(){
  var b=document.getElementById('people-body');
  b.innerHTML=st.people.length?st.people.map(function(p){
    var n=st.entries.filter(function(e){return e.personId===p.id}).length;
    return '<tr>'+
      '<td>'+esc(p.name)+'</td>'+
      '<td>'+cpfFmt(p.cpf)+'</td>'+
      '<td>'+((p.accounts||[]).length?(p.accounts||[]).map(esc).join(', '):'—')+'</td>'+
      '<td class="num">'+(personCashTotal(p.id)==null?'<span class="small">não informado</span>':brl(personCashTotal(p.id)))+'</td>'+
      '<td>'+
        (p.id===st.active?'<span class="badge ok">Ativo</span>':'<button class="ghost" data-use="'+p.id+'">Usar CPF</button>')+
        ' <button class="ghost" data-edit-person="'+p.id+'">Editar</button> '+
        (n?'<span class="small">'+n+' lançamento(s)</span>':'<button class="danger" data-rm="'+p.id+'">Remover</button>')+
      '</td>'+
    '</tr>';
  }).join(''):'<tr><td colspan="5" class="small" style="text-align:center;padding:22px">Cadastre um contribuinte.</td></tr>';
}
function renderSelects(){
  var bar=document.getElementById('activebar'),
      a=document.getElementById('active-person'),
      f=document.getElementById('f-person');

  if(!st.people.length){
    bar.style.display='flex';
    a.innerHTML='<option value="">Nenhum CPF cadastrado</option>';
    a.disabled=true;
    f.innerHTML='<option value="">Cadastre um CPF primeiro</option>';
    f.disabled=true;
    return;
  }

  a.disabled=false;
  f.disabled=false;
  if(!person(st.active))st.active=st.people[0].id;
  bar.style.display='flex';

  var opts=st.people.map(function(p){
    return'<option value="'+p.id+'"'+(p.id===st.active?' selected':'')+'>'+esc(personLabel(p))+'</option>';
  }).join('');
  a.innerHTML=opts;
  f.innerHTML=opts;
  f.value=st.active;
}
function renderStats(L){var last=L[L.length-1],pending=L.filter(function(r){return r.darf>0&&!r.paid}).reduce(function(s,r){return s+r.darf},0),yr=last?last.ym.slice(0,4):new Date().getFullYear(),paid=L.filter(function(r){return r.paid&&r.ym.slice(0,4)==yr}).reduce(function(s,r){return s+r.darf},0);document.getElementById('stats').innerHTML=stat('DARF pendente',pending,pending?'bad':'','competências em aberto')+stat('Prejuízo day trade',last?last.loss:0,'','saldo para compensar')+stat('Crédito IRRF '+yr,last?last.credit:0,'','não passa automaticamente para janeiro')+stat('DARF pago '+yr,paid,'ok','guias marcadas como pagas')}
function stat(k,v,cl,s){return'<div class="stat"><div class="k">'+k+'</div><div class="v '+cl+'">'+brl(v)+'</div><div class="s">'+s+'</div></div>'}

function renderCloseMonths(L){
  var sel=document.getElementById('close-month'),cur=sel.value,months=L.map(function(r){return r.ym}).sort().reverse();
  sel.innerHTML=months.length?months.map(function(m){return'<option value="'+m+'">'+ymlabel(m)+'</option>'}).join(''):'<option value="">Sem competências</option>';
  if(months.indexOf(cur)>=0)sel.value=cur;else if(months.length)sel.value=months[0];
  renderClosePanel(L);
}
function renderClosePanel(L){
  var month=document.getElementById('close-month').value,r=L.find(function(x){return x.ym===month});
  var stats=document.getElementById('close-stats'),body=document.getElementById('account-summary'),
      btn=document.getElementById('close-toggle'),status=document.getElementById('close-status'),
      darfBtn=document.getElementById('close-darf'),paidBtn=document.getElementById('close-paid'),
      rep=document.getElementById('monthly-report');
  if(!month||!r){
    stats.innerHTML='';
    body.innerHTML='<tr><td colspan="7" class="small" style="text-align:center;padding:18px">Sem competência selecionada.</td></tr>';
    btn.disabled=true;darfBtn.disabled=true;paidBtn.disabled=true;rep.disabled=true;
    darfBtn.style.display='none';paidBtn.style.display='none';
    status.textContent='';
    return
  }
  btn.disabled=false;rep.disabled=false;var closed=closedInfo(st.active,month);
  btn.textContent=closed?'Reabrir competência':'Fechar competência';btn.className=closed?'ghost':'primary';

  darfBtn.style.display=r.darf>0?'':'none';
  paidBtn.style.display=r.darf>0?'':'none';
  darfBtn.disabled=!(r.darf>0);
  paidBtn.disabled=!(r.darf>0);
  paidBtn.textContent=r.paid?'Reabrir pagamento':'Marcar pago';
  paidBtn.className=r.paid?'ghost':'primary';

  var payText=r.darf>0?(r.paid?' • DARF pago':' • DARF pendente'):'';
  var diverg=closedDivergence(st.active,r);
  status.textContent=(closed?'Fechada em '+new Date(closed.closedAt).toLocaleString('pt-BR'):'Competência aberta')+payText+
    (diverg?' • ⚠ valores mudaram após o fechamento (DARF fechado: '+brl(diverg.closedDarf)+') — veja o painel de inconsistências':'');
  status.style.color=diverg?'var(--critical)':'';
  var det=accountSummary(month);
  var hasDet=det.some(function(a){return a.hasDetalhe});
  var brutoMes=det.reduce(function(s,a){return s+(a.bruto||0)},0);
  var custosMes=det.reduce(function(s,a){return s+(a.custos||0)},0);
  var liquidoNotasMes=det.reduce(function(s,a){return s+(a.liquidoNota||0)},0);

  stats.innerHTML=
    stat('Bruto das notas',hasDet?brutoMes:0,'',hasDet?'valor bruto extraído dos PDFs':'sem detalhamento nas notas antigas/manuais')+
    stat('Custos / taxas',hasDet?custosMes:0,'',hasDet?'custos extraídos dos PDFs':'sem detalhamento')+
    stat('Resultado do mês',r.result,r.result<0?'bad':'','resultado líquido tributável')+
    stat('IRRF do mês',r.irrf,'','retido nas notas')+
    stat('Líquido das notas',hasDet?liquidoNotasMes:0,'',hasDet?'valor financeiro das notas':'sem detalhamento')+
    stat('Prejuízo compensado',r.usedLoss,'','')+
    stat('Base tributável',r.base,'','')+
    stat('IR 20%',r.tax,'','')+
    stat('IRRF utilizado',r.creditUsed||0,'','')+
    stat('Saldo IRRF',r.credit,'','')+
    stat(r.paid?'DARF pago':'DARF a pagar',r.darf,r.darf>0?(r.paid?'ok':'bad'):'','')+
    '<div class="stat"><div class="k">Vencimento</div><div class="v">'+(r.darf>0?due(r.ym):'—')+'</div><div class="s">'+(r.paid?'marcado como pago':'')+'</div></div>';
  var acc=accountSummary(month);
  body.innerHTML=acc.length?acc.map(function(a){return'<tr>'+
      '<td>'+esc(a.account)+'</td>'+
      '<td class="num">'+a.count+'</td>'+
      '<td class="num">'+(a.hasDetalhe?brl(a.bruto):'—')+'</td>'+
      '<td class="num">'+(a.hasDetalhe?brl(a.custos):'—')+'</td>'+
      '<td class="num '+(a.result<0?'neg':'pos')+'">'+brl(a.result)+'</td>'+
      '<td class="num">'+brl(a.irrf)+'</td>'+
      '<td class="num">'+(a.hasDetalhe?brl(a.liquidoNota):'—')+'</td>'+
    '</tr>'}).join(''):'<tr><td colspan="7" class="small" style="text-align:center;padding:18px">Sem lançamentos.</td></tr>';
}
function renderIrrfAnnual(L){
  var sel=document.getElementById('irrf-year'),cur=sel.value,
      years=Array.from(new Set(L.map(function(r){return r.ym.slice(0,4)}))).sort().reverse();

  sel.innerHTML=years.length
    ?years.map(function(y){return'<option value="'+y+'">'+y+'</option>'}).join('')
    :'<option value="">Sem dados</option>';

  if(years.indexOf(cur)>=0)sel.value=cur;

  var year=sel.value;
  var rows=L.filter(function(r){return r.ym.slice(0,4)===year});
  var irrfRetido=rows.reduce(function(s,r){return s+r.irrf},0);
  var irrfUtilizado=rows.reduce(function(s,r){return s+(r.creditUsed||0)},0);
  var darfPago=rows.filter(function(r){return r.paid}).reduce(function(s,r){return s+r.darf},0);
  var totalRecolhido=Math.round((irrfRetido+darfPago)*100)/100;
  var saldoIRRF=rows.length?rows[rows.length-1].credit:0;

  document.getElementById('irrf-stats').innerHTML=
    stat('IRRF retido nas notas '+(year||'—'),irrfRetido,'','crédito informado pelas corretoras')+
    stat('IRRF utilizado',irrfUtilizado,'','saldo disponível: '+brl(saldoIRRF))+
    stat('DARF pago',darfPago,darfPago>0?'ok':'','somente competências marcadas como pagas')+
    stat('IR recolhido / retido',totalRecolhido,'ok','IRRF retido + DARFs pagos');
}
function renderIssues(){
  var issues=collectIssues(),el=document.getElementById('issues-panel');
  if(!issues.length){el.innerHTML='<span class="badge ok">Nenhuma inconsistência identificada</span>';return}
  el.innerHTML='<div style="display:grid;gap:7px">'+issues.slice(0,50).map(function(i){return'<div style="border:1px solid var(--line);border-radius:7px;padding:8px 10px"><span class="badge '+(i.level==='bad'?'bad':'warn')+'">'+(i.level==='bad'?'Revisar':'Atenção')+'</span> <span style="font-size:12.5px">'+esc(i.text)+'</span></div>'}).join('')+'</div>';
}

function renderFilters(){
  var monthSel=document.getElementById('flt-month');
  var currentMonth=monthSel.value;
  var months=Array.from(new Set(activeEntries().map(function(e){return ym(e.date)}))).sort().reverse();
  monthSel.innerHTML='<option value="">Todos os meses</option>'+
    months.map(function(x){return'<option value="'+x+'">'+ymlabel(x)+'</option>'}).join('');
  if(months.indexOf(currentMonth)>=0) monthSel.value=currentMonth;

  var accountSel=document.getElementById('flt-account');
  var currentAccount=accountSel.value;
  var accounts=[];

  var p=person(st.active);
  if(p&&Array.isArray(p.accounts)){
    p.accounts.forEach(function(a){
      var d=digits(a);
      if(d&&accounts.indexOf(d)===-1) accounts.push(d);
    });
  }

  activeEntries().forEach(function(e){
    var d=entryAccountDigits(e);
    if(d&&accounts.indexOf(d)===-1) accounts.push(d);
  });

  accounts.sort();
  accountSel.innerHTML='<option value="">Todas as contas</option>'+
    accounts.map(function(a){return'<option value="'+a+'">Conta '+esc(a)+'</option>'}).join('');
  if(accounts.indexOf(currentAccount)>=0) accountSel.value=currentAccount;

  // O filtro de conta fica sempre visível. Se houver apenas uma conta,
  // ela aparece como opção além de "Todas as contas".
  accountSel.style.display='';
  if(currentAccount && accounts.indexOf(currentAccount)===-1) accountSel.value='';
}
function filtered(){
  var m=document.getElementById('flt-month').value;
  var c=document.getElementById('flt-cat').value;
  var a=document.getElementById('flt-account').value;
  return activeEntries().filter(function(e){
    return (!m||ym(e.date)===m) &&
           (!c||e.cat===c) &&
           (!a||entryAccountDigits(e)===a);
  }).sort(function(a,b){return b.date.localeCompare(a.date)});
}
function renderHistory(){var list=filtered();document.getElementById('count').textContent=list.length+' lançamento(s)';var b=document.getElementById('history');b.innerHTML=list.length?list.map(function(e){return'<tr>'+
      '<td>'+datebr(e.date)+'</td>'+
      '<td>'+CATS[e.cat]+'</td>'+
      '<td class="num">'+(e.bruto==null?'—':brl(e.bruto))+'</td>'+
      '<td class="num">'+(e.custos==null?'—':brl(e.custos))+'</td>'+
      '<td class="num '+(e.result<0?'neg':'pos')+'">'+brl(e.result)+'</td>'+
      '<td class="num">'+brl(e.irrf)+'</td>'+
      '<td class="num">'+(e.liquidoNota==null?'—':brl(e.liquidoNota))+'</td>'+
      '<td>'+esc(e.ref||'—')+'</td>'+
      '<td>'+esc(e.account||'—')+'</td>'+
      '<td><span class="badge neutral">'+(e.origin==='pdf'?'PDF':'Manual')+'</span></td>'+
      '<td>'+(isMonthClosed(e.personId,ym(e.date))?'<span class="badge ok">Fechada</span>':'<button class="ghost" data-edit="'+e.id+'">Editar</button> <button class="danger" data-del="'+e.id+'">Excluir</button>')+'</td>'+
    '</tr>'}).join(''):'<tr><td colspan="11" class="small" style="text-align:center;padding:22px">Nenhum lançamento neste filtro.</td></tr>';drawCharts(list);renderPerformance(list)}

// Associação automática SOMENTE por número de conta já memorizado.
// Nome igual é usado apenas como sugestão na associação em lote.
function resolveAccountOnly(parsed){
  var cp=digits(parsed.cpf||'');
  if(cp){
    var byCpf=st.people.find(function(p){return digits(p.cpf||'')===cp;});
    if(byCpf){
      if(parsed.account)link(byCpf.id,parsed.account);
      return byCpf.id;
    }
  }

  var a=digits(parsed.account);
  if(!a)return '';
  var p=st.people.find(function(p){
    return (p.accounts||[]).some(function(x){return digits(x)===a;});
  });
  return p?p.id:'';
}
function suggestedByName(parsed){
  if(!parsed.name) return '';
  var n=norm(parsed.name);
  var p=st.people.find(function(p){return norm(p.name)===n;});
  return p?p.id:'';
}
function link(pid,acc){
  var a=digits(acc); if(!a)return;
  var p=person(pid); if(!p)return;
  p.accounts=p.accounts||[];
  if(!p.accounts.some(function(x){return digits(x)===a;})) p.accounts.push(a);
}
function duplicate(x,exclude){
  return st.entries.find(function(e){
    if(e.id===exclude||e.personId!==x.personId)return false;
    if(x.ref&&e.ref){
      // Contas diferentes (ex.: corretoras distintas) podem repetir o número do comprovante.
      var xa=entryAccountDigits(x),ea=entryAccountDigits(e);
      if(xa&&ea&&xa!==ea)return false;
      var xr=refNumber(x.ref),er=refNumber(e.ref);
      if(xr&&er)return xr===er;
      return norm(x.ref)===norm(e.ref);
    }
    return e.date===x.date&&e.cat===x.cat&&
      Math.abs((+e.result||0)-(+x.result||0))<.005&&
      Math.abs((+e.irrf||0)-(+x.irrf||0))<.005&&
      digits(e.account)===digits(x.account);
  })||null;
}

// Identificador forte para PDF: conta + comprovante + data.
// Se não houver comprovante, usa conta/data/resultado/IRRF como fallback.
function pdfFingerprint(x){
  var acc=digits(x.account||'');
  var ref=refNumber(x.ref||'')||norm(x.ref||'');
  var dt=x.date||'';
  if(acc&&ref) return 'REF|'+acc+'|'+ref+'|'+dt;
  return 'VAL|'+acc+'|'+dt+'|'+(x.cat||'')+'|'+
    Number(x.result||0).toFixed(2)+'|'+Number(x.irrf||0).toFixed(2);
}
function existingPdfDuplicate(parsed){
  var fp=pdfFingerprint(parsed);
  return st.entries.find(function(e){
    if(e.origin!=='pdf') return false;
    return pdfFingerprint({
      account:e.account,
      ref:e.ref,
      date:e.date,
      cat:e.cat,
      result:e.result,
      irrf:e.irrf
    })===fp;
  })||null;
}
function stagingPdfDuplicate(parsed){
  var fp=pdfFingerprint(parsed);
  return staging.find(function(s){
    return pdfFingerprint(s)===fp;
  })||null;
}
async function readPdf(file){
  if(!window.pdfjsLib.GlobalWorkerOptions.workerSrc){
    window.pdfjsLib.GlobalWorkerOptions.workerSrc='js/vendor/pdf.worker.min.js';
  }

  var pdf=await window.pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise;
  var lines=[],layoutRows=[];

  for(var p=1;p<=pdf.numPages;p++){
    var page=await pdf.getPage(p),ct=await page.getTextContent();
    var items=ct.items.map(function(i){
      return{
        x:i.transform[4],
        y:i.transform[5],
        w:Number(i.width)||0,
        s:i.str
      };
    }).filter(function(i){return i.s&&i.s.trim();});

    lines=lines.concat(rebuild(items));
    layoutRows=layoutRows.concat(rebuildRows(items));
  }

  var parsed=parseNote(lines,lines.join('\n'),layoutRows);
  parsed.file=file.name;
  parsed.temp=id();
  parsed.personId=resolveAccountOnly(parsed);
  parsed.suggestedPersonId=parsed.personId?'':suggestedByName(parsed);
  parsed.batchKey=digits(parsed.cpf||'')
    ?'CPF:'+digits(parsed.cpf)
    :(digits(parsed.account)
      ?'ACC:'+digits(parsed.account)
      :'NAME:'+norm(parsed.name||file.name));
  return parsed;
}

function unresolvedGroups(){
  var map={};
  staging.forEach(function(s){
    if(s.personId) return;
    var key=s.batchKey||('FILE:'+s.temp);
    if(!map[key]){
      map[key]={
        key:key,
        name:s.name||'Titular não identificado',
        account:s.account||'',
        count:0,
        suggested:s.suggestedPersonId||''
      };
    }
    map[key].count++;
    if(!map[key].suggested&&s.suggestedPersonId) map[key].suggested=s.suggestedPersonId;
  });
  return Object.keys(map).map(function(k){return map[k];});
}

function renderAssociations(){
  var wrap=document.getElementById('assoc-wrap');
  var body=document.getElementById('assoc-body');
  var groups=unresolvedGroups();

  if(!groups.length){
    wrap.style.display='none';
    body.innerHTML='';
    return false;
  }

  wrap.style.display='block';
  body.innerHTML=groups.map(function(g){
    var opts='<option value="">Selecione o CPF…</option>'+
      st.people.map(function(p){
        var sel=g.suggested===p.id?' selected':'';
        return '<option value="'+p.id+'"'+sel+'>'+esc(personLabel(p))+'</option>';
      }).join('');
    return '<tr data-assoc-key="'+esc(g.key)+'">'+
      '<td><strong>'+esc(g.name)+'</strong></td>'+
      '<td>'+(g.account?esc(g.account):'<span class="small">não encontrada</span>')+'</td>'+
      '<td class="num">'+g.count+'</td>'+
      '<td><select data-assoc-person style="min-width:260px">'+opts+'</select>'+
        (g.suggested?'<div class="small">Sugestão pelo nome do titular — confirme antes de continuar.</div>':'')+
      '</td></tr>';
  }).join('');
  return true;
}

function stageRender(){
  var w=document.getElementById('staging-wrap'),b=document.getElementById('stage-body');
  var hasAssoc=renderAssociations();

  // Enquanto houver grupos sem CPF, primeiro mostramos a associação em lote.
  w.style.display=staging.length&&!hasAssoc?'block':'none';
  if(hasAssoc){b.innerHTML='';return;}

  b.innerHTML=staging.map(function(s){
    var opts='<option value="">Selecione o CPF…</option>'+
      st.people.map(function(p){
        return'<option value="'+p.id+'"'+(s.personId===p.id?' selected':'')+'>'+esc(personLabel(p))+'</option>';
      }).join('');
    var warn=(s.warnings||[]).map(function(x){
      return'<div class="warningline">⚠ '+esc(x)+'</div>';
    }).join('');
    return'<tr data-t="'+s.temp+'">'+
      '<td><strong>'+esc(s.file)+'</strong><div class="small">'+esc(s.name||'Titular não identificado')+
        (s.cpf?' • CPF '+cpfFmt(s.cpf):'')+
        (s.account?' • conta '+esc(s.account):'')+
        (s.layout==='santander-bmf-legado'?' • Nota Santander/B3 (grade fixa)':'')+
        '</div>'+
        ((s.bruto!==undefined||s.custos!==undefined||s.liquidoNota!==undefined)
          ?'<div class="small" style="margin-top:3px">Bruto '+brl(s.bruto||0)+' • Custos '+brl(s.custos||0)+' • IRRF '+brl(s.irrf||0)+' • Líquido nota '+brl(s.liquidoNota||0)+'</div>'
          :'')+warn+'</td>'+
      '<td><select data-f="personId" style="min-width:220px">'+opts+'</select></td>'+
      '<td><input data-f="date" type="date" value="'+(s.date||'')+'"></td>'+
      '<td><select data-f="cat"><option value="acoes"'+(s.cat==='acoes'?' selected':'')+'>Ações</option>'+
        '<option value="futuros"'+(s.cat==='futuros'?' selected':'')+'>Futuros</option></select></td>'+
      '<td><input data-f="result" type="number" step="0.01" value="'+(s.result===undefined?'':s.result)+'" style="width:110px"></td>'+
      '<td><input data-f="irrf" type="number" step="0.01" value="'+(s.irrf===undefined?'':s.irrf)+'" style="width:90px"></td>'+
      '<td><input data-f="ref" value="'+esc(s.ref||'')+'" style="min-width:140px"></td>'+
      '<td><button class="danger" data-stage-rm="'+s.temp+'">Remover</button></td></tr>';
  }).join('');
}

// Events
var pc=document.getElementById('p-cpf');pc.addEventListener('input',function(){this.value=cpfFmt(this.value)});
function resetPersonForm(){
  document.getElementById('p-edit-id').value='';
  document.getElementById('person-form').reset();
  document.getElementById('person-submit').textContent='Cadastrar';
  document.getElementById('person-cancel').style.display='none';
}
function openPeopleModal(){
  renderPeople();
  document.getElementById('people-msg').textContent='';
  document.getElementById('people-modal').style.display='block';
  document.body.style.overflow='hidden';
}
function closePeopleModal(){
  document.getElementById('people-modal').style.display='none';
  document.body.style.overflow='';
  resetPersonForm();
}

document.getElementById('manage-people').addEventListener('click',openPeopleModal);
document.getElementById('people-close').addEventListener('click',closePeopleModal);
document.getElementById('person-cancel').addEventListener('click',function(){
  resetPersonForm();
  document.getElementById('people-msg').textContent='';
});
document.getElementById('people-modal').addEventListener('click',function(ev){
  if(ev.target===this)closePeopleModal();
});
document.addEventListener('keydown',function(ev){
  if(ev.key==='Escape'&&document.getElementById('people-modal').style.display==='block')closePeopleModal();
});

document.getElementById('person-form').addEventListener('submit',function(ev){
  ev.preventDefault();

  var name=document.getElementById('p-name').value.trim();
  var cpf=digits(document.getElementById('p-cpf').value);
  var editId=document.getElementById('p-edit-id').value;
  var msg=document.getElementById('people-msg');

  if(!name||!cpfOk(cpf)){
    msg.className='status err';
    msg.textContent='CPF inválido.';
    return;
  }

  var sameCpf=st.people.find(function(p){return digits(p.cpf)===cpf&&p.id!==editId});
  if(sameCpf){
    msg.className='status err';
    msg.textContent='Este CPF já está cadastrado para '+sameCpf.name+'.';
    return;
  }

  if(editId){
    var existing=person(editId);
    if(!existing)return;
    existing.name=name;
    existing.cpf=cpf;
    st.active=existing.id;
  }else{
    var ex=st.people.find(function(p){return digits(p.cpf)===cpf});
    if(ex){
      ex.name=name;
      st.active=ex.id;
    }else{
      var byName=st.people.find(function(p){return norm(p.name)===norm(name)&&!p.cpf});
      if(byName){
        byName.cpf=cpf;
        st.active=byName.id;
      }else{
        var p={id:id(),name:name,cpf:cpf,accounts:[]};
        st.people.push(p);
        st.active=p.id;
      }
    }
  }

  save();
  render();
  resetPersonForm();
  renderPeople();
  msg.className='status';
  msg.textContent=editId?'Contribuinte atualizado.':'Contribuinte cadastrado.';
});

document.getElementById('people-body').addEventListener('click',function(ev){
  var u=ev.target.closest('[data-use]');
  var r=ev.target.closest('[data-rm]');
  var ed=ev.target.closest('[data-edit-person]');

  if(u){
    st.active=u.dataset.use;
    save();
    render();
    renderPeople();
    return;
  }

  if(ed){
    var p=person(ed.getAttribute('data-edit-person'));
    if(!p)return;
    document.getElementById('p-edit-id').value=p.id;
    document.getElementById('p-name').value=p.name||'';
    document.getElementById('p-cpf').value=cpfFmt(p.cpf||'');
    document.getElementById('person-submit').textContent='Salvar alteração';
    document.getElementById('person-cancel').style.display='';
    document.getElementById('people-msg').textContent='';
    document.getElementById('p-name').focus();
    return;
  }

  if(r){
    
    var pid=r.dataset.rm;
    var used=st.entries.some(function(e){return e.personId===pid})||(st.cashMoves||[]).some(function(m){return m.personId===pid});
    if(used){
      document.getElementById('people-msg').className='status err';
      document.getElementById('people-msg').textContent='Não é possível remover um contribuinte que possui lançamentos ou movimentos de conta.';
      return;
    }
    st.people=st.people.filter(function(p){return p.id!==pid});
    if(st.active===pid)st.active=st.people[0]?st.people[0].id:'';
    save();
    render();
    renderPeople();
  }
});
document.getElementById('active-person').addEventListener('change',function(){st.active=this.value;save();render()});
document.getElementById('close-month').addEventListener('change',function(){renderClosePanel(ledger(activeEntries()))});
document.getElementById('irrf-year').addEventListener('change',function(){renderIrrfAnnual(ledger(activeEntries()))});
document.getElementById('close-toggle').addEventListener('click',function(){
  var month=document.getElementById('close-month').value;if(!month||!st.active)return;
  var k=closeKey(st.active,month);
  if(st.closed[k])delete st.closed[k];
  else{
    var r=ledger(activeEntries()).find(function(x){return x.ym===month});if(!r)return;
    st.closed[k]={closedAt:new Date().toISOString(),result:r.result,base:r.base,tax:r.tax,irrf:r.irrf,darf:r.darf,entries:monthEntries(month).length};
  }
  save();render();
});
document.getElementById('monthly-report').addEventListener('click',function(){var m=document.getElementById('close-month').value;if(m)gerarRelatorioMensal(m)});
document.getElementById('close-darf').addEventListener('click',function(){
  var month=document.getElementById('close-month').value;
  var r=ledger(activeEntries()).find(function(x){return x.ym===month});
  if(r&&r.darf>0)gerarDARF(r.key);
});
document.getElementById('close-paid').addEventListener('click',function(){
  var month=document.getElementById('close-month').value;
  var r=ledger(activeEntries()).find(function(x){return x.ym===month});
  if(!r||!(r.darf>0))return;
  st.paid[r.key]=!st.paid[r.key];
  save();
  render();
});

['flt-month','flt-cat','flt-account'].forEach(function(i){
  document.getElementById(i).addEventListener('change',renderHistory);
});
document.getElementById('flt-clear').onclick=function(){
  document.getElementById('flt-month').value='';
  document.getElementById('flt-cat').value='';
  document.getElementById('flt-account').value='';
  renderHistory();
};
var drop=document.getElementById('drop'),inp=document.getElementById('pdf-input');drop.onclick=function(){inp.click()};['dragenter','dragover'].forEach(function(e){drop.addEventListener(e,function(ev){ev.preventDefault();drop.classList.add('drag')})});['dragleave','drop'].forEach(function(e){drop.addEventListener(e,function(ev){ev.preventDefault();drop.classList.remove('drag')})});drop.addEventListener('drop',function(ev){handleFiles(ev.dataTransfer.files)});inp.addEventListener('change',function(){handleFiles(this.files);this.value='' });
async function handleFiles(fl){
  var fs=Array.from(fl||[]).filter(function(f){
    return /\.pdf$/i.test(f.name)||f.type==='application/pdf';
  });
  if(!fs.length)return;

  var stat=document.getElementById('pdf-status');
  var accepted=0, duplicated=[], failed=[];

  for(var i=0;i<fs.length;i++){
    stat.className='status';
    stat.textContent='Lendo '+fs[i].name+' ('+(i+1)+'/'+fs.length+')…';
    try{
      var p=await readPdf(fs[i]);

      // 1) Já importado anteriormente.
      var oldDup=existingPdfDuplicate(p);
      if(oldDup){
        duplicated.push(fs[i].name+' — já importado');
        continue;
      }

      // 2) Mesmo PDF repetido no lote atual ou já aguardando revisão.
      var batchDup=stagingPdfDuplicate(p);
      if(batchDup){
        duplicated.push(fs[i].name+' — duplicado neste lote');
        continue;
      }

      // 3) Se a conta já reconhece o CPF, aplica também a regra tributária
      //    de duplicidade por pessoa/ref antes de chegar à revisão.
      if(p.personId){
        var cand={
          personId:p.personId,date:p.date,cat:p.cat,result:p.result,
          irrf:p.irrf,ref:p.ref,account:p.account
        };
        if(duplicate(cand,null)){
          duplicated.push(fs[i].name+' — lançamento já existente');
          continue;
        }
      }

      staging.push(p);
      accepted++;
    }catch(e){
      failed.push({
        file:fs[i].name,
        error:(e&&e.message)?e.message:String(e||'erro desconhecido')
      });
    }
  }

  stageRender();
  var groups=unresolvedGroups();
  var msgs=[];

  if(accepted){
    if(groups.length){
      msgs.push(accepted+' PDF(s) novo(s) lido(s). Faça '+groups.length+
        ' associação(ões) de conta/titular ao CPF para continuar');
    }else{
      msgs.push(accepted+' PDF(s) novo(s) pronto(s) para revisão');
    }
  }

  if(duplicated.length){
    msgs.push(duplicated.length+' PDF(s) ignorado(s) por duplicidade: '+duplicated.join('; '));
  }
  if(failed.length){
    msgs.push(failed.length+' PDF(s) não puderam ser lido(s): '+
      failed.map(function(f){return f.file+' — '+f.error;}).join('; '));
  }

  stat.className='status'+(accepted===0&&(duplicated.length||failed.length)?' err':'');
  stat.textContent=msgs.length?msgs.join('. ')+'.':'Nenhum PDF novo para importar.';
}

document.getElementById('assoc-confirm').addEventListener('click',function(){
  
  var rows=Array.from(document.querySelectorAll('#assoc-body tr[data-assoc-key]'));
  var missing=false;

  rows.forEach(function(row){
    var key=row.getAttribute('data-assoc-key');
    var pid=row.querySelector('[data-assoc-person]').value;
    if(!pid){missing=true;return;}

    staging.forEach(function(s){
      if(s.batchKey===key&&!s.personId){
        s.personId=pid;
        if(s.account) link(pid,s.account);
      }
    });
  });

  if(missing){
    document.getElementById('pdf-status').textContent='Selecione um CPF para cada grupo antes de confirmar.';
    document.getElementById('pdf-status').className='status err';
    return;
  }

  // Depois de definir o CPF, faz nova checagem. Isso cobre notas sem
  // vínculo prévio de conta que só puderam ser identificadas agora.
  var kept=[], dupAfterAssoc=[];
  staging.forEach(function(s){
    var x={
      personId:s.personId,date:s.date,cat:s.cat,result:s.result,
      irrf:s.irrf,ref:s.ref,account:s.account
    };
    if(s.personId && duplicate(x,null)){
      dupAfterAssoc.push(s.file||s.ref||'PDF');
    }else{
      kept.push(s);
    }
  });
  staging=kept;

  document.getElementById('pdf-status').className='status';
  save();
  stageRender();

  if(dupAfterAssoc.length){
    document.getElementById('pdf-status').textContent=
      'Associações confirmadas. '+dupAfterAssoc.length+
      ' PDF(s) já importado(s) foram ignorados: '+dupAfterAssoc.join('; ')+
      '. Revise somente os arquivos novos.';
  }else{
    document.getElementById('pdf-status').textContent=
      'Associações confirmadas. Agora revise os valores extraídos e adicione os lançamentos.';
  }
});

document.getElementById('stage-body').addEventListener('input',function(ev){
  var f=ev.target.dataset.f;if(!f)return;
  var s=staging.find(function(x){return x.temp===ev.target.closest('tr').dataset.t});
  if(!s)return;
  s[f]=(f==='result'||f==='irrf')?(ev.target.value===''?undefined:+ev.target.value):ev.target.value;
  if(f==='personId'&&s.personId&&s.account) link(s.personId,s.account);
});document.getElementById('stage-body').addEventListener('click',function(ev){var b=ev.target.closest('[data-stage-rm]');if(b){staging=staging.filter(function(x){return x.temp!==b.dataset.stageRm});stageRender()}});document.getElementById('stage-clear').onclick=function(){staging=[];stageRender();document.getElementById('pdf-status').textContent=''};
document.getElementById('stage-commit').onclick=function(){
  
  var left=[],added=0,dups=[],closedMonths=[];
  staging.forEach(function(s){
    if(!s.personId||!s.date||s.result===undefined||isNaN(s.result)){
      left.push(s);
      return;
    }
    if(isMonthClosed(s.personId,ym(s.date))){
      var lbl=ymlabel(ym(s.date));
      if(closedMonths.indexOf(lbl)<0)closedMonths.push(lbl);
      left.push(s);return;
    }
    var x={
      id:id(),personId:s.personId,date:s.date,cat:s.cat||'futuros',
      result:+s.result,irrf:+s.irrf||0,ref:s.ref||'',
      account:s.account?('Conta '+s.account):'',origin:'pdf',
      bruto:(s.bruto===undefined?null:+s.bruto),
      custos:(s.custos===undefined?null:+s.custos),
      tributos:(s.tributos===undefined?null:+s.tributos),
      liquidoNota:(s.liquidoNota===undefined?null:+s.liquidoNota),
      cpfNota:s.cpf||'',
      layoutNota:s.layout||''
    };
    if(duplicate(x,null)||existingPdfDuplicate(x)){
      dups.push(s.file||s.ref||'PDF');
      return; // descartado: não fica mais pendente
    }
    st.entries.push(x);
    if(s.account)link(s.personId,s.account);
    added++;
  });

  staging=left;
  save();stageRender();render();

  var msg=added+' lançamento(s) adicionado(s).';
  if(dups.length) msg+=' '+dups.length+' duplicado(s) ignorado(s): '+dups.join('; ')+'.';
  if(left.length) msg+=' '+left.length+' arquivo(s) ainda precisam de revisão.';
  if(closedMonths.length) msg+=' Competência(s) fechada(s): '+closedMonths.join(', ')+' — reabra antes de importar esses PDFs.';
  document.getElementById('pdf-status').textContent=msg;
};

document.getElementById('entry-form').addEventListener('submit',function(ev){ev.preventDefault();var x={personId:document.getElementById('f-person').value,date:document.getElementById('f-date').value,cat:document.getElementById('f-cat').value,result:+document.getElementById('f-result').value,irrf:+document.getElementById('f-irrf').value||0,account:document.getElementById('f-account').value.trim(),ref:document.getElementById('f-ref').value.trim(),origin:'manual',bruto:null,custos:null,tributos:null,liquidoNota:null};if(!x.personId||!x.date||isNaN(x.result)){return}if(!ensureMonthOpen(x.personId,x.date,editing?'editar este lançamento':'adicionar este lançamento'))return;if(duplicate(x,editing)){document.getElementById('entry-msg').textContent='Possível duplicidade. Altere a referência/valores ou exclua o lançamento existente.';return}if(editing){var oldEntry=st.entries.find(function(e){return e.id===editing});if(oldEntry&&!ensureMonthOpen(oldEntry.personId,oldEntry.date,'editar este lançamento'))return;if(oldEntry){/* preserva origem e detalhamento extraído do PDF */['origin','bruto','custos','tributos','liquidoNota','cpfNota','layoutNota'].forEach(function(k){if(oldEntry[k]!==undefined)x[k]=oldEntry[k]})}var i=st.entries.findIndex(function(e){return e.id===editing});x.id=editing;if(i>=0)st.entries[i]=x;editing=null;document.getElementById('entry-btn').textContent='Adicionar'}else{x.id=id();st.entries.push(x)}var m=x.account.match(/\d{4,}/);if(m)link(x.personId,m[0]);this.reset();document.getElementById('f-person').value=st.active||x.personId;document.getElementById('entry-msg').textContent='';save();render()});
document.getElementById('history').addEventListener('click',function(ev){
  var de=ev.target.closest('[data-del]'),ed=ev.target.closest('[data-edit]');
  if(de){
    var d=st.entries.find(function(e){return e.id===de.dataset.del});if(!d)return;
    if(!ensureMonthOpen(d.personId,d.date,'excluir este lançamento'))return;
    st.entries=st.entries.filter(function(e){return e.id!==de.dataset.del});save();render();
  }
  if(ed){
    var e=st.entries.find(function(x){return x.id===ed.dataset.edit});if(!e)return;
    if(!ensureMonthOpen(e.personId,e.date,'editar este lançamento'))return;
    editing=e.id;document.getElementById('f-person').value=e.personId;document.getElementById('f-date').value=e.date;
    document.getElementById('f-cat').value=e.cat;document.getElementById('f-result').value=e.result;document.getElementById('f-irrf').value=e.irrf||'';
    document.getElementById('f-account').value=e.account||'';document.getElementById('f-ref').value=e.ref||'';document.getElementById('entry-btn').textContent='Salvar alteração';
    document.getElementById('entry-form').scrollIntoView({behavior:'smooth',block:'center'});
  }
});

function download(name,data,type){var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([data],{type:type}));a.download=name;a.click();setTimeout(function(){URL.revokeObjectURL(a.href)},500)}

// ---------------- Backup, restauração e versões internas ----------------
function backupMsg(t){document.getElementById('backup-msg').textContent=t}
// Lê um .json de backup, confirma e substitui os dados (guardando cópia antes).
function restoreFromJsonText(text,origem){
  var p=normalizeLoadedState(JSON.parse(text));
  var vazio=!st.people.length&&!st.entries.length;
  if(!vazio&&!confirm('Restaurar '+origem+'?\n\nEle tem '+p.people.length+' contribuinte(s) e '+p.entries.length+' lançamento(s) e vai SUBSTITUIR os dados atuais ('+st.people.length+' contribuinte(s), '+st.entries.length+' lançamento(s)).\n\nUma cópia dos dados atuais fica guardada nas versões internas.'))return false;
  return backupBeforeChange('antes-restauracao').then(function(){
    st=p;staging=[];editing=null;stageRender();save();render();renderSnapshots();showWelcome(false);
    return true;
  });
}
document.getElementById('backup-out').onclick=function(){
  download('calculadora-trader-backup-'+backupStamp()+'.json',JSON.stringify(st,null,2),'application/json');
};
document.getElementById('backup-in').onclick=function(){document.getElementById('backup-file').click()};
document.getElementById('backup-file').onchange=function(){
  var f=this.files[0];if(!f)return;this.value='';
  f.text().then(function(t){return restoreFromJsonText(t,'"'+f.name+'"')}).then(function(ok){
    if(ok)backupMsg('Backup restaurado. Os dados anteriores ficaram nas versões internas.');
  }).catch(function(e){backupMsg('Erro: '+e.message)});
};
document.getElementById('backup-now').onclick=function(){
  addSnapshot('manual',JSON.stringify(st,null,2)).then(function(){
    renderSnapshots();
    backupMsg('Versão salva'+(backupReady?' (também na pasta backups).':' nas versões internas.'));
  });
};
var armed=false;document.getElementById('wipe').onclick=function(){
  if(!armed){armed=true;this.textContent='Confirmar exclusão?';var b=this;setTimeout(function(){armed=false;b.textContent='Apagar lançamentos'},4000);return}
  armed=false;this.textContent='Apagar lançamentos';
  backupBeforeChange('antes-apagar').then(function(){
    st.entries=[];st.paid={};st.closed={};st.cashMoves=[];save();render();renderSnapshots();
    backupMsg('Lançamentos apagados. Os dados anteriores ficaram nas versões internas.');
  });
};
document.getElementById('folder-btn').onclick=function(){
  connectBackupFolder().then(function(ok){
    if(ok)backupMsg('Pasta conectada. Cada alteração também será gravada em '+backupHandle.name+'/dados.');
  }).catch(function(e){
    if(e&&e.name!=='AbortError')backupMsg('Não foi possível conectar a pasta: '+e.message);
  });
};
document.getElementById('folder-banner-btn').onclick=function(){document.getElementById('folder-btn').click()};
document.getElementById('folder-forget').onclick=function(){
  if(!confirm('Desconectar a pasta de backup? Os dados do app não são afetados.'))return;
  forgetBackupFolder().then(function(){backupMsg('Pasta de backup desconectada.')});
};
var SNAP_LABELS={auto:'automática',manual:'manual','antes-apagar':'antes de apagar','antes-restauracao':'antes de restaurar','antes-carregar-pasta':'antes de carregar da pasta'};
function renderSnapshots(){
  listSnapshots().then(function(list){
    var sel=document.getElementById('snap-select');
    sel.innerHTML=list.length?list.map(function(s){
      var d;try{d=JSON.parse(s.data)}catch(e){d=null}
      return'<option value="'+esc(s.id)+'">'+esc(new Date(s.createdAt).toLocaleString('pt-BR'))+' — '+esc(SNAP_LABELS[s.label]||s.label)+(d?' — '+d.entries.length+' lançamento(s)':'')+'</option>';
    }).join(''):'<option value="">Nenhuma versão ainda</option>';
    document.getElementById('snap-restore').disabled=!list.length;
  }).catch(function(){});
}
document.getElementById('snap-restore').onclick=function(){
  var sid=document.getElementById('snap-select').value;if(!sid)return;
  listSnapshots().then(function(list){
    var s=list.find(function(x){return x.id===sid});if(!s)return;
    return Promise.resolve(restoreFromJsonText(s.data,'a versão de '+new Date(s.createdAt).toLocaleString('pt-BR'))).then(function(ok){
      if(ok)backupMsg('Versão restaurada. Os dados anteriores ficaram nas versões internas.');
    });
  }).catch(function(e){backupMsg('Erro: '+e.message)});
};
window.addEventListener('beforeunload',function(ev){
  if(saveFailed||staging.length){ev.preventDefault();ev.returnValue='';}
});
['chart-day','chart-cum'].forEach(function(cid){var c=document.getElementById(cid);c.addEventListener('pointermove',function(ev){var r=c.getBoundingClientRect(),px=ev.clientX-r.left,meta=cid==='chart-day'?chartMeta.day:chartMeta.cum;if(!meta)return hideTip();var item=null;if(meta.boxes){var best=Infinity;meta.boxes.forEach(function(b){var mid=(b.x+b.x2)/2,d=Math.abs(px-mid);if(d<best){best=d;item=b}})}else if(meta.pts){var best2=Infinity;meta.pts.forEach(function(p){var d=Math.abs(px-p.x);if(d<best2){best2=d;item=p}})}if(item)tip(ev,datebr(item.date)+'<br><strong>'+brl(item.value)+'</strong>')});c.addEventListener('pointerleave',hideTip)});window.addEventListener('resize',function(){clearTimeout(window.__v3rz);window.__v3rz=setTimeout(renderHistory,120)});

// ---------------- Saldo em conta ----------------
var cashAutoValue=null; // valor sugerido que o próprio app preencheu no campo
function pctBR(v){return v==null?'—':((v>=0?'+':'')+(v*100).toFixed(2).replace('.',',')+'%')}
function renderCash(){
  var pid=st.active,body=document.getElementById('cash-body');
  if(!body)return;
  var accs=pid?cashAccounts(pid):[];
  document.getElementById('c-accounts').innerHTML=accs.map(function(a){return'<option value="'+esc(a)+'">'}).join('');
  var dateInp=document.getElementById('c-date');if(!dateInp.value)dateInp.value=iso(new Date());

  var balances=accs.map(function(a){return accountBalance(pid,a)});
  body.innerHTML=balances.length?balances.map(function(b){
    var ck=b.checkpoint;
    return'<tr><td>Conta '+esc(b.account)+'</td>'+
      '<td>'+(ck?brl(ck.amount)+' <span class="small">em '+datebr(ck.date)+'</span>':'<span class="small">não informado</span>')+'</td>'+
      '<td class="num '+(b.results<0?'neg':'pos')+'">'+brl(b.results)+' <span class="small">('+b.notes+')</span></td>'+
      '<td class="num">'+brl(b.deposits)+'</td><td class="num">'+brl(b.withdrawals)+'</td>'+
      '<td class="num"><strong>'+(b.known?brl(b.balance):'—')+'</strong></td>'+
      '<td><button type="button" class="ghost" data-cash-check="'+esc(b.account)+'">Conferir saldo</button></td></tr>';
  }).join(''):'<tr><td colspan="7" class="small" style="text-align:center;padding:18px">Nenhuma conta vinculada a este CPF. Digite o número da conta acima para começar.</td></tr>';

  var total=pid?personCashTotal(pid):null,today=iso(new Date());
  var mStart=today.slice(0,7)+'-01',yStart=today.slice(0,4)+'-01-01';
  var rm=pid?cashReturn(pid,mStart,today):null,ry=pid?cashReturn(pid,yStart,today):null;
  function box(k,v,cl,s){return'<div class="stat"><div class="k">'+k+'</div><div class="v '+(cl||'')+'">'+v+'</div><div class="s">'+s+'</div></div>'}
  document.getElementById('cash-stats').innerHTML=
    box('Saldo estimado total',total==null?'—':brl(total),'',total==null?'informe o saldo de pelo menos uma conta':'soma das contas do CPF')+
    box('Resultado no mês',rm?brl(rm.result):'—',rm&&rm.result<0?'neg':'pos',rm?pctBR(rm.pct)+' sobre '+(rm.capital?brl(rm.capital):'capital não informado'):'')+
    box('Resultado no ano',ry?brl(ry.result):'—',ry&&ry.result<0?'neg':'pos',ry?pctBR(ry.pct)+' sobre '+(ry.capital?brl(ry.capital):'capital não informado'):'')+
    box('Aportes líquidos no ano',ry?brl(ry.deposits-ry.withdrawals):'—','',ry?'depósitos '+brl(ry.deposits)+' • retiradas '+brl(ry.withdrawals):'');

  var moves=(st.cashMoves||[]).filter(function(m){return m.personId===pid}).sort(function(a,b){return b.date.localeCompare(a.date)});
  document.getElementById('cash-moves-title').textContent='Movimentos registrados ('+moves.length+')';
  document.getElementById('cash-moves').innerHTML=moves.length?moves.map(function(m){
    return'<tr><td>'+datebr(m.date)+'</td><td>Conta '+esc(m.account)+'</td><td>'+esc(CASH_TYPES[m.type]||m.type)+'</td>'+
      '<td class="num '+(m.type==='retirada'?'neg':'')+'">'+brl(m.amount)+'</td><td>'+esc(m.note||'')+'</td>'+
      '<td><button type="button" class="danger" data-cash-del="'+esc(m.id)+'">Excluir</button></td></tr>';
  }).join(''):'<tr><td colspan="6" class="small" style="text-align:center;padding:14px">Nenhum movimento.</td></tr>';
  updateCashSuggestion();
}
// Sugestão: em "Saldo conferido", preenche o saldo que o app estima para a
// conta/data e mostra a diferença quando o usuário digita o valor do extrato.
function updateCashSuggestion(){
  var hint=document.getElementById('cash-hint'),amt=document.getElementById('c-amount');
  var acc=digits(document.getElementById('c-account').value),date=document.getElementById('c-date').value,type=document.getElementById('c-type').value;
  if(type!=='saldo'||!acc||!date||!st.active){hint.textContent='';return}
  var b=accountBalance(st.active,acc,date);
  if(!b.known){hint.textContent='Primeiro saldo desta conta: informe o valor do extrato ao final de '+datebr(date)+'.';return}
  if(amt.value===''||(cashAutoValue!==null&&+amt.value===cashAutoValue)){
    amt.value=b.balance.toFixed(2);cashAutoValue=+amt.value;
  }
  var dif=round2((+amt.value||0)-b.balance);
  hint.innerHTML='Sugestão do app para a conta '+esc(acc)+' ao final de '+datebr(date)+': <strong>'+brl(b.balance)+'</strong> — confira com o extrato e corrija se preciso.'+
    (Math.abs(dif)>=0.01?' <span class="'+(dif<0?'neg':'pos')+'">Diferença: '+brl(dif)+'</span> <span class="small">(tarifas, custódia ou rendimentos fora das notas)</span>':'');
}
['c-account','c-date','c-type'].forEach(function(i){document.getElementById(i).addEventListener('change',updateCashSuggestion)});
document.getElementById('c-amount').addEventListener('input',function(){
  if(cashAutoValue!==null&&+this.value!==cashAutoValue)cashAutoValue=null;
  updateCashSuggestion();
});
document.getElementById('cash-form').addEventListener('submit',function(ev){
  ev.preventDefault();
  if(!st.active){alert('Cadastre e selecione um contribuinte primeiro.');return}
  var acc=digits(document.getElementById('c-account').value),amount=round2(+document.getElementById('c-amount').value);
  var m={id:id(),personId:st.active,account:acc,date:document.getElementById('c-date').value,
    type:document.getElementById('c-type').value,amount:amount,note:document.getElementById('c-note').value.trim()};
  if(!acc||!m.date||isNaN(amount)||amount<0){alert('Informe conta, data e valor.');return}
  if(!st.cashMoves)st.cashMoves=[];
  st.cashMoves.push(m);
  link(st.active,acc);
  document.getElementById('c-amount').value='';document.getElementById('c-note').value='';cashAutoValue=null;
  save();render();
});
document.getElementById('cash-card').addEventListener('click',function(ev){
  var ck=ev.target.closest('[data-cash-check]'),del=ev.target.closest('[data-cash-del]');
  if(ck){
    document.getElementById('c-account').value=ck.getAttribute('data-cash-check');
    document.getElementById('c-date').value=iso(new Date());
    document.getElementById('c-type').value='saldo';
    document.getElementById('c-amount').value='';cashAutoValue=null;
    updateCashSuggestion();
    var a=document.getElementById('c-amount');a.focus();a.select();
  }
  if(del){
    var mid=del.getAttribute('data-cash-del');
    if(!confirm('Excluir este movimento de conta?'))return;
    st.cashMoves=st.cashMoves.filter(function(x){return x.id!==mid});
    save();render();
  }
});
