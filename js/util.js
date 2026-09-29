// Utilitários gerais: formatação, CPF, datas, escape de HTML.
'use strict';
var CATS={acoes:'Ações',futuros:'Mercado futuro'};
var months=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
function id(){return 'x'+Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
function digits(s){return String(s||'').replace(/\D/g,'')}
function cpfFmt(s){var d=digits(s).slice(0,11);return d.length<=3?d:d.length<=6?d.slice(0,3)+'.'+d.slice(3):d.length<=9?d.slice(0,3)+'.'+d.slice(3,6)+'.'+d.slice(6):d.slice(0,3)+'.'+d.slice(3,6)+'.'+d.slice(6,9)+'-'+d.slice(9)}
function cpfOk(c){var s=digits(c);if(s.length!==11||/^(\d)\1{10}$/.test(s))return false;function dg(b){var z=0,w=b.length+1;for(var i=0;i<b.length;i++)z+=+b[i]*(w-i);var r=(z*10)%11;return r===10?0:r}return dg(s.slice(0,9))===+s[9]&&dg(s.slice(0,10))===+s[10]}
function norm(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toUpperCase()}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function brl(n){return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n)||0)}
function short(n){var a=Math.abs(n),sg=n<0?'-':'';return sg+'R$'+(a>=1000?(a/1000).toFixed(1).replace('.',',')+'k':Math.round(a))}
function ym(d){return d.slice(0,7)} function ymlabel(x){var p=x.split('-');return months[+p[1]-1]+'/'+p[0]}
function datebr(s){if(!s)return'—';var p=s.split('-');return p[2]+'/'+p[1]+'/'+p[0]}
function iso(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function round2(v){return Math.round(v*100)/100}
function entryAccountDigits(e){
  var raw=String(e.account||'');
  var m=raw.match(/\d{3,}/);
  return m?digits(m[0]):'';
}
