// Saldo em conta por corretora/conta (financeiro real), separado da apuração fiscal.
//
// Movimentos (st.cashMoves): {id, personId, account (dígitos), date, type, amount, note}
//   type 'saldo'    → saldo conferido no extrato AO FINAL do dia `date` (ponto de partida)
//   type 'deposito' → dinheiro que entrou na corretora
//   type 'retirada' → dinheiro que saiu da corretora
// Saldo estimado = último saldo conferido + resultados financeiros das notas
//                  + depósitos − retiradas (tudo DEPOIS da data do saldo conferido).
// Sem saldo conferido, parte de zero considerando todo o histórico da conta.
// O DARF é pago pelo banco, portanto não altera o saldo da corretora.
// Depende de: util.js, state.js.
'use strict';

var CASH_TYPES={saldo:'Saldo conferido',deposito:'Depósito',retirada:'Retirada'};

// Efeito de um lançamento no caixa da corretora: líquido da nota (já sem IRRF);
// para lançamentos manuais, resultado − IRRF.
function entryCash(e){
  return e.liquidoNota!=null?+e.liquidoNota||0:round2((+e.result||0)-(+e.irrf||0));
}
function cashMovesOf(pid){return(st.cashMoves||[]).filter(function(m){return m.personId===pid})}

// Contas do CPF: vinculadas no cadastro, presentes nos lançamentos ou nos movimentos.
function cashAccounts(pid){
  var out=[],add=function(a){a=digits(a);if(a&&out.indexOf(a)<0)out.push(a)};
  var p=person(pid);if(p)(p.accounts||[]).forEach(add);
  st.entries.forEach(function(e){if(e.personId===pid)add(entryAccountDigits(e))});
  cashMovesOf(pid).forEach(function(m){add(m.account)});
  return out.sort();
}

// Saldo de uma conta ao final do dia asOf (AAAA-MM-DD; padrão: hoje).
function accountBalance(pid,acc,asOf){
  asOf=asOf||iso(new Date());
  var moves=cashMovesOf(pid).filter(function(m){return m.account===acc&&m.date<=asOf});
  var cks=moves.filter(function(m){return m.type==='saldo'}).sort(function(a,b){return a.date.localeCompare(b.date)||String(a.id).localeCompare(String(b.id))});
  var ck=cks[cks.length-1]||null;
  var from=ck?ck.date:'';
  var results=0,deposits=0,withdrawals=0,notes=0;
  st.entries.forEach(function(e){
    if(e.personId!==pid||entryAccountDigits(e)!==acc||e.date<=from||e.date>asOf)return;
    results+=entryCash(e);notes++;
  });
  moves.forEach(function(m){
    if(m.date<=from)return;
    if(m.type==='deposito')deposits+=+m.amount||0;
    else if(m.type==='retirada')withdrawals+=+m.amount||0;
  });
  var base=ck?+ck.amount||0:0;
  return{
    account:acc,known:!!ck||deposits>0,checkpoint:ck,
    results:round2(results),notes:notes,deposits:round2(deposits),withdrawals:round2(withdrawals),
    balance:round2(base+results+deposits-withdrawals)
  };
}

function lastDayBefore(isoDate){
  var p=isoDate.split('-'),d=new Date(+p[0],+p[1]-1,+p[2]);d.setDate(d.getDate()-1);return iso(d);
}

