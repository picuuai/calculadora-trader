// Leitura de notas/comprovantes em PDF: reconstrução de linhas a partir do
// texto posicionado do pdf.js e extração dos campos por layout.
'use strict';

function parseMoney(raw){
  if(!raw) return null;
  var neg=/-/.test(raw);
  var cleaned=String(raw).replace(/R\$/gi,'').replace(/\s/g,'').replace(/-/g,'');
  cleaned=cleaned.replace(/\./g,'').replace(',','.');
  if(cleaned==='') return null;
  var v=parseFloat(cleaned);
  return isNaN(v)?null:(neg?-v:v);
}
function rebuild(items){
  var sorted=items.slice().sort(function(a,b){return b.y-a.y}),lines=[],cur=null;
  sorted.forEach(function(i){
    if(cur&&Math.abs(i.y-cur.y)<=2.5) cur.a.push(i);
    else {cur={y:i.y,a:[i]};lines.push(cur);}
  });
  return lines.map(function(l){
    return l.a.sort(function(a,b){return a.x-b.x;}).map(function(i){return i.s;}).join(' ');
  });
}

function rebuildRows(items){
  var sorted=items.slice().sort(function(a,b){return b.y-a.y}),rows=[],cur=null;
  sorted.forEach(function(i){
    if(cur&&Math.abs(i.y-cur.y)<=2.5)cur.items.push(i);
    else{cur={y:i.y,items:[i]};rows.push(cur);}
  });
  rows.forEach(function(r){r.items.sort(function(a,b){return a.x-b.x;})});
  return rows;
}
function rowMap(row){
  var txt='',spans=[];
  (row.items||[]).forEach(function(it,idx){
    if(idx)txt+=' ';
    var st=txt.length;
    txt+=it.s;
    spans.push({
      start:st,end:txt.length,
      x0:it.x,
      x1:it.x+(Number(it.w)||Math.max(4,String(it.s||'').length*3)),
      text:it.s
    });
  });
  return{text:txt,spans:spans};
}
function locateLabel(rows,labelRegex){
  for(var i=0;i<rows.length;i++){
    var rm=rowMap(rows[i]);
    var re=new RegExp(labelRegex.source,labelRegex.flags.replace('g',''));
    var m=re.exec(rm.text);
    if(!m)continue;
    var a=m.index,b=m.index+m[0].length,used=rm.spans.filter(function(s){return s.end>a&&s.start<b});
    if(!used.length)continue;
    return{
      row:i,
      x0:Math.min.apply(null,used.map(function(s){return s.x0})),
      x1:Math.max.apply(null,used.map(function(s){return s.x1})),
      text:rm.text
    };
  }
  return null;
}
function numericItemValue(s){
  s=String(s||'').trim();
  if(!/^-?[\d.]+,\d{2,4}$/.test(s))return null;
  return parseMoney(s);
}
function valueNearLabel(rows,labelRegex,opts){
  opts=opts||{};
  var loc=locateLabel(rows,labelRegex);
  if(!loc)return null;

  var candidates=[];
  var from=Math.max(0,loc.row-(opts.rowRadius||2));
  var to=Math.min(rows.length-1,loc.row+(opts.rowRadius||2));

  for(var ri=from;ri<=to;ri++){
    (rows[ri].items||[]).forEach(function(it){
      var v=numericItemValue(it.s);
      if(v===null)return;
      var cx=it.x+(Number(it.w)||0)/2;
      var dx=Math.abs(cx-((loc.x0+loc.x1)/2));
      var rightPenalty=cx<loc.x0?80:0;
      var rowPenalty=Math.abs(ri-loc.row)*18;
      if(dx<=(opts.maxDx||105)){
        candidates.push({v:v,item:it,row:ri,score:dx+rightPenalty+rowPenalty});
      }
    });
  }
  if(!candidates.length)return null;
  candidates.sort(function(a,b){return a.score-b.score});
  var c=candidates[0];

  // D/C normalmente está imediatamente à direita do valor.
  var dc='';
  var rowItems=rows[c.row].items||[];
  var idx=rowItems.indexOf(c.item);
  for(var j=idx+1;j<Math.min(rowItems.length,idx+3);j++){
    var t=String(rowItems[j].s||'').trim().toUpperCase();
    if(t==='C'||t==='D'){dc=t;break}
    if(numericItemValue(t)!==null)break;
  }
  var v=c.v;
  if(dc==='D')v=-Math.abs(v);
  else if(dc==='C')v=Math.abs(v);
  return Math.round(v*100)/100;
}
function textNearLabel(rows,labelRegex,pattern,opts){
  opts=opts||{};
  var loc=locateLabel(rows,labelRegex);
  if(!loc)return '';
  var from=Math.max(0,loc.row-(opts.rowRadius||3));
  var to=Math.min(rows.length-1,loc.row+(opts.rowRadius||3));
  var found=[];
  for(var ri=from;ri<=to;ri++){
    var rm=rowMap(rows[ri]);
    var re=new RegExp(pattern.source,pattern.flags.replace('g',''));
    var m=re.exec(rm.text);
    if(m){
      var rowDistance=Math.abs(ri-loc.row);
      found.push({value:m[1]||m[0],score:rowDistance});
    }
  }
  found.sort(function(a,b){return a.score-b.score});
  return found.length?String(found[0].value).trim():'';
}

