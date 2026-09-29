// Regras fiscais de day trade: vencimento do DARF, apuração mensal (ledger),
// fechamento de competência e painel de inconsistências.
// Depende de: util.js, state.js (variável global st).
'use strict';

// ---- Vencimento: último dia útil do mês seguinte à competência ----
function easter(y){var a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),mo=Math.floor((h+l-7*m+114)/31),da=((h+l-7*m+114)%31)+1;return new Date(y,mo-1,da)}
function nonbiz(d){if(d.getDay()===0||d.getDay()===6)return true;var md=String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');if(['01-01','04-21','05-01','09-07','10-12','11-02','11-15','11-20','12-25','12-31'].indexOf(md)>=0)return true;var e=easter(d.getFullYear()),gf=new Date(e),co=new Date(e),c1=new Date(e),c2=new Date(e);gf.setDate(e.getDate()-2);co.setDate(e.getDate()+60);c1.setDate(e.getDate()-48);c2.setDate(e.getDate()-47);/* c1/c2 = segunda e terça de Carnaval (sem expediente bancário) */return iso(d)===iso(gf)||iso(d)===iso(co)||iso(d)===iso(c1)||iso(d)===iso(c2)}
function due(x){var p=x.split('-'),y=+p[0],m=+p[1]+1;if(m>12){m=1;y++}var d=new Date(y,m,0);while(nonbiz(d))d.setDate(d.getDate()-1);return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear()}

function dueDate(x){var p=due(x).split('/');return new Date(+p[2],+p[1]-1,+p[0])}

// DARFs em aberto de todos os contribuintes que vencem em até `days` dias
// (ou já venceram). today é opcional (testes).
function dueAlerts(today,days){
  today=today||new Date();days=days==null?7:days;
  var t0=new Date(today.getFullYear(),today.getMonth(),today.getDate());
  var out=[];
  st.people.forEach(function(p){
    var es=st.entries.filter(function(e){return e.personId===p.id});
    ledger(es,st.paid,p.id).forEach(function(r){
      if(!(r.darf>0)||r.paid)return;
      var d=dueDate(r.ym),left=Math.round((d-t0)/86400000);
      if(left<=days)out.push({person:p,ym:r.ym,darf:r.darf,due:due(r.ym),daysLeft:left});
    });
  });
  return out.sort(function(a,b){return a.daysLeft-b.daysLeft});
}

// ---- Apuração mensal ----
// Day trade de ações e futuros forma um único resultado mensal (prejuízo de
// day trade compensa lucro de day trade em qualquer mercado). Regras:
//  - alíquota de 20% sobre a base (resultado - prejuízo acumulado);
//  - IRRF de day trade vira crédito, abatido do imposto no mesmo ano-calendário
//    (zerado na virada do ano para o cálculo automático);
//  - DARF abaixo de R$ 10,00 é acumulado para o mês seguinte.
// paid/pid são opcionais (padrão: estado atual) para permitir testes isolados.
function ledger(entries,paid,pid){
  if(paid===undefined)paid=st.paid||{};
  if(pid===undefined)pid=st.active;
  var bm={};
  entries.slice().sort(function(a,b){return a.date.localeCompare(b.date)}).forEach(function(e){
    var k=ym(e.date);
    if(!bm[k])bm[k]={result:0,irrf:0,acoes:0,futuros:0};
    bm[k].result+=+e.result||0;
    bm[k].irrf+=+e.irrf||0;
    bm[k][e.cat==='acoes'?'acoes':'futuros']+=+e.result||0;
  });
  var loss=0,credit=0,small=0,creditYear=null,rows=[];
  Object.keys(bm).sort().forEach(function(k){
    var yr=k.slice(0,4);
    if(creditYear!==null&&yr!==creditYear)credit=0;
    creditYear=yr;
    var a=bm[k],r=round2(a.result),ir=round2(a.irrf),usedLoss=0,base=0,tax=0,darf=0,creditUsed=0;
    credit=round2(credit+ir);
    if(r>0){
      usedLoss=Math.min(loss,r);
      base=round2(r-usedLoss);
      loss=round2(loss-usedLoss);
      tax=Math.round(base*20)/100;
      var use=Math.min(credit,tax);
      creditUsed=round2(use);
      credit=round2(credit-use);
      darf=round2(tax-use);
    }else if(r<0){
      loss=round2(loss+Math.abs(r));
    }
    var total=round2(small+darf),below=false;
    if(total>0&&total<10){small=total;darf=0;below=true}
    else{darf=total;small=0}
    var key=paidKey(pid,k);
    rows.push({ym:k,result:r,irrf:ir,acoes:round2(a.acoes),futuros:round2(a.futuros),
      usedLoss:usedLoss,base:base,tax:tax,darf:darf,below:below,loss:loss,credit:credit,
      creditUsed:creditUsed,paid:!!paid[key],key:key});
  });
  return rows;
}

// ---- Fechamento de competência e conferências ----
function closeKey(pid,month){return String(pid||'')+'|'+String(month||'')}
function isMonthClosed(pid,month){return !!(st.closed&&st.closed[closeKey(pid,month)])}
function closedInfo(pid,month){return st.closed?st.closed[closeKey(pid,month)]||null:null}
function ensureMonthOpen(pid,date,action){
  if(!pid||!date)return true;
  var m=ym(date);
  if(isMonthClosed(pid,m)){
    alert('A competência '+ymlabel(m)+' está fechada. Reabra a competência antes de '+(action||'alterar lançamentos')+'.');
    return false;
  }
  return true;
}
function monthEntries(month){return activeEntries().filter(function(e){return ym(e.date)===month})}
function accountName(e){return String(e.account||'').trim()||'Sem conta informada'}
function accountSummary(month){
  var map={};
  monthEntries(month).forEach(function(e){
    var a=accountName(e);
    if(!map[a])map[a]={account:a,count:0,bruto:0,custos:0,result:0,irrf:0,liquidoNota:0,hasDetalhe:false};
    map[a].count++;
    map[a].result+=+e.result||0;
    map[a].irrf+=+e.irrf||0;
    if(e.bruto!=null){map[a].bruto+=+e.bruto||0;map[a].hasDetalhe=true}
    if(e.custos!=null){map[a].custos+=+e.custos||0;map[a].hasDetalhe=true}
    if(e.liquidoNota!=null){map[a].liquidoNota+=+e.liquidoNota||0;map[a].hasDetalhe=true}
  });
  return Object.keys(map).sort().map(function(k){
    var x=map[k];
    ['bruto','custos','result','irrf','liquidoNota'].forEach(function(f){x[f]=Math.round(x[f]*100)/100});
    return x;
  });
}
function collectIssues(){
  var issues=[],p=person(st.active);
  if(!p)return[{level:'warn',text:'Nenhum contribuinte selecionado.'}];
  if(!cpfOk(p.cpf))issues.push({level:'bad',text:'CPF do contribuinte inválido ou incompleto.'});
  var seen={};
  activeEntries().forEach(function(e){
    var label=datebr(e.date)+' — '+(e.ref||'sem referência');
    if(!e.ref)issues.push({level:'warn',text:label+': lançamento sem referência da nota/comprovante.'});
    if(!String(e.account||'').trim())issues.push({level:'warn',text:label+': corretora/conta não informada.'});
    if((+e.irrf||0)<0)issues.push({level:'bad',text:label+': IRRF negativo; confira o sinal.'});
    var ad=entryAccountDigits(e);
    if(ad&&p.accounts&&!p.accounts.some(function(a){return digits(a)===ad;}))
      issues.push({level:'warn',text:label+': conta '+ad+' aparece no lançamento, mas não está vinculada ao CPF.'});
    var fp=(e.ref?norm(e.ref):'')+'|'+e.date+'|'+ad;
    if(e.ref&&seen[fp])issues.push({level:'bad',text:label+': possível referência duplicada no histórico.'});
    if(e.ref)seen[fp]=true;
  });
  ledger(activeEntries()).forEach(function(r){
    var d=closedDivergence(st.active,r);
    if(d)issues.push({level:'bad',text:'Competência '+ymlabel(r.ym)+' fechada com DARF '+brl(d.closedDarf)+' (base '+brl(d.closedBase)+'), mas o recálculo atual dá DARF '+brl(r.darf)+' (base '+brl(r.base)+'). Houve alteração em lançamentos (deste mês ou de meses anteriores) depois do fechamento — confira e, se estiver correto, reabra e feche novamente.'});
  });
  return issues;
}
// Compara o retrato gravado no fechamento com o recálculo atual.
// Mudanças em meses anteriores (prejuízo/IRRF acumulados) alteram meses já fechados.
function closedDivergence(pid,r){
  var c=closedInfo(pid,r.ym);
  if(!c)return null;
  var dif=function(a,b){return Math.abs((+a||0)-(+b||0))>0.009};
  if(dif(c.darf,r.darf)||dif(c.base,r.base)||dif(c.result,r.result)||dif(c.irrf,r.irrf))
    return{closedDarf:+c.darf||0,closedBase:+c.base||0};
  return null;
}