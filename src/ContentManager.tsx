import { useState, useEffect } from 'react';
import { X, Trash2, LogIn, UserPlus, TrendingUp, TrendingDown, Bitcoin, BarChart3, Calendar, Clock, DollarSign, Percent, ArrowUpCircle, ArrowDownCircle, Edit, Sun, Moon } from 'lucide-react';
import { db } from './firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import SHA512 from 'crypto-js/sha512';
import CustomAlert from './components/CustomAlert';
import CustomConfirm from './components/CustomConfirm';

interface User {
  id: string;
  username: string;
  passwordHash: string;
  email?: string; // Email opcional
  createdAt: string;
}

interface BitcoinTransaction {
  id: string;
  userId: string;
  type: 'buy' | 'sell';
  date: string;
  time: string;
  bitcoinAmount: number;
  satoshis: number;
  fiatAmount: number;
  fiatCurrency: string;
  bitcoinPrice: number;
  createdAt: string;
  exchangeRates?: {
    BRL: number;
    USD: number;
    EUR: number;
    GBP: number;
  };
}

interface UserData {
  transactions: BitcoinTransaction[];
}

// Definições de cores para os temas
const themeColors = {
  dark: {
    background: '#0f172a',
    cardBg: '#1e293b',
    cardBgSecondary: '#0f172a',
    border: '#334155',
    borderSecondary: '#475569',
    text: '#ffffff',
    textSecondary: '#cbd5e1',
    textTertiary: '#94a3b8',
    inputBg: 'rgba(51, 65, 85, 0.5)',
    modalBg: 'linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #1e293b 100%)',
    headerBg: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
  },
  light: {
    background: '#f8fafc',
    cardBg: '#ffffff',
    cardBgSecondary: '#f1f5f9',
    border: '#e2e8f0',
    borderSecondary: '#cbd5e1',
    text: '#0f172a',
    textSecondary: '#475569',
    textTertiary: '#64748b',
    inputBg: '#ffffff',
    modalBg: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 50%, #ffffff 100%)',
    headerBg: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
  }
};

