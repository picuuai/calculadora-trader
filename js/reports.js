// Documentos gerados em nova janela: relatório mensal e DARF 6015 (para impressão/PDF).
'use strict';

function reportEsc(s){return darfEsc(s)}
function gerarRelatorioMensal(month){
  var p=person(st.active),L=ledger(activeEntries()),r=L.find(function(x){return x.ym===month});
  if(!p||!r){alert('Não há apuração para esta competência.');return}
  var entries=monthEntries(month).slice().sort(function(a,b){return a.date.localeCompare(b.date)});
  var accounts=accountSummary(month),info=closedInfo(st.active,month);
  var html=`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório Day Trade - ${reportEsc(ymlabel(month))}</title>
  <style>@page{size:A4;margin:12mm}*{box-sizing:border-box}body{font:12px Arial;color:#111;margin:0}h1{font-size:20px;margin:0 0 4px}h2{font-size:14px;margin:18px 0 6px}.muted{color:#666}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:12px 0}.box{border:1px solid #bbb;padding:7px}.box b{display:block;font-size:14px;margin-top:3px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #bbb;padding:5px;text-align:left}th{background:#f3f3f3}.num{text-align:right}.foot{margin-top:16px;font-size:10px;color:#666}.toolbar{margin-bottom:10px}.toolbar button{padding:8px 12px}@media print{.toolbar{display:none}}</style></head><body>
  <div class="toolbar"><button onclick="window.print()">Imprimir / Salvar em PDF</button></div>
  <h1>Relatório mensal — Day Trade</h1><div>${reportEsc(p.name)} • CPF ${reportEsc(cpfFmt(p.cpf))}</div>
  <div class="muted">Competência: ${reportEsc(ymlabel(month))} • Situação: ${info?'Fechada':'Aberta'}${info?' em '+reportEsc(new Date(info.closedAt).toLocaleString('pt-BR')):''}</div>
  <div class="grid">
  <div class="box">Resultado<b>${brl(r.result)}</b></div><div class="box">Prejuízo compensado<b>${brl(r.usedLoss)}</b></div>
  <div class="box">Base tributável<b>${brl(r.base)}</b></div><div class="box">IR 20%<b>${brl(r.tax)}</b></div>
  <div class="box">IRRF do mês<b>${brl(r.irrf)}</b></div><div class="box">IRRF utilizado<b>${brl(r.creditUsed||0)}</b></div>
  <div class="box">${r.paid?'DARF pago':'DARF'}<b>${brl(r.darf)}</b></div><div class="box">Vencimento<b>${r.darf>0?due(r.ym):'—'}</b></div></div>
  <h2>Resumo por conta/corretora</h2><table><thead><tr><th>Conta / corretora</th><th class="num">Lançamentos</th><th class="num">Bruto</th><th class="num">Custos</th><th class="num">Resultado</th><th class="num">IRRF</th><th class="num">Líquido nota</th></tr></thead><tbody>
  ${accounts.map(function(a){return'<tr><td>'+reportEsc(a.account)+'</td><td class="num">'+a.count+'</td><td class="num">'+(a.hasDetalhe?brl(a.bruto):'—')+'</td><td class="num">'+(a.hasDetalhe?brl(a.custos):'—')+'</td><td class="num">'+brl(a.result)+'</td><td class="num">'+brl(a.irrf)+'</td><td class="num">'+(a.hasDetalhe?brl(a.liquidoNota):'—')+'</td></tr>'}).join('')}
  </tbody></table><h2>Lançamentos da competência</h2>
  <table><thead><tr><th>Data</th><th>Mercado</th><th>Conta</th><th>Referência</th><th class="num">Bruto</th><th class="num">Custos</th><th class="num">Resultado</th><th class="num">IRRF</th><th class="num">Líquido nota</th></tr></thead><tbody>
  ${entries.map(function(e){return'<tr><td>'+datebr(e.date)+'</td><td>'+reportEsc(CATS[e.cat]||e.cat)+'</td><td>'+reportEsc(e.account||'—')+'</td><td>'+reportEsc(e.ref||'—')+'</td><td class="num">'+(e.bruto==null?'—':brl(e.bruto))+'</td><td class="num">'+(e.custos==null?'—':brl(e.custos))+'</td><td class="num">'+brl(e.result)+'</td><td class="num">'+brl(e.irrf)+'</td><td class="num">'+(e.liquidoNota==null?'—':brl(e.liquidoNota))+'</td></tr>'}).join('')}
  </tbody></table><div class="foot">Relatório gerado offline pela Calculadora Trader. Documento de apoio à conferência.</div></body></html>`;
  var w=window.open('','_blank');if(!w){alert('Permita pop-ups para gerar o relatório.');return}
  w.document.open();w.document.write(html);w.document.close();
}

