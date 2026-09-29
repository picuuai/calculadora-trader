// Gráficos de resultado diário e acumulado (canvas) + tooltip.
'use strict';

function colors(){var s=getComputedStyle(document.documentElement);return{good:s.getPropertyValue('--good').trim(),bad:s.getPropertyValue('--critical').trim(),accent:s.getPropertyValue('--accent').trim(),line:s.getPropertyValue('--line').trim(),muted:s.getPropertyValue('--ink-muted').trim(),ink:s.getPropertyValue('--ink').trim(),paper:s.getPropertyValue('--paper-raised').trim()}}
function canvas(c){var r=c.getBoundingClientRect(),d=devicePixelRatio||1,h=285;c.width=Math.max(1,Math.round(r.width*d));c.height=Math.round(h*d);var x=c.getContext('2d');x.setTransform(d,0,0,d,0,0);return{x:x,w:r.width,h:h}}
function daily(list){var o={};list.forEach(function(e){o[e.date]=(o[e.date]||0)+(+e.result||0)});var k=Object.keys(o).sort();return{k:k,v:k.map(function(x){return o[x]})}}
var chartMeta={day:null,cum:null};
function drawCharts(list){drawDay(list);drawCum(list)}
function drawDay(list){
  var c=document.getElementById('chart-day'),z=canvas(c),x=z.x,w=z.w,h=z.h,co=colors(),d=daily(list);
  x.clearRect(0,0,w,h);
  if(!d.k.length){
    x.fillStyle=co.muted;x.textAlign='center';x.font='12px Segoe UI';
    x.fillText('Sem dados',w/2,h/2);chartMeta.day=null;return;
  }
  var p={l:70,r:12,t:34,b:72},pw=w-p.l-p.r,ph=h-p.t-p.b,mid=p.t+ph/2;
  var max=Math.max(1,Math.max.apply(null,d.v.map(Math.abs)));
  var scale=(ph/2-24)/max,slot=pw/d.v.length,bw=Math.max(3,Math.min(26,slot*.62));

  [max,max/2,0,-max/2,-max].forEach(function(v){
    var yy=mid-(v*scale);
    x.strokeStyle=co.line;x.globalAlpha=(v===0?1:.55);x.lineWidth=(v===0?1.2:1);
    x.beginPath();x.moveTo(p.l,yy+.5);x.lineTo(p.l+pw,yy+.5);x.stroke();
    x.globalAlpha=1;x.fillStyle=co.muted;x.font='9px Segoe UI';x.textAlign='right';
    x.fillText(short(v),p.l-9,yy+3);
  });

  x.strokeStyle=co.line;x.globalAlpha=.8;
  x.beginPath();x.moveTo(p.l+.5,p.t);x.lineTo(p.l+.5,p.t+ph);x.stroke();
  x.globalAlpha=1;

  var boxes=[];
  d.v.forEach(function(v,i){
    var bx=p.l+slot*i+(slot-bw)/2,bh=Math.max(1,Math.abs(v)*scale),by=v>=0?mid-bh:mid;
    x.fillStyle=v>=0?co.good:co.bad;x.fillRect(bx,by,bw,bh);
    x.fillStyle=v>=0?co.good:co.bad;x.font=(d.v.length<=18?'9':'8')+'px Segoe UI';x.textAlign='center';
    x.fillText(short(v),bx+bw/2,v>=0?Math.max(12,by-6):Math.min(p.t+ph+15,by+bh+12));

    var q=d.k[i].split('-');
    x.save();x.translate(bx+bw/2,p.t+ph+52);x.rotate(-Math.PI/4);
    x.fillStyle=co.muted;x.font='9px Segoe UI';x.textAlign='right';x.fillText(q[2]+'/'+q[1],0,0);x.restore();

    boxes.push({x:bx,x2:bx+bw,date:d.k[i],value:v});
  });
  chartMeta.day={boxes:boxes};
}
function drawCum(list){var c=document.getElementById('chart-cum'),z=canvas(c),x=z.x,w=z.w,h=z.h,co=colors(),d=daily(list);x.clearRect(0,0,w,h);if(!d.k.length){x.fillStyle=co.muted;x.textAlign='center';x.fillText('Sem dados',w/2,h/2);chartMeta.cum=null;return}var vals=[],a=0;d.v.forEach(function(v){a+=v;vals.push(a)});var p={l:54,r:12,t:32,b:72},pw=w-p.l-p.r,ph=h-p.t-p.b,min=Math.min.apply(null,vals.concat(0)),max=Math.max.apply(null,vals.concat(0)),rg=max-min||1,pad=rg*.08||1;min-=pad;max+=pad;rg=max-min;var xx=function(i){return p.l+(vals.length>1?pw*i/(vals.length-1):pw/2)},yy=function(v){return p.t+ph-(v-min)/rg*ph};if(min<0&&max>0){x.strokeStyle=co.line;x.beginPath();x.moveTo(p.l,yy(0));x.lineTo(p.l+pw,yy(0));x.stroke()}x.strokeStyle=co.accent;x.lineWidth=2;x.beginPath();vals.forEach(function(v,i){i?x.lineTo(xx(i),yy(v)):x.moveTo(xx(i),yy(v))});x.stroke();var pts=[],every=Math.max(1,Math.ceil(vals.length/12));vals.forEach(function(v,i){var px=xx(i),py=yy(v);x.fillStyle=co.accent;x.beginPath();x.arc(px,py,3,0,Math.PI*2);x.fill();if(i%every===0||i===vals.length-1){x.fillStyle=co.ink;x.font='9px Segoe UI';x.textAlign='center';x.fillText(short(v),px,Math.max(10,py-8));var q=d.k[i].split('-');x.save();x.translate(px,p.t+ph+52);x.rotate(-Math.PI/4);x.fillStyle=co.muted;x.textAlign='right';x.fillText(q[2]+'/'+q[1],0,0);x.restore()}pts.push({x:px,date:d.k[i],value:v})});chartMeta.cum={pts:pts}}
function tip(ev,txt){var t=document.getElementById('tip');t.innerHTML=txt;t.style.left=(ev.clientX+12)+'px';t.style.top=(ev.clientY+12)+'px';t.style.display='block'}function hideTip(){document.getElementById('tip').style.display='none'}