function itemCenter(it){
  return Number(it.x||0)+(Number(it.w)||0)/2;
}
function findValueBelowCell(rows,labelRegex,valueRegex,opts){
  opts=opts||{};
  var loc=locateLabel(rows,labelRegex);
  if(!loc)return null;

  var left=loc.x0-(opts.leftPad==null?4:opts.leftPad);
  var right=loc.x0+(opts.cellWidth||105);
  var maxRows=opts.maxRows||4;

  for(var ri=loc.row+1;ri<=Math.min(rows.length-1,loc.row+maxRows);ri++){
    var items=rows[ri].items||[];
    for(var j=0;j<items.length;j++){
      var it=items[j],cx=itemCenter(it);
      if(cx<left||cx>right)continue;
      var raw=String(it.s||'').trim();
      var re=new RegExp(valueRegex.source,valueRegex.flags.replace('g',''));
      var m=re.exec(raw);
      if(!m)continue;

      var value=m[1]||m[0];
      var dc='';
      for(var k=j+1;k<Math.min(items.length,j+3);k++){
        var nxt=String(items[k].s||'').trim().toUpperCase();
        if(itemCenter(items[k])>right)break;
        if(nxt==='C'||nxt==='D'){dc=nxt;break}
      }
      return{raw:value,dc:dc,item:it,row:ri};
    }
  }
  return null;
}
function moneyBelowCell(rows,labelRegex,opts){
  var f=findValueBelowCell(
    rows,labelRegex,
    /(-?[\d.]+,\d{2})/,
    opts
  );
  if(!f)return null;
  return parseMoneyDC(f.raw,f.dc);
}
function dateBelowCell(rows,labelRegex,opts){
  var f=findValueBelowCell(
    rows,labelRegex,
    /(\d{2}\/\d{2}\/\d{4})/,
    opts
  );
  return f?f.raw:'';
}
function integerBelowCell(rows,labelRegex,opts){
  var f=findValueBelowCell(
    rows,labelRegex,
    /(\d{4,12})/,
    opts
  );
  return f?f.raw:'';
}
function cpfBelowCell(rows,labelRegex,opts){
  var f=findValueBelowCell(
    rows,labelRegex,
    /(\d{3}\.\d{3}\.\d{3}-\d{2})/,
    opts
  );
  return f?digits(f.raw):'';
}
function nameBelowClientCell(rows){
  var loc=locateLabel(rows,/^Cliente$/i);
  if(!loc)return '';
  for(var ri=loc.row+1;ri<=Math.min(rows.length-1,loc.row+4);ri++){
    var words=(rows[ri].items||[]).filter(function(it){
      var cx=itemCenter(it);
      var t=String(it.s||'').trim();
      return cx>=105&&cx<=330 &&
             /^[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ]+$/.test(t) &&
             !/\d/.test(t);
    }).map(function(it){return String(it.s).trim()});
    if(words.length>=2){
      return words.join(' ').replace(/\s+/g,' ').trim();
    }
  }
  return '';
}

