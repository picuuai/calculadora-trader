// Estado da aplicação (contribuintes, lançamentos, pagamentos, fechamentos)
// e migrações de formato. O estado é salvo pelo storage.js.
'use strict';

var DATA_VERSION=7.0;
function stateDefault(){return{people:[],entries:[],paid:{},closed:{},active:'',version:DATA_VERSION,savedAt:''}}

var st=stateDefault(), staging=[], editing=null;

function normalizeLoadedState(x){
  if(!x||!Array.isArray(x.people)||!Array.isArray(x.entries))throw new Error('arquivo de dados inválido');
  if(!x.paid)x.paid={};
  if(!x.closed)x.closed={};
  if(!x.active&&x.people[0])x.active=x.people[0].id;
  migratePaidKeys(x);
  x.version=DATA_VERSION;
  if(!x.savedAt)x.savedAt='';
  return x;
}
// Até a v6.2 o pagamento era gravado como "AAAA-MM|daytrade" (sem CPF),
// valendo para todos os contribuintes. Agora a chave é "pid|AAAA-MM|daytrade".
// Migração: a marcação antiga passa para cada contribuinte com lançamentos no mês.
function paidKey(pid,month){return String(pid||'')+'|'+month+'|daytrade'}
function migratePaidKeys(x){
  Object.keys(x.paid).forEach(function(k){
    var m=k.match(/^(\d{4}-\d{2})\|daytrade$/);
    if(!m)return;
    if(x.paid[k]){
      x.people.forEach(function(p){
        var has=x.entries.some(function(e){return e.personId===p.id&&String(e.date||'').slice(0,7)===m[1]});
        if(has)x.paid[paidKey(p.id,m[1])]=true;
      });
    }
    delete x.paid[k];
  });
}

function person(pid){return st.people.find(function(p){return p.id===pid})||null}
function personLabel(p){return p.name+' — CPF '+cpfFmt(p.cpf)}
function activeEntries(){return st.active?st.entries.filter(function(e){return e.personId===st.active}):[]}