// Rentabilidade do período [start,end]: resultado financeiro das notas dividido
// pelo capital (saldo no dia anterior ao início + depósitos do período).
// Conta que só passou a ter saldo conferido DENTRO do período: esse primeiro
// saldo vira o capital inicial dela, e só conta o que veio depois dele.
function cashReturn(pid,start,end){
  var accs=cashAccounts(pid),before=lastDayBefore(start),capital=0,result=0,deposits=0,withdrawals=0,known=false;
  var cutoff={}; // conta → data a partir da qual (exclusive) contam notas/movimentos
  accs.forEach(function(a){
    var b0=accountBalance(pid,a,before);
    if(b0.known){capital+=b0.balance;known=true;return}
    var ck=cashMovesOf(pid).filter(function(m){return m.account===a&&m.type==='saldo'&&m.date>=start&&m.date<=end})
      .sort(function(x,y){return x.date.localeCompare(y.date)})[0];
    if(ck){capital+=+ck.amount||0;known=true;cutoff[a]=ck.date}
  });
  var inRange=function(acc,date){return date>=start&&date<=end&&!(cutoff[acc]&&date<=cutoff[acc])};
  cashMovesOf(pid).forEach(function(m){
    if(!inRange(m.account,m.date))return;
    if(m.type==='deposito'){deposits+=+m.amount||0;known=true}
    else if(m.type==='retirada')withdrawals+=+m.amount||0;
  });
  st.entries.forEach(function(e){
    if(e.personId===pid&&inRange(entryAccountDigits(e),e.date))result+=entryCash(e);
  });
  capital=round2(capital+deposits);
  return{result:round2(result),capital:capital,deposits:round2(deposits),withdrawals:round2(withdrawals),
    pct:(known&&capital>0)?result/capital:null};
}

// Extrato do mês (AAAA-MM) de uma conta:
//   saldo anterior + bruto das notas − despesas − IRRF + depósitos − retiradas
//   (+ ajuste do extrato) = saldo final.
// Saldo anterior = saldo ao final do mês anterior. Conta cujo primeiro saldo
// conferido está DENTRO do mês: ele vira o saldo inicial e só conta o que veio depois.
// Ajuste do extrato = diferença entre os saldos conferidos no mês e o que as
// notas/movimentos davam (depósito ou retirada não registrados, tarifas, etc.).
// bruto/custos/irrf vêm com sinal (despesas e IRRF negativos), então a soma fecha.
function accountStatement(pid,acc,month){
  var p=month.split('-'),start=month+'-01',end=iso(new Date(+p[0],+p[1],0));
  var b0=accountBalance(pid,acc,lastDayBefore(start)),known=b0.known,opening=known?b0.balance:0,from='';
  if(!known){
    var first=cashMovesOf(pid).filter(function(m){return m.account===acc&&m.type==='saldo'&&m.date>=start&&m.date<=end})
      .sort(function(x,y){return x.date.localeCompare(y.date)})[0];
    if(first){opening=+first.amount||0;from=first.date;known=true}
  }
  var inRange=function(d){return d>=start&&d<=end&&d>from};
  var bruto=0,custos=0,irrf=0,deposits=0,withdrawals=0,notes=0;
  st.entries.forEach(function(e){
    if(e.personId!==pid||entryAccountDigits(e)!==acc||!inRange(e.date))return;
    // Sem detalhamento (lançamento manual): o resultado entra como bruto.
    var b=e.bruto!=null?+e.bruto||0:+e.result||0,c=e.custos!=null?+e.custos||0:0;
    bruto+=b;custos+=c;irrf+=entryCash(e)-b-c;notes++;
  });
  cashMovesOf(pid).forEach(function(m){
    if(m.account!==acc||!inRange(m.date))return;
    if(m.type==='deposito')deposits+=+m.amount||0;
    else if(m.type==='retirada')withdrawals+=+m.amount||0;
  });
  var computed=round2(opening+bruto+custos+irrf+deposits-withdrawals);
  var closing=known?accountBalance(pid,acc,end).balance:computed;
  return{account:acc,month:month,known:known,opening:round2(opening),openingDate:from,
    bruto:round2(bruto),custos:round2(custos),irrf:round2(irrf),notes:notes,
    deposits:round2(deposits),withdrawals:round2(withdrawals),
    adjust:round2(closing-computed),closing:closing};
}

function personCashTotal(pid){
  var total=0,known=false;
  cashAccounts(pid).forEach(function(a){var b=accountBalance(pid,a);if(b.known){total+=b.balance;known=true}});
  return known?round2(total):null;
}
