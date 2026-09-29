# Calculadora Trader

Apuração mensal de IR sobre **day trade** (ações e mercado futuro) por CPF, com leitura de notas em PDF, fechamento mensal, relatório e DARF 6015.

> **Importação de PDF:** no momento, funciona somente com notas/comprovantes de **mercado futuro (BM&F) da corretora Santander**. Para outras corretoras e para notas de ações, use o **lançamento manual**.

- **Seus dados ficam só no seu computador.** O app é um conjunto de arquivos estáticos; não existe servidor, conta ou banco de dados on-line. Nada do que você lança é enviado para a internet.
- **Funciona offline** depois de aberto uma vez.
- **Instalável** (Chrome/Edge): vira um aplicativo com ícone e janela própria — sem instalador .exe.
- **Desempenho**: taxa de acerto, payoff, fator de lucro, drawdown, sequências, custos e resultado por dia da semana.
- **Relatório para a declaração (IRPF)** mês a mês e **aviso de DARF** perto do vencimento ou vencido.
- **Saldo em conta** por corretora: informe o saldo do extrato, depósitos e retiradas; o app soma o líquido de cada nota, sugere o saldo atual e calcula a rentabilidade do mês e do ano (não interfere no imposto).

## Como usar

1. Abra o endereço do app no Chrome ou no Edge.
2. Clique em **Instalar app** (no topo) ou no ícone de instalação na barra de endereço.
3. Na primeira abertura, escolha:
   - **Conectar a pasta com meus dados** — se você já usava a versão em arquivo único (HTML): selecione a pasta que contém a subpasta `dados`. Os dados são importados e a pasta passa a receber uma cópia automática.
   - **Importar arquivo de backup (.json)**, ou
   - **Começar do zero**.

## Onde ficam os dados

| Local | O que é |
|---|---|
| Armazenamento do app (IndexedDB) | Dados principais. Não precisa de permissão nem de pasta. |
| Versões internas | Cópias automáticas (a cada 10 min de uso e antes de apagar/restaurar). Restauráveis na seção *Dados e backup*. |
| Pasta de backup (opcional, recomendada) | `dados/calculadora-trader-dados.json` + `backups/`. Use uma pasta do OneDrive/Google Drive para ter cópia fora do computador. É o mesmo formato da versão portátil. |

> ⚠️ Desinstalar o app ou limpar os dados de navegação do Chrome/Edge apaga o armazenamento do app. Mantenha a pasta de backup conectada ou baixe backups periodicamente.

No app instalado, ao conectar a pasta, marque **“Permitir sempre”** para o navegador não pedir autorização a cada abertura.

## Regras de cálculo

- 20% sobre o resultado líquido mensal de day trade; ações e futuros compõem um único resultado (prejuízo de day trade compensa lucro de day trade).
- Prejuízo acumulado sem prazo; IRRF (1%) abatido do imposto no mesmo ano-calendário.
- DARF abaixo de R$ 10,00 é acumulado para o mês seguinte.
- Vencimento: último dia útil do mês seguinte (fins de semana, feriados nacionais, Carnaval, Sexta-feira Santa e Corpus Christi).

Ferramenta de apoio ao cálculo pessoal — não substitui orientação contábil. Confira sempre no Sicalc.

## Desenvolvimento

Sem etapa de build: são arquivos HTML/CSS/JS simples.

```bash
python -m http.server 8000
```

Abra `http://localhost:8000/` (app) e `http://localhost:8000/tests/` (testes das regras fiscais).

| Arquivo | Responsabilidade |
|---|---|
| `js/util.js` | Formatação, CPF, datas |
| `js/state.js` | Estado e migrações de formato |
| `js/fiscal.js` | Apuração (ledger), vencimento, fechamento, inconsistências |
| `js/pdf-parser.js` | Leitura das notas/comprovantes em PDF |
| `js/reports.js` | Relatório mensal e DARF |
| `js/charts.js` | Gráficos |
| `js/performance.js` | Painel de desempenho |
| `js/cash.js` | Saldo em conta e rentabilidade |
| `js/storage.js` | IndexedDB, versões internas, pasta de backup |
| `js/ui.js` | Telas e eventos |
| `js/app.js` | Inicialização, instalação e atualização |
| `sw.js` | Cache offline |

### Publicar uma nova versão

1. Altere `CACHE_VERSION` em `sw.js` (ex.: `calculadora-trader-v7.0.1`).
2. Rode os testes em `/tests/`.
3. Faça commit e push. Os usuários verão o aviso **“Nova versão disponível”**.

Bibliotecas incluídas: [pdf.js](https://mozilla.github.io/pdf.js/) (Apache 2.0) e [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) (MIT).