function legacyIdentityFromRows(rows,full){
  var out={name:'',account:'',cpf:''};

  var cpfMatch=full.match(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/);
  if(cpfMatch)out.cpf=digits(cpfMatch[0]);

  var acc=textNearLabel(rows,/C[oó]digo\s+Cliente/i,/(\b\d{4,10}\b)/,{rowRadius:2});
  if(acc)out.account=digits(acc);

  // A linha visual do CPF também contém o nome do cliente à esquerda.
  if(out.cpf){
    for(var i=0;i<rows.length;i++){
      var rm=rowMap(rows[i]);
      if(rm.text.indexOf(cpfFmt(out.cpf))===-1)continue;
      var parts=(rows[i].items||[]).filter(function(it){
        return it.x<350 && /[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ]/.test(it.s) && !/\d/.test(it.s);
      }).map(function(it){return it.s});
      var nm=parts.join(' ').replace(/\s+/g,' ').trim();
      if(nm.length>=8){out.name=nm;break}
    }
  }

  if(!out.name){
    // Fallback: primeira linha de texto abaixo de "Cliente" com nome em maiúsculas.
    var cli=locateLabel(rows,/^Cliente$/i);
    if(cli){
      for(var r=cli.row-1;r<=cli.row+4;r++){
        if(r<0||r>=rows.length)continue;
        var items=(rows[r].items||[]).filter(function(it){
          return it.x>90&&it.x<330&&/^[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ]+$/.test(String(it.s||''));
        });
        var n=items.map(function(it){return it.s}).join(' ').trim();
        if(n.split(/\s+/).length>=2){out.name=n;break}
      }
    }
  }
  return out;
}


// IMPORTANTE: uma linha reconstruída pode conter várias colunas.
// Esta rotina localiza o rótulo e pega o primeiro valor monetário
// posicionado DEPOIS daquele rótulo, evitando capturar custos/IRRF
// negativos de outra coluna da mesma linha.
function amountByLabel(lines,labelRegex,opts){
  opts=opts||{};
  var flags=labelRegex.flags.indexOf('g')===-1?labelRegex.flags+'g':labelRegex.flags;
  var globalLabel=new RegExp(labelRegex.source,flags);

  for(var i=0;i<lines.length;i++){
    var line=lines[i];
    globalLabel.lastIndex=0;
    var lm,labelEnd=-1;
    while((lm=globalLabel.exec(line))!==null){
      labelEnd=lm.index+lm[0].length;
      if(lm[0].length===0) globalLabel.lastIndex++;
    }
    if(labelEnd===-1) continue;

    var amountRe=/-?\s*R\$\s*-?[\d.,]+/gi,am,candidates=[];
    while((am=amountRe.exec(line))!==null){
      candidates.push({index:am.index,text:am[0]});
    }

    var picked=null;
    for(var k=0;k<candidates.length;k++){
      if(candidates[k].index>=labelEnd){picked=candidates[k];break;}
    }
    if(!picked&&opts.last&&candidates.length) picked=candidates[candidates.length-1];
    if(!picked&&candidates.length) picked=candidates[0];

    if(picked){
      var val=parseMoney(picked.text);
      if(val!==null) return {value:val,line:line};
    }

    // Alguns PDFs quebram o valor para a linha seguinte.
    if(i+1<lines.length){
      var nm=lines[i+1].match(/-?\s*R\$\s*-?[\d.,]+/i);
      if(nm){
        var v2=parseMoney(nm[0]);
        if(v2!==null) return {value:v2,line:line+' '+lines[i+1]};
      }
    }
  }
  return null;
}

function extractIdentity(lines,full){
  var out={name:'',account:'',cpf:''};

  // Modelos atuais de comprovante.
  var ac=full.match(/Conta:\s*(\d+)/i);
  if(ac) out.account=ac[1];

  for(var i=0;i<lines.length;i++){
    if(/^Conta:\s*\d+/i.test(lines[i])&&i>0){
      var prev=lines[i-1].trim();
      if(prev&&!/P[aá]gina|COMPROVANTE|Data de refer/i.test(prev)){
        out.name=prev.replace(/\s+/g,' ').trim();
        break;
      }
    }
  }
  if(!out.name){
    var nm=full.match(/([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][A-ZÁÀÂÃÉÊÍÓÔÕÚÇ\s]{5,})\s+Conta:\s*\d+/i);
    if(nm) out.name=nm[1].replace(/\s+/g,' ').trim();
  }

  // Nota de corretagem tradicional Santander/B3.
  if(!out.account){
    var cc=full.match(/C[oó]digo\s+Cliente\s*:?\s*(\d+)/i);
    if(cc) out.account=cc[1];
  }

  var cpfm=full.match(/C\.?\s*N\.?\s*P\.?\s*J\.?\s*\/\s*C\.?\s*P\.?\s*F\.?\s*:?\s*([\d.\-]+)/i)
        || full.match(/\bCPF\s*:?\s*([\d.\-]{11,14})/i);
  if(cpfm) out.cpf=digits(cpfm[1]);

  if(!out.name){
    var cli=full.match(/Cliente\s+([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][A-ZÁÀÂÃÉÊÍÓÔÕÚÇ\s]{5,}?)(?=\s+(?:RUA|AVENIDA|AV\.|ALAMEDA|C\.?\s*N\.?\s*P\.?\s*J\.?\s*\/\s*C\.?\s*P\.?\s*F))/i);
    if(cli) out.name=cli[1].replace(/\s+/g,' ').trim();
  }

  return out;
}


