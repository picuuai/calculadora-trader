// Painel de desempenho: estatísticas por pregão (dia operado) a partir dos
// lançamentos filtrados no histórico. Não interfere na apuração fiscal.
// Depende de: util.js.
'use strict';

var WEEKDAYS=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

// Cálculo puro (testável). list = lançamentos; um "pregão" soma os
// lançamentos da mesma data (várias contas/mercados no mesmo dia).
function computePerformance(list){
  var byDay={},bruto=0,custos=0,detail=0;
  list.forEach(function(e){
    byDay[e.date]=(byDay[e.date]||0)+(+e.result||0);
    if(e.bruto!=null&&e.custos!=null){bruto+=+e.bruto||0;custos+=+e.custos||0;detail++}
  });
  var days=Object.keys(byDay).sort().map(function(d){return{date:d,value:round2(byDay[d])}});
  var wins=days.filter(function(d){return d.value>0}),losses=days.filter(function(d){return d.value<0});
  var sum=function(a){return round2(a.reduce(function(s,d){return s+d.value},0))};
  var gain=sum(wins),loss=sum(losses);
  var avgWin=wins.length?round2(gain/wins.length):0,avgLoss=losses.length?round2(loss/losses.length):0;

  // Drawdown máximo: maior queda do resultado acumulado desde um pico.
  var cum=0,peak=0,peakDate=null,maxDD=0,ddFrom=null,ddTo=null;
  days.forEach(function(d){
    cum=round2(cum+d.value);
    if(cum>peak){peak=cum;peakDate=d.date}
    if(peak-cum>maxDD){maxDD=round2(peak-cum);ddFrom=peakDate;ddTo=d.date}
  });

  // Sequências: dias com resultado zero interrompem as duas.
  var bestW=0,bestL=0,curW=0,curL=0;
  days.forEach(function(d){
    if(d.value>0){curW++;curL=0}else if(d.value<0){curL++;curW=0}else{curW=0;curL=0}
    bestW=Math.max(bestW,curW);bestL=Math.max(bestL,curL);
  });

  var best=days.reduce(function(b,d){return!b||d.value>b.value?d:b},null);
  var worst=days.reduce(function(b,d){return!b||d.value<b.value?d:b},null);

  var week=[1,2,3,4,5].map(function(w){return{wd:w,label:WEEKDAYS[w],days:0,wins:0,total:0}});
  days.forEach(function(d){
    var p=d.date.split('-'),wd=new Date(+p[0],+p[1]-1,+p[2]).getDay();
    var row=week.find(function(r){return r.wd===wd});if(!row)return;
    row.days++;row.total=round2(row.total+d.value);if(d.value>0)row.wins++;
  });

  return{
    days:days.length,wins:wins.length,losses:losses.length,
    winRate:days.length?wins.length/days.length:0,
    total:sum(days),gain:gain,loss:loss,avgWin:avgWin,avgLoss:avgLoss,
    payoff:avgLoss?round2(avgWin/Math.abs(avgLoss)):null,
    profitFactor:loss?round2(gain/Math.abs(loss)):null,
    maxDrawdown:maxDD,ddFrom:ddFrom,ddTo:ddTo,
    bestStreak:bestW,worstStreak:bestL,best:best,worst:worst,
    bruto:round2(bruto),custos:round2(custos),detailEntries:detail,
    week:week
  };
}

function pct(v){return(v*100).toFixed(1).replace('.',',')+'%'}
function ratio(v){return v==null?'—':v.toFixed(2).replace('.',',')}

function renderPerformance(list){
  var el=document.getElementById('perf-stats'),wk=document.getElementById('perf-week');
  if(!el)return;
  var p=computePerformance(list);
  if(!p.days){
    el.innerHTML='<div class="stat" style="grid-column:1/-1"><div class="s">Sem pregões neste filtro.</div></div>';
    wk.innerHTML='';return;
  }
  function box(k,v,cl,s){return'<div class="stat"><div class="k">'+k+'</div><div class="v '+(cl||'')+'">'+v+'</div><div class="s">'+(s||'')+'</div></div>'}
  el.innerHTML=
    box('Taxa de acerto',pct(p.winRate),'',p.wins+' dia(s) com lucro • '+p.losses+' com prejuízo • '+p.days+' pregões')+
    box('Payoff',ratio(p.payoff),'','ganho médio '+brl(p.avgWin)+' • perda média '+brl(p.avgLoss))+
    box('Fator de lucro',ratio(p.profitFactor),p.profitFactor==null?'':(p.profitFactor>=1?'pos':'neg'),'ganhos '+brl(p.gain)+' ÷ perdas '+brl(Math.abs(p.loss)))+
    box('Resultado líquido',brl(p.total),p.total<0?'neg':'pos','média por pregão '+brl(p.total/p.days))+
    box('Drawdown máximo',brl(-p.maxDrawdown),p.maxDrawdown?'neg':'',p.maxDrawdown?'de '+datebr(p.ddFrom||p.ddTo)+' até '+datebr(p.ddTo):'sem queda desde o início')+
    box('Melhor / pior dia',brl(p.best.value)+' / '+brl(p.worst.value),'',datebr(p.best.date)+' • '+datebr(p.worst.date))+
    box('Sequências máximas',p.bestStreak+' / '+p.worstStreak,'','dias seguidos com lucro / com prejuízo')+
    box('Custos operacionais',p.detailEntries?brl(p.custos):'—',p.detailEntries?'neg':'',p.detailEntries
      ?'bruto '+brl(p.bruto)+' • média '+brl(p.custos/p.detailEntries)+' por nota'
      :'só disponível para notas importadas de PDF');
  var maxAbs=Math.max.apply(null,p.week.map(function(r){return Math.abs(r.total)}).concat(1));
  wk.innerHTML=p.week.map(function(r){
    var w=Math.round(Math.abs(r.total)/maxAbs*100);
    return'<tr><td>'+r.label+'</td><td class="num">'+r.days+'</td><td class="num">'+(r.days?pct(r.wins/r.days):'—')+'</td>'+
      '<td class="num '+(r.total<0?'neg':(r.total>0?'pos':''))+'">'+brl(r.total)+'</td>'+
      '<td style="width:40%"><div style="height:8px;border-radius:4px;width:'+w+'%;background:'+(r.total<0?'var(--critical)':'var(--good)')+'"></div></td></tr>';
  }).join('');
}