export default function ContentManager() {
  // Estados de autenticação
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showRegister, setShowRegister] = useState(false);
  const [showPasswordBuy, setShowPasswordBuy] = useState(false);
  const [showPasswordSell, setShowPasswordSell] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<BitcoinTransaction | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importProgress, setImportProgress] = useState('');
  
  // Estados de formulários
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ username: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  
  // Estados de preço e moeda
  const [currentBitcoinPrice, setCurrentBitcoinPrice] = useState<number>(0);
  const [selectedCurrency, setSelectedCurrency] = useState<string>('BRL');
  const [exchangeRates, setExchangeRates] = useState<{
    BRL: number;
    USD: number;
    EUR: number;
    GBP: number;
  }>({
    BRL: 1,
    USD: 1,
    EUR: 1,
    GBP: 1
  });
  
  // Estados de transações
  const [userTransactions, setUserTransactions] = useState<BitcoinTransaction[]>([]);
  
  // Estado do modal de transações
  const [showTransactionsModal, setShowTransactionsModal] = useState(false);
  
  // Estado para controlar número de transações exibidas
  const [transactionsToShow, setTransactionsToShow] = useState(10);
  
  // Estado do tema (dark/light)
  const [isDarkTheme, setIsDarkTheme] = useState(true);
  
  // Estados para alertas e confirmações personalizados
  const [alertConfig, setAlertConfig] = useState<{
    show: boolean;
    message: string;
    type: 'info' | 'success' | 'error' | 'warning';
  } | null>(null);
  
  const [confirmConfig, setConfirmConfig] = useState<{
    show: boolean;
    message: string;
    onConfirm: () => void;
  } | null>(null);
  
  // Funções helper para mostrar alertas e confirmações
  const showAlert = (message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    setAlertConfig({ show: true, message, type });
  };
  
  const showConfirm = (message: string, onConfirm: () => void) => {
    setConfirmConfig({ show: true, message, onConfirm });
  };
  
  const closeAlert = () => {
    setAlertConfig(null);
  };
  
  const closeConfirm = () => {
    setConfirmConfig(null);
  };
  
  // Estados de formulários de transação
  const [buyInputMode, setBuyInputMode] = useState<'fiat' | 'satoshis'>('fiat'); // Modo de entrada: fiat ou satoshis
  const [loadingHistoricalPrice, setLoadingHistoricalPrice] = useState(false);
  const [newBuyTransaction, setNewBuyTransaction] = useState({
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().split(' ')[0].slice(0, 5),
    bitcoinAmount: 0,
    fiatAmount: 0,
    fiatCurrency: selectedCurrency,
    bitcoinPrice: 0
  });
  
  const [newSellTransaction, setNewSellTransaction] = useState({
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().split(' ')[0].slice(0, 5),
    satoshiAmount: 0,
    fiatCurrency: selectedCurrency,
    bitcoinPrice: 0
  });

  // Função para hash da senha
  const hashPassword = (password: string): string => {
    return SHA512(password).toString();
  };

  // Função para salvar sessão no localStorage
  const saveSession = (user: User) => {
    localStorage.setItem('crescer_user_session', JSON.stringify(user));
  };

  // Função para carregar sessão do localStorage
  const loadSession = (): User | null => {
    const sessionData = localStorage.getItem('crescer_user_session');
    if (sessionData) {
      try {
        return JSON.parse(sessionData) as User;
      } catch {
        return null;
      }
    }
    return null;
  };

  // Função para limpar sessão do localStorage
  const clearSession = () => {
    localStorage.removeItem('crescer_user_session');
  };

  // Função para buscar taxas de câmbio
  const fetchExchangeRates = async () => {
    try {
      // Usando API ExchangeRate-API (gratuita)
      const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
      const data = await response.json();
      
      const rates = {
        USD: 1, // USD é a base
        BRL: data.rates.BRL || 5.0,
        EUR: data.rates.EUR || 0.92,
        GBP: data.rates.GBP || 0.79
      };
      
      setExchangeRates(rates);
      return rates;
    } catch (error) {
      console.error('Erro ao buscar taxas de câmbio:', error);
      // Valores padrão em caso de erro
      const defaultRates = {
        USD: 1,
        BRL: 5.0,
        EUR: 0.92,
        GBP: 0.79
      };
      setExchangeRates(defaultRates);
      return defaultRates;
    }
  };

  // Função para buscar preço histórico do Bitcoin em uma data/hora específica
  const fetchHistoricalBitcoinPrice = async (date: string, time: string, currency: string) => {
    try {
      // Converter data para timestamp Unix (em segundos)
      const dateTimeString = `${date}T${time}:00`;
      const timestamp = Math.floor(new Date(dateTimeString).getTime() / 1000);
      
      // Buscar preço histórico do Bitcoin em USD
      const response = await fetch(
        `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart/range?vs_currency=usd&from=${timestamp - 3600}&to=${timestamp + 3600}`
      );
      
      if (!response.ok) {
        throw new Error('Erro ao buscar preço histórico');
      }
      
      const data = await response.json();
      
      if (!data.prices || data.prices.length === 0) {
        throw new Error('Dados históricos não disponíveis');
      }
      
      // Pegar o preço mais próximo do timestamp solicitado
      let closestPrice = data.prices[0][1];
      let minDiff = Math.abs(data.prices[0][0] - timestamp * 1000);
      
      for (const [priceTimestamp, price] of data.prices) {
        const diff = Math.abs(priceTimestamp - timestamp * 1000);
        if (diff < minDiff) {
          minDiff = diff;
          closestPrice = price;
        }
      }
      
      // Converter de USD para a moeda desejada
      if (currency === 'USD') {
        return closestPrice;
      } else {
        const rateResponse = await fetch(`https://api.exchangerate-api.com/v4/latest/USD`);
        const rateData = await rateResponse.json();
        const rate = rateData.rates[currency] || 1;
        return closestPrice * rate;
      }
    } catch (error) {
      console.error('Erro ao buscar preço histórico:', error);
      // Em caso de erro, retornar preço atual
      return currentBitcoinPrice;
    }
  };

  // Função para converter valor entre moedas usando as taxas armazenadas na transação
  const convertCurrency = (
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    transactionRates?: { BRL: number; USD: number; EUR: number; GBP: number }
  ): number => {
    if (fromCurrency === toCurrency) return amount;
    
    // Usar taxas da transação se disponível, senão usar taxas atuais
    const rates = transactionRates || exchangeRates;
    
    // Converter para USD primeiro (base)
    const amountInUSD = amount / rates[fromCurrency as keyof typeof rates];
    
    // Converter de USD para moeda de destino
    return amountInUSD * rates[toCurrency as keyof typeof rates];
  };

  // Função para registrar usuário
  const registerUser = async () => {
    if (!registerForm.username || !registerForm.password) {
      setError('Usuário e senha são obrigatórios');
      return;
    }

    if (registerForm.password !== registerForm.confirmPassword) {
      setError('Senhas não coincidem');
      return;
    }

    if (registerForm.password.length < 6) {
      setError('Senha deve ter pelo menos 6 caracteres');
      return;
    }

    try {
      // Verificar se usuário já existe
      const usersQuery = query(
        collection(db, 'users'),
        where('username', '==', registerForm.username)
      );
      const existingUsers = await getDocs(usersQuery);
      
      if (!existingUsers.empty) {
        setError('Nome de usuário já existe');
        return;
      }

      const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const newUser: User = {
        id: userId,
        username: registerForm.username,
        passwordHash: hashPassword(registerForm.password),
        createdAt: new Date().toISOString()
      };

      // Salvar usuário no Firebase
      await setDoc(doc(db, 'users', userId), newUser);
      
      // Criar documento de transações do usuário
      await setDoc(doc(db, 'userTransactions', userId), { transactions: [] });

      setCurrentUser(newUser);
      setIsAuthenticated(true);
      setShowRegister(false);
      setError('');
      
      // Limpar formulário
      setRegisterForm({ username: '', password: '', confirmPassword: '' });
      showAlert('Conta criada com sucesso! Bem-vindo!', 'success');
    } catch (error) {
      console.error('Erro ao registrar usuário:', error);
      setError('Erro ao criar conta. Tente novamente.');
      showAlert('Erro ao criar conta. Tente novamente.', 'error');
    }
  };

  // Função para fazer login
  const loginUser = async () => {
    if (!loginForm.username || !loginForm.password) {
      setError('Usuário e senha são obrigatórios');
      return;
    }

    try {
      const usersQuery = query(
        collection(db, 'users'),
        where('username', '==', loginForm.username)
      );
      const userDocs = await getDocs(usersQuery);
      
      if (userDocs.empty) {
        setError('Usuário não encontrado');
        return;
      }

      const userData = userDocs.docs[0].data() as User;
      const hashedPassword = hashPassword(loginForm.password);
      
      if (userData.passwordHash !== hashedPassword) {
        setError('Senha incorreta');
        return;
      }

      setCurrentUser(userData);
      setIsAuthenticated(true);
      setError('');
      
      // Salvar sessão no localStorage
      saveSession(userData);
      
      // Carregar transações do usuário
      await loadUserTransactions(userData.id);
      
      // Limpar formulário
      setLoginForm({ username: '', password: '' });
      showAlert(`Bem-vindo de volta, ${userData.username}!`, 'success');
    } catch (error) {
      console.error('Erro ao fazer login:', error);
      setError('Erro ao entrar. Tente novamente.');
      showAlert('Erro ao fazer login. Verifique suas credenciais.', 'error');
    }
  };

  // Função para carregar transações do usuário
  const loadUserTransactions = async (userId: string) => {
    try {
      const userTransactionsDoc = await getDoc(doc(db, 'userTransactions', userId));
      if (userTransactionsDoc.exists()) {
        const data = userTransactionsDoc.data() as UserData;
        setUserTransactions(data.transactions || []);
      }
    } catch (error) {
      console.error('Erro ao carregar transações:', error);
    }
  };

  // Função para logout
  const logout = () => {
    setCurrentUser(null);
    setIsAuthenticated(false);
    setUserTransactions([]);
    clearSession(); // Limpar sessão do localStorage
  };

  // Função para adicionar ou editar transação de compra
  const addBuyTransaction = async () => {
    if (!currentUser) return;

    // Buscar taxas de câmbio atualizadas no momento da transação
    const currentRates = await fetchExchangeRates();

    const satoshis = Math.round(newBuyTransaction.bitcoinAmount * 100000000);
    
    let updatedTransactions;
    
    if (editingTransaction) {
      // Editando transação existente
      updatedTransactions = userTransactions.map(t => 
        t.id === editingTransaction.id 
          ? {
              ...t,
              date: newBuyTransaction.date,
              time: newBuyTransaction.time,
              bitcoinAmount: newBuyTransaction.bitcoinAmount,
              satoshis: satoshis,
              fiatAmount: newBuyTransaction.fiatAmount,
              fiatCurrency: newBuyTransaction.fiatCurrency,
              bitcoinPrice: newBuyTransaction.bitcoinPrice,
              exchangeRates: currentRates
            }
          : t
      );
    } else {
      // Nova transação
      const transaction: BitcoinTransaction = {
        id: `buy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: currentUser.id,
        type: 'buy',
        date: newBuyTransaction.date,
        time: newBuyTransaction.time,
        bitcoinAmount: newBuyTransaction.bitcoinAmount,
        satoshis: satoshis,
        fiatAmount: newBuyTransaction.fiatAmount,
        fiatCurrency: newBuyTransaction.fiatCurrency,
        bitcoinPrice: newBuyTransaction.bitcoinPrice,
        createdAt: new Date().toISOString(),
        exchangeRates: currentRates
      };
      updatedTransactions = [...userTransactions, transaction];
    }

    try {
      await setDoc(doc(db, 'userTransactions', currentUser.id), { transactions: updatedTransactions });
      setUserTransactions(updatedTransactions);

      // Reset form
      setNewBuyTransaction({
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().split(' ')[0].slice(0, 5),
        bitcoinAmount: 0,
        fiatAmount: 0,
        fiatCurrency: selectedCurrency,
        bitcoinPrice: 0
      });
      setShowPasswordBuy(false);
      setEditingTransaction(null);
      showAlert('Compra salva com sucesso!', 'success');
    } catch (error) {
      console.error('Erro ao salvar compra:', error);
      setError('Erro ao salvar compra');
      showAlert('Erro ao salvar compra. Tente novamente.', 'error');
    }
  };

  // Função para adicionar transação de venda
  const addSellTransaction = async () => {
    if (!currentUser || newSellTransaction.bitcoinPrice === 0) return;

    const totalSatoshis = calculateTotalSatoshis();
    if (newSellTransaction.satoshiAmount > totalSatoshis) {
      setError('Quantidade de satoshis insuficiente');
      return;
    }

    // Buscar taxas de câmbio atualizadas no momento da transação
    const currentRates = await fetchExchangeRates();

    const bitcoinAmount = newSellTransaction.satoshiAmount / 100000000;
    const fiatAmount = bitcoinAmount * newSellTransaction.bitcoinPrice;

    const transaction: BitcoinTransaction = {
      id: `sell_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: currentUser.id,
      type: 'sell',
      date: newSellTransaction.date,
      time: newSellTransaction.time,
      bitcoinAmount: bitcoinAmount,
      satoshis: newSellTransaction.satoshiAmount,
      fiatAmount: fiatAmount,
      fiatCurrency: newSellTransaction.fiatCurrency,
      bitcoinPrice: newSellTransaction.bitcoinPrice,
      createdAt: new Date().toISOString(),
      exchangeRates: currentRates // Salvar taxas de câmbio do momento da transação
    };

    try {
      const updatedTransactions = [...userTransactions, transaction];
      await setDoc(doc(db, 'userTransactions', currentUser.id), { transactions: updatedTransactions });
      setUserTransactions(updatedTransactions);

      // Reset form
      setNewSellTransaction({
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().split(' ')[0].slice(0, 5),
        satoshiAmount: 0,
        fiatCurrency: selectedCurrency,
        bitcoinPrice: 0
      });
      setShowPasswordSell(false);
      setError('');
      showAlert('Venda registrada com sucesso!', 'success');
    } catch (error) {
      console.error('Erro ao adicionar venda:', error);
      setError('Erro ao registrar venda');
      showAlert('Erro ao registrar venda. Tente novamente.', 'error');
    }
  };

  // Função para deletar transação
  const deleteTransaction = async (transactionId: string) => {
    if (!currentUser) return;

    try {
      const updatedTransactions = userTransactions.filter(t => t.id !== transactionId);
      await setDoc(doc(db, 'userTransactions', currentUser.id), { transactions: updatedTransactions });
      setUserTransactions(updatedTransactions);
      showAlert('Transação excluída com sucesso!', 'success');
    } catch (error) {
      console.error('Erro ao deletar transação:', error);
      setError('Erro ao deletar transação');
      showAlert('Erro ao excluir transação. Tente novamente.', 'error');
    }
  };

  // Calcular totais
  const calculateTotalSatoshis = () => {
    return userTransactions.reduce((sum, transaction) => {
      return transaction.type === 'buy' 
        ? sum + transaction.satoshis 
        : sum - transaction.satoshis;
    }, 0);
  };

  const calculateTotalBitcoin = () => {
    return calculateTotalSatoshis() / 100000000;
  };

  const calculateTotalInvested = () => {
    return userTransactions.reduce((sum, transaction) => {
      // Converter valor da transação para moeda selecionada
      const convertedAmount = convertCurrency(
        transaction.fiatAmount,
        transaction.fiatCurrency,
        selectedCurrency,
        transaction.exchangeRates
      );
      
      return transaction.type === 'buy' 
        ? sum + convertedAmount 
        : sum - convertedAmount;
    }, 0);
  };

  // Calcular preço médio de compra
  const calculateAverageBuyPrice = () => {
    const buyTransactions = userTransactions.filter(t => t.type === 'buy');
    if (buyTransactions.length === 0) return 0;
    
    const totalSpent = buyTransactions.reduce((sum, transaction) => {
      const convertedAmount = convertCurrency(
        transaction.fiatAmount,
        transaction.fiatCurrency,
        selectedCurrency,
        transaction.exchangeRates
      );
      return sum + convertedAmount;
    }, 0);
    
    const totalBitcoin = buyTransactions.reduce((sum, transaction) => {
      return sum + transaction.satoshis / 100000000;
    }, 0);
    
    return totalBitcoin > 0 ? totalSpent / totalBitcoin : 0;
  };

  // Calcular preço médio de venda
  const calculateAverageSellPrice = () => {
    const sellTransactions = userTransactions.filter(t => t.type === 'sell');
    if (sellTransactions.length === 0) return 0;
    
    const totalReceived = sellTransactions.reduce((sum, transaction) => {
      const convertedAmount = convertCurrency(
        transaction.fiatAmount,
        transaction.fiatCurrency,
        selectedCurrency,
        transaction.exchangeRates
      );
      return sum + convertedAmount;
    }, 0);
    
    const totalBitcoin = sellTransactions.reduce((sum, transaction) => {
      return sum + transaction.satoshis / 100000000;
    }, 0);
    
    return totalBitcoin > 0 ? totalReceived / totalBitcoin : 0;
  };

  // Buscar preço atual do Bitcoin na Binance
  const fetchBitcoinPrice = async () => {
    try {
      const response = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT');
      const data = await response.json();
      const usdPrice = parseFloat(data.price);
      
      // Converter para a moeda selecionada
      if (selectedCurrency === 'USD') {
        setCurrentBitcoinPrice(usdPrice);
      } else {
        // Buscar taxa de câmbio USD para moeda selecionada
        const rateResponse = await fetch(`https://api.exchangerate-api.com/v4/latest/USD`);
        const rateData = await rateResponse.json();
        const rate = rateData.rates[selectedCurrency] || 1;
        setCurrentBitcoinPrice(usdPrice * rate);
      }
    } catch (error) {
      console.error('Erro ao buscar preço do Bitcoin:', error);
    }
  };

  // Calcular lucro/prejuízo para uma transação específica
  const calculateProfitLoss = (transaction: BitcoinTransaction) => {
    if (currentBitcoinPrice === 0 || transaction.type === 'sell') return { profit: 0, percentage: 0 };
    
    // Valor atual em moeda selecionada
    const currentValue = transaction.bitcoinAmount * currentBitcoinPrice;
    
    // Converter valor original da transação para moeda selecionada
    const originalValueInSelectedCurrency = convertCurrency(
      transaction.fiatAmount,
      transaction.fiatCurrency,
      selectedCurrency,
      transaction.exchangeRates
    );
    
    const profit = currentValue - originalValueInSelectedCurrency;
    const percentage = ((currentValue - originalValueInSelectedCurrency) / originalValueInSelectedCurrency) * 100;
    
    return { profit, percentage };
  };

  // Função para importar transações da Aave (apenas BTC - Supply e Collateral Swap)
  const importAaveTransactions = async (fileContent: string, fileType: 'csv' | 'json') => {
    try {
      setImportProgress('🔍 Processando arquivo...');
      let transactions: any[] = [];

      if (fileType === 'json') {
        transactions = JSON.parse(fileContent);
      } else {
        // Parse CSV aprimorado - lida com vírgulas dentro de aspas
        const lines = fileContent.split('\n').filter(line => line.trim());
        if (lines.length < 2) {
          setError('Arquivo CSV vazio ou inválido.');
          setImportProgress('');
          return;
        }

        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        
        transactions = lines.slice(1).map((line, index) => {
          // Parse linha respeitando campos entre aspas
          const values: string[] = [];
          let currentValue = '';
          let insideQuotes = false;
          
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
              insideQuotes = !insideQuotes;
            } else if (char === ',' && !insideQuotes) {
              values.push(currentValue.trim().replace(/"/g, ''));
              currentValue = '';
            } else {
              currentValue += char;
            }
          }
          values.push(currentValue.trim().replace(/"/g, ''));

          const obj: any = {};
          headers.forEach((header, idx) => {
            obj[header] = values[idx] || '';
          });
          
          console.log(`Linha ${index + 1}:`, obj); // Debug
          return obj;
        }).filter(obj => Object.keys(obj).length > 0);
      }

      console.log('Total de transações processadas:', transactions.length);
      setImportProgress(`📊 Encontradas ${transactions.length} transações. Filtrando BTC...`);

      // Filtrar APENAS Supply e Collateral Swap com BTC
      const btcTransactions = transactions.filter(tx => {
        const symbol = (tx['reserve.symbol'] || tx.symbol || '').toUpperCase();
        const action = (tx.action || '').trim();
        
        console.log(`Transação: ${action} | Símbolo: ${symbol}`); // Debug
        
        const isBTC = symbol.includes('BTC');
        const isValidAction = action === 'Supply' || action === 'CowCollateralSwap';
        
        return isBTC && isValidAction;
      });

      console.log('Transações BTC filtradas:', btcTransactions);
      setImportProgress(`✅ ${btcTransactions.length} transações de BTC encontradas. Importando...`);

      if (btcTransactions.length === 0) {
        setError('❌ Nenhuma transação de BTC (Supply/Collateral Swap) encontrada no arquivo.');
        setImportProgress('');
        return;
      }

      // Converter transações da Aave para o formato do sistema
      let importedCount = 0;
      for (const tx of btcTransactions) {
        try {
          const timestamp = parseInt(tx.timestamp);
          const date = new Date(timestamp * 1000);
          
          // Para Supply, usar tx.amount
          // Para Collateral Swap, usar tx.toAmount (quantidade recebida de BTC)
          let amount = 0;
          if (tx.action === 'Supply') {
            amount = parseFloat(tx.amount || '0');
          } else if (tx.action === 'CowCollateralSwap') {
            // Em Collateral Swap, toAmount é o BTC recebido
            amount = parseFloat(tx.toAmount || '0');
          }

          const priceUSD = parseFloat(tx.assetPriceUSD || '0');

          console.log(`Importando: ${tx.action} | Amount: ${amount} | Price: ${priceUSD}`);

          if (isNaN(amount) || amount <= 0) {
            console.log('Quantidade inválida, pulando...');
            continue;
          }

          // Todas são compras (Supply ou swap para receber BTC)
          const newTransaction: BitcoinTransaction = {
            id: tx.id || `imported-${Date.now()}-${Math.random()}`,
            userId: currentUser!.id,
            type: 'buy',
            date: date.toISOString().split('T')[0],
            time: date.toTimeString().split(' ')[0].slice(0, 5),
            bitcoinAmount: amount,
            satoshis: Math.round(amount * 100000000),
            fiatAmount: amount * priceUSD,
            fiatCurrency: 'USD',
            bitcoinPrice: priceUSD,
            createdAt: new Date().toISOString(),
            exchangeRates: exchangeRates
          };

          // Adicionar ao Firestore
          const userDocRef = doc(db, 'users', currentUser!.id);
          const userDoc = await getDoc(userDocRef);
          const existingData = userDoc.data() as UserData || { transactions: [] };
          
          await setDoc(userDocRef, {
            transactions: [...existingData.transactions, newTransaction]
          });

          importedCount++;
          setImportProgress(`⏳ Importando... ${importedCount}/${btcTransactions.length}`);
        } catch (txError) {
          console.error('Erro ao importar transação:', tx, txError);
        }
      }

      // Recarregar transações
      await loadUserTransactions(currentUser!.id);
      
      setImportProgress(`🎉 Importação concluída! ${importedCount} transações de BTC importadas com sucesso!`);
      
      setTimeout(() => {
        setShowImportModal(false);
        setImportProgress('');
      }, 3000);

    } catch (error) {
      console.error('Erro ao importar transações da Aave:', error);
      setError('Erro ao processar arquivo. Verifique se o formato está correto.');
      setImportProgress('❌ Erro ao processar arquivo');
    }
  };

  // Handler para upload de arquivo
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    if (fileExtension !== 'csv' && fileExtension !== 'json') {
      setError('Por favor, envie um arquivo CSV ou JSON.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      importAaveTransactions(content, fileExtension as 'csv' | 'json');
    };
    reader.readAsText(file);
  };

  // Aplicar tema ao body
  useEffect(() => {
    if (isDarkTheme) {
      document.body.classList.remove('light-theme');
    } else {
      document.body.classList.add('light-theme');
    }
  }, [isDarkTheme]);

  // Restaurar sessão ao carregar o componente
  useEffect(() => {
    const savedUser = loadSession();
    if (savedUser) {
      setCurrentUser(savedUser);
      setIsAuthenticated(true);
      loadUserTransactions(savedUser.id);
    }
    // Buscar taxas de câmbio ao carregar
    fetchExchangeRates();
  }, []); // Executar apenas uma vez na montagem do componente

  // Buscar preço do Bitcoin periodicamente
  useEffect(() => {
    fetchBitcoinPrice(); // Buscar imediatamente
    const interval = setInterval(fetchBitcoinPrice, 1000); // Atualizar a cada 1 segundo
    return () => clearInterval(interval);
  }, [selectedCurrency]);

  // Atualizar taxas de câmbio periodicamente (a cada 5 minutos)
  useEffect(() => {
    const interval = setInterval(fetchExchangeRates, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Buscar preço histórico quando data ou hora da transação mudarem
  useEffect(() => {
    const fetchHistoricalPrice = async () => {
      if (newBuyTransaction.date && newBuyTransaction.time && showPasswordBuy) {
        // Verificar se a data/hora é a atual (ou muito próxima)
        const now = new Date();
        const selectedDateTime = new Date(`${newBuyTransaction.date}T${newBuyTransaction.time}`);
        const diffInMinutes = Math.abs(now.getTime() - selectedDateTime.getTime()) / (1000 * 60);
        
        // Se a diferença for menor que 10 minutos, usar preço em tempo real
        if (diffInMinutes < 10) {
          console.log('📊 Usando preço em tempo real (data/hora atual)');
          setNewBuyTransaction(prev => ({
            ...prev,
            bitcoinPrice: currentBitcoinPrice
          }));
          return;
        }

        // Caso contrário, buscar preço histórico
        console.log('📅 Buscando preço histórico para', newBuyTransaction.date, newBuyTransaction.time);
        setLoadingHistoricalPrice(true);
        try {
          const historicalPrice = await fetchHistoricalBitcoinPrice(
            newBuyTransaction.date,
            newBuyTransaction.time,
            newBuyTransaction.fiatCurrency
          );
          setNewBuyTransaction(prev => ({
            ...prev,
            bitcoinPrice: historicalPrice
          }));
        } catch (error) {
          console.error('Erro ao buscar preço histórico:', error);
        } finally {
          setLoadingHistoricalPrice(false);
        }
      }
    };

    // Adicionar debounce para não fazer muitas requisições
    const timeoutId = setTimeout(fetchHistoricalPrice, 500);
    return () => clearTimeout(timeoutId);
  }, [newBuyTransaction.date, newBuyTransaction.time, newBuyTransaction.fiatCurrency, showPasswordBuy, currentBitcoinPrice]);

  // Buscar preço histórico para vendas quando data ou hora mudarem
  useEffect(() => {
    const fetchHistoricalPriceForSell = async () => {
      if (newSellTransaction.date && newSellTransaction.time && showPasswordSell) {
        // Verificar se a data/hora é a atual (ou muito próxima)
        const now = new Date();
        const selectedDateTime = new Date(`${newSellTransaction.date}T${newSellTransaction.time}`);
        const diffInMinutes = Math.abs(now.getTime() - selectedDateTime.getTime()) / (1000 * 60);
        
        // Se a diferença for menor que 10 minutos, usar preço em tempo real
        if (diffInMinutes < 10) {
          console.log('📊 Usando preço em tempo real (data/hora atual)');
          setNewSellTransaction(prev => ({
            ...prev,
            bitcoinPrice: currentBitcoinPrice
          }));
          return;
        }

        // Caso contrário, buscar preço histórico
        console.log('📅 Buscando preço histórico para', newSellTransaction.date, newSellTransaction.time);
        setLoadingHistoricalPrice(true);
        try {
          const historicalPrice = await fetchHistoricalBitcoinPrice(
            newSellTransaction.date,
            newSellTransaction.time,
            newSellTransaction.fiatCurrency
          );
          setNewSellTransaction(prev => ({
            ...prev,
            bitcoinPrice: historicalPrice
          }));
        } catch (error) {
          console.error('Erro ao buscar preço histórico:', error);
        } finally {
          setLoadingHistoricalPrice(false);
        }
      }
    };

    const timeoutId = setTimeout(fetchHistoricalPriceForSell, 500);
    return () => clearTimeout(timeoutId);
  }, [newSellTransaction.date, newSellTransaction.time, newSellTransaction.fiatCurrency, showPasswordSell, currentBitcoinPrice]);

  // Sincronizar moeda selecionada com os formulários
  useEffect(() => {
    setNewBuyTransaction(prev => ({
      ...prev,
      fiatCurrency: selectedCurrency
    }));
    setNewSellTransaction(prev => ({
      ...prev,
      fiatCurrency: selectedCurrency
    }));
  }, [selectedCurrency]);

  // Carregar transações do usuário quando autenticado
  useEffect(() => {
    if (isAuthenticated && currentUser) {
      loadUserTransactions(currentUser.id);
    }
  }, [isAuthenticated, currentUser]);

  // DEBUG: Monitorar mudanças nos estados dos modais
  useEffect(() => {
    console.log('🔍 Estado showPasswordBuy mudou para:', showPasswordBuy);
  }, [showPasswordBuy]);

  useEffect(() => {
    console.log('🔍 Estado showPasswordSell mudou para:', showPasswordSell);
  }, [showPasswordSell]);

  // Cores do tema atual - definindo aqui para usar em TODO o componente
  const colors = isDarkTheme ? themeColors.dark : themeColors.light;

  // Se não estiver autenticado, mostrar tela de login/registro
  if (!isAuthenticated) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        background: colors.modalBg,
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Efeitos de fundo */}
        <div style={{
          position: 'absolute',
          top: '10%',
          left: '10%',
          width: '300px',
          height: '300px',
          background: 'radial-gradient(circle, rgba(251, 146, 60, 0.12) 0%, transparent 70%)',
          borderRadius: '50%',
          filter: 'blur(40px)',
          animation: 'pulse 4s ease-in-out infinite'
        }}></div>
        <div style={{
          position: 'absolute',
          bottom: '10%',
          right: '10%',
          width: '400px',
          height: '400px',
          background: 'radial-gradient(circle, rgba(245, 158, 11, 0.10) 0%, transparent 70%)',
          borderRadius: '50%',
          filter: 'blur(50px)',
          animation: 'pulse 5s ease-in-out infinite',
          animationDelay: '1s'
        }}></div>
        
        <div style={{
          backgroundColor: colors.cardBg,
          borderRadius: '24px',
          padding: '48px',
          width: '100%',
          maxWidth: '480px',
          position: 'relative',
          zIndex: 10,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          border: `1px solid ${colors.border}`,
          backdropFilter: 'blur(10px)'
        }}>
          {/* Logo com ícone Bitcoin */}
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <img 
              src="/logo.png" 
              alt="Bitcoin Logo" 
              style={{
                width: '120px',
                height: '120px',
                margin: '0 auto',
                display: 'block',
                filter: 'drop-shadow(0 10px 25px rgba(245, 158, 11, 0.5))'
              }}
            />
          </div>

          {/* Erro */}
          {error && (
            <div style={{
              backgroundColor: '#7f1d1d',
              border: '1px solid #991b1b',
              color: '#fca5a5',
              padding: '16px',
              borderRadius: '12px',
              marginBottom: '24px',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <span style={{ fontSize: '18px' }}>⚠️</span>
              {error}
            </div>
          )}

          {!showRegister ? (
            /* Formulário de Login */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                <h2 style={{
                  fontSize: '24px',
                  fontWeight: 'bold',
                  color: colors.text,
                  margin: '0'
                }}>
                  Entrar na Conta
                </h2>
              </div>
              
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: colors.text,
                  marginBottom: '8px'
                }}>
                  Nome de Usuário
                </label>
                <input
                  type="text"
                  value={loginForm.username}
                  onChange={(e) => setLoginForm({...loginForm, username: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    fontSize: '16px',
                    backgroundColor: colors.inputBg,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '12px',
                    color: colors.text,
                    outline: 'none',
                    transition: 'all 0.2s',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#fb923c';
                    e.target.style.boxShadow = '0 0 0 3px rgba(251, 146, 60, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = colors.border;
                    e.target.style.boxShadow = 'none';
                  }}
                  placeholder="Digite seu usuário"
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: colors.text,
                  marginBottom: '8px'
                }}>
                  Senha
                </label>
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    fontSize: '16px',
                    backgroundColor: colors.inputBg,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '12px',
                    color: colors.text,
                    outline: 'none',
                    transition: 'all 0.2s',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#fb923c';
                    e.target.style.boxShadow = '0 0 0 3px rgba(251, 146, 60, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = colors.border;
                    e.target.style.boxShadow = 'none';
                  }}
                  placeholder="Digite sua senha"
                />
              </div>

              <button
                onClick={loginUser}
                style={{
                  width: '100%',
                  padding: '16px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  color: 'white',
                  background: 'linear-gradient(135deg, #fb923c 0%, #f97316 100%)',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 12px rgba(251, 146, 60, 0.4)',
                  transition: 'all 0.3s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(251, 146, 60, 0.5)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(251, 146, 60, 0.4)';
                }}
              >
                <LogIn style={{ width: '20px', height: '20px' }} />
                Entrar
              </button>

              <div style={{ textAlign: 'center' }}>
                <button
                  onClick={() => setShowRegister(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#fb923c',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#fdba74'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#fb923c'}
                >
                  Não tem conta? Criar nova conta
                </button>
              </div>
            </div>
          ) : (
            /* Formulário de Registro */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                <h2 style={{
                  fontSize: '24px',
                  fontWeight: 'bold',
                  color: colors.text,
                  margin: '0'
                }}>
                  Criar Nova Conta
                </h2>
              </div>
              
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: colors.text,
                  marginBottom: '8px'
                }}>
                  Nome de Usuário
                </label>
                <input
                  type="text"
                  value={registerForm.username}
                  onChange={(e) => setRegisterForm({...registerForm, username: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    fontSize: '16px',
                    backgroundColor: colors.inputBg,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '12px',
                    color: colors.text,
                    outline: 'none',
                    transition: 'all 0.2s',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#10b981';
                    e.target.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = colors.border;
                    e.target.style.boxShadow = 'none';
                  }}
                  placeholder="Escolha um nome de usuário"
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: 'white',
                  marginBottom: '8px'
                }}>
                  Senha
                </label>
                <input
                  type="password"
                  value={registerForm.password}
                  onChange={(e) => setRegisterForm({...registerForm, password: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    fontSize: '16px',
                    backgroundColor: colors.inputBg,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '12px',
                    color: colors.text,
                    outline: 'none',
                    transition: 'all 0.2s',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#10b981';
                    e.target.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = colors.border;
                    e.target.style.boxShadow = 'none';
                  }}
                  placeholder="Crie uma senha (min. 6 caracteres)"
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: colors.text,
                  marginBottom: '8px'
                }}>
                  Confirmar Senha
                </label>
                <input
                  type="password"
                  value={registerForm.confirmPassword}
                  onChange={(e) => setRegisterForm({...registerForm, confirmPassword: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    fontSize: '16px',
                    backgroundColor: colors.inputBg,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '12px',
                    color: colors.text,
                    outline: 'none',
                    transition: 'all 0.2s',
                    boxSizing: 'border-box'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#10b981';
                    e.target.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = colors.border;
                    e.target.style.boxShadow = 'none';
                  }}
                  placeholder="Confirme sua senha"
                />
              </div>

              <button
                onClick={registerUser}
                style={{
                  width: '100%',
                  padding: '16px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  color: 'white',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)',
                  transition: 'all 0.3s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.5)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.4)';
                }}
              >
                <UserPlus style={{ width: '20px', height: '20px' }} />
                Criar Conta
              </button>

              <div style={{ textAlign: 'center' }}>
                <button
                  onClick={() => setShowRegister(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#fb923c',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#fdba74'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#fb923c'}
                >
                  Já tem conta? Fazer login
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Interface principal (usuário autenticado)
  return (
    <>
      {/* ========== MODAL DE COMPRA ========== */}
      {showPasswordBuy && (
        <div 
          onClick={() => setShowPasswordBuy(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            zIndex: 999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            backdropFilter: 'blur(8px)'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: colors.cardBg,
              borderRadius: '24px',
              maxWidth: '600px',
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              border: `1px solid ${colors.border}`
            }}
          >
            {/* Header do Modal */}
            <div style={{
              padding: '24px 32px',
              borderBottom: `1px solid ${colors.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: colors.headerBg
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 10px 25px -5px rgba(16, 185, 129, 0.5)'
                }}>
                  <TrendingUp style={{ width: '24px', height: '24px', color: 'white' }} />
                </div>
                <div>
                  <h2 style={{
                    fontSize: '24px',
                    fontWeight: 'bold',
                    color: colors.text,
                    margin: 0,
                    lineHeight: '1.2'
                  }}>
                    {editingTransaction ? 'Editar Compra' : 'Registrar Compra'}
                  </h2>
                  <p style={{
                    fontSize: '14px',
                    color: colors.textTertiary,
                    margin: '4px 0 0 0'
                  }}>
                    Adicione uma transação de compra
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowPasswordBuy(false);
                  setBuyInputMode('fiat');
                  setEditingTransaction(null);
                  setNewBuyTransaction({
                    date: new Date().toISOString().split('T')[0],
                    time: new Date().toTimeString().split(' ')[0].slice(0, 5),
                    bitcoinAmount: 0,
                    fiatAmount: 0,
                    fiatCurrency: selectedCurrency,
                    bitcoinPrice: 0
                  });
                }}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: colors.borderSecondary,
                  color: colors.textSecondary,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = colors.textSecondary;
                  e.currentTarget.style.color = colors.text;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = colors.borderSecondary;
                  e.currentTarget.style.color = colors.textSecondary;
                }}
              >
                <X style={{ width: '20px', height: '20px' }} />
              </button>
            </div>

            {/* Corpo do Modal */}
            <div style={{ padding: '32px' }}>
              {error && (
                <div style={{
                  backgroundColor: '#7f1d1d',
                  border: '1px solid #991b1b',
                  color: '#fca5a5',
                  padding: '16px',
                  borderRadius: '12px',
                  marginBottom: '24px',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  animation: 'fadeIn 0.3s ease-in-out'
                }}>
                  <span style={{ fontSize: '18px' }}>⚠️</span>
                  {error}
                </div>
              )}

              {/* Seletor de Modo */}
              <div style={{
                backgroundColor: colors.cardBgSecondary,
                border: `1px solid ${colors.border}`,
                padding: '20px',
                borderRadius: '16px',
                marginBottom: '24px'
              }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: colors.text,
                  marginBottom: '12px'
                }}>
                  Como você quer registrar?
                </label>
                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px'}}>
                  <button
                    type="button"
                    onClick={() => {
                      setBuyInputMode('fiat');
                      setNewBuyTransaction({...newBuyTransaction, bitcoinAmount: 0, fiatAmount: 0});
                    }}
                    style={{
                      padding: '14px',
                      borderRadius: '12px',
                      border: buyInputMode === 'fiat' ? '2px solid #10b981' : `1px solid ${colors.border}`,
                      fontWeight: '600',
                      fontSize: '14px',
                      cursor: 'pointer',
                      backgroundColor: buyInputMode === 'fiat' ? '#10b981' : colors.cardBg,
                      color: colors.text,
                      transition: 'all 0.2s',
                      boxShadow: buyInputMode === 'fiat' ? '0 4px 12px rgba(16, 185, 129, 0.4)' : 'none'
                    }}
                  >
                    💰 Valor em Fiat
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBuyInputMode('satoshis');
                      setNewBuyTransaction({...newBuyTransaction, bitcoinAmount: 0, fiatAmount: 0});
                    }}
                    style={{
                      padding: '14px',
                      borderRadius: '12px',
                      border: buyInputMode === 'satoshis' ? '2px solid #10b981' : `1px solid ${colors.border}`,
                      fontWeight: '600',
                      fontSize: '14px',
                      cursor: 'pointer',
                      backgroundColor: buyInputMode === 'satoshis' ? '#10b981' : colors.cardBg,
                      color: colors.text,
                      transition: 'all 0.2s',
                      boxShadow: buyInputMode === 'satoshis' ? '0 4px 12px rgba(16, 185, 129, 0.4)' : 'none'
                    }}
                  >
                    ₿ Quantidade Satoshis
                  </button>
                </div>
              </div>

              {/* Data e Hora */}
              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '8px'}}>
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: colors.text,
                    marginBottom: '8px'
                  }}>
                    📅 Data
                  </label>
                  <input
                    type="date"
                    value={newBuyTransaction.date}
                    onChange={(e) => setNewBuyTransaction({...newBuyTransaction, date: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '12px',
                      border: `1px solid ${colors.border}`,
                      fontSize: '14px',
                      backgroundColor: colors.inputBg,
                      color: colors.text,
                      outline: 'none',
                      transition: 'all 0.2s',
                      boxSizing: 'border-box'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#10b981';
                      e.target.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = colors.border;
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: colors.text,
                    marginBottom: '8px'
                  }}>
                    🕐 Hora
                  </label>
                  <input
                    type="time"
                    value={newBuyTransaction.time}
                    onChange={(e) => setNewBuyTransaction({...newBuyTransaction, time: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '12px',
                      border: `1px solid ${colors.border}`,
                      fontSize: '14px',
                      backgroundColor: colors.inputBg,
                      color: colors.text,
                      outline: 'none',
                      transition: 'all 0.2s',
                      boxSizing: 'border-box'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#10b981';
                      e.target.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = colors.border;
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>
              </div>

              {/* Moeda */}
              <div style={{ marginTop: '8px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: colors.text,
                  marginBottom: '8px'
                }}>
                  💱 Moeda
                </label>
                <select
                  value={newBuyTransaction.fiatCurrency}
                  onChange={(e) => setNewBuyTransaction({...newBuyTransaction, fiatCurrency: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    border: `1px solid ${colors.border}`,
                    fontSize: '14px',
                    backgroundColor: colors.inputBg,
                    color: colors.text,
                    outline: 'none',
                    transition: 'all 0.2s',
                    boxSizing: 'border-box',
                    cursor: 'pointer'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#10b981';
                    e.target.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = colors.border;
                    e.target.style.boxShadow = 'none';
                  }}
                >
                  <option value="BRL">🇧🇷 Real Brasileiro (BRL)</option>
                  <option value="USD">🇺🇸 Dólar Americano (USD)</option>
                  <option value="EUR">🇪🇺 Euro (EUR)</option>
                  <option value="GBP">🇬🇧 Libra Esterlina (GBP)</option>
                </select>
              </div>

              {/* Preço Bitcoin */}
              <div>
                <label style={{display: 'block', fontSize: '14px', fontWeight: 'bold', color: colors.text, marginBottom: '8px'}}>
                  Preço Bitcoin ({newBuyTransaction.fiatCurrency}) - {(() => {
                    const now = new Date();
                    const selectedDateTime = new Date(`${newBuyTransaction.date}T${newBuyTransaction.time}`);
                    const diffInMinutes = Math.abs(now.getTime() - selectedDateTime.getTime()) / (1000 * 60);
                    return diffInMinutes < 10 ? '� Tempo Real' : `�📅 ${newBuyTransaction.date} às ${newBuyTransaction.time}`;
                  })()}
                </label>
                <input
                  type="text"
                  value={(() => {
                    const now = new Date();
                    const selectedDateTime = new Date(`${newBuyTransaction.date}T${newBuyTransaction.time}`);
                    const diffInMinutes = Math.abs(now.getTime() - selectedDateTime.getTime()) / (1000 * 60);
                    
                    // Se for tempo real (< 10 minutos), mostrar preço direto ou aguardando
                    if (diffInMinutes < 10) {
                      return newBuyTransaction.bitcoinPrice > 0 
                        ? newBuyTransaction.bitcoinPrice.toLocaleString('pt-BR', {minimumFractionDigits: 2})
                        : 'Aguardando preço...';
                    }
                    
                    // Se for histórico, mostrar "Buscando..." apenas durante o carregamento
                    return loadingHistoricalPrice 
                      ? 'Buscando preço histórico...' 
                      : newBuyTransaction.bitcoinPrice > 0 
                        ? newBuyTransaction.bitcoinPrice.toLocaleString('pt-BR', {minimumFractionDigits: 2})
                        : 'Aguardando...';
                  })()}
                  disabled
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: `2px solid ${colors.border}`,
                    fontSize: '14px',
                    backgroundColor: colors.cardBgSecondary,
                    color: colors.text,
                    fontWeight: '600'
                  }}
                />
                <p style={{marginTop: '4px', fontSize: '12px', color: colors.textTertiary}}>
                  {(() => {
                    const now = new Date();
                    const selectedDateTime = new Date(`${newBuyTransaction.date}T${newBuyTransaction.time}`);
                    const diffInMinutes = Math.abs(now.getTime() - selectedDateTime.getTime()) / (1000 * 60);
                    return diffInMinutes < 10 
                      ? '🔴 Usando preço em tempo real atualizado a cada segundo'
                      : '📅 Usando preço histórico do CoinGecko para a data/hora selecionada';
                  })()}
                </p>
              </div>

              {/* Campo Principal */}
              {buyInputMode === 'fiat' ? (
                <div>
                  <label style={{display: 'block', fontSize: '14px', fontWeight: 'bold', color: colors.text, marginBottom: '8px'}}>
                    💰 Valor Pago ({newBuyTransaction.fiatCurrency})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={newBuyTransaction.fiatAmount || ''}
                    onChange={(e) => {
                      const fiatAmount = parseFloat(e.target.value) || 0;
                      const bitcoinAmount = newBuyTransaction.bitcoinPrice > 0 ? fiatAmount / newBuyTransaction.bitcoinPrice : 0;
                      setNewBuyTransaction({
                        ...newBuyTransaction, 
                        fiatAmount,
                        bitcoinAmount
                      });
                    }}
                    disabled={loadingHistoricalPrice || newBuyTransaction.bitcoinPrice === 0}
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: '8px',
                      border: '2px solid #e5e7eb',
                      fontSize: '14px',
                      fontWeight: 'bold',
                      color: '#3b82f6'
                    }}
                    placeholder="Digite o valor em fiat"
                  />
                </div>
              ) : (
                <div>
                  <label style={{display: 'block', fontSize: '14px', fontWeight: 'bold', color: colors.text, marginBottom: '8px'}}>
                    ₿ Quantidade de Satoshis
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={newBuyTransaction.bitcoinAmount > 0 ? Math.round(newBuyTransaction.bitcoinAmount * 100000000) : ''}
                    onChange={(e) => {
                      const satoshis = parseInt(e.target.value) || 0;
                      const bitcoinAmount = satoshis / 100000000;
                      const fiatAmount = newBuyTransaction.bitcoinPrice > 0 ? bitcoinAmount * newBuyTransaction.bitcoinPrice : 0;
                      setNewBuyTransaction({
                        ...newBuyTransaction, 
                        bitcoinAmount,
                        fiatAmount
                      });
                    }}
                    disabled={loadingHistoricalPrice || newBuyTransaction.bitcoinPrice === 0}
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: '8px',
                      border: '2px solid #e5e7eb',
                      fontSize: '14px',
                      fontWeight: 'bold',
                      color: '#f97316'
                    }}
                    placeholder="Digite a quantidade"
                  />
                </div>
              )}

              {/* Preview */}
              {(newBuyTransaction.fiatAmount > 0 || newBuyTransaction.bitcoinAmount > 0) && (
                <div style={{
                  background: 'linear-gradient(to right, #d1fae5, #dbeafe)',
                  padding: '16px',
                  borderRadius: '12px'
                }}>
                  <h4 style={{fontSize: '14px', fontWeight: 'bold', color: colors.text, marginBottom: '12px'}}>
                    📊 Resumo da Compra
                  </h4>
                  <div style={{display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px'}}>
                    <div style={{display: 'flex', justifyContent: 'space-between'}}>
                      <span style={{color: colors.textSecondary}}>Bitcoin:</span>
                      <span style={{fontWeight: 'bold', color: colors.text}}>{newBuyTransaction.bitcoinAmount.toFixed(8)} BTC</span>
                    </div>
                    <div style={{display: 'flex', justifyContent: 'space-between'}}>
                      <span style={{color: colors.textSecondary}}>Satoshis:</span>
                      <span style={{fontWeight: 'bold', color: colors.text}}>{Math.round(newBuyTransaction.bitcoinAmount * 100000000).toLocaleString('pt-BR')} sats</span>
                    </div>
                    <div style={{display: 'flex', justifyContent: 'space-between'}}>
                      <span style={{color: colors.textSecondary}}>Valor Total:</span>
                      <span style={{fontWeight: 'bold', color: '#3b82f6'}}>{newBuyTransaction.fiatCurrency} {newBuyTransaction.fiatAmount.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Botão Registrar */}
              <button
                onClick={addBuyTransaction}
                disabled={!newBuyTransaction.bitcoinAmount || !newBuyTransaction.fiatAmount || currentBitcoinPrice === 0}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '12px',
                  border: 'none',
                  backgroundColor: newBuyTransaction.bitcoinAmount && newBuyTransaction.fiatAmount ? '#10b981' : '#d1d5db',
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: '16px',
                  cursor: newBuyTransaction.bitcoinAmount && newBuyTransaction.fiatAmount ? 'pointer' : 'not-allowed',
                  opacity: newBuyTransaction.bitcoinAmount && newBuyTransaction.fiatAmount ? 1 : 0.5
                }}
              >
                ✅ {editingTransaction ? 'Salvar Alterações' : 'Registrar Compra'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== MODAL DE VENDA ========== */}
      {showPasswordSell && (
        <div 
          onClick={() => setShowPasswordSell(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            zIndex: 999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            backdropFilter: 'blur(8px)'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: colors.cardBg,
              borderRadius: '24px',
              maxWidth: '600px',
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              border: `1px solid ${colors.border}`
            }}
          >
            {/* Header do Modal */}
            <div style={{
              padding: '24px 32px',
              borderBottom: `1px solid ${colors.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: colors.headerBg
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 10px 25px -5px rgba(239, 68, 68, 0.5)'
                }}>
                  <TrendingDown style={{ width: '24px', height: '24px', color: 'white' }} />
                </div>
                <div>
                  <h2 style={{
                    fontSize: '24px',
                    fontWeight: 'bold',
                    color: colors.text,
                    margin: 0,
                    lineHeight: '1.2'
                  }}>
                    Registrar Venda
                  </h2>
                  <p style={{
                    fontSize: '14px',
                    color: colors.textTertiary,
                    margin: '4px 0 0 0'
                  }}>
                    Adicione uma transação de venda
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPasswordSell(false)}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: colors.borderSecondary,
                  color: colors.textSecondary,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = colors.textSecondary;
                  e.currentTarget.style.color = colors.text;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = colors.borderSecondary;
                  e.currentTarget.style.color = colors.textSecondary;
                }}
              >
                <X style={{ width: '20px', height: '20px' }} />
              </button>
            </div>

            {/* Corpo do Modal */}
            <div style={{ padding: '32px' }}>
              {error && (
                <div style={{
                  backgroundColor: '#7f1d1d',
                  border: '1px solid #991b1b',
                  color: '#fca5a5',
                  padding: '16px',
                  borderRadius: '12px',
                  marginBottom: '24px',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  animation: 'fadeIn 0.3s ease-in-out'
                }}>
                  <span style={{ fontSize: '18px' }}>⚠️</span>
                  {error}
                </div>
              )}

              {/* Data e Hora */}
              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px'}}>
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: colors.text,
                    marginBottom: '8px'
                  }}>
                    📅 Data
                  </label>
                  <input
                    type="date"
                    value={newSellTransaction.date}
                    onChange={(e) => setNewSellTransaction({...newSellTransaction, date: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '12px',
                      border: `1px solid ${colors.border}`,
                      fontSize: '14px',
                      backgroundColor: colors.inputBg,
                      color: colors.text,
                      outline: 'none',
                      transition: 'all 0.2s',
                      boxSizing: 'border-box'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#ef4444';
                      e.target.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = colors.border;
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: colors.text,
                    marginBottom: '8px'
                  }}>
                    🕐 Hora
                  </label>
                  <input
                    type="time"
                    value={newSellTransaction.time}
                    onChange={(e) => setNewSellTransaction({...newSellTransaction, time: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '12px',
                      border: `1px solid ${colors.border}`,
                      fontSize: '14px',
                      backgroundColor: colors.inputBg,
                      color: colors.text,
                      outline: 'none',
                      transition: 'all 0.2s',
                      boxSizing: 'border-box'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#ef4444';
                      e.target.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = colors.border;
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>
              </div>

              {/* Moeda */}
              <div style={{ marginTop: '8px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: colors.text,
                  marginBottom: '8px'
                }}>
                  💱 Moeda
                </label>
                <select
                  value={newSellTransaction.fiatCurrency}
                  onChange={(e) => setNewSellTransaction({...newSellTransaction, fiatCurrency: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    border: `1px solid ${colors.border}`,
                    fontSize: '14px',
                    backgroundColor: colors.inputBg,
                    color: colors.text,
                    outline: 'none',
                    transition: 'all 0.2s',
                    boxSizing: 'border-box',
                    cursor: 'pointer'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#ef4444';
                    e.target.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = colors.border;
                    e.target.style.boxShadow = 'none';
                  }}
                >
                  <option value="BRL">🇧🇷 Real Brasileiro (BRL)</option>
                  <option value="USD">🇺🇸 Dólar Americano (USD)</option>
                  <option value="EUR">🇪🇺 Euro (EUR)</option>
                  <option value="GBP">🇬🇧 Libra Esterlina (GBP)</option>
                </select>
              </div>

              {/* Preço Bitcoin */}
              <div>
                <label style={{display: 'block', fontSize: '14px', fontWeight: 'bold', color: colors.text, marginBottom: '8px'}}>
                  Preço Bitcoin ({newSellTransaction.fiatCurrency}) - {(() => {
                    const now = new Date();
                    const selectedDateTime = new Date(`${newSellTransaction.date}T${newSellTransaction.time}`);
                    const diffInMinutes = Math.abs(now.getTime() - selectedDateTime.getTime()) / (1000 * 60);
                    return diffInMinutes < 10 ? '🔴 Tempo Real' : `📅 ${newSellTransaction.date} às ${newSellTransaction.time}`;
                  })()}
                </label>
                <input
                  type="text"
                  value={(() => {
                    const now = new Date();
                    const selectedDateTime = new Date(`${newSellTransaction.date}T${newSellTransaction.time}`);
                    const diffInMinutes = Math.abs(now.getTime() - selectedDateTime.getTime()) / (1000 * 60);
                    
                    // Se for tempo real (< 10 minutos), mostrar preço direto ou aguardando
                    if (diffInMinutes < 10) {
                      return newSellTransaction.bitcoinPrice > 0 
                        ? newSellTransaction.bitcoinPrice.toLocaleString('pt-BR', {minimumFractionDigits: 2})
                        : 'Aguardando preço...';
                    }
                    
                    // Se for histórico, mostrar "Buscando..." apenas durante o carregamento
                    return loadingHistoricalPrice 
                      ? 'Buscando preço histórico...' 
                      : newSellTransaction.bitcoinPrice > 0 
                        ? newSellTransaction.bitcoinPrice.toLocaleString('pt-BR', {minimumFractionDigits: 2})
                        : 'Aguardando...';
                  })()}
                  disabled
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: `2px solid ${colors.border}`,
                    fontSize: '14px',
                    backgroundColor: colors.cardBgSecondary,
                    color: colors.text,
                    fontWeight: '600'
                  }}
                />
                <p style={{marginTop: '4px', fontSize: '12px', color: colors.textTertiary}}>
                  {(() => {
                    const now = new Date();
                    const selectedDateTime = new Date(`${newSellTransaction.date}T${newSellTransaction.time}`);
                    const diffInMinutes = Math.abs(now.getTime() - selectedDateTime.getTime()) / (1000 * 60);
                    return diffInMinutes < 10 
                      ? '🔴 Usando preço em tempo real atualizado a cada segundo'
                      : '📅 Usando preço histórico do CoinGecko para a data/hora selecionada';
                  })()}
                </p>
              </div>

              {/* Satoshis Disponíveis */}
              <div style={{
                background: 'linear-gradient(to right, #dbeafe, #fef3c7)',
                padding: '16px',
                borderRadius: '12px'
              }}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                  <span style={{fontSize: '14px', fontWeight: 'bold', color: colors.text}}>Satoshis Disponíveis:</span>
                  <span style={{fontSize: '18px', fontWeight: 'bold', color: '#3b82f6'}}>
                    {calculateTotalSatoshis().toLocaleString('pt-BR')} sats
                  </span>
                </div>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px'}}>
                  <span style={{fontSize: '12px', color: colors.textSecondary}}>Bitcoin Disponível:</span>
                  <span style={{fontSize: '14px', fontWeight: '600', color: colors.textSecondary}}>
                    {calculateTotalBitcoin().toFixed(8)} BTC
                  </span>
                </div>
              </div>

              {/* Quantidade de Satoshis */}
              <div>
                <label style={{display: 'block', fontSize: '14px', fontWeight: 'bold', color: colors.text, marginBottom: '8px'}}>
                  ₿ Quantidade de Satoshis a Vender
                </label>
                <input
                  type="number"
                  step="1"
                  value={newSellTransaction.satoshiAmount || ''}
                  onChange={(e) => setNewSellTransaction({
                    ...newSellTransaction,
                    satoshiAmount: parseInt(e.target.value) || 0
                  })}
                  disabled={loadingHistoricalPrice || newSellTransaction.bitcoinPrice === 0}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '2px solid #e5e7eb',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    color: '#ef4444'
                  }}
                  placeholder="Digite a quantidade de satoshis"
                />
                {newSellTransaction.satoshiAmount > calculateTotalSatoshis() && (
                  <p style={{marginTop: '4px', fontSize: '12px', color: '#ef4444'}}>
                    ⚠️ Quantidade maior que o disponível!
                  </p>
                )}
              </div>

              {/* Preview */}
              {newSellTransaction.satoshiAmount > 0 && newSellTransaction.bitcoinPrice > 0 && (
                <div style={{
                  background: 'linear-gradient(to right, #fee2e2, #fef3c7)',
                  padding: '16px',
                  borderRadius: '12px'
                }}>
                  <h4 style={{fontSize: '14px', fontWeight: 'bold', color: colors.text, marginBottom: '12px'}}>
                    📊 Resumo da Venda
                  </h4>
                  <div style={{display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px'}}>
                    <div style={{display: 'flex', justifyContent: 'space-between'}}>
                      <span style={{color: colors.textSecondary}}>Bitcoin a vender:</span>
                      <span style={{fontWeight: 'bold', color: colors.text}}>
                        {(newSellTransaction.satoshiAmount / 100000000).toFixed(8)} BTC
                      </span>
                    </div>
                    <div style={{display: 'flex', justifyContent: 'space-between'}}>
                      <span style={{color: colors.textSecondary}}>Valor estimado:</span>
                      <span style={{fontWeight: 'bold', color: '#ef4444'}}>
                        {newSellTransaction.fiatCurrency} {((newSellTransaction.satoshiAmount / 100000000) * newSellTransaction.bitcoinPrice).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Botão Registrar */}
              <button
                onClick={addSellTransaction}
                disabled={newSellTransaction.satoshiAmount <= 0 || newSellTransaction.satoshiAmount > calculateTotalSatoshis() || loadingHistoricalPrice || newSellTransaction.bitcoinPrice === 0}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '12px',
                  border: 'none',
                  backgroundColor: (newSellTransaction.satoshiAmount > 0 && newSellTransaction.satoshiAmount <= calculateTotalSatoshis() && newSellTransaction.bitcoinPrice > 0) ? '#ef4444' : '#d1d5db',
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: '16px',
                  cursor: (newSellTransaction.satoshiAmount > 0 && newSellTransaction.satoshiAmount <= calculateTotalSatoshis() && newSellTransaction.bitcoinPrice > 0) ? 'pointer' : 'not-allowed',
                  opacity: (newSellTransaction.satoshiAmount > 0 && newSellTransaction.satoshiAmount <= calculateTotalSatoshis() && newSellTransaction.bitcoinPrice > 0) ? 1 : 0.5
                }}
              >
                {loadingHistoricalPrice ? 'Carregando preço...' : '✅ Registrar Venda'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE IMPORTAÇÃO AAVE */}
      {showImportModal && (
        <div
          onClick={() => setShowImportModal(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999999,
            padding: '20px',
            backdropFilter: 'blur(8px)'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: colors.modalBg,
              borderRadius: '24px',
              maxWidth: '600px',
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              border: `1px solid ${colors.border}`
            }}
          >
            {/* Header do Modal */}
            <div style={{
              padding: '24px 32px',
              borderBottom: `1px solid ${colors.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: colors.headerBg
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 10px 25px -5px rgba(59, 130, 246, 0.5)'
                }}>
                  <BarChart3 style={{ width: '24px', height: '24px', color: 'white' }} />
                </div>
                <div>
                  <h2 style={{
                    fontSize: '24px',
                    fontWeight: 'bold',
                    color: 'white',
                    margin: 0,
                    lineHeight: '1.2'
                  }}>
                    Importar Histórico Aave
                  </h2>
                  <p style={{
                    fontSize: '14px',
                    color: '#94a3b8',
                    margin: '4px 0 0 0'
                  }}>
                    Carregue arquivos CSV ou JSON
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: colors.cardBgSecondary,
                  color: colors.textSecondary,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = isDarkTheme ? '#475569' : '#d1d5db';
                  e.currentTarget.style.color = colors.text;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = colors.cardBgSecondary;
                  e.currentTarget.style.color = colors.textSecondary;
                }}
              >
                <X style={{ width: '20px', height: '20px' }} />
              </button>
            </div>

            {/* Corpo do Modal */}
            <div style={{ padding: '32px' }}>
              {/* Área de Upload */}
              <div style={{
                border: `2px dashed ${colors.border}`,
                borderRadius: '16px',
                padding: '40px 20px',
                textAlign: 'center',
                backgroundColor: colors.inputBg,
                marginBottom: '24px',
                transition: 'all 0.3s'
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.style.borderColor = '#3b82f6';
                e.currentTarget.style.backgroundColor = isDarkTheme ? '#1e293b' : '#e0f2fe';
              }}
              onDragLeave={(e) => {
                e.currentTarget.style.borderColor = '#475569';
                e.currentTarget.style.backgroundColor = '#0f172a';
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.style.borderColor = '#475569';
                e.currentTarget.style.backgroundColor = '#0f172a';
                const file = e.dataTransfer.files[0];
                if (file) {
                  const input = document.createElement('input');
                  input.type = 'file';
                  const dataTransfer = new DataTransfer();
                  dataTransfer.items.add(file);
                  input.files = dataTransfer.files;
                  handleFileUpload({ target: input } as any);
                }
              }}>
                <BarChart3 style={{
                  width: '64px',
                  height: '64px',
                  color: '#3b82f6',
                  margin: '0 auto 16px auto'
                }} />
                <h3 style={{
                  fontSize: '18px',
                  fontWeight: 'bold',
                  color: 'white',
                  marginBottom: '8px'
                }}>
                  Arraste seu arquivo aqui
                </h3>
                <p style={{
                  fontSize: '14px',
                  color: '#94a3b8',
                  marginBottom: '20px'
                }}>
                  ou clique no botão abaixo para selecionar
                </p>
                <label
                  htmlFor="file-upload"
                  style={{
                    display: 'inline-block',
                    padding: '12px 24px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                    color: 'white',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    transition: 'all 0.3s',
                    border: 'none',
                    fontSize: '14px',
                    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.4)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(59, 130, 246, 0.5)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.4)';
                  }}
                >
                  📁 Escolher Arquivo
                </label>
                <input
                  id="file-upload"
                  type="file"
                  accept=".csv,.json"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
              </div>

              {/* Informações sobre o formato */}
              <div style={{
                backgroundColor: colors.cardBgSecondary,
                borderRadius: '12px',
                padding: '20px',
                marginBottom: '24px',
                border: `1px solid ${colors.border}`
              }}>
                <h4 style={{
                  fontSize: '14px',
                  fontWeight: 'bold',
                  color: colors.text,
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  ℹ️ Informações Importantes
                </h4>
                <ul style={{
                  fontSize: '13px',
                  color: '#94a3b8',
                  lineHeight: '1.8',
                  paddingLeft: '20px',
                  margin: 0
                }}>
                  <li>Apenas transações com <strong style={{ color: '#f59e0b' }}>Bitcoin (BTC)</strong> serão importadas</li>
                  <li>Tipos aceitos: <strong style={{ color: '#10b981' }}>Supply</strong> e <strong style={{ color: '#f59e0b' }}>Collateral Swap</strong></li>
                  <li>Formatos suportados: <strong style={{ color: '#3b82f6' }}>CSV e JSON</strong></li>
                  <li>Moedas BTC reconhecidas: cbBTC, WBTC, renBTC, tBTC, etc.</li>
                </ul>
              </div>

              {/* Progresso da Importação */}
              {importProgress && (
                <div style={{
                  backgroundColor: colors.cardBgSecondary,
                  borderRadius: '12px',
                  padding: '20px',
                  border: `1px solid ${colors.border}`,
                  animation: 'fadeIn 0.3s ease-in-out'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}>
                    {importProgress.includes('✅') ? (
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        backgroundColor: '#10b981',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <span style={{ fontSize: '20px' }}>✅</span>
                      </div>
                    ) : importProgress.includes('❌') ? (
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        backgroundColor: '#ef4444',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <span style={{ fontSize: '20px' }}>❌</span>
                      </div>
                    ) : (
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        border: '3px solid #3b82f6',
                        borderTopColor: 'transparent',
                        animation: 'spin 1s linear infinite',
                        flexShrink: 0
                      }}></div>
                    )}
                    <p style={{
                      fontSize: '14px',
                      color: 'white',
                      margin: 0,
                      fontWeight: '500'
                    }}>
                      {importProgress}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div style={{
        minHeight: '100vh',
        position: 'relative',
        overflow: 'hidden',
        background: colors.modalBg
      }}>
        {/* Efeitos de fundo laranja */}
        <div style={{
          position: 'absolute',
          top: '5%',
          left: '5%',
          width: '400px',
          height: '400px',
          background: 'radial-gradient(circle, rgba(251, 146, 60, 0.08) 0%, transparent 70%)',
          borderRadius: '50%',
          filter: 'blur(60px)',
          animation: 'pulse 6s ease-in-out infinite'
        }}></div>
        <div style={{
          position: 'absolute',
          top: '30%',
          right: '10%',
          width: '350px',
          height: '350px',
          background: 'radial-gradient(circle, rgba(245, 158, 11, 0.06) 0%, transparent 70%)',
          borderRadius: '50%',
          filter: 'blur(50px)',
          animation: 'pulse 7s ease-in-out infinite',
          animationDelay: '1s'
        }}></div>
        <div style={{
          position: 'absolute',
          bottom: '10%',
          left: '40%',
          width: '300px',
          height: '300px',
          background: 'radial-gradient(circle, rgba(234, 88, 12, 0.05) 0%, transparent 70%)',
          borderRadius: '50%',
          filter: 'blur(45px)',
          animation: 'pulse 8s ease-in-out infinite',
          animationDelay: '2s'
        }}></div>

      <div style={{position: 'relative', zIndex: 10, minHeight: '100vh', padding: '2%'}}>
        {/* Container Principal com Cards */}
        <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
          {/* Card Único do Portfolio Completo */}
          <div style={{
            backgroundColor: colors.cardBg,
            borderRadius: '24px',
            boxShadow: isDarkTheme 
              ? '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
              : '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
            border: `1px solid ${colors.border}`,
            overflow: 'hidden'
          }}>
            {/* Header com Título e Ações */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '24px',
              borderBottom: `1px solid ${colors.border}`,
              background: colors.headerBg
            }}>
              <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  background: 'linear-gradient(135deg, #fb923c 0%, #f97316 100%)',
                  borderRadius: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 10px 25px -5px rgba(251, 146, 60, 0.5)'
                }}>
                  <Bitcoin style={{width: '28px', height: '28px', color: 'white'}} />
                </div>
                <div>
                  <h3 style={{fontSize: '24px', fontWeight: 'bold', color: colors.text, margin: 0}}>
                    Portfolio Bitcoin
                  </h3>
                  <div style={{display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px'}}>
                    <div style={{
                      width: '8px',
                      height: '8px',
                      backgroundColor: '#10b981',
                      borderRadius: '50%',
                      animation: 'pulse 2s ease-in-out infinite'
                    }}></div>
                    <span style={{fontSize: '12px', color: '#10b981', fontWeight: '600'}}>Ativo</span>
                  </div>
                </div>
              </div>
              <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                {/* Botão de alternância de tema */}
                <button 
                  onClick={() => setIsDarkTheme(!isDarkTheme)}
                  style={{
                    background: isDarkTheme 
                      ? 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)'
                      : 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                    color: 'white',
                    padding: '12px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    fontSize: '14px',
                    border: 'none',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    boxShadow: isDarkTheme 
                      ? '0 4px 12px rgba(251, 191, 36, 0.4)'
                      : '0 4px 12px rgba(99, 102, 241, 0.4)',
                    transition: 'all 0.3s',
                    width: '48px',
                    height: '48px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px) rotate(15deg)';
                    e.currentTarget.style.boxShadow = isDarkTheme
                      ? '0 6px 20px rgba(251, 191, 36, 0.5)'
                      : '0 6px 20px rgba(99, 102, 241, 0.5)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0) rotate(0deg)';
                    e.currentTarget.style.boxShadow = isDarkTheme
                      ? '0 4px 12px rgba(251, 191, 36, 0.4)'
                      : '0 4px 12px rgba(99, 102, 241, 0.4)';
                  }}
                  aria-label={isDarkTheme ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
                  title={isDarkTheme ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
                >
                  {isDarkTheme ? (
                    <Sun style={{width: '22px', height: '22px'}} />
                  ) : (
                    <Moon style={{width: '22px', height: '22px'}} />
                  )}
                </button>
                
                <button 
                  onClick={logout}
                  style={{
                    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                    color: 'white',
                    padding: '12px 20px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '14px',
                    border: 'none',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)',
                    transition: 'all 0.3s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(239, 68, 68, 0.5)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.4)';
                  }}
                  aria-label="Sair"
                >
                  <X style={{width: '18px', height: '18px'}} />
                  <span>Sair</span>
                </button>
              </div>
            </div>

            {/* Seletor de Moeda */}
            <div style={{
              padding: '24px',
              borderBottom: `1px solid ${colors.border}`,
              backgroundColor: colors.cardBg
            }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: colors.text,
                marginBottom: '12px'
              }}>
                💱 Moeda de Visualização
              </label>
              <select 
                value={selectedCurrency} 
                onChange={(e) => setSelectedCurrency(e.target.value)}
                style={{
                  width: '100%',
                  backgroundColor: colors.inputBg,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '12px',
                  padding: '14px 16px',
                  color: colors.text,
                  fontWeight: '600',
                  outline: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontSize: '14px'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#fb923c';
                  e.target.style.boxShadow = '0 0 0 3px rgba(251, 146, 60, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = colors.border;
                  e.target.style.boxShadow = 'none';
                }}
              >
                <option value="BRL">🇧🇷 Real Brasileiro (BRL)</option>
                <option value="USD">🇺🇸 Dólar Americano (USD)</option>
                <option value="EUR">🇪🇺 Euro (EUR)</option>
                <option value="GBP">🇬🇧 Libra Esterlina (GBP)</option>
              </select>
            </div>

            {/* Grid de Informações Principais */}
            <div style={{
              padding: '24px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '16px'
            }}>
              {/* Card: Preço Atual */}
              <div style={{
                background: colors.cardBgSecondary,
                padding: '20px',
                borderRadius: '16px',
                border: `1px solid ${colors.border}`,
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                transition: 'all 0.3s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#fb923c';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 20px rgba(251, 146, 60, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = colors.border;
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
              }}>
                <div style={{color: colors.textTertiary, fontSize: '12px', fontWeight: '600', marginBottom: '8px'}}>
                  📊 Preço Atual BTC
                </div>
                <div style={{color: colors.text, fontSize: '28px', fontWeight: 'bold'}}>
                  {selectedCurrency} {currentBitcoinPrice.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                </div>
              </div>

              {/* Card: Total Bitcoin */}
              <div style={{
                background: colors.cardBgSecondary,
                padding: '20px',
                borderRadius: '16px',
                border: `1px solid ${colors.border}`,
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                transition: 'all 0.3s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#fb923c';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 20px rgba(251, 146, 60, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = colors.border;
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
              }}>
                <div style={{color: colors.textTertiary, fontSize: '12px', fontWeight: '600', marginBottom: '8px'}}>
                  ₿ Total em Carteira
                </div>
                <div style={{color: colors.text, fontSize: '28px', fontWeight: 'bold'}}>
                  {calculateTotalBitcoin().toFixed(8)} BTC
                </div>
              </div>

              {/* Card: Preço Médio de Compra */}
              <div style={{
                background: colors.cardBgSecondary,
                padding: '20px',
                borderRadius: '16px',
                border: `1px solid ${colors.border}`,
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                transition: 'all 0.3s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#10b981';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 20px rgba(16, 185, 129, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = colors.border;
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
              }}>
                <div style={{color: colors.textTertiary, fontSize: '12px', fontWeight: '600', marginBottom: '8px'}}>
                  📈 Preço Médio de Compra
                </div>
                <div style={{color: colors.text, fontSize: '28px', fontWeight: 'bold'}}>
                  {selectedCurrency} {calculateAverageBuyPrice() > 0 
                    ? calculateAverageBuyPrice().toLocaleString('pt-BR', {minimumFractionDigits: 2})
                    : '0.00'
                  }
                </div>
              </div>

              {/* Card: Preço Médio de Venda */}
              <div style={{
                background: colors.cardBgSecondary,
                padding: '20px',
                borderRadius: '16px',
                border: `1px solid ${colors.border}`,
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                transition: 'all 0.3s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#ef4444';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 20px rgba(239, 68, 68, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = colors.border;
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
              }}>
                <div style={{color: colors.textTertiary, fontSize: '12px', fontWeight: '600', marginBottom: '8px'}}>
                  📉 Preço Médio de Venda
                </div>
                <div style={{color: colors.text, fontSize: '28px', fontWeight: 'bold'}}>
                  {selectedCurrency} {calculateAverageSellPrice() > 0 
                    ? calculateAverageSellPrice().toLocaleString('pt-BR', {minimumFractionDigits: 2})
                    : '0.00'
                  }
                </div>
              </div>
            </div>

            {/* Resumo Financeiro */}
            <div style={{
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              backgroundColor: colors.modalBg,
              borderTop: `1px solid ${colors.border}`
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px',
                backgroundColor: colors.cardBg,
                borderRadius: '12px',
                border: `1px solid ${colors.border}`
              }}>
                <span style={{color: colors.textTertiary, fontSize: '14px', fontWeight: '600'}}>💰 Valor Total Bruto Investido</span>
                <span style={{fontWeight: 'bold', color: colors.text, fontSize: '16px'}}>
                  {selectedCurrency} {calculateTotalInvested().toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                </span>
              </div>

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '20px',
                backgroundColor: colors.cardBg,
                borderRadius: '12px',
                border: `2px solid ${colors.border}`
              }}>
                <span style={{color: colors.text, fontWeight: '600', fontSize: '16px'}}>💵 Valor Total Líquido Atual</span>
                <span style={{
                  fontWeight: 'bold',
                  fontSize: '24px',
                  color: (calculateTotalBitcoin() * currentBitcoinPrice) - calculateTotalInvested() >= 0 ? '#10b981' : '#ef4444'
                }}>
                  {selectedCurrency} {(calculateTotalBitcoin() * currentBitcoinPrice).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                </span>
              </div>
            </div>

            {/* Card de Performance (Lucro/Prejuízo) */}
            {currentBitcoinPrice > 0 && calculateTotalInvested() > 0 && (
              <div style={{
                padding: '24px',
                border: '2px solid',
                borderColor: (calculateTotalBitcoin() * currentBitcoinPrice) - calculateTotalInvested() >= 0 ? '#10b981' : '#ef4444',
                background: (calculateTotalBitcoin() * currentBitcoinPrice) - calculateTotalInvested() >= 0 
                  ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.1) 100%)'
                  : 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(220, 38, 38, 0.1) 100%)',
                borderRadius: '16px 16px 0 0'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '16px'
                }}>
                  <div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '14px',
                      fontWeight: '700',
                      marginBottom: '8px',
                      color: (calculateTotalBitcoin() * currentBitcoinPrice) - calculateTotalInvested() >= 0 ? '#10b981' : '#ef4444'
                    }}>
                      {(calculateTotalBitcoin() * currentBitcoinPrice) - calculateTotalInvested() >= 0 
                        ? <ArrowUpCircle style={{width: '20px', height: '20px'}} />
                        : <ArrowDownCircle style={{width: '20px', height: '20px'}} />
                      }
                      <span>
                        {(calculateTotalBitcoin() * currentBitcoinPrice) - calculateTotalInvested() >= 0 ? '💰 LUCRO' : '📉 PREJUÍZO'}
                      </span>
                    </div>
                    <div style={{
                      fontSize: '36px',
                      fontWeight: '900',
                      color: (calculateTotalBitcoin() * currentBitcoinPrice) - calculateTotalInvested() >= 0 ? '#10b981' : '#ef4444'
                    }}>
                      {((calculateTotalBitcoin() * currentBitcoinPrice) - calculateTotalInvested() >= 0 ? '+' : '')}
                      {selectedCurrency} {Math.abs((calculateTotalBitcoin() * currentBitcoinPrice) - calculateTotalInvested()).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                    </div>
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '48px',
                    fontWeight: '900',
                    color: (calculateTotalBitcoin() * currentBitcoinPrice) - calculateTotalInvested() >= 0 ? '#10b981' : '#ef4444'
                  }}>
                    <Percent style={{width: '48px', height: '48px'}} />
                    <span>
                      {((calculateTotalBitcoin() * currentBitcoinPrice) - calculateTotalInvested() >= 0 ? '+' : '')}
                      {Math.abs(((((calculateTotalBitcoin() * currentBitcoinPrice) - calculateTotalInvested()) / calculateTotalInvested()) * 100)).toFixed(2)}
                    </span>
                  </div>
                </div>
                <div style={{
                  height: '8px',
                  backgroundColor: colors.cardBgSecondary,
                  borderRadius: '999px',
                  overflow: 'hidden'
                }}>
                  <div 
                    style={{
                      height: '100%',
                      background: (calculateTotalBitcoin() * currentBitcoinPrice) - calculateTotalInvested() >= 0
                        ? 'linear-gradient(90deg, #10b981 0%, #059669 100%)'
                        : 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)',
                      width: `${Math.min(Math.abs(((((calculateTotalBitcoin() * currentBitcoinPrice) - calculateTotalInvested()) / calculateTotalInvested()) * 100)), 100)}%`,
                      transition: 'width 0.5s ease'
                    }}
                  ></div>
                </div>
              </div>
            )}

            {/* Botões de Ação */}
            <div style={{
              padding: '24px',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '16px'
            }}>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('Botão Comprar clicado, showPasswordBuy atual:', showPasswordBuy);
                  setShowPasswordBuy(true);
                  console.log('showPasswordBuy definido para true');
                }}
                style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white',
                  padding: '18px 24px',
                  fontWeight: 'bold',
                  fontSize: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  border: 'none',
                  borderRadius: '16px',
                  cursor: 'pointer',
                  boxShadow: '0 6px 20px rgba(16, 185, 129, 0.4)',
                  transition: 'all 0.3s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-3px) scale(1.02)';
                  e.currentTarget.style.boxShadow = '0 10px 30px rgba(16, 185, 129, 0.6)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0) scale(1)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.4)';
                }}
              >
                <TrendingUp style={{width: '24px', height: '24px'}} />
                <span>Comprar</span>
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('Botão Vender clicado, showPasswordSell atual:', showPasswordSell);
                  setShowPasswordSell(true);
                  console.log('showPasswordSell definido para true');
                }}
                style={{
                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  color: 'white',
                  padding: '18px 24px',
                  fontWeight: 'bold',
                  fontSize: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  border: 'none',
                  borderRadius: '16px',
                  cursor: 'pointer',
                  boxShadow: '0 6px 20px rgba(239, 68, 68, 0.4)',
                  transition: 'all 0.3s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-3px) scale(1.02)';
                  e.currentTarget.style.boxShadow = '0 10px 30px rgba(239, 68, 68, 0.6)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0) scale(1)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(239, 68, 68, 0.4)';
                }}
              >
                <TrendingDown style={{width: '24px', height: '24px'}} />
                <span>Vender</span>
              </button>
            </div>
          </div>

          {/* Remover categorias antigas duplicadas */}
          {false && currentBitcoinPrice > 0 && calculateTotalInvested() > 0 && (
                <div className={`hidden flex items-center justify-between p-5 rounded-xl border-l-4 hover:shadow-md transition-shadow ${
                  (calculateTotalBitcoin() * currentBitcoinPrice) - calculateTotalInvested() >= 0
                    ? 'bg-gradient-to-r from-emerald-50 to-transparent border-emerald-500'
                    : 'bg-gradient-to-r from-rose-50 to-transparent border-rose-500'
                }`}>
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-3xl shadow-lg ${
                      (calculateTotalBitcoin() * currentBitcoinPrice) - calculateTotalInvested() >= 0
                        ? 'bg-emerald-500'
                        : 'bg-rose-500'
                    }`}>
                      {(calculateTotalBitcoin() * currentBitcoinPrice) - calculateTotalInvested() >= 0 ? '📊' : '📉'}
                    </div>
                    <div>
                      <h5 className="text-sm text-gray-600 font-semibold mb-1">
                        {(calculateTotalBitcoin() * currentBitcoinPrice) - calculateTotalInvested() >= 0 ? 'Lucro' : 'Prejuízo'}
                      </h5>
                      <p className={`text-2xl sm:text-3xl font-black ${
                        (calculateTotalBitcoin() * currentBitcoinPrice) - calculateTotalInvested() >= 0
                          ? 'text-emerald-600'
                          : 'text-rose-600'
                      }`}>
                        {((calculateTotalBitcoin() * currentBitcoinPrice) - calculateTotalInvested() >= 0 ? '+' : '')}
                        {selectedCurrency} {Math.abs((calculateTotalBitcoin() * currentBitcoinPrice) - calculateTotalInvested()).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                      </p>
                      <p className={`text-sm font-bold mt-1 ${
                        (calculateTotalBitcoin() * currentBitcoinPrice) - calculateTotalInvested() >= 0
                          ? 'text-emerald-600'
                          : 'text-rose-600'
                      }`}>
                        {((calculateTotalBitcoin() * currentBitcoinPrice) - calculateTotalInvested() >= 0 ? '↗' : '↘')} {Math.abs(((((calculateTotalBitcoin() * currentBitcoinPrice) - calculateTotalInvested()) / calculateTotalInvested()) * 100)).toFixed(2)}%
                      </p>
                    </div>
                  </div>
                </div>
              )}

          {/* Histórico de Transações - Card Estilizado */}
          {userTransactions.length > 0 && (
            <div style={{
              background: colors.cardBg,
              borderRadius: '24px',
              padding: '0',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
              border: `1px solid ${colors.border}`,
              overflow: 'hidden'
            }}>
              {/* Header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '24px',
                borderBottom: `1px solid ${colors.border}`,
                background: colors.headerBg
              }}>
                <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    background: 'linear-gradient(135deg, #fb923c 0%, #f97316 100%)',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(251, 146, 60, 0.4)'
                  }}>
                    <BarChart3 style={{width: '24px', height: '24px', color: 'white'}} />
                  </div>
                  <div>
                    <h3 style={{fontSize: '20px', fontWeight: 'bold', color: colors.text, marginBottom: '4px'}}>Histórico de Transações</h3>
                    <p style={{fontSize: '14px', color: colors.textTertiary}}>
                      {userTransactions.length} transaç{userTransactions.length !== 1 ? 'ões' : 'ão'} registrada{userTransactions.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                
                {/* Controle de Quantidade */}
                <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                  <label style={{fontSize: '14px', fontWeight: '600', color: '#cbd5e1'}}>Mostrar:</label>
                  <select
                    value={transactionsToShow}
                    onChange={(e) => setTransactionsToShow(Number(e.target.value))}
                    style={{
                      padding: '10px 16px',
                      background: 'rgba(51, 65, 85, 0.5)',
                      border: '2px solid #475569',
                      borderRadius: '12px',
                      color: 'white',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.outline = 'none';
                      e.currentTarget.style.borderColor = '#fb923c';
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(251, 146, 60, 0.2)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = '#475569';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <option value={10}>10 transações</option>
                    <option value={25}>25 transações</option>
                    <option value={50}>50 transações</option>
                    <option value={100}>100 transações</option>
                  </select>
                  <button
                    onClick={() => setShowTransactionsModal(true)}
                    style={{
                      padding: '10px 16px',
                      background: 'linear-gradient(135deg, #fb923c 0%, #f97316 100%)',
                      color: 'white',
                      borderRadius: '12px',
                      fontSize: '14px',
                      fontWeight: '600',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: '0 4px 12px rgba(251, 146, 60, 0.3)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'scale(1.05)';
                      e.currentTarget.style.boxShadow = '0 6px 16px rgba(251, 146, 60, 0.5)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(251, 146, 60, 0.3)';
                    }}
                  >
                    Ver Planilha Completa
                  </button>
                </div>
              </div>

              {/* Grid de Cards de Transações */}
              <div style={{
                padding: '24px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: '16px'
              }}>
                {userTransactions.slice().reverse().slice(0, transactionsToShow).map((transaction) => {
                  const { profit, percentage } = calculateProfitLoss(transaction);
                  const isProfit = profit >= 0;
                  const convertedValue = convertCurrency(
                    transaction.fiatAmount,
                    transaction.fiatCurrency,
                    selectedCurrency,
                    transaction.exchangeRates
                  );
                  
                  return (
                    <div key={transaction.id} style={{
                      background: colors.cardBgSecondary,
                      border: `2px solid ${colors.border}`,
                      borderRadius: '16px',
                      padding: '16px',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#fb923c';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 8px 20px rgba(251, 146, 60, 0.2)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#475569';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}>
                      {/* Header do Card */}
                      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px'}}>
                        <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                          <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: transaction.type === 'buy' 
                              ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' 
                              : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                            boxShadow: transaction.type === 'buy'
                              ? '0 4px 12px rgba(16, 185, 129, 0.4)'
                              : '0 4px 12px rgba(239, 68, 68, 0.4)'
                          }}>
                            {transaction.type === 'buy' ? <TrendingUp style={{width: '20px', height: '20px', color: 'white'}} /> : <TrendingDown style={{width: '20px', height: '20px', color: 'white'}} />}
                          </div>
                          <div>
                            <div style={{fontSize: '14px', fontWeight: 'bold', color: colors.text}}>
                              {transaction.type === 'buy' ? 'Compra' : 'Venda'}
                            </div>
                            <div style={{display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: colors.textTertiary}}>
                              <Calendar style={{width: '12px', height: '12px'}} />
                              {transaction.date}
                            </div>
                          </div>
                        </div>
                        <div style={{display: 'flex', gap: '4px'}}>
                          <button 
                            onClick={() => {
                              setEditingTransaction(transaction);
                              if (transaction.type === 'buy') {
                                setShowPasswordBuy(true);
                                setNewBuyTransaction({
                                  date: transaction.date,
                                  time: transaction.time,
                                  bitcoinAmount: transaction.bitcoinAmount,
                                  fiatAmount: transaction.fiatAmount,
                                  fiatCurrency: transaction.fiatCurrency,
                                  bitcoinPrice: transaction.bitcoinPrice
                                });
                              } else {
                                setShowPasswordSell(true);
                              }
                            }}
                            style={{
                              padding: '8px',
                              background: 'transparent',
                              border: '1px solid transparent',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)';
                              e.currentTarget.style.borderColor = '#3b82f6';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'transparent';
                              e.currentTarget.style.borderColor = 'transparent';
                            }}
                          >
                            <Edit style={{width: '16px', height: '16px', color: '#94a3b8'}} />
                          </button>
                          <button 
                            onClick={() => {
                              showConfirm('Tem certeza que deseja excluir esta transação?', () => {
                                deleteTransaction(transaction.id);
                                closeConfirm();
                              });
                            }}
                            style={{
                              padding: '8px',
                              background: 'transparent',
                              border: '1px solid transparent',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                              e.currentTarget.style.borderColor = '#ef4444';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'transparent';
                              e.currentTarget.style.borderColor = 'transparent';
                            }}
                          >
                            <Trash2 style={{width: '16px', height: '16px', color: '#94a3b8'}} />
                          </button>
                        </div>
                      </div>

                      {/* Informações */}
                      <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                        {/* Hora */}
                        <div style={{display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#94a3b8'}}>
                          <Clock style={{width: '12px', height: '12px'}} />
                          <span>{transaction.time}</span>
                        </div>

                        {/* Quantidade BTC */}
                        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                          <span style={{fontSize: '12px', color: colors.textTertiary}}>Quantidade</span>
                          <div style={{display: 'flex', alignItems: 'center', gap: '4px'}}>
                            <Bitcoin style={{width: '16px', height: '16px', color: '#fb923c'}} />
                            <span style={{fontSize: '14px', fontFamily: 'monospace', fontWeight: 'bold', color: '#fb923c'}}>
                              {transaction.bitcoinAmount.toFixed(8)}
                            </span>
                          </div>
                        </div>

                        {/* Valor */}
                        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                          <span style={{fontSize: '12px', color: colors.textTertiary}}>Valor</span>
                          <div style={{textAlign: 'right'}}>
                            <div style={{fontSize: '14px', fontWeight: 'bold', color: colors.text, display: 'flex', alignItems: 'center', gap: '4px'}}>
                              <DollarSign style={{width: '14px', height: '14px'}} />
                              {selectedCurrency} {convertedValue.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                            </div>
                            {transaction.fiatCurrency !== selectedCurrency && (
                              <div style={{fontSize: '12px', color: colors.textTertiary, marginTop: '2px'}}>
                                {transaction.fiatCurrency} {transaction.fiatAmount.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Resultado */}
                        {transaction.type === 'buy' && currentBitcoinPrice > 0 ? (
                          <div style={{
                            marginTop: '12px',
                            padding: '12px',
                            borderRadius: '8px',
                            border: `2px solid ${isProfit ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                            background: isProfit ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'
                          }}>
                            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                              <span style={{fontSize: '12px', fontWeight: '600', color: colors.textSecondary}}>Resultado</span>
                              <div style={{textAlign: 'right'}}>
                                <div style={{
                                  fontSize: '16px',
                                  fontWeight: 'bold',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  color: isProfit ? '#10b981' : '#ef4444'
                                }}>
                                  {isProfit ? <ArrowUpCircle style={{width: '16px', height: '16px'}} /> : <ArrowDownCircle style={{width: '16px', height: '16px'}} />}
                                  {isProfit ? '+' : ''}{profit.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                                </div>
                                <div style={{
                                  fontSize: '12px',
                                  fontWeight: '600',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  justifyContent: 'flex-end',
                                  marginTop: '4px',
                                  color: isProfit ? '#10b981' : '#ef4444'
                                }}>
                                  <Percent style={{width: '12px', height: '12px'}} />
                                  {isProfit ? '+' : ''}{percentage.toFixed(2)}
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div style={{
                            marginTop: '12px',
                            padding: '12px',
                            borderRadius: '8px',
                            background: 'rgba(71, 85, 105, 0.2)',
                            border: '2px solid rgba(71, 85, 105, 0.3)'
                          }}>
                            <span style={{fontSize: '12px', color: '#64748b'}}>Resultado não disponível</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
                
              {/* Indicador de mais transações */}
              {userTransactions.length > transactionsToShow && (
                <div style={{
                  background: 'rgba(51, 65, 85, 0.3)',
                  padding: '16px 24px',
                  textAlign: 'center',
                  borderTop: '2px solid #475569'
                }}>
                  <p style={{fontSize: '14px', color: '#cbd5e1'}}>
                    Mostrando {transactionsToShow} de {userTransactions.length} transações.
                    <button
                      onClick={() => setShowTransactionsModal(true)}
                      style={{
                        marginLeft: '8px',
                        color: '#fb923c',
                        fontWeight: '600',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        textDecoration: 'none',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = '#f97316';
                        e.currentTarget.style.textDecoration = 'underline';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = '#fb923c';
                        e.currentTarget.style.textDecoration = 'none';
                      }}
                    >
                      Ver todas na planilha completa
                    </button>
                  </p>
                </div>
              )}
            </div>
          )}


        </div>
      </div>

      {/* Modal de Histórico de Transações - Estilo Planilha */}
      {showTransactionsModal && (
        <div style={{
          position: 'fixed',
          inset: '0',
          zIndex: '50',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          background: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #1e293b 100%)',
            borderRadius: '24px',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8)',
            width: '100%',
            maxWidth: '1400px',
            maxHeight: '90vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            border: '1px solid #334155'
          }}>
            {/* Header do Modal */}
            <div style={{
              background: 'linear-gradient(135deg, #fb923c 0%, #f97316 100%)',
              color: 'white',
              padding: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{display: 'flex', alignItems: 'center', gap: '16px'}}>
                <span style={{fontSize: '36px'}}>📊</span>
                <div>
                  <h2 style={{fontSize: '24px', fontWeight: 'bold', marginBottom: '4px'}}>Histórico de Transações</h2>
                  <p style={{color: 'rgba(255, 255, 255, 0.9)', fontSize: '14px'}}>
                    {userTransactions.length} transaç{userTransactions.length !== 1 ? 'ões' : 'ão'} registrada{userTransactions.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowTransactionsModal(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: 'none',
                  padding: '8px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                }}
              >
                <X style={{width: '24px', height: '24px', color: 'white'}} />
              </button>
            </div>

            {/* Tabela de Transações */}
            <div style={{overflow: 'auto', flex: '1'}}>
              <table style={{width: '100%', borderCollapse: 'collapse'}}>
                <thead style={{
                  background: '#1e293b',
                  position: 'sticky',
                  top: '0',
                  zIndex: '10'
                }}>
                  <tr>
                    <th style={{
                      padding: '12px 16px',
                      textAlign: 'left',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      color: '#cbd5e1',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      borderBottom: '2px solid #475569'
                    }}>
                      Tipo
                    </th>
                    <th style={{
                      padding: '12px 16px',
                      textAlign: 'left',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      color: '#cbd5e1',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      borderBottom: '2px solid #475569'
                    }}>
                      Data
                    </th>
                    <th style={{
                      padding: '12px 16px',
                      textAlign: 'left',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      color: '#cbd5e1',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      borderBottom: '2px solid #475569'
                    }}>
                      Hora
                    </th>
                    <th style={{
                      padding: '12px 16px',
                      textAlign: 'right',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      color: '#cbd5e1',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      borderBottom: '2px solid #475569'
                    }}>
                      Quantidade BTC
                    </th>
                    <th style={{
                      padding: '12px 16px',
                      textAlign: 'right',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      color: '#cbd5e1',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      borderBottom: '2px solid #475569'
                    }}>
                      Satoshis
                    </th>
                    <th style={{
                      padding: '12px 16px',
                      textAlign: 'right',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      color: '#cbd5e1',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      borderBottom: '2px solid #475569'
                    }}>
                      Preço Unitário
                    </th>
                    <th style={{
                      padding: '12px 16px',
                      textAlign: 'right',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      color: '#cbd5e1',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      borderBottom: '2px solid #475569'
                    }}>
                      Valor Total
                    </th>
                    <th style={{
                      padding: '12px 16px',
                      textAlign: 'right',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      color: '#cbd5e1',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      borderBottom: '2px solid #475569'
                    }}>
                      Valor Atual
                    </th>
                    <th style={{
                      padding: '12px 16px',
                      textAlign: 'right',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      color: '#cbd5e1',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      borderBottom: '2px solid #475569'
                    }}>
                      Lucro/Prejuízo
                    </th>
                    <th style={{
                      padding: '12px 16px',
                      textAlign: 'center',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      color: '#cbd5e1',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      borderBottom: '2px solid #475569'
                    }}>
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody style={{background: '#0f172a'}}>
                  {userTransactions.slice().reverse().map((transaction, index) => {
                    const { profit, percentage } = calculateProfitLoss(transaction);
                    const isProfit = profit >= 0;
                    const currentValue = transaction.bitcoinAmount * currentBitcoinPrice;
                    
                    return (
                      <tr 
                        key={transaction.id} 
                        style={{
                          borderBottom: '1px solid #334155',
                          transition: 'background 0.2s',
                          background: index % 2 === 0 ? '#0f172a' : '#1e293b'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#334155';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = index % 2 === 0 ? '#0f172a' : '#1e293b';
                        }}
                      >
                        <td style={{padding: '12px 16px', whiteSpace: 'nowrap'}}>
                          <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                            <div style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: transaction.type === 'buy' 
                                ? 'rgba(16, 185, 129, 0.2)' 
                                : 'rgba(239, 68, 68, 0.2)',
                              color: transaction.type === 'buy' ? '#10b981' : '#ef4444'
                            }}>
                              {transaction.type === 'buy' ? <TrendingUp style={{width: '16px', height: '16px'}} /> : <TrendingDown style={{width: '16px', height: '16px'}} />}
                            </div>
                            <span style={{fontSize: '14px', fontWeight: '500', color: 'white'}}>
                              {transaction.type === 'buy' ? 'Compra' : 'Venda'}
                            </span>
                          </div>
                        </td>
                        <td style={{padding: '12px 16px', whiteSpace: 'nowrap', fontSize: '14px', color: 'white'}}>
                          {transaction.date}
                        </td>
                        <td style={{padding: '12px 16px', whiteSpace: 'nowrap', fontSize: '14px', color: 'white'}}>
                          {transaction.time}
                        </td>
                        <td style={{padding: '12px 16px', whiteSpace: 'nowrap', textAlign: 'right', fontSize: '14px', fontFamily: 'monospace', fontWeight: '600', color: '#fb923c'}}>
                          {transaction.bitcoinAmount.toFixed(8)}
                        </td>
                        <td style={{padding: '12px 16px', whiteSpace: 'nowrap', textAlign: 'right', fontSize: '14px', color: '#94a3b8'}}>
                          {transaction.satoshis.toLocaleString('pt-BR')}
                        </td>
                        <td style={{padding: '12px 16px', whiteSpace: 'nowrap', textAlign: 'right', fontSize: '14px'}}>
                          <div style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-end'}}>
                            <span style={{fontWeight: '600', color: 'white'}}>{selectedCurrency} {convertCurrency(transaction.bitcoinPrice, transaction.fiatCurrency, selectedCurrency, transaction.exchangeRates).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                            {transaction.fiatCurrency !== selectedCurrency && (
                              <span style={{fontSize: '12px', color: '#64748b', marginTop: '2px'}}>{transaction.fiatCurrency} {transaction.bitcoinPrice.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                            )}
                          </div>
                        </td>
                        <td style={{padding: '12px 16px', whiteSpace: 'nowrap', textAlign: 'right', fontSize: '14px', fontWeight: '600'}}>
                          <div style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-end'}}>
                            <span style={{fontWeight: 'bold', color: 'white'}}>{selectedCurrency} {convertCurrency(transaction.fiatAmount, transaction.fiatCurrency, selectedCurrency, transaction.exchangeRates).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                            {transaction.fiatCurrency !== selectedCurrency && (
                              <span style={{fontSize: '12px', color: '#64748b', fontWeight: 'normal', marginTop: '2px'}}>{transaction.fiatCurrency} {transaction.fiatAmount.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                            )}
                          </div>
                        </td>
                        <td style={{padding: '12px 16px', whiteSpace: 'nowrap', textAlign: 'right', fontSize: '14px', fontWeight: '600'}}>
                          {transaction.type === 'buy' && currentBitcoinPrice > 0 ? (
                            <span style={{color: isProfit ? '#10b981' : '#ef4444'}}>
                              {selectedCurrency} {currentValue.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                            </span>
                          ) : (
                            <span style={{color: '#64748b'}}>-</span>
                          )}
                        </td>
                        <td style={{padding: '12px 16px', whiteSpace: 'nowrap', textAlign: 'right'}}>
                          {transaction.type === 'buy' && currentBitcoinPrice > 0 ? (
                            <div style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px'}}>
                              <span style={{
                                fontSize: '14px',
                                fontWeight: 'bold',
                                color: isProfit ? '#10b981' : '#ef4444'
                              }}>
                                {isProfit ? '+' : ''}{profit.toLocaleString('pt-BR', {minimumFractionDigits: 2})} {selectedCurrency}
                              </span>
                              <span style={{
                                fontSize: '12px',
                                fontWeight: '600',
                                color: isProfit ? '#10b981' : '#ef4444'
                              }}>
                                {isProfit ? '↗' : '↘'} {percentage.toFixed(2)}%
                              </span>
                            </div>
                          ) : (
                            <span style={{color: '#64748b'}}>-</span>
                          )}
                        </td>
                        <td style={{padding: '12px 16px', whiteSpace: 'nowrap', textAlign: 'center'}}>
                          <button 
                            onClick={() => {
                              showConfirm('Tem certeza que deseja excluir esta transação?', () => {
                                deleteTransaction(transaction.id);
                                closeConfirm();
                              });
                            }}
                            style={{
                              padding: '8px',
                              background: 'transparent',
                              border: 'none',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'transparent';
                            }}
                          >
                            <Trash2 style={{width: '16px', height: '16px', color: '#94a3b8'}} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer com resumo */}
            <div style={{
              background: '#1e293b',
              borderTop: '1px solid #475569',
              padding: '24px'
            }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '16px'
              }}>
                <div style={{textAlign: 'center'}}>
                  <p style={{fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '600', marginBottom: '8px'}}>Total Investido</p>
                  <p style={{fontSize: '18px', fontWeight: 'bold', color: 'white'}}>
                    {selectedCurrency} {calculateTotalInvested().toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                  </p>
                </div>
                <div style={{textAlign: 'center'}}>
                  <p style={{fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '600', marginBottom: '8px'}}>Total BTC</p>
                  <p style={{fontSize: '18px', fontWeight: 'bold', color: '#fb923c'}}>
                    {calculateTotalBitcoin().toFixed(8)} BTC
                  </p>
                </div>
                <div style={{textAlign: 'center'}}>
                  <p style={{fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '600', marginBottom: '8px'}}>Valor Atual</p>
                  <p style={{fontSize: '18px', fontWeight: 'bold', color: 'white'}}>
                    {selectedCurrency} {(calculateTotalBitcoin() * currentBitcoinPrice).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                  </p>
                </div>
                <div style={{textAlign: 'center'}}>
                  <p style={{fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '600', marginBottom: '8px'}}>Resultado</p>
                  <p style={{
                    fontSize: '18px',
                    fontWeight: 'bold',
                    color: (calculateTotalBitcoin() * currentBitcoinPrice) - calculateTotalInvested() >= 0
                      ? '#10b981'
                      : '#ef4444'
                  }}>
                    {((calculateTotalBitcoin() * currentBitcoinPrice) - calculateTotalInvested() >= 0 ? '+' : '')}
                    {selectedCurrency} {((calculateTotalBitcoin() * currentBitcoinPrice) - calculateTotalInvested()).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Os modais de compra e venda agora estão no topo do componente */}
      
      {/* Alertas e Confirmações Personalizados */}
      {alertConfig?.show && (
        <CustomAlert
          message={alertConfig.message}
          type={alertConfig.type}
          onClose={closeAlert}
          isDarkTheme={isDarkTheme}
        />
      )}
      
      {confirmConfig?.show && (
        <CustomConfirm
          message={confirmConfig.message}
          onConfirm={() => {
            confirmConfig.onConfirm();
          }}
          onCancel={closeConfirm}
          isDarkTheme={isDarkTheme}
        />
      )}
      </div>
    </>
  );
}
