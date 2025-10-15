import { useState, useEffect } from 'react';
import { Edit2, X, Trash2, LogIn, UserPlus, TrendingUp, TrendingDown } from 'lucide-react';
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
  
  // Estados de formulários
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ username: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  
  // Estados de preço e moeda
  const [currentBitcoinPrice, setCurrentBitcoinPrice] = useState<number>(0);
  const [selectedCurrency, setSelectedCurrency] = useState<string>('BRL');
  
  // Estados de transações
  const [userTransactions, setUserTransactions] = useState<BitcoinTransaction[]>([]);
  
  // Estado do menu flutuante
  const [showFabMenu, setShowFabMenu] = useState(false);
  
  // Estados de formulários de transação
  const [newBuyTransaction, setNewBuyTransaction] = useState({
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().split(' ')[0].slice(0, 5),
    bitcoinAmount: 0,
    fiatAmount: 0,
    fiatCurrency: selectedCurrency,
    bitcoinPrice: 0
  });
  
  const [newSellTransaction, setNewSellTransaction] = useState({
    satoshiAmount: 0
  });

  // Função para hash da senha
  const hashPassword = (password: string): string => {
    return SHA512(password).toString();
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
  };

  // Função para adicionar transação de compra
  const addBuyTransaction = async () => {
    if (!currentUser) return;

    const satoshis = Math.round(newBuyTransaction.bitcoinAmount * 100000000);
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
      createdAt: new Date().toISOString()
    };

    try {
      const updatedTransactions = [...userTransactions, transaction];
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
    } catch (error) {
      console.error('Erro ao adicionar compra:', error);
      setError('Erro ao registrar compra');
    }
  };

  // Função para adicionar transação de venda
  const addSellTransaction = async () => {
    if (!currentUser || currentBitcoinPrice === 0) return;

    const totalSatoshis = calculateTotalSatoshis();
    if (newSellTransaction.satoshiAmount > totalSatoshis) {
      setError('Quantidade de satoshis insuficiente');
      return;
    }

    const bitcoinAmount = newSellTransaction.satoshiAmount / 100000000;
    const fiatAmount = bitcoinAmount * currentBitcoinPrice;

    const transaction: BitcoinTransaction = {
      id: `sell_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: currentUser.id,
      type: 'sell',
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().split(' ')[0].slice(0, 5),
      bitcoinAmount: bitcoinAmount,
      satoshis: newSellTransaction.satoshiAmount,
      fiatAmount: fiatAmount,
      fiatCurrency: selectedCurrency,
      bitcoinPrice: currentBitcoinPrice,
      createdAt: new Date().toISOString()
    };

    try {
      const updatedTransactions = [...userTransactions, transaction];
      await setDoc(doc(db, 'userTransactions', currentUser.id), { transactions: updatedTransactions });
      setUserTransactions(updatedTransactions);

      // Reset form
      setNewSellTransaction({ satoshiAmount: 0 });
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
      return transaction.type === 'buy' 
        ? sum + transaction.fiatAmount 
        : sum - transaction.fiatAmount;
    }, 0);
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
    
    const currentValue = transaction.bitcoinAmount * currentBitcoinPrice;
    const profit = currentValue - transaction.fiatAmount;
    const percentage = ((currentValue - transaction.fiatAmount) / transaction.fiatAmount) * 100;
    
    return { profit, percentage };
  };

  // Buscar preço do Bitcoin periodicamente
  useEffect(() => {
    fetchBitcoinPrice(); // Buscar imediatamente
    const interval = setInterval(fetchBitcoinPrice, 1000); // Atualizar a cada 1 segundo
    return () => clearInterval(interval);
  }, [selectedCurrency]);

  // Sincronizar moeda selecionada com os formulários
  useEffect(() => {
    setNewBuyTransaction(prev => ({
      ...prev,
      fiatCurrency: selectedCurrency,
      bitcoinPrice: currentBitcoinPrice
    }));
  }, [selectedCurrency, currentBitcoinPrice]);

  // Carregar transações do usuário quando autenticado
  useEffect(() => {
    if (isAuthenticated && currentUser) {
      loadUserTransactions(currentUser.id);
    }
  }, [isAuthenticated, currentUser]);

  // Se não estiver autenticado, mostrar tela de login/registro
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-orange-100 flex items-center justify-center p-4">
        <div className="apple-modal-content p-6 sm:p-8 w-full max-w-xs apple-fade-in">
          {/* Logo */}
          <div className="text-center mb-6 sm:mb-8">
            <img src="/logo.png" alt="Crescer - Bitcoin Holding" className="h-12 sm:h-16 mx-auto mb-3 sm:mb-4 apple-bounce" />
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Crescer - Bitcoin Holding</h1>
            <p className="text-sm sm:text-base text-gray-600">Sistema de Rastreamento de Bitcoin</p>
          </div>

          {/* Erro */}
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 apple-badge bg-red-50 text-red-800 mb-4">
              {error}
            </div>
          )}

          {!showRegister ? (
            /* Formulário de Login */
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-center text-gray-900">Entrar na Conta</h2>
              
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">Nome de Usuário</label>
                <input
                  type="text"
                  value={loginForm.username}
                  onChange={(e) => setLoginForm({...loginForm, username: e.target.value})}
                  className="apple-input w-full px-4 py-3"
                  placeholder="Digite seu usuário"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">Senha</label>
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                  className="apple-input w-full px-4 py-3"
                  placeholder="Digite sua senha"
                />
              </div>

              <button
                onClick={loginUser}
                className="apple-button apple-gradient-primary w-full text-white py-3 font-bold flex items-center justify-center gap-2"
              >
                <LogIn className="w-5 h-5" />
                Entrar
              </button>

              <div className="text-center">
                <button
                  onClick={() => setShowRegister(true)}
                  className="text-primary-600 hover:text-primary-800 font-medium transition-all"
                >
                  Não tem conta? Criar nova conta
                </button>
              </div>
            </div>
          ) : (
            /* Formulário de Registro */
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-center text-gray-900">Criar Nova Conta</h2>
              
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">Nome de Usuário</label>
                <input
                  type="text"
                  value={registerForm.username}
                  onChange={(e) => setRegisterForm({...registerForm, username: e.target.value})}
                  className="apple-input w-full px-4 py-3"
                  placeholder="Escolha um nome de usuário"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">Senha</label>
                <input
                  type="password"
                  value={registerForm.password}
                  onChange={(e) => setRegisterForm({...registerForm, password: e.target.value})}
                  className="apple-input w-full px-4 py-3"
                  placeholder="Crie uma senha (min. 6 caracteres)"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">Confirmar Senha</label>
                <input
                  type="password"
                  value={registerForm.confirmPassword}
                  onChange={(e) => setRegisterForm({...registerForm, confirmPassword: e.target.value})}
                  className="apple-input w-full px-4 py-3"
                  placeholder="Confirme sua senha"
                />
              </div>

              <button
                onClick={registerUser}
                className="apple-button apple-gradient-success w-full text-white py-3 font-bold flex items-center justify-center gap-2"
              >
                <UserPlus className="w-5 h-5" />
                Criar Conta
              </button>

              <div className="text-center">
                <button
                  onClick={() => setShowRegister(false)}
                  className="text-primary-600 hover:text-primary-800 font-medium transition-all"
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
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-orange-100 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-20 left-20 w-72 h-72 bg-primary-400 rounded-full filter blur-xl opacity-70 animate-pulse"></div>
        <div className="absolute top-40 right-20 w-72 h-72 bg-orange-400 rounded-full filter blur-xl opacity-70 animate-pulse delay-1000"></div>
        <div className="absolute bottom-20 left-40 w-72 h-72 bg-amber-400 rounded-full filter blur-xl opacity-70 animate-pulse delay-2000"></div>
      </div>

      <div className="relative z-10 container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 sm:mb-12 apple-fade-in">
          <div className="flex items-center gap-2 sm:gap-4">
            <img src="/logo.png" alt="Crescer - Bitcoin Holding" className="h-8 sm:h-12 apple-bounce" />
            <div>
              <h1 className="text-base sm:text-2xl font-bold text-gray-900">Crescer - Bitcoin Holding</h1>
              <p className="text-xs sm:text-base text-gray-600">Bem-vindo, {currentUser?.username}!</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="apple-button apple-gradient-danger text-white px-3 sm:px-6 py-1.5 sm:py-2 font-medium flex items-center gap-1 sm:gap-2"
          >
            <X className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </div>

        <div className="apple-card p-4 sm:p-8 md:p-12 lg:p-16 relative overflow-hidden apple-fade-in">
          {/* Hero Background */}
          <div className="absolute inset-0 gradient-glass apple-card"></div>
          <div className="absolute top-0 right-0 w-48 h-48 sm:w-96 sm:h-96 bg-gradient-to-bl from-primary-400/20 to-transparent rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 sm:w-96 sm:h-96 bg-gradient-to-tr from-orange-400/20 to-transparent rounded-full blur-3xl"></div>
          
          <div className="relative">
            {/* Hero Section */}
            <div className="text-center mb-8 sm:mb-12 md:mb-20 max-w-5xl mx-auto">
              <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-black mb-4 sm:mb-6 md:mb-8 leading-tight sm:leading-none">
                <span className="bg-gradient-to-r from-gray-900 via-primary-800 to-orange-900 bg-clip-text text-transparent">
                  Crescer - Bitcoin Holding
                </span>
              </h1>
              <h2 className="text-base sm:text-xl md:text-2xl lg:text-3xl font-bold text-blue-600 mb-3 sm:mb-4 md:mb-8 tracking-tight px-2">
                Estratégias Inteligentes para Crescimento Sustentável
              </h2>
              <p className="text-sm sm:text-base md:text-lg lg:text-xl text-gray-700 max-w-3xl mx-auto leading-relaxed font-medium px-4">
                Nossa plataforma oferece soluções inovadoras em investimentos digitais, focando no crescimento de longo prazo através de estratégias consolidadas no mercado de criptomoedas.
              </p>
            </div>

            {/* Bitcoin Portfolio Summary */}
            <div className="space-y-6 sm:space-y-8 md:space-y-12 max-w-6xl mx-auto">
              {/* Seletor de Moeda */}
              <div className="flex justify-center mb-4 sm:mb-8">
                <div className="apple-card p-4 sm:p-6 w-full max-w-sm">
                  <h4 className="text-sm sm:text-base md:text-lg font-bold text-gray-900 mb-3 sm:mb-4 text-center">Moeda de Referência</h4>
                  <select 
                    value={selectedCurrency} 
                    onChange={(e) => setSelectedCurrency(e.target.value)}
                    className="apple-select w-full p-2 sm:p-3 text-gray-900 font-medium text-xs sm:text-base"
                  >
                    <option value="BRL">🇧🇷 Real Brasileiro (BRL)</option>
                    <option value="USD">🇺🇸 Dólar Americano (USD)</option>
                    <option value="EUR">🇪🇺 Euro (EUR)</option>
                    <option value="GBP">🇬🇧 Libra Esterlina (GBP)</option>
                  </select>
                </div>
              </div>

              {/* Preço Atual do Bitcoin */}
              <div className="apple-gradient-blue text-white p-4 sm:p-6 md:p-8 apple-card text-center max-w-3xl mx-auto">
                <h4 className="text-base sm:text-xl md:text-2xl font-bold mb-2 sm:mb-4">Preço Atual do Bitcoin</h4>
                <p className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black mb-2">
                  {selectedCurrency} {currentBitcoinPrice.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                </p>
                <div className="flex items-center justify-center gap-2">
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <p className="text-xs sm:text-sm md:text-base lg:text-lg opacity-90">Binance • Atualizado a cada segundo</p>
                </div>
              </div>

              {/* Card de Totais */}
              <div className="apple-card p-4 sm:p-6 md:p-8 max-w-5xl mx-auto">
                <h3 className="text-xl sm:text-2xl md:text-3xl font-bold mb-4 sm:mb-6 md:mb-8 text-center gradient-text">💼 Resumo do Portfolio</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                  <div className="text-center apple-card p-4 sm:p-6">
                    <div className="text-2xl sm:text-3xl md:text-4xl mb-2">₿</div>
                    <h5 className="text-sm sm:text-base md:text-lg font-bold mb-2">Total Bitcoin</h5>
                    <p className="text-lg sm:text-xl md:text-2xl font-black text-gray-900">{calculateTotalBitcoin().toFixed(8)} BTC</p>
                    <p className="text-xs sm:text-sm opacity-75">{calculateTotalSatoshis().toLocaleString('pt-BR')} sats</p>
                  </div>
                  <div className="text-center apple-card p-4 sm:p-6">
                    <div className="text-2xl sm:text-3xl md:text-4xl mb-2">💰</div>
                    <h5 className="text-sm sm:text-base md:text-lg font-bold mb-2">Total Investido</h5>
                    <p className="text-lg sm:text-xl md:text-2xl font-black text-gray-900">{selectedCurrency} {calculateTotalInvested().toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                  </div>
                  <div className="text-center apple-card p-4 sm:p-6">
                    <div className="text-2xl sm:text-3xl md:text-4xl mb-2">📈</div>
                    <h5 className="text-sm sm:text-base md:text-lg font-bold mb-2">Valor Atual</h5>
                    <p className="text-lg sm:text-xl md:text-2xl font-black text-gray-900">
                      {selectedCurrency} {(calculateTotalBitcoin() * currentBitcoinPrice).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                    </p>
                    {currentBitcoinPrice > 0 && (
                      <p className={`text-xs sm:text-sm font-bold ${(calculateTotalBitcoin() * currentBitcoinPrice) - calculateTotalInvested() >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {((calculateTotalBitcoin() * currentBitcoinPrice) - calculateTotalInvested() >= 0 ? '+' : '')}
                        {selectedCurrency} {((calculateTotalBitcoin() * currentBitcoinPrice) - calculateTotalInvested()).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                        ({((((calculateTotalBitcoin() * currentBitcoinPrice) - calculateTotalInvested()) / calculateTotalInvested()) * 100).toFixed(2)}%)
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Cards Individuais das Transações */}
              {userTransactions.length > 0 && (
                <div className="px-2 sm:px-0">
                  <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-4 sm:mb-8 text-center">📊 Histórico de Transações</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                    {userTransactions.slice().reverse().map((transaction) => {
                      const { profit, percentage } = calculateProfitLoss(transaction);
                      const isProfit = profit >= 0;
                      
                      return (
                        <div key={transaction.id} className="apple-card overflow-hidden hover:transform hover:scale-[1.02] transition-all duration-300">
                          {/* Header com data e ações */}
                          <div className="p-3 sm:p-4 border-b border-gray-100 flex items-center justify-between">
                            <h4 className="font-bold text-gray-900 text-sm sm:text-base">
                              {transaction.type === 'buy' ? '🟢 Compra' : '🔴 Venda'} Bitcoin
                            </h4>
                            <div className="flex items-center gap-1.5 sm:gap-2">
                              <Edit2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 cursor-pointer hover:text-primary-500 transition-colors" />
                              <Trash2 
                                className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 cursor-pointer hover:text-red-500 transition-colors" 
                                onClick={() => deleteTransaction(transaction.id)}
                              />
                            </div>
                          </div>

                          {/* Status */}
                          {transaction.type === 'buy' && (
                            <div className="px-3 sm:px-4 py-2">
                              <div className={`apple-badge text-xs ${
                                isProfit 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                <div className={`w-2 h-2 rounded-full ${isProfit ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                {isProfit ? 'Em Lucro' : 'Em Prejuízo'}
                              </div>
                            </div>
                          )}

                          {/* Informações principais */}
                          <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
                            <div className="flex justify-between items-center">
                              <span className="text-gray-600 text-xs sm:text-sm">Data/Hora</span>
                              <span className="font-semibold text-gray-900 text-xs sm:text-sm">{transaction.date} • {transaction.time}</span>
                            </div>

                            <div className="flex justify-between items-center">
                              <span className="text-gray-600 text-xs sm:text-sm">Quantidade</span>
                              <div className="text-right">
                                <div className="font-bold text-gray-900 text-xs sm:text-sm">{transaction.bitcoinAmount.toFixed(8)} BTC</div>
                                <div className="text-xs text-gray-500">{transaction.satoshis.toLocaleString('pt-BR')} sats</div>
                              </div>
                            </div>

                            <div className="flex justify-between items-center">
                              <span className="text-gray-600 text-xs sm:text-sm">Preço Unitário</span>
                              <span className="font-semibold text-gray-900 text-xs sm:text-sm">
                                {transaction.fiatCurrency} {transaction.bitcoinPrice.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                              </span>
                            </div>

                            <div className="flex justify-between items-center">
                              <span className="text-gray-600 text-xs sm:text-sm">Valor Total</span>
                              <span className={`font-bold text-base sm:text-lg ${transaction.type === 'buy' ? 'text-gray-900' : 'text-green-600'}`}>
                                {transaction.fiatCurrency} {transaction.fiatAmount.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                              </span>
                            </div>

                            {currentBitcoinPrice > 0 && transaction.type === 'buy' && (
                              <div className="flex justify-between items-center">
                                <span className="text-gray-600 text-xs sm:text-sm">Valor Atual</span>
                                <span className={`font-bold text-base sm:text-lg ${isProfit ? 'text-green-600' : 'text-red-600'}`}>
                                  {selectedCurrency} {(transaction.bitcoinAmount * currentBitcoinPrice).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Barra de progresso do resultado */}
                          {currentBitcoinPrice > 0 && transaction.type === 'buy' && (
                            <div className="px-3 sm:px-4 pb-3 sm:pb-4">
                              <div className={`apple-progress ${isProfit ? 'bg-green-200' : 'bg-red-200'}`}>
                                <div 
                                  className={`apple-progress-bar ${isProfit ? 'bg-green-500' : 'bg-red-500'}`} 
                                  style={{width: `${Math.min(Math.abs(percentage), 100)}%`}}
                                ></div>
                              </div>
                              <div className="flex justify-between items-center mt-2">
                                <span className={`text-xs sm:text-sm font-medium ${isProfit ? 'text-green-600' : 'text-red-600'}`}>
                                  {isProfit ? '+' : ''}{profit.toLocaleString('pt-BR', {minimumFractionDigits: 2})} {selectedCurrency}
                                </span>
                                <span className={`text-xs sm:text-sm font-bold ${isProfit ? 'text-green-600' : 'text-red-600'}`}>
                                  {isProfit ? '+' : ''}{percentage.toFixed(2)}%
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Rodapé com ações */}
                          <div className="p-3 sm:p-4 bg-gray-50 border-t border-gray-100">
                            <button className="w-full text-blue-600 hover:text-blue-800 text-xs sm:text-sm font-medium transition-colors apple-button bg-transparent border-none">
                              Ver detalhes completos
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Compra */}
      {showPasswordBuy && (
        <div className="apple-modal fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="apple-modal-content p-4 sm:p-8 w-full max-w-md apple-fade-in">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h3 className="text-lg sm:text-2xl font-bold text-gray-900">Registrar Compra</h3>
              <button
                onClick={() => setShowPasswordBuy(false)}
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
              <div>
                <label className="block text-xs sm:text-sm font-bold text-gray-900 mb-1.5 sm:mb-2">Quantidade Bitcoin</label>
                <input
                  type="number"
                  step="0.00000001"
                  value={newBuyTransaction.bitcoinAmount}
                  onChange={(e) => setNewBuyTransaction({...newBuyTransaction, bitcoinAmount: parseFloat(e.target.value) || 0})}
                  className="apple-input w-full px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-base"
                  placeholder="0.00000000"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-bold text-gray-900 mb-1.5 sm:mb-2">Valor Pago</label>
                <input
                  type="number"
                  step="0.01"
                  value={newBuyTransaction.fiatAmount}
                  onChange={(e) => setNewBuyTransaction({...newBuyTransaction, fiatAmount: parseFloat(e.target.value) || 0})}
                  className="apple-input w-full px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-base"
                  placeholder="0.00"
                />
              </div>
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
              <div>
                <label className="block text-xs sm:text-sm font-bold text-gray-900 mb-1.5 sm:mb-2">
                  Preço Bitcoin ({newBuyTransaction.fiatCurrency}) - <span className="text-green-600">Tempo Real</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={currentBitcoinPrice.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                    disabled
                    className="apple-input w-full px-2 sm:px-4 py-2 sm:py-3 font-semibold text-gray-900 text-xs sm:text-base"
                    placeholder="Aguardando preço..."
                  />
                  <div className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 sm:gap-2">
                    <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-xs text-gray-600 font-medium hidden sm:inline">Binance</span>
                  </div>
                </div>
              </div>
              <button
                onClick={addBuyTransaction}
                className="apple-button apple-gradient-success w-full text-white py-2.5 sm:py-3 font-bold text-sm sm:text-base"
              >
                Registrar Compra
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Venda */}
      {showPasswordSell && (
        <div className="apple-modal fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="apple-modal-content p-4 sm:p-8 w-full max-w-md apple-fade-in">
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
                <p className="text-xs sm:text-sm text-blue-800">
                  <strong>Preço atual:</strong> {selectedCurrency} {currentBitcoinPrice.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
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
                />
              </div>
              
              {newSellTransaction.satoshiAmount > 0 && (
                <div className="apple-card bg-green-50 p-3 sm:p-4">
                  <p className="text-xs sm:text-sm text-green-800">
                    <strong>Bitcoin a vender:</strong> {(newSellTransaction.satoshiAmount / 100000000).toFixed(8)} BTC
                  </p>
                  <p className="text-xs sm:text-sm text-green-800">
                    <strong>Valor estimado:</strong> {selectedCurrency} {((newSellTransaction.satoshiAmount / 100000000) * currentBitcoinPrice).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                  </p>
                </div>
              )}
              
              <button
                onClick={addSellTransaction}
                disabled={newSellTransaction.satoshiAmount <= 0 || newSellTransaction.satoshiAmount > calculateTotalSatoshis()}
                className="apple-button apple-gradient-danger w-full text-white py-2.5 sm:py-3 font-bold text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Registrar Venda
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Menu de Ação Flutuante */}
      {showFabMenu && (
        <div className="fab-menu">
          <button
            onClick={() => {
              setShowPasswordBuy(true);
              setShowFabMenu(false);
            }}
            className="fab-menu-item apple-gradient-success text-white"
          >
            <TrendingUp className="w-5 h-5" />
            <span className="font-semibold">Registrar Compra</span>
          </button>
          <button
            onClick={() => {
              setShowPasswordSell(true);
              setShowFabMenu(false);
            }}
            className="fab-menu-item apple-gradient-danger text-white"
          >
            <TrendingDown className="w-5 h-5" />
            <span className="font-semibold">Registrar Venda</span>
          </button>
        </div>
      )}

      {/* Botão de Ação Flutuante */}
      <button
        onClick={() => setShowFabMenu(!showFabMenu)}
        className="fab-button apple-gradient-primary text-white"
        aria-label="Adicionar transação"
      >
        {showFabMenu ? <X className="w-6 h-6" /> : <span className="text-3xl font-light">+</span>}
      </button>
    </div>
  );
}