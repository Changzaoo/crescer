# 📋 Instruções de Importação Aave

## Tipos de Transação Aceitos

A importação do Aave agora reconhece **apenas** os seguintes tipos de transação:

### 1. **Supply** (Depósito)
Quando você deposita BTC no protocolo Aave.

**Exemplo CSV:**
```
action,amount,reserve.symbol,timestamp,assetPriceUSD
Supply,0.0000402,cbBTC,1728932940,67500.00
```

### 2. **CowCollateralSwap** (Troca de Colateral)
Quando você troca outro ativo por BTC através do protocolo Aave.

**Exemplo CSV:**
```
action,fromAmount,toAmount,reserve.symbol,toReserve.symbol,timestamp,assetPriceUSD
CowCollateralSwap,19.47,0.01,USDC,cbBTC,1728935460,67500.00
```

## Formato do Arquivo

### CSV
- **Separador:** vírgula (,)
- **Encoding:** UTF-8
- **Primeira linha:** cabeçalhos

**Campos obrigatórios:**
- `action`: Tipo da ação (Supply ou CowCollateralSwap)
- `amount` (para Supply): Quantidade de BTC
- `toAmount` (para CowCollateralSwap): Quantidade de BTC recebida
- `reserve.symbol` ou `symbol`: Símbolo do ativo (deve conter "BTC")
- `timestamp`: Unix timestamp em segundos
- `assetPriceUSD`: Preço do BTC em USD

### JSON
Array de objetos com as mesmas propriedades do CSV.

## Moedas BTC Reconhecidas
- cbBTC (Coinbase Wrapped Bitcoin)
- WBTC (Wrapped Bitcoin)
- renBTC (Ren Protocol Bitcoin)
- tBTC (Threshold Bitcoin)
- Qualquer token com "BTC" no símbolo

## Cálculo de Satoshis
O sistema calcula automaticamente os satoshis:
- **Supply:** Usa o campo `amount`
- **CowCollateralSwap:** Usa o campo `toAmount` (quantidade recebida de BTC)

**Conversão:** 1 BTC = 100,000,000 satoshis

## Debug
O sistema agora inclui logs no console do navegador (F12) para depuração:
- Total de transações processadas
- Transações filtradas (apenas BTC)
- Detalhes de cada importação

## Cores do Tema
O aplicativo agora usa tons **laranja Bitcoin** sutis:
- Fundo de login: tons laranja com transparência
- Botões: gradiente laranja (#fb923c → #f97316)
- Inputs focus: borda laranja
- Links: laranja (#fb923c)