function parseMoneyDC(raw,dc){
  var v=parseMoney(raw);
  if(v===null)return null;
  dc=String(dc||'').trim().toUpperCase();
  if(dc==='D')v=-Math.abs(v);
  else if(dc==='C')v=Math.abs(v);
  return Math.round(v*100)/100;
}
function findLegacyField(full,labelRegex){
  var re=new RegExp(
    labelRegex.source+
    '\\s*(?:R\\$\\s*)?(-?\\s*[\\d.]+,\\d{2})\\s*([CD])?',
    'i'
  );
  var m=full.match(re);
  if(!m)return null;
  return parseMoneyDC(m[1],m[2]);
}
function normalizeDayTradeNote(r){
  // Regra canônica usada por todos os layouts:
  // resultado tributável = bruto + custos/despesas.
  // IRRF é crédito separado e não reduz o resultado tributável.
  if(r.bruto!=null)r.bruto=Math.round(Number(r.bruto)*100)/100;
  if(r.custos!=null)r.custos=Math.round(Number(r.custos)*100)/100;
  if(r.irrf!=null)r.irrf=Math.round(Math.abs(Number(r.irrf))*100)/100;
  if(r.liquidoNota!=null)r.liquidoNota=Math.round(Number(r.liquidoNota)*100)/100;

  if(r.bruto!=null){
    var c=r.custos==null?0:Number(r.custos);
    // Custos/despesas devem reduzir o resultado.
    if(c>0)c=-Math.abs(c);
    r.custos=Math.round(c*100)/100;
    r.result=Math.round((Number(r.bruto)+r.custos)*100)/100;
  }

  if(r.irrf==null)r.irrf=0;
  r.tributos=-Math.abs(r.irrf);

  // Conferências sem alterar os valores.
  if(r.totalLiquidoFiscal!=null && r.result!=null &&
     Math.abs(Number(r.totalLiquidoFiscal)-Number(r.result))>0.02){
    r.warnings.push('Conferência: Total líquido (#) difere do resultado tributável calculado.');
  }

  if(r.liquidoNota!=null && r.result!=null){
    var expected=Math.round((Number(r.result)-Math.abs(Number(r.irrf||0)))*100)/100;
    if(Math.abs(expected-Number(r.liquidoNota))>0.02){
      r.warnings.push('Conferência: resultado tributável menos IRRF difere do líquido da nota.');
    }
  }
  return r;
}
function refNumber(ref){
  var m=String(ref||'').match(/(\d{4,})/);
  return m?m[1]:'';
}

function amountLegacyDC(full,labelRegex){
  var re=new RegExp(labelRegex.source+'\\s*(?:R\\$\\s*)?(-?[\\d.]+,\\d{2})\\s*([CD])?','i');
  var m=full.match(re);
  if(!m)return null;
  var v=parseMoney(m[1]);
  if(v===null)return null;
  var dc=(m[2]||'').toUpperCase();
  if(dc==='D')v=-Math.abs(v);
  else if(dc==='C')v=Math.abs(v);
  return Math.round(v*100)/100;
}
function isLegacySantanderBmf(full){
  return /NOTA\s+DE\s+CORRETAGEM/i.test(full) &&
         /(?:Taxa\s+registro\s+BM&F|Ajuste\s+de\s+day\s*trade|Custos\s+BM&F)/i.test(full) &&
         /DAY\s*TRADE|DAYTRADE/i.test(full);
}
function parseLegacySantanderBmf(lines,full,rows){
  var r={cat:'futuros',warnings:[],layout:'santander-bmf-legado'};
  rows=rows||[];

  // Cabeçalho: leitura estritamente pela célula visual correspondente.
  var preg=dateBelowCell(rows,/Preg[aã]o/i,{cellWidth:55,maxRows:3});
  if(preg){
    var dp=preg.split('/');
    r.date=dp[2]+'-'+dp[1]+'-'+dp[0];
  }else{
    r.warnings.push('Data do pregão não identificada; confira manualmente.');
  }

  var nota=integerBelowCell(rows,/Nr\.?\s*Nota/i,{cellWidth:45,maxRows:3});
  if(nota)r.ref='Nota '+nota;
  else r.warnings.push('Número da nota não identificado.');

  r.cpf=cpfBelowCell(rows,/C\.?\s*N\.?\s*P\.?\s*J\.?\s*\/\s*C\.?\s*P\.?\s*F/i,{cellWidth:105,maxRows:3});
  r.account=integerBelowCell(rows,/C[oó]digo\s+Cliente/i,{cellWidth:85,maxRows:3});
  r.name=nameBelowClientCell(rows);

  // Quadro inferior: cada valor é lido somente dentro da própria célula.
  var bruto=moneyBelowCell(rows,/Ajuste\s+de\s+day\s*trade/i,{cellWidth:92,maxRows:3});
  if(bruto===null){
    bruto=moneyBelowCell(rows,/Valor\s+dos\s+neg[oó]cios/i,{cellWidth:100,maxRows:3});
  }

  var custos=moneyBelowCell(rows,/Total\s+das\s+despesas/i,{cellWidth:105,maxRows:3});
  var irrf=moneyBelowCell(rows,/IRRF\s+Day\s*Trade\s*\(Proje[cç][aã]o\)/i,{cellWidth:92,maxRows:3});
  var totalFiscal=moneyBelowCell(rows,/Total\s+l[ií]quido\s*\(#\)/i,{cellWidth:92,maxRows:3});
  var liquido=moneyBelowCell(rows,/Total\s+l[ií]quido\s+da\s+nota/i,{cellWidth:105,maxRows:3});

  if(bruto===null){
    r.warnings.push('Valor bruto do day trade não identificado.');
  }else{
    r.bruto=bruto;
  }

  r.custos=(custos===null?0:custos);
  r.irrf=(irrf===null?0:Math.abs(irrf));
  r.totalLiquidoFiscal=totalFiscal;
  if(liquido!==null)r.liquidoNota=liquido;

  normalizeDayTradeNote(r);

  // Validação específica deste layout.
  if(r.result!=null&&totalFiscal!=null&&Math.abs(r.result-totalFiscal)<=0.02){
    // fecha corretamente; sem aviso.
  }
  if(!r.name)r.warnings.push('Titular não identificado no PDF.');
  if(!r.cpf)r.warnings.push('CPF não identificado no PDF.');
  if(!r.account)r.warnings.push('Código do cliente não identificado no PDF.');

  return r;
}

function parseNote(lines,full,rows){
  if(isLegacySantanderBmf(full)){
    return parseLegacySantanderBmf(lines,full,rows);
  }
  var isBMF=/COMPROVANTE\s+BM\s*&\s*F|BM&FBOVESPA|BM&F/i.test(full);
  var r={cat:isBMF?'futuros':'acoes',warnings:[]};

  // Data: prioriza a região de "Data de referência".
  var dm=null;
  for(var i=0;i<lines.length;i++){
    if(/Data de refer[êe]ncia/i.test(lines[i])){
      var seg=lines.slice(i,i+3).join(' ');
      dm=seg.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if(dm) break;
    }
  }
  if(!dm) dm=full.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if(dm) r.date=dm[3]+'-'+dm[2]+'-'+dm[1];
  else r.warnings.push('Data não identificada; confira manualmente.');

  var ident=extractIdentity(lines,full);
  r.account=ident.account;
  r.name=ident.name;

  var ref=full.match(/Conta:\s*\d+\s+\d{2}\/\d{2}\/\d{4}\s+(\d{4,})/i)
       || full.match(/Comprovante\D{0,30}?(\d{4,})/i);
  if(ref) r.ref='Comprovante '+ref[1];

  if(isBMF){
    var gross=amountByLabel(lines,/Ajuste\s+encerra\s+hoje/i);
    if(!gross) gross=amountByLabel(lines,/Total\s+d(?:os|e)\s+neg[oó]cios/i,{last:true});

    var costs=amountByLabel(lines,/Total\s+de\s+custos/i);
    var ir=amountByLabel(lines,/IRRF\s+Day\s*Trade/i,{last:true});
    var liquid=amountByLabel(lines,/TOTAL\s+L[ÍI]QUIDO/i,{last:true});

    var grossVal=gross?gross.value:null;
    var costsVal=costs?costs.value:0;
    var irVal=ir?ir.value:0;

    if(grossVal!==null){
      r.bruto=grossVal;
      r.custos=costsVal;
    }else{
      r.warnings.push('Resultado bruto não identificado; preencha manualmente.');
    }

    r.irrf=Math.abs(irVal);
    if(liquid)r.liquidoNota=liquid.value;

    normalizeDayTradeNote(r);
  } else {
    r.warnings.push('Nota de ações: confira/preencha resultado e IRRF manualmente.');
  }

  if(!r.name) r.warnings.push('Titular não identificado no PDF.');
  return r;
}

