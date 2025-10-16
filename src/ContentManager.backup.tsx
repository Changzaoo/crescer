import { useState, useEffect } from 'react';
import { X, Trash2, LogIn, UserPlus, TrendingUp, TrendingDown, Bitcoin, BarChart3, Calendar, Clock, DollarSign, Percent, ArrowUpCircle, ArrowDownCircle, Edit } from 'lucide-react';
import { db } from './firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import SHA512 from 'crypto-js/sha512';

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

export default function ContentManager() {
  // Estados de autenticação
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showRegister, setShowRegister] = useState(false);
  const [showPasswordBuy, setShowPasswordBuy] = useState(false);
  const [showPasswordSell, setShowPasswordSell] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<BitcoinTransaction | null>(null);
  
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
    } catch (error) {
      console.error('Erro ao registrar usuário:', error);
      setError('Erro ao criar conta. Tente novamente.');
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
    } catch (error) {
      console.error('Erro ao fazer login:', error);
      setError('Erro ao entrar. Tente novamente.');
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
    } catch (error) {
      console.error('Erro ao salvar compra:', error);
      setError('Erro ao salvar compra');
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
    } catch (error) {
      console.error('Erro ao adicionar venda:', error);
      setError('Erro ao registrar venda');
    }
  };

  // Função para deletar transação
  const deleteTransaction = async (transactionId: string) => {
    if (!currentUser) return;

    try {
      const updatedTransactions = userTransactions.filter(t => t.id !== transactionId);
      await setDoc(doc(db, 'userTransactions', currentUser.id), { transactions: updatedTransactions });
      setUserTransactions(updatedTransactions);
    } catch (error) {
      console.error('Erro ao deletar transação:', error);
      setError('Erro ao deletar transação');
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
  }, [newBuyTransaction.date, newBuyTransaction.time, newBuyTransaction.fiatCurrency, showPasswordBuy]);

  // Buscar preço histórico para vendas quando data ou hora mudarem
  useEffect(() => {
    const fetchHistoricalPriceForSell = async () => {
      if (newSellTransaction.date && newSellTransaction.time && showPasswordSell) {
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
  }, [newSellTransaction.date, newSellTransaction.time, newSellTransaction.fiatCurrency, showPasswordSell]);

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

  // Se não estiver autenticado, mostrar tela de login/registro
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
        {/* Partículas flutuantes brancas */}
        {[...Array(10)].map((_, i) => (
          <div key={i} className="particle"></div>
        ))}
        
        <div className="apple-modal-content p-14 sm:p-18 w-full max-w-[382px] apple-fade-in relative z-10">
          {/* Logo */}
          <div className="text-center mb-10 sm:mb-13 mx-[2%]">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Crescer - Bitcoin Holding</h1>
          </div>

          {/* Erro */}
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 apple-badge bg-red-50 text-red-800 mb-4 text-sm mx-[2%]">
              {error}
            </div>
          )}

          {!showRegister ? (
            /* Formulário de Login */
            <div className="space-y-13 mx-[2%]">
              <h2 className="text-2xl font-bold text-center text-gray-900">Entrar na Conta</h2>
              
              <div>
                <label className="block text-lg font-bold text-gray-900 mb-5">Nome de Usuário</label>
                <input
                  type="text"
                  value={loginForm.username}
                  onChange={(e) => setLoginForm({...loginForm, username: e.target.value})}
                  className="apple-input w-full px-6 py-6 text-xl"
                  placeholder="Digite seu usuário"
                />
              </div>

              <div className="mx-[2%]">
                <label className="block text-lg font-bold text-gray-900 mb-5">Senha</label>
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                  className="apple-input w-full px-6 py-6 text-xl"
                  placeholder="Digite sua senha"
                />
              </div>

              <div>
                <button
                  onClick={loginUser}
                  className="apple-button apple-gradient-primary w-full text-white py-6 font-bold flex items-center justify-center gap-2 text-xl"
                >
                  <LogIn className="w-7 h-7" />
                  Entrar
                </button>
              </div>

              <div className="text-center mt-9">
                <button
                  onClick={() => setShowRegister(true)}
                  className="text-primary-600 hover:text-primary-800 font-medium transition-all text-lg"
                >
                  Não tem conta? Criar nova conta
                </button>
              </div>
            </div>
          ) : (
            /* Formulário de Registro */
            <div className="space-y-13 mx-[2%]">
              <h2 className="text-2xl font-bold text-center text-gray-900">Criar Nova Conta</h2>
              
              <div>
                <label className="block text-lg font-bold text-gray-900 mb-5">Nome de Usuário</label>
                <input
                  type="text"
                  value={registerForm.username}
                  onChange={(e) => setRegisterForm({...registerForm, username: e.target.value})}
                  className="apple-input w-full px-6 py-6 text-xl"
                  placeholder="Escolha um nome de usuário"
                />
              </div>

              <div className="mx-[2%]">
                <label className="block text-lg font-bold text-gray-900 mb-5">Senha</label>
                <input
                  type="password"
                  value={registerForm.password}
                  onChange={(e) => setRegisterForm({...registerForm, password: e.target.value})}
                  className="apple-input w-full px-6 py-6 text-xl"
                  placeholder="Crie uma senha (min. 6 caracteres)"
                />
              </div>

              <div>
                <label className="block text-lg font-bold text-gray-900 mb-5">Confirmar Senha</label>
                <input
                  type="password"
                  value={registerForm.confirmPassword}
                  onChange={(e) => setRegisterForm({...registerForm, confirmPassword: e.target.value})}
                  className="apple-input w-full px-6 py-6 text-xl"
                  placeholder="Confirme sua senha"
                />
              </div>

              <div>
                <button
                  onClick={registerUser}
                  className="apple-button apple-gradient-success w-full text-white py-6 font-bold flex items-center justify-center gap-2 text-xl"
                >
                  <UserPlus className="w-7 h-7" />
                  Criar Conta
                </button>
              </div>

              <div className="text-center mt-9">
                <button
                  onClick={() => setShowRegister(false)}
                  className="text-primary-600 hover:text-primary-800 font-medium transition-all text-lg"
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
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            zIndex: 999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
          onClick={() => setShowPasswordBuy(false)}
        >
          <div 
            style={{
              backgroundColor: 'white',
              padding: '32px',
              borderRadius: '16px',
              maxWidth: '500px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px'}}>
              <h2 style={{fontSize: '24px', fontWeight: 'bold', color: '#111'}}>
                {editingTransaction ? 'Editar Compra' : 'Registrar Compra'}
              </h2>
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
                  padding: '8px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#f3f4f6',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X style={{width: '20px', height: '20px', color: '#666'}} />
              </button>
            </div>

            {error && (
              <div style={{
                backgroundColor: '#fee2e2',
                color: '#991b1b',
                padding: '12px',
                borderRadius: '8px',
                marginBottom: '16px',
                fontSize: '14px'
              }}>
                {error}
              </div>
            )}

            <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
              {/* Seletor de Modo */}
              <div style={{
                background: 'linear-gradient(to right, #fef3c7, #fed7aa)',
                padding: '16px',
                borderRadius: '12px'
              }}>
                <label style={{display: 'block', fontSize: '14px', fontWeight: 'bold', color: '#111', marginBottom: '12px'}}>
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
                      padding: '12px',
                      borderRadius: '8px',
                      border: 'none',
                      fontWeight: '600',
                      fontSize: '14px',
                      cursor: 'pointer',
                      backgroundColor: buyInputMode === 'fiat' ? '#3b82f6' : 'white',
                      color: buyInputMode === 'fiat' ? 'white' : '#374151',
                      transform: buyInputMode === 'fiat' ? 'scale(1.05)' : 'scale(1)',
                      transition: 'all 0.2s'
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
                      padding: '12px',
                      borderRadius: '8px',
                      border: 'none',
                      fontWeight: '600',
                      fontSize: '14px',
                      cursor: 'pointer',
                      backgroundColor: buyInputMode === 'satoshis' ? '#3b82f6' : 'white',
                      color: buyInputMode === 'satoshis' ? 'white' : '#374151',
                      transform: buyInputMode === 'satoshis' ? 'scale(1.05)' : 'scale(1)',
                      transition: 'all 0.2s'
                    }}
                  >
                    ₿ Quantidade Satoshis
                  </button>
                </div>
              </div>

              {/* Data e Hora */}
              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px'}}>
                <div>
                  <label style={{display: 'block', fontSize: '14px', fontWeight: 'bold', color: '#111', marginBottom: '8px'}}>
                    Data
                  </label>
                  <input
                    type="date"
                    value={newBuyTransaction.date}
                    onChange={(e) => setNewBuyTransaction({...newBuyTransaction, date: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: '8px',
                      border: '2px solid #e5e7eb',
                      fontSize: '14px'
                    }}
                  />
                </div>
                <div>
                  <label style={{display: 'block', fontSize: '14px', fontWeight: 'bold', color: '#111', marginBottom: '8px'}}>
                    Hora
                  </label>
                  <input
                    type="time"
                    value={newBuyTransaction.time}
                    onChange={(e) => setNewBuyTransaction({...newBuyTransaction, time: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: '8px',
                      border: '2px solid #e5e7eb',
                      fontSize: '14px'
                    }}
                  />
                </div>
              </div>

              {/* Moeda */}
              <div>
                <label style={{display: 'block', fontSize: '14px', fontWeight: 'bold', color: '#111', marginBottom: '8px'}}>
                  Moeda
                </label>
                <select
                  value={newBuyTransaction.fiatCurrency}
                  onChange={(e) => setNewBuyTransaction({...newBuyTransaction, fiatCurrency: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '2px solid #e5e7eb',
                    fontSize: '14px'
                  }}
                >
                  <option value="BRL">🇧🇷 Real Brasileiro (BRL)</option>
                  <option value="USD">🇺🇸 Dólar Americano (USD)</option>
                  <option value="EUR">🇪🇺 Euro (EUR)</option>
                  <option value="GBP">🇬🇧 Libra Esterlina (GBP)</option>
                </select>
              </div>

              {/* Preço Histórico */}
              <div>
                <label style={{display: 'block', fontSize: '14px', fontWeight: 'bold', color: '#111', marginBottom: '8px'}}>
                  Preço Bitcoin ({newBuyTransaction.fiatCurrency}) - 📅 {newBuyTransaction.date} às {newBuyTransaction.time}
                </label>
                <input
                  type="text"
                  value={loadingHistoricalPrice 
                    ? 'Buscando preço histórico...' 
                    : newBuyTransaction.bitcoinPrice > 0 
                      ? newBuyTransaction.bitcoinPrice.toLocaleString('pt-BR', {minimumFractionDigits: 2})
                      : 'Aguardando...'
                  }
                  disabled
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '2px solid #e5e7eb',
                    fontSize: '14px',
                    backgroundColor: '#f9fafb',
                    fontWeight: '600'
                  }}
                />
                <p style={{marginTop: '4px', fontSize: '12px', color: '#6b7280'}}>
                  ⏰ O preço é atualizado automaticamente ao selecionar data e hora
                </p>
              </div>

              {/* Campo Principal */}
              {buyInputMode === 'fiat' ? (
                <div>
                  <label style={{display: 'block', fontSize: '14px', fontWeight: 'bold', color: '#111', marginBottom: '8px'}}>
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
                  <label style={{display: 'block', fontSize: '14px', fontWeight: 'bold', color: '#111', marginBottom: '8px'}}>
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
                  <h4 style={{fontSize: '14px', fontWeight: 'bold', color: '#111', marginBottom: '12px'}}>
                    📊 Resumo da Compra
                  </h4>
                  <div style={{display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px'}}>
                    <div style={{display: 'flex', justifyContent: 'space-between'}}>
                      <span style={{color: '#374151'}}>Bitcoin:</span>
                      <span style={{fontWeight: 'bold', color: '#111'}}>{newBuyTransaction.bitcoinAmount.toFixed(8)} BTC</span>
                    </div>
                    <div style={{display: 'flex', justifyContent: 'space-between'}}>
                      <span style={{color: '#374151'}}>Satoshis:</span>
                      <span style={{fontWeight: 'bold', color: '#111'}}>{Math.round(newBuyTransaction.bitcoinAmount * 100000000).toLocaleString('pt-BR')} sats</span>
                    </div>
                    <div style={{display: 'flex', justifyContent: 'space-between'}}>
                      <span style={{color: '#374151'}}>Valor Total:</span>
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
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            zIndex: 999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
          onClick={() => setShowPasswordSell(false)}
        >
          <div 
            style={{
              backgroundColor: 'white',
              padding: '32px',
              borderRadius: '16px',
              maxWidth: '500px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px'}}>
              <h2 style={{fontSize: '24px', fontWeight: 'bold', color: '#111'}}>
                Registrar Venda
              </h2>
              <button
                onClick={() => setShowPasswordSell(false)}
                style={{
                  padding: '8px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: '#f3f4f6',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X style={{width: '20px', height: '20px', color: '#666'}} />
              </button>
            </div>

            {error && (
              <div style={{
                backgroundColor: '#fee2e2',
                color: '#991b1b',
                padding: '12px',
                borderRadius: '8px',
                marginBottom: '16px',
                fontSize: '14px'
              }}>
                {error}
              </div>
            )}

            <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
              {/* Data e Hora */}
              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px'}}>
                <div>
                  <label style={{display: 'block', fontSize: '14px', fontWeight: 'bold', color: '#111', marginBottom: '8px'}}>
                    Data
                  </label>
                  <input
                    type="date"
                    value={newSellTransaction.date}
                    onChange={(e) => setNewSellTransaction({...newSellTransaction, date: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: '8px',
                      border: '2px solid #e5e7eb',
                      fontSize: '14px'
                    }}
                  />
                </div>
                <div>
                  <label style={{display: 'block', fontSize: '14px', fontWeight: 'bold', color: '#111', marginBottom: '8px'}}>
                    Hora
                  </label>
                  <input
                    type="time"
                    value={newSellTransaction.time}
                    onChange={(e) => setNewSellTransaction({...newSellTransaction, time: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: '8px',
                      border: '2px solid #e5e7eb',
                      fontSize: '14px'
                    }}
                  />
                </div>
              </div>

              {/* Moeda */}
              <div>
                <label style={{display: 'block', fontSize: '14px', fontWeight: 'bold', color: '#111', marginBottom: '8px'}}>
                  Moeda
                </label>
                <select
                  value={newSellTransaction.fiatCurrency}
                  onChange={(e) => setNewSellTransaction({...newSellTransaction, fiatCurrency: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '2px solid #e5e7eb',
                    fontSize: '14px'
                  }}
                >
                  <option value="BRL">🇧🇷 Real Brasileiro (BRL)</option>
                  <option value="USD">🇺🇸 Dólar Americano (USD)</option>
                  <option value="EUR">🇪🇺 Euro (EUR)</option>
                  <option value="GBP">🇬🇧 Libra Esterlina (GBP)</option>
                </select>
              </div>

              {/* Preço Histórico */}
              <div>
                <label style={{display: 'block', fontSize: '14px', fontWeight: 'bold', color: '#111', marginBottom: '8px'}}>
                  Preço Bitcoin ({newSellTransaction.fiatCurrency}) - 📅 {newSellTransaction.date} às {newSellTransaction.time}
                </label>
                <input
                  type="text"
                  value={loadingHistoricalPrice 
                    ? 'Buscando preço histórico...' 
                    : newSellTransaction.bitcoinPrice > 0 
                      ? newSellTransaction.bitcoinPrice.toLocaleString('pt-BR', {minimumFractionDigits: 2})
                      : 'Aguardando...'
                  }
                  disabled
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '2px solid #e5e7eb',
                    fontSize: '14px',
                    backgroundColor: '#f9fafb',
                    fontWeight: '600'
                  }}
                />
                <p style={{marginTop: '4px', fontSize: '12px', color: '#6b7280'}}>
                  ⏰ O preço é atualizado automaticamente ao selecionar data e hora
                </p>
              </div>

              {/* Satoshis Disponíveis */}
              <div style={{
                background: 'linear-gradient(to right, #dbeafe, #fef3c7)',
                padding: '16px',
                borderRadius: '12px'
              }}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                  <span style={{fontSize: '14px', fontWeight: 'bold', color: '#111'}}>Satoshis Disponíveis:</span>
                  <span style={{fontSize: '18px', fontWeight: 'bold', color: '#3b82f6'}}>
                    {calculateTotalSatoshis().toLocaleString('pt-BR')} sats
                  </span>
                </div>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px'}}>
                  <span style={{fontSize: '12px', color: '#6b7280'}}>Bitcoin Disponível:</span>
                  <span style={{fontSize: '14px', fontWeight: '600', color: '#6b7280'}}>
                    {calculateTotalBitcoin().toFixed(8)} BTC
                  </span>
                </div>
              </div>

              {/* Quantidade de Satoshis */}
              <div>
                <label style={{display: 'block', fontSize: '14px', fontWeight: 'bold', color: '#111', marginBottom: '8px'}}>
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
                  <h4 style={{fontSize: '14px', fontWeight: 'bold', color: '#111', marginBottom: '12px'}}>
                    📊 Resumo da Venda
                  </h4>
                  <div style={{display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px'}}>
                    <div style={{display: 'flex', justifyContent: 'space-between'}}>
                      <span style={{color: '#374151'}}>Bitcoin a vender:</span>
                      <span style={{fontWeight: 'bold', color: '#111'}}>
                        {(newSellTransaction.satoshiAmount / 100000000).toFixed(8)} BTC
                      </span>
                    </div>
                    <div style={{display: 'flex', justifyContent: 'space-between'}}>
                      <span style={{color: '#374151'}}>Valor estimado:</span>
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

      <div className="min-h-screen relative overflow-hidden">
        {/* Partículas flutuantes brancas */}
        {[...Array(10)].map((_, i) => (
          <div key={i} className="particle"></div>
        ))}
      
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-20 left-20 w-72 h-72 bg-white rounded-full filter blur-xl opacity-50 animate-pulse"></div>
        <div className="absolute top-40 right-20 w-72 h-72 bg-white rounded-full filter blur-xl opacity-50 animate-pulse delay-1000"></div>
        <div className="absolute bottom-20 left-40 w-72 h-72 bg-white rounded-full filter blur-xl opacity-50 animate-pulse delay-2000"></div>
      </div>

      <div className="relative z-10 min-h-screen" style={{padding: '2%'}}>
        {/* Container Principal com Cards */}
        <div className="space-y-4">
          {/* Card Único do Portfolio Completo */}
          <div className="apple-card bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 text-white shadow-2xl border border-slate-700">
            {/* Header com Título e Ações */}
            <div className="flex items-center justify-between p-6 border-b border-slate-700/50 bg-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg">
                  <Bitcoin className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Portfolio Bitcoin</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-xs text-green-400 font-semibold">Ativo</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={logout}
                className="apple-button apple-gradient-danger text-white px-4 py-2 font-medium flex items-center gap-2 text-sm hover:scale-105 transition-transform"
                aria-label="Sair"
              >
                <X className="w-4 h-4" />
                <span>Sair</span>
              </button>
            </div>

            {/* Seletor de Moeda */}
            <div className="p-6 border-b border-slate-700/50">
              <label className="block text-sm font-semibold text-gray-300 mb-3">Moeda de Visualização</label>
              <select 
                value={selectedCurrency} 
                onChange={(e) => setSelectedCurrency(e.target.value)}
                className="w-full bg-slate-700/50 border-2 border-slate-600 rounded-xl px-4 py-3 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-400 transition-all hover:border-slate-500"
              >
                <option value="BRL">Real Brasileiro (BRL)</option>
                <option value="USD">Dólar Americano (USD)</option>
                <option value="EUR">Euro (EUR)</option>
                <option value="GBP">Libra Esterlina (GBP)</option>
              </select>
            </div>

            {/* Grid de Informações Principais */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Card: Preço Atual */}
              <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-4 rounded-xl shadow-lg border-2 border-blue-400 hover:border-blue-300 transition-colors">
                <div className="text-blue-200 text-xs font-semibold mb-1">Preço Atual BTC</div>
                <div className="text-white text-2xl font-bold">{selectedCurrency} {currentBitcoinPrice.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
              </div>

              {/* Card: Total Bitcoin */}
              <div className="bg-gradient-to-br from-orange-600 to-orange-700 p-4 rounded-xl shadow-lg border-2 border-orange-400 hover:border-orange-300 transition-colors">
                <div className="text-orange-200 text-xs font-semibold mb-1">Total em Carteira</div>
                <div className="text-white text-2xl font-bold">{calculateTotalBitcoin().toFixed(8)} BTC</div>
              </div>

              {/* Card: Preço Médio de Compra */}
              <div className="bg-gradient-to-br from-green-600 to-green-700 p-4 rounded-xl shadow-lg border-2 border-green-400 hover:border-green-300 transition-colors">
                <div className="text-green-200 text-xs font-semibold mb-1">Preço Médio de Compra</div>
                <div className="text-white text-2xl font-bold">
                  {selectedCurrency} {calculateAverageBuyPrice() > 0 
                    ? calculateAverageBuyPrice().toLocaleString('pt-BR', {minimumFractionDigits: 2})
                    : '0.00'
                  }
                </div>
              </div>

              {/* Card: Preço Médio de Venda */}
              <div className="bg-gradient-to-br from-red-600 to-red-700 p-4 rounded-xl shadow-lg border-2 border-red-400 hover:border-red-300 transition-colors">
                <div className="text-red-200 text-xs font-semibold mb-1">Preço Médio de Venda</div>
                <div className="text-white text-2xl font-bold">
                  {selectedCurrency} {calculateAverageSellPrice() > 0 
                    ? calculateAverageSellPrice().toLocaleString('pt-BR', {minimumFractionDigits: 2})
                    : '0.00'
                  }
                </div>
              </div>
            </div>

            {/* Resumo Financeiro */}
            <div className="p-6 space-y-3 bg-slate-800/30 border-t-2 border-slate-700">
              <div className="flex justify-between items-center p-3 bg-slate-700/30 rounded-lg border border-slate-600">
                <span className="text-gray-400 text-sm font-semibold">Valor Total Bruto Investido</span>
                <span className="font-bold text-white">{selectedCurrency} {calculateTotalInvested().toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
              </div>

              <div className="flex justify-between items-center p-4 bg-slate-700/50 rounded-lg border-2 border-slate-600">
                <span className="text-gray-300 font-semibold">Valor Total Líquido Atual</span>
                <span className={`font-bold text-2xl ${
                  (calculateTotalBitcoin() * currentBitcoinPrice) - calculateTotalInvested() >= 0
                    ? 'text-green-400'
                    : 'text-red-400'
                }`}>
                  {selectedCurrency} {(calculateTotalBitcoin() * currentBitcoinPrice).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                </span>
              </div>
            </div>

            {/* Card de Performance (Lucro/Prejuízo) */}
            {currentBitcoinPrice > 0 && calculateTotalInvested() > 0 && (
              <div className={`p-6 border-2 ${
                (calculateTotalBitcoin() * currentBitcoinPrice) - calculateTotalInvested() >= 0
                  ? 'bg-gradient-to-r from-green-600/20 to-green-800/20 border-green-500'
                  : 'bg-gradient-to-r from-red-600/20 to-red-800/20 border-red-500'
              }`}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className={`flex items-center gap-2 text-xs font-semibold mb-2 ${
                      (calculateTotalBitcoin() * currentBitcoinPrice) - calculateTotalInvested() >= 0
                        ? 'text-green-400'
                        : 'text-red-400'
                    }`}>
                      {(calculateTotalBitcoin() * currentBitcoinPrice) - calculateTotalInvested() >= 0 
                        ? <ArrowUpCircle className="w-4 h-4" />
                        : <ArrowDownCircle className="w-4 h-4" />
                      }
                      <span>{(calculateTotalBitcoin() * currentBitcoinPrice) - calculateTotalInvested() >= 0 ? 'LUCRO' : 'PREJUÍZO'}</span>
                    </div>
                    <div className={`text-3xl font-black ${
                      (calculateTotalBitcoin() * currentBitcoinPrice) - calculateTotalInvested() >= 0
                        ? 'text-green-400'
                        : 'text-red-400'
                    }`}>
                      {((calculateTotalBitcoin() * currentBitcoinPrice) - calculateTotalInvested() >= 0 ? '+' : '')}
                      {selectedCurrency} {Math.abs((calculateTotalBitcoin() * currentBitcoinPrice) - calculateTotalInvested()).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                    </div>
                  </div>
                  <div className={`flex items-center gap-2 text-5xl font-black ${
                    (calculateTotalBitcoin() * currentBitcoinPrice) - calculateTotalInvested() >= 0
                      ? 'text-green-400'
                      : 'text-red-400'
                  }`}>
                    <Percent className="w-12 h-12" />
                    <span>
                      {((calculateTotalBitcoin() * currentBitcoinPrice) - calculateTotalInvested() >= 0 ? '+' : '')}
                      {Math.abs(((((calculateTotalBitcoin() * currentBitcoinPrice) - calculateTotalInvested()) / calculateTotalInvested()) * 100)).toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-500 ${
                      (calculateTotalBitcoin() * currentBitcoinPrice) - calculateTotalInvested() >= 0
                        ? 'bg-gradient-to-r from-green-400 to-green-600'
                        : 'bg-gradient-to-r from-red-400 to-red-600'
                    }`}
                    style={{
                      width: `${Math.min(Math.abs(((((calculateTotalBitcoin() * currentBitcoinPrice) - calculateTotalInvested()) / calculateTotalInvested()) * 100)), 100)}%`
                    }}
                  ></div>
                </div>
              </div>
            )}

            {/* Botões de Ação */}
            <div className="p-6 grid grid-cols-2 gap-4">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('Botão Comprar clicado, showPasswordBuy atual:', showPasswordBuy);
                  setShowPasswordBuy(true);
                  console.log('showPasswordBuy definido para true');
                }}
                className="apple-button bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white px-6 py-4 font-bold text-lg flex items-center justify-center gap-3 hover:scale-105 transition-transform shadow-lg rounded-xl border-2 border-green-400 hover:border-green-300"
              >
                <TrendingUp className="w-5 h-5" />
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
                className="apple-button bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white px-6 py-4 font-bold text-lg flex items-center justify-center gap-3 hover:scale-105 transition-transform shadow-lg rounded-xl border-2 border-red-400 hover:border-red-300"
              >
                <TrendingDown className="w-5 h-5" />
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
            <div className="apple-card bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 text-white shadow-2xl border border-slate-700">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-slate-700/50 bg-slate-800/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                    <BarChart3 className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">Histórico de Transações</h3>
                    <p className="text-sm text-gray-400">
                      {userTransactions.length} transaç{userTransactions.length !== 1 ? 'ões' : 'ão'} registrada{userTransactions.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                
                {/* Controle de Quantidade */}
                <div className="flex items-center gap-3">
                  <label className="text-sm font-semibold text-gray-300">Mostrar:</label>
                  <select
                    value={transactionsToShow}
                    onChange={(e) => setTransactionsToShow(Number(e.target.value))}
                    className="px-4 py-2 bg-slate-700/50 border-2 border-slate-600 rounded-xl text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-400 hover:border-slate-500 transition-all"
                  >
                    <option value={10}>10 transações</option>
                    <option value={25}>25 transações</option>
                    <option value={50}>50 transações</option>
                    <option value={100}>100 transações</option>
                  </select>
                  <button
                    onClick={() => setShowTransactionsModal(true)}
                    className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl text-sm font-semibold transition-all hover:scale-105 border-2 border-blue-400"
                  >
                    Ver Planilha Completa
                  </button>
                </div>
              </div>

              {/* Grid de Cards de Transações */}
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                    <div key={transaction.id} className="bg-slate-700/30 border-2 border-slate-600 rounded-xl p-4">
                      {/* Header do Card */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg ${
                            transaction.type === 'buy' 
                              ? 'bg-gradient-to-br from-green-500 to-green-600' 
                              : 'bg-gradient-to-br from-red-500 to-red-600'
                          }`}>
                            {transaction.type === 'buy' ? <TrendingUp className="w-5 h-5 text-white" /> : <TrendingDown className="w-5 h-5 text-white" />}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-white">
                              {transaction.type === 'buy' ? 'Compra' : 'Venda'}
                            </div>
                            <div className="flex items-center gap-1 text-xs text-gray-400">
                              <Calendar className="w-3 h-3" />
                              {transaction.date}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-1">
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
                            className="p-2 hover:bg-blue-500/20 rounded-lg transition-colors border border-transparent hover:border-blue-500"
                          >
                            <Edit className="w-4 h-4 text-gray-400 hover:text-blue-400" />
                          </button>
                          <button 
                            onClick={() => {
                              if (window.confirm('Tem certeza que deseja excluir esta transação?')) {
                                deleteTransaction(transaction.id);
                              }
                            }}
                            className="p-2 hover:bg-red-500/20 rounded-lg transition-colors border border-transparent hover:border-red-500"
                          >
                            <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-400" />
                          </button>
                        </div>
                      </div>

                      {/* Informações */}
                      <div className="space-y-2">
                        {/* Hora */}
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <Clock className="w-3 h-3" />
                          <span>{transaction.time}</span>
                        </div>

                        {/* Quantidade BTC */}
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-400">Quantidade</span>
                          <div className="flex items-center gap-1">
                            <Bitcoin className="w-4 h-4 text-orange-400" />
                            <span className="text-sm font-mono font-bold text-orange-400">
                              {transaction.bitcoinAmount.toFixed(8)}
                            </span>
                          </div>
                        </div>

                        {/* Valor */}
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-400">Valor</span>
                          <div className="text-right">
                            <div className="text-sm font-bold text-white flex items-center gap-1">
                              <DollarSign className="w-3.5 h-3.5" />
                              {selectedCurrency} {convertedValue.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                            </div>
                            {transaction.fiatCurrency !== selectedCurrency && (
                              <div className="text-xs text-gray-500">
                                {transaction.fiatCurrency} {transaction.fiatAmount.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Resultado */}
                        {transaction.type === 'buy' && currentBitcoinPrice > 0 ? (
                          <div className={`mt-3 p-3 rounded-lg border-2 ${
                            isProfit 
                              ? 'bg-green-500/10 border-green-500/30' 
                              : 'bg-red-500/10 border-red-500/30'
                          }`}>
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-gray-300">Resultado</span>
                              <div className="text-right">
                                <div className={`text-base font-bold flex items-center gap-1 ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
                                  {isProfit ? <ArrowUpCircle className="w-4 h-4" /> : <ArrowDownCircle className="w-4 h-4" />}
                                  {isProfit ? '+' : ''}{profit.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                                </div>
                                <div className={`text-xs font-semibold flex items-center gap-1 justify-end ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
                                  <Percent className="w-3 h-3" />
                                  {isProfit ? '+' : ''}{percentage.toFixed(2)}
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-3 p-3 rounded-lg bg-slate-600/20 border-2 border-slate-600/30">
                            <span className="text-xs text-gray-500">Resultado não disponível</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
                
              {/* Indicador de mais transações */}
              {userTransactions.length > transactionsToShow && (
                <div className="bg-slate-700/30 px-6 py-4 text-center border-t-2 border-slate-600">
                  <p className="text-sm text-gray-300">
                    Mostrando {transactionsToShow} de {userTransactions.length} transações.
                    <button
                      onClick={() => setShowTransactionsModal(true)}
                      className="ml-2 text-blue-400 hover:text-blue-300 font-semibold hover:underline transition-colors"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header do Modal */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-4xl">📊</span>
                <div>
                  <h2 className="text-2xl font-bold">Histórico de Transações</h2>
                  <p className="text-blue-100 text-sm">
                    {userTransactions.length} transaç{userTransactions.length !== 1 ? 'ões' : 'ão'} registrada{userTransactions.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowTransactionsModal(false)}
                className="bg-white/20 hover:bg-white/30 p-2 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Tabela de Transações */}
            <div className="overflow-auto flex-1">
              <table className="w-full">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-b-2 border-gray-300">
                      Tipo
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-b-2 border-gray-300">
                      Data
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-b-2 border-gray-300">
                      Hora
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider border-b-2 border-gray-300">
                      Quantidade BTC
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider border-b-2 border-gray-300">
                      Satoshis
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider border-b-2 border-gray-300">
                      Preço Unitário
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider border-b-2 border-gray-300">
                      Valor Total
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider border-b-2 border-gray-300">
                      Valor Atual
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider border-b-2 border-gray-300">
                      Lucro/Prejuízo
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-b-2 border-gray-300">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {userTransactions.slice().reverse().map((transaction) => {
                    const { profit, percentage } = calculateProfitLoss(transaction);
                    const isProfit = profit >= 0;
                    const currentValue = transaction.bitcoinAmount * currentBitcoinPrice;
                    
                    return (
                      <tr key={transaction.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              transaction.type === 'buy' 
                                ? 'bg-green-100 text-green-600' 
                                : 'bg-red-100 text-red-600'
                            }`}>
                              {transaction.type === 'buy' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                            </div>
                            <span className="text-sm font-medium text-gray-900">
                              {transaction.type === 'buy' ? 'Compra' : 'Venda'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          {transaction.date}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          {transaction.time}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-mono font-semibold text-gray-900">
                          {transaction.bitcoinAmount.toFixed(8)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-gray-600">
                          {transaction.satoshis.toLocaleString('pt-BR')}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-gray-900">
                          <div className="flex flex-col items-end">
                            <span className="font-semibold">{selectedCurrency} {convertCurrency(transaction.bitcoinPrice, transaction.fiatCurrency, selectedCurrency, transaction.exchangeRates).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                            {transaction.fiatCurrency !== selectedCurrency && (
                              <span className="text-xs text-gray-500">{transaction.fiatCurrency} {transaction.bitcoinPrice.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-semibold text-gray-900">
                          <div className="flex flex-col items-end">
                            <span className="font-bold">{selectedCurrency} {convertCurrency(transaction.fiatAmount, transaction.fiatCurrency, selectedCurrency, transaction.exchangeRates).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                            {transaction.fiatCurrency !== selectedCurrency && (
                              <span className="text-xs text-gray-500 font-normal">{transaction.fiatCurrency} {transaction.fiatAmount.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-semibold">
                          {transaction.type === 'buy' && currentBitcoinPrice > 0 ? (
                            <span className={isProfit ? 'text-green-600' : 'text-red-600'}>
                              {selectedCurrency} {currentValue.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          {transaction.type === 'buy' && currentBitcoinPrice > 0 ? (
                            <div className="flex flex-col items-end gap-1">
                              <span className={`text-sm font-bold ${isProfit ? 'text-green-600' : 'text-red-600'}`}>
                                {isProfit ? '+' : ''}{profit.toLocaleString('pt-BR', {minimumFractionDigits: 2})} {selectedCurrency}
                              </span>
                              <span className={`text-xs font-semibold ${isProfit ? 'text-green-600' : 'text-red-600'}`}>
                                {isProfit ? '↗' : '↘'} {percentage.toFixed(2)}%
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          <button 
                            onClick={() => {
                              if (window.confirm('Tem certeza que deseja excluir esta transação?')) {
                                deleteTransaction(transaction.id);
                              }
                            }}
                            className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer com resumo */}
            <div className="bg-gray-50 border-t border-gray-200 p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-xs text-gray-600 uppercase font-semibold">Total Investido</p>
                  <p className="text-lg font-bold text-gray-900">
                    {selectedCurrency} {calculateTotalInvested().toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-600 uppercase font-semibold">Total BTC</p>
                  <p className="text-lg font-bold text-gray-900">
                    {calculateTotalBitcoin().toFixed(8)} BTC
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-600 uppercase font-semibold">Valor Atual</p>
                  <p className="text-lg font-bold text-gray-900">
                    {selectedCurrency} {(calculateTotalBitcoin() * currentBitcoinPrice).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-600 uppercase font-semibold">Resultado</p>
                  <p className={`text-lg font-bold ${
                    (calculateTotalBitcoin() * currentBitcoinPrice) - calculateTotalInvested() >= 0
                      ? 'text-green-600'
                      : 'text-red-600'
                  }`}>
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
      </div>
    </>
  );
}
              <h2 className="text-2xl font-bold text-gray-900">
                {editingTransaction ? 'Editar Compra' : 'Registrar Compra'}
              </h2>
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
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-6 h-6 text-gray-600" />
              </button>
            </div>

            {error && (
              <div className="apple-badge bg-red-50 text-red-800 mb-3 sm:mb-4 p-2 sm:p-3 w-full text-xs sm:text-sm">
                {error}
              </div>
            )}

            <div className="space-y-3 sm:space-y-4">
              {/* Seletor de Modo de Entrada */}
              <div className="apple-card bg-gradient-to-r from-primary-50 to-orange-50 p-3 sm:p-4">
                <label className="block text-xs sm:text-sm font-bold text-gray-900 mb-2 sm:mb-3">Como você quer registrar?</label>
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setBuyInputMode('fiat');
                      setNewBuyTransaction({...newBuyTransaction, bitcoinAmount: 0, fiatAmount: 0});
                    }}
                    className={`apple-button py-2 sm:py-3 font-semibold text-xs sm:text-sm transition-all ${
                      buyInputMode === 'fiat' 
                        ? 'apple-gradient-primary text-white shadow-lg scale-105' 
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    💰 Valor em Fiat
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBuyInputMode('satoshis');
                      setNewBuyTransaction({...newBuyTransaction, bitcoinAmount: 0, fiatAmount: 0});
                    }}
                    className={`apple-button py-2 sm:py-3 font-semibold text-xs sm:text-sm transition-all ${
                      buyInputMode === 'satoshis' 
                        ? 'apple-gradient-primary text-white shadow-lg scale-105' 
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    ₿ Quantidade Satoshis
                  </button>
                </div>
              </div>

              {/* Data e Hora */}
              <div className="grid grid-cols-2 gap-2 sm:gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-bold text-gray-900 mb-1.5 sm:mb-2">Data</label>
                  <input
                    type="date"
                    value={newBuyTransaction.date}
                    onChange={(e) => setNewBuyTransaction({...newBuyTransaction, date: e.target.value})}
                    className="apple-input w-full px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-base"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-bold text-gray-900 mb-1.5 sm:mb-2">Hora</label>
                  <input
                    type="time"
                    value={newBuyTransaction.time}
                    onChange={(e) => setNewBuyTransaction({...newBuyTransaction, time: e.target.value})}
                    className="apple-input w-full px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-base"
                  />
                </div>
              </div>

              {/* Moeda */}
              <div>
                <label className="block text-xs sm:text-sm font-bold text-gray-900 mb-1.5 sm:mb-2">Moeda</label>
                <select
                  value={newBuyTransaction.fiatCurrency}
                  onChange={(e) => setNewBuyTransaction({...newBuyTransaction, fiatCurrency: e.target.value})}
                  className="apple-select w-full px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-base"
                >
                  <option value="BRL">🇧🇷 Real Brasileiro (BRL)</option>
                  <option value="USD">🇺🇸 Dólar Americano (USD)</option>
                  <option value="EUR">🇪🇺 Euro (EUR)</option>
                  <option value="GBP">🇬🇧 Libra Esterlina (GBP)</option>
                </select>
              </div>

              {/* Preço Histórico do Bitcoin */}
              <div>
                <label className="block text-xs sm:text-sm font-bold text-gray-900 mb-1.5 sm:mb-2">
                  Preço Bitcoin ({newBuyTransaction.fiatCurrency}) - <span className="text-blue-600">📅 {newBuyTransaction.date} às {newBuyTransaction.time}</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={loadingHistoricalPrice 
                      ? 'Buscando preço histórico...' 
                      : newBuyTransaction.bitcoinPrice > 0 
                        ? newBuyTransaction.bitcoinPrice.toLocaleString('pt-BR', {minimumFractionDigits: 2})
                        : 'Aguardando...'
                    }
                    disabled
                    className="apple-input w-full px-2 sm:px-4 py-2 sm:py-3 font-semibold text-gray-900 text-xs sm:text-base"
                    placeholder="Selecione data e hora"
                  />
                  <div className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 sm:gap-2">
                    {loadingHistoricalPrice ? (
                      <>
                        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-blue-500 rounded-full animate-pulse"></div>
                        <span className="text-xs text-gray-600 font-medium hidden sm:inline">Carregando...</span>
                      </>
                    ) : newBuyTransaction.bitcoinPrice > 0 ? (
                      <>
                        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-500 rounded-full"></div>
                        <span className="text-xs text-gray-600 font-medium hidden sm:inline">CoinGecko</span>
                      </>
                    ) : null}
                  </div>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  ⏰ O preço é atualizado automaticamente ao selecionar data e hora
                </p>
              </div>

              {/* Campo de Entrada Principal - Muda conforme o modo */}
              {buyInputMode === 'fiat' ? (
                <div>
                  <label className="block text-xs sm:text-sm font-bold text-gray-900 mb-1.5 sm:mb-2">
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
                    className="apple-input w-full px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-base font-bold text-primary-600"
                    placeholder="Digite o valor em fiat"
                    disabled={loadingHistoricalPrice || newBuyTransaction.bitcoinPrice === 0}
                  />
                  {(loadingHistoricalPrice || newBuyTransaction.bitcoinPrice === 0) && (
                    <p className="mt-1 text-xs text-amber-600">
                      ⏳ Aguarde o preço ser carregado antes de inserir o valor
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-xs sm:text-sm font-bold text-gray-900 mb-1.5 sm:mb-2">
                    ₿ Quantidade de Satoshis Adquiridos
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
                    className="apple-input w-full px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-base font-bold text-orange-600"
                    placeholder="Digite a quantidade de satoshis"
                    disabled={loadingHistoricalPrice || newBuyTransaction.bitcoinPrice === 0}
                  />
                  {(loadingHistoricalPrice || newBuyTransaction.bitcoinPrice === 0) && (
                    <p className="mt-1 text-xs text-amber-600">
                      ⏳ Aguarde o preço ser carregado antes de inserir a quantidade
                    </p>
                  )}
                </div>
              )}

              {/* Preview dos Cálculos */}
              {(newBuyTransaction.fiatAmount > 0 || newBuyTransaction.bitcoinAmount > 0) && (
                <div className="apple-card bg-gradient-to-r from-green-50 to-blue-50 p-3 sm:p-4 space-y-2">
                  <h4 className="text-xs sm:text-sm font-bold text-gray-900 mb-2">📊 Resumo da Compra</h4>
                  <div className="space-y-1 text-xs sm:text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-700">Bitcoin:</span>
                      <span className="font-bold text-gray-900">{newBuyTransaction.bitcoinAmount.toFixed(8)} BTC</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700">Satoshis:</span>
                      <span className="font-bold text-gray-900">{Math.round(newBuyTransaction.bitcoinAmount * 100000000).toLocaleString('pt-BR')} sats</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700">Valor Total:</span>
                      <span className="font-bold text-primary-600">{newBuyTransaction.fiatCurrency} {newBuyTransaction.fiatAmount.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700">Preço Unitário:</span>
                      <span className="font-semibold text-gray-900">{newBuyTransaction.fiatCurrency} {currentBitcoinPrice.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={addBuyTransaction}
                disabled={!newBuyTransaction.bitcoinAmount || !newBuyTransaction.fiatAmount || currentBitcoinPrice === 0}
                className="apple-button apple-gradient-success w-full text-white py-2.5 sm:py-3 font-bold text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ✅ Registrar Compra
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Venda */}
      {showPasswordSell && (
        <div className="apple-modal fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4" style={{backgroundColor: 'rgba(0, 0, 0, 0.5)'}} onClick={(e) => {
          console.log('Modal de venda OVERLAY clicado');
          if (e.target === e.currentTarget) {
            setShowPasswordSell(false);
          }
        }}>
          <div className="apple-modal-content p-4 sm:p-8 w-full max-w-md apple-fade-in" style={{position: 'relative', zIndex: 10000}} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h3 className="text-lg sm:text-2xl font-bold text-gray-900">Registrar Venda</h3>
              <button
                onClick={() => setShowPasswordSell(false)}
                className="apple-button bg-gray-100 hover:bg-gray-200 p-1.5 sm:p-2 text-gray-600 hover:text-gray-800"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>

            {error && (
              <div className="apple-badge bg-red-50 text-red-800 mb-3 sm:mb-4 p-2 sm:p-3 w-full text-xs sm:text-sm">
                {error}
              </div>
            )}

            <div className="space-y-3 sm:space-y-4">
              <div className="apple-card bg-blue-50 p-3 sm:p-4">
                <p className="text-xs sm:text-sm text-blue-800">
                  <strong>Saldo disponível:</strong> {calculateTotalSatoshis().toLocaleString('pt-BR')} satoshis
                </p>
              </div>

              {/* Data e Hora */}
              <div className="grid grid-cols-2 gap-2 sm:gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-bold text-gray-900 mb-1.5 sm:mb-2">Data</label>
                  <input
                    type="date"
                    value={newSellTransaction.date}
                    onChange={(e) => setNewSellTransaction({...newSellTransaction, date: e.target.value})}
                    className="apple-input w-full px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-base"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-bold text-gray-900 mb-1.5 sm:mb-2">Hora</label>
                  <input
                    type="time"
                    value={newSellTransaction.time}
                    onChange={(e) => setNewSellTransaction({...newSellTransaction, time: e.target.value})}
                    className="apple-input w-full px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-base"
                  />
                </div>
              </div>

              {/* Moeda */}
              <div>
                <label className="block text-xs sm:text-sm font-bold text-gray-900 mb-1.5 sm:mb-2">Moeda</label>
                <select
                  value={newSellTransaction.fiatCurrency}
                  onChange={(e) => setNewSellTransaction({...newSellTransaction, fiatCurrency: e.target.value})}
                  className="apple-select w-full px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-base"
                >
                  <option value="BRL">🇧🇷 Real Brasileiro (BRL)</option>
                  <option value="USD">🇺🇸 Dólar Americano (USD)</option>
                  <option value="EUR">🇪🇺 Euro (EUR)</option>
                  <option value="GBP">🇬🇧 Libra Esterlina (GBP)</option>
                </select>
              </div>

              {/* Preço Histórico do Bitcoin */}
              <div>
                <label className="block text-xs sm:text-sm font-bold text-gray-900 mb-1.5 sm:mb-2">
                  Preço Bitcoin ({newSellTransaction.fiatCurrency}) - <span className="text-blue-600">📅 {newSellTransaction.date} às {newSellTransaction.time}</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={loadingHistoricalPrice 
                      ? 'Buscando preço histórico...' 
                      : newSellTransaction.bitcoinPrice > 0 
                        ? newSellTransaction.bitcoinPrice.toLocaleString('pt-BR', {minimumFractionDigits: 2})
                        : 'Aguardando...'
                    }
                    disabled
                    className="apple-input w-full px-2 sm:px-4 py-2 sm:py-3 font-semibold text-gray-900 text-xs sm:text-base"
                    placeholder="Selecione data e hora"
                  />
                  <div className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 sm:gap-2">
                    {loadingHistoricalPrice ? (
                      <>
                        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-blue-500 rounded-full animate-pulse"></div>
                        <span className="text-xs text-gray-600 font-medium hidden sm:inline">Carregando...</span>
                      </>
                    ) : newSellTransaction.bitcoinPrice > 0 ? (
                      <>
                        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-500 rounded-full"></div>
                        <span className="text-xs text-gray-600 font-medium hidden sm:inline">CoinGecko</span>
                      </>
                    ) : null}
                  </div>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  ⏰ O preço é atualizado automaticamente ao selecionar data e hora
                </p>
              </div>
              
              <div>
                <label className="block text-xs sm:text-sm font-bold text-gray-900 mb-1.5 sm:mb-2">Quantidade de Satoshis para Vender</label>
                <input
                  type="number"
                  value={newSellTransaction.satoshiAmount}
                  onChange={(e) => setNewSellTransaction({...newSellTransaction, satoshiAmount: parseInt(e.target.value) || 0})}
                  className="apple-input w-full px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-base"
                  placeholder="Quantidade em satoshis"
                  max={calculateTotalSatoshis()}
                  disabled={loadingHistoricalPrice || newSellTransaction.bitcoinPrice === 0}
                />
                {(loadingHistoricalPrice || newSellTransaction.bitcoinPrice === 0) && (
                  <p className="mt-1 text-xs text-amber-600">
                    ⏳ Aguarde o preço ser carregado antes de inserir a quantidade
                  </p>
                )}
              </div>
              
              {newSellTransaction.satoshiAmount > 0 && newSellTransaction.bitcoinPrice > 0 && (
                <div className="apple-card bg-green-50 p-3 sm:p-4">
                  <p className="text-xs sm:text-sm text-green-800">
                    <strong>Bitcoin a vender:</strong> {(newSellTransaction.satoshiAmount / 100000000).toFixed(8)} BTC
                  </p>
                  <p className="text-xs sm:text-sm text-green-800">
                    <strong>Valor estimado:</strong> {newSellTransaction.fiatCurrency} {((newSellTransaction.satoshiAmount / 100000000) * newSellTransaction.bitcoinPrice).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                  </p>
                </div>
              )}
              
              <button
                onClick={addSellTransaction}
                disabled={newSellTransaction.satoshiAmount <= 0 || newSellTransaction.satoshiAmount > calculateTotalSatoshis() || loadingHistoricalPrice || newSellTransaction.bitcoinPrice === 0}
                className="apple-button apple-gradient-danger w-full text-white py-2.5 sm:py-3 font-bold text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingHistoricalPrice ? 'Carregando preço...' : 'Registrar Venda'}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
}