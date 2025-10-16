# 💱 Sistema de Conversão de Moedas

## 📋 Visão Geral

O sistema agora captura e armazena as **taxas de câmbio** no momento de cada transação, permitindo conversões precisas entre diferentes moedas (BRL, USD, EUR, GBP).

## 🔄 Como Funciona

### 1. **Captura de Taxas de Câmbio**
- Quando você registra uma **compra** ou **venda**, o sistema:
  - Busca as taxas de câmbio atuais da API ExchangeRate-API
  - Armazena as taxas de todas as moedas (BRL, USD, EUR, GBP) na transação
  - As taxas são fixas e históricas para cada transação

### 2. **Conversão Inteligente**
- Ao trocar a moeda de exibição, o sistema:
  - Usa as taxas históricas armazenadas em cada transação
  - Converte os valores originais para a moeda selecionada
  - Mantém a precisão dos cálculos de lucro/prejuízo

### 3. **Exemplo Prático**

#### Cenário:
```
Transação registrada em 15/10/2025:
- Compra: 0.001 BTC
- Valor: R$ 500,00 (BRL)
- Taxas armazenadas:
  * USD = 1.00
  * BRL = 5.00
  * EUR = 0.92
  * GBP = 0.79
```

#### Exibição:
- **Em BRL**: R$ 500,00 (valor original)
- **Em USD**: $100,00 (500 ÷ 5.00)
- **Em EUR**: €92,00 (500 ÷ 5.00 × 0.92)
- **Em GBP**: £79,00 (500 ÷ 5.00 × 0.79)

## 🎯 Benefícios

### ✅ Precisão Histórica
- Cada transação mantém suas taxas de câmbio originais
- Não há distorção causada por flutuações cambiais posteriores

### ✅ Cálculos Corretos
- Lucro/prejuízo calculado com base nas taxas históricas
- Total investido ajustado para a moeda de exibição

### ✅ Transparência
- Mostra o valor original e o convertido na tabela
- Indicador visual de conversão no card de portfólio

## 📊 Interface

### Card de Portfólio
```
┌─────────────────────────────────┐
│ Moeda: [BRL ▼]                  │
│ 💱 Valores convertidos usando   │
│    taxas de câmbio históricas   │
│                                 │
│ Total Investido: R$ 10.000,00   │
│ Valor Atual: R$ 12.500,00       │
│ Lucro: +R$ 2.500,00 (+25%)      │
└─────────────────────────────────┘
```

### Tabela de Transações
```
┌──────────┬─────────────────┬──────────────────┐
│ Data     │ Valor Total     │ Moeda Original   │
├──────────┼─────────────────┼──────────────────┤
│ 15/10/25 │ BRL 500,00      │ BRL 500,00       │
│          │                 │                  │
│ (Exibindo em BRL - moeda original)            │
└──────────┴─────────────────┴──────────────────┘

Ao mudar para USD:

┌──────────┬─────────────────┬──────────────────┐
│ Data     │ Valor Total     │ Moeda Original   │
├──────────┼─────────────────┼──────────────────┤
│ 15/10/25 │ USD 100,00      │ BRL 500,00       │
│          │                 │ (valor original) │
│ (Convertido para USD usando taxa histórica)   │
└──────────┴─────────────────┴──────────────────┘
```

## 🔧 API Utilizada

### ExchangeRate-API
- **URL**: https://api.exchangerate-api.com/v4/latest/USD
- **Tipo**: Gratuita, sem necessidade de chave API
- **Atualização**: A cada 5 minutos (para taxas atuais)
- **Cobertura**: 160+ moedas

### Estrutura da Resposta:
```json
{
  "base": "USD",
  "date": "2025-10-15",
  "rates": {
    "BRL": 5.0,
    "EUR": 0.92,
    "GBP": 0.79,
    ...
  }
}
```

## 📝 Estrutura de Dados

### Interface BitcoinTransaction:
```typescript
interface BitcoinTransaction {
  id: string;
  userId: string;
  type: 'buy' | 'sell';
  date: string;
  time: string;
  bitcoinAmount: number;
  satoshis: number;
  fiatAmount: number;
  fiatCurrency: string;  // Moeda original (BRL, USD, EUR, GBP)
  bitcoinPrice: number;
  createdAt: string;
  exchangeRates?: {      // ⭐ NOVO!
    BRL: number;
    USD: number;
    EUR: number;
    GBP: number;
  };
}
```

## 🚀 Próximas Melhorias

### Possíveis Adições:
- [ ] Adicionar mais moedas (JPY, CAD, AUD, etc.)
- [ ] Gráfico de evolução cambial
- [ ] Exportar relatório em múltiplas moedas
- [ ] Comparação entre taxas históricas e atuais
- [ ] Alert de grandes variações cambiais

## 💡 Dicas de Uso

1. **Registre transações na moeda original**: Sempre registre a compra/venda na moeda que você realmente usou
2. **Troque a moeda para análise**: Use o seletor de moeda para ver seus investimentos em diferentes perspectivas
3. **Compare resultados**: Veja como seu portfólio se comporta em diferentes moedas
4. **Histórico preservado**: Suas transações mantêm os valores originais intactos

---

**Desenvolvido para Crescer - Bitcoin Holding** 🚀