function parseBRDate(s){
  var p=String(s||'').split('/');
  if(p.length!==3)return null;
  return new Date(+p[2],+p[1]-1,+p[0],23,59,59,999);
}
function paLastDay(ymValue){
  var p=ymValue.split('-'), y=+p[0], m=+p[1];
  var d=new Date(y,m,0);
  return String(d.getDate()).padStart(2,'0')+'/'+String(m).padStart(2,'0')+'/'+y;
}
function fmtMoneyPlain(v){
  return Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
}
function darfEsc(s){
  return String(s==null?'':s).replace(/[&<>"']/g,function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}
function gerarDARF(key){
  var L=ledger(activeEntries());
  var r=L.find(function(x){return x.key===key;});
  var p=person(st.active);

  if(!r||!p){
    alert('Não foi possível localizar os dados desta apuração.');
    return;
  }
  if(!(r.darf>=10)){
    alert('Não há DARF a emitir nesta competência. Valores inferiores a R$ 10,00 permanecem acumulados.');
    return;
  }

  var venc=due(r.ym);
  var vencDate=parseBRDate(venc);
  var hoje=new Date();

  if(vencDate && hoje.getTime()>vencDate.getTime()){
    alert('Este DARF está vencido desde '+venc+'. Para emitir corretamente, atualize multa e juros no Sicalc Web.');
    return;
  }

  var nome=p.name||'';
  var cpf=cpfFmt(p.cpf||'');
  var pa=paLastDay(r.ym);
  var principal=fmtMoneyPlain(r.darf);
  var agora=new Date();
  var geradoEm=String(agora.getDate()).padStart(2,'0')+'/'+
    String(agora.getMonth()+1).padStart(2,'0')+'/'+agora.getFullYear()+' '+
    String(agora.getHours()).padStart(2,'0')+':'+
    String(agora.getMinutes()).padStart(2,'0')+':'+
    String(agora.getSeconds()).padStart(2,'0');

  var BRASAO="data:image/png;base64,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";

  function linha(num,rotulo,valor){
    return '<div class="linha">'+
      '<div class="rot"><strong>'+num+'</strong><span>'+rotulo+'</span><b class="seta">➜</b></div>'+
      '<div class="valor">'+(valor||'')+'</div>'+
    '</div>';
  }

  function via(numero){
    return `
      <section class="via">
        <div class="via-num">${numero}a. via</div>
        <div class="form">
          <div class="esq">
            <div class="cab">
              <img class="brasao" src="${BRASAO}">
              <div class="cabtxt">
                <div class="mf">MINISTÉRIO DA FAZENDA</div>
                <div class="rfb">SECRETARIA DA RECEITA FEDERAL DO BRASIL</div>
                <div class="doc">Documento de Arrecadação de Receitas Federais</div>
                <div class="darf-title">DARF</div>
              </div>
            </div>

            <div class="nome">
              <div class="nome-head"><b>01</b><span>NOME / RAZÃO SOCIAL</span></div>
              <div class="nome-value">${darfEsc(nome)}</div>
            </div>

            <div class="obs">
              <div class="acolhimento">
                <span>Data limite para acolhimento:</span>
                <strong>${darfEsc(venc)}</strong>
              </div>
              <div class="obs-label">Observações:</div>
              <div class="obs-text">DARF gerado offline pela Calculadora Trader</div>
              <div class="rodape-esq">CALCULADORA TRADER</div>
              <div class="rodape-dir">${darfEsc(geradoEm)}</div>
            </div>
          </div>

          <div class="dir">
            ${linha('02','PERÍODO DE APURAÇÃO',darfEsc(pa))}
            ${linha('03','NÚMERO DO CPF OU CNPJ',darfEsc(cpf))}
            ${linha('04','CÓDIGO DA RECEITA','6015')}
            ${linha('05','NÚMERO DE REFERÊNCIA','')}
            ${linha('06','DATA DE VENCIMENTO',darfEsc(venc))}
            ${linha('07','VALOR DO PRINCIPAL',principal)}
            ${linha('08','VALOR DA MULTA','')}
            ${linha('09','VALOR DOS JUROS E / OU<br>ENCARGOS DL - 1.025/69','')}
            ${linha('10','VALOR TOTAL',principal)}
            <div class="linha autenticacao">
              <div class="rot"><strong>11</strong><span>AUTENTICAÇÃO BANCÁRIA <small>(Somente nas 1a. e 2a. vias)</small></span></div>
              <div class="valor"></div>
            </div>
          </div>
        </div>
      </section>`;
  }

  var html=`<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>DARF 6015 - ${darfEsc(nome)}</title>
<style>
  @page{size:A4 portrait;margin:8mm 10mm}
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;background:#fff;color:#000}
  body{font-family:Arial,Helvetica,sans-serif}
  .toolbar{display:flex;justify-content:center;gap:8px;padding:10px 0 12px}
  .toolbar button{border:1px solid #333;background:#fff;padding:8px 14px;border-radius:4px;font:600 13px Arial;cursor:pointer}
  .toolbar .primary{background:#111;color:#fff}
  .pagina{width:190mm;margin:0 auto}

  .via{position:relative;width:100%;height:81mm}
  .via:first-of-type{
    height:101mm;
    margin-bottom:7mm;
    border-bottom:.22mm dashed #555
  }
  .via-num{
    position:absolute;
    right:0;
    top:0;
    font-size:8.8px;
    line-height:1
  }

  .form{
    width:100%;
    height:76mm;
    margin-top:5mm;
    display:grid;
    grid-template-columns:50% 50%;
    border-left:.22mm solid #333;
    border-top:.22mm solid #333;
    border-right:.22mm solid #333
  }
  .esq{
    border-right:.22mm solid #333;
    display:grid;
    grid-template-rows:27mm 11mm 38mm
  }
  .cab{
    display:flex;
    align-items:flex-start;
    overflow:hidden;
    padding:2.1mm 2.2mm 1.5mm 2.0mm;
    border-bottom:.22mm solid #333
  }
  .brasao{
    width:14.6mm;
    height:auto;
    object-fit:contain;
    margin:.35mm 2.1mm 0 0;
    flex:0 0 auto
  }
  .cabtxt{
    padding-top:.15mm;
    min-width:0
  }
  .mf{
    font-size:13.5px;
    font-weight:800;
    line-height:1.12;
    white-space:nowrap
  }
  .rfb{
    font-size:10.5px;
    font-weight:800;
    line-height:1.18;
    margin-top:.25mm;
    white-space:nowrap
  }
  .doc{
    font-size:8.5px;
    font-weight:600;
    line-height:1.15;
    margin-top:.25mm;
    white-space:nowrap
  }
  .darf-title{
    font-size:21.8px;
    line-height:1;
    font-weight:800;
    margin-top:1.35mm
  }

  .nome{border-bottom:.22mm solid #333}
  .nome-head{
    height:4.6mm;
    display:flex;
    align-items:center;
    gap:2.0mm;
    padding:0 .8mm
  }
  .nome-head b{font-size:17px;line-height:1}
  .nome-head span{font-size:6.8px}
  .nome-value{
    padding:.45mm 7mm 0 7mm;
    font-family:"Courier New",monospace;
    font-size:9.4px;
    text-transform:uppercase;
    letter-spacing:.03mm;
    white-space:nowrap;
    overflow:hidden
  }

  .obs{
    position:relative;
    overflow:hidden;
    padding:4.3mm 1.7mm 1.8mm;
    font-size:8.6px
  }
  .acolhimento{
    display:grid;
    grid-template-columns:auto 1fr;
    column-gap:7.0mm;
    align-items:center
  }
  .acolhimento strong{font-size:8.6px}
  .obs-label{margin-top:3.4mm}
  .obs-text{
    margin-top:1.5mm;
    font-family:"Courier New",monospace;
    font-size:8.5px;
    white-space:nowrap
  }
  .rodape-esq,.rodape-dir{
    position:absolute;
    bottom:1.55mm;
    font-size:6.0px;
    line-height:1;
    white-space:nowrap
  }
  .rodape-esq{left:1.7mm}
  .rodape-dir{right:1.7mm;text-align:right}

  .dir{
    display:grid;
    grid-template-rows:repeat(10,7.6mm)
  }
  .linha{display:grid;grid-template-columns:50% 50%;border-bottom:.22mm solid #333}
  .rot{border-right:.22mm solid #333;display:flex;align-items:center;position:relative;min-width:0}
  .rot strong{
    font-size:16.3px;
    width:8mm;
    padding-left:.7mm;
    line-height:1;
    flex:0 0 auto
  }
  .rot span{
    font-size:6.45px;
    line-height:1.12;
    max-width:32mm
  }
  .rot small{font-size:5.35px;font-weight:400}
  .seta{
    position:absolute;
    right:2.1mm;
    font-size:12.7px;
    line-height:1
  }
  .valor{
    display:flex;
    align-items:center;
    justify-content:flex-end;
    padding:0 1.5mm 0 1mm;
    font-size:11.7px;
    font-weight:400;
    white-space:nowrap;
    overflow:hidden
  }
  .autenticacao .rot{border-right:none;grid-column:1 / 3}
  .autenticacao .valor{display:none}

  @media print{
    .toolbar{display:none}
    .pagina{width:190mm}
    .via{break-inside:avoid}
  }
</style>
</head>
<body>
<div class="toolbar">
  <button class="primary" onclick="window.print()">Imprimir / Salvar em PDF</button>
  <button onclick="window.close()">Fechar</button>
</div>
<main class="pagina">
  ${via(1)}
  ${via(2)}
</main>
</body>
</html>`;

  var w=window.open('','_blank');
  if(!w){
    alert('O navegador bloqueou a nova janela. Permita pop-ups para gerar o DARF.');
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}



// Relatório anual para a declaração (IRPF): valores mês a mês no formato
// da ficha "Renda Variável → Operações Comuns / Day-Trade".
function gerarRelatorioAnual(year){
  var p=person(st.active);
  if(!p||!year){alert('Selecione um contribuinte e um ano.');return}
  var L=ledger(activeEntries()),rows=L.filter(function(r){return r.ym.slice(0,4)===year});
  if(!rows.length){alert('Não há lançamentos em '+year+'.');return}
  var prev=L.filter(function(r){return r.ym<year+'-01'}),lossStart=prev.length?prev[prev.length-1].loss:0;
  var byYm={};rows.forEach(function(r){byYm[r.ym]=r});
  var tot={acoes:0,futuros:0,result:0,tax:0,irrf:0,creditUsed:0,darfPago:0,darfAberto:0};
  var body='';
  for(var m=1;m<=12;m++){
    var k=year+'-'+String(m).padStart(2,'0'),r=byYm[k];
    if(!r){body+='<tr class="muted"><td>'+ymlabel(k)+'</td>'+'<td class="num">—</td>'.repeat(9)+'</tr>';continue}
    tot.acoes+=r.acoes;tot.futuros+=r.futuros;tot.result+=r.result;tot.tax+=r.tax;tot.irrf+=r.irrf;tot.creditUsed+=r.creditUsed||0;
    if(r.darf>0){if(r.paid)tot.darfPago+=r.darf;else tot.darfAberto+=r.darf}
    body+='<tr><td>'+ymlabel(k)+'</td><td class="num">'+brl(r.acoes)+'</td><td class="num">'+brl(r.futuros)+'</td>'+
      '<td class="num"><b>'+brl(r.result)+'</b></td><td class="num">'+brl(r.usedLoss)+'</td><td class="num">'+brl(r.loss)+'</td>'+
      '<td class="num">'+brl(r.tax)+'</td><td class="num">'+brl(r.irrf)+'</td>'+
      '<td class="num">'+(r.darf>0?brl(r.darf):(r.below?'acumulado':'—'))+'</td>'+
      '<td class="num">'+(r.darf>0?(r.paid?'pago':'<span class="alert">em aberto</span>'):'—')+'</td></tr>';
  }
  var last=rows[rows.length-1];
  Object.keys(tot).forEach(function(k){tot[k]=round2(tot[k])});
  var html=`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>IRPF ${reportEsc(year)} - Day Trade - ${reportEsc(p.name)}</title>
  <style>@page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}body{font:12px Arial;color:#111;margin:16px}h1{font-size:20px;margin:0 0 4px}h2{font-size:14px;margin:18px 0 6px}.muted{color:#888}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:12px 0}.box{border:1px solid #bbb;padding:7px}.box b{display:block;font-size:14px;margin-top:3px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #bbb;padding:5px;text-align:left}th{background:#f3f3f3}.num{text-align:right}.alert{color:#AA372B;font-weight:bold}ol li{margin:4px 0}.foot{margin-top:16px;font-size:10px;color:#666}.toolbar{margin-bottom:10px}.toolbar button{padding:8px 12px}@media print{.toolbar{display:none}body{margin:0}}</style></head><body>
  <div class="toolbar"><button onclick="window.print()">Imprimir / Salvar em PDF</button></div>
  <h1>Declaração IRPF ${reportEsc(year)} — Renda Variável (Day Trade)</h1>
  <div>${reportEsc(p.name)} • CPF ${reportEsc(cpfFmt(p.cpf))}</div>
  <div class="grid">
    <div class="box">Resultado day trade no ano<b>${brl(tot.result)}</b></div>
    <div class="box">Prejuízo a compensar em 31/12<b>${brl(last.loss)}</b></div>
    <div class="box">IRRF day trade retido no ano<b>${brl(tot.irrf)}</b></div>
    <div class="box">DARFs pagos (competências do ano)<b>${brl(tot.darfPago)}</b></div>
  </div>
  ${lossStart?'<p>Prejuízo de day trade vindo de anos anteriores (saldo em 31/12/'+(+year-1)+'): <b>'+brl(lossStart)+'</b>.</p>':''}
  ${tot.darfAberto?'<p class="alert">Atenção: há '+brl(tot.darfAberto)+' em DARFs de '+reportEsc(year)+' não marcados como pagos. Pague (com multa e juros pelo Sicalc, se vencidos) e marque como pago antes de declarar.</p>':''}
  <h2>Mês a mês</h2>
  <table><thead><tr><th>Mês</th><th class="num">Day trade ações</th><th class="num">Day trade futuros</th><th class="num">Resultado do mês</th><th class="num">Prejuízo compensado</th><th class="num">Prejuízo a compensar</th><th class="num">Imposto 20%</th><th class="num">IRRF no mês</th><th class="num">DARF</th><th class="num">Situação</th></tr></thead>
  <tbody>${body}</tbody>
  <tfoot><tr><th>Total</th><th class="num">${brl(tot.acoes)}</th><th class="num">${brl(tot.futuros)}</th><th class="num">${brl(tot.result)}</th><th></th><th></th><th class="num">${brl(tot.tax)}</th><th class="num">${brl(tot.irrf)}</th><th class="num">${brl(tot.darfPago+tot.darfAberto)}</th><th></th></tr></tfoot></table>
  <h2>Como preencher no programa do IRPF</h2>
  <ol>
    <li>Abra a ficha <b>Renda Variável → Operações Comuns / Day-Trade</b> e selecione o titular.</li>
    <li>Em cada mês, preencha a coluna <b>Day-Trade</b>:
      <ul><li><b>Mercado à vista – ações</b>: valor da coluna “Day trade ações”.</li>
      <li><b>Mercado futuro</b>: valor da coluna “Day trade futuros”, na linha do ativo negociado — mini-índice (WIN) em <b>índices</b>, mini-dólar (WDO) em <b>dólar dos EUA</b>. Se operou os dois no mesmo mês, divida conforme as notas.</li></ul></li>
    <li>Em <b>IR fonte (Day-Trade) no mês</b>, informe a coluna “IRRF no mês”.</li>
    <li>Em <b>Imposto pago</b>, informe o valor do DARF código 6015 pago referente àquele mês.</li>
    <li>O programa calcula prejuízo a compensar e imposto devido; confira com as colunas acima. ${lossStart?'Em janeiro, o “Resultado negativo até o mês anterior” (day trade) deve ser '+brl(lossStart)+'.':''}</li>
  </ol>
  <div class="foot">Relatório gerado offline pela Calculadora Trader em ${reportEsc(new Date().toLocaleString('pt-BR'))}. Documento de apoio; confira com os informes das corretoras. IRRF não utilizado no ano (${brl(last.credit)}) é informado nos meses em que foi retido, na própria ficha.</div>
  </body></html>`;
  var w=window.open('','_blank');if(!w){alert('Permita pop-ups para gerar o relatório.');return}
  w.document.open();w.document.write(html);w.document.close();
}
