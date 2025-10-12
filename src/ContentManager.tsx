import { useState, useEffect } from 'react';
import { Edit2, X, Trash2, LogIn, UserPlus, TrendingUp, TrendingDown } from 'lucide-react';
import { db } from './firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import SHA512 from 'crypto-js/sha512';

interface User {
  id: string;
  username: string;
  passwordHash: string;
  email: string;
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
  const [registerForm, setRegisterForm] = useState({ username: '', email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  
  // Estados de preço e moeda
  const [currentBitcoinPrice, setCurrentBitcoinPrice] = useState<number>(0);
  const [selectedCurrency, setSelectedCurrency] = useState<string>('BRL');
  
  // Estados de transações
  const [userTransactions, setUserTransactions] = useState<BitcoinTransaction[]>([]);
  
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
    if (!registerForm.username || !registerForm.email || !registerForm.password) {
      setError('Todos os campos são obrigatórios');
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
        email: registerForm.email,
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
      setRegisterForm({ username: '', email: '', password: '', confirmPassword: '' });
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
      fiatCurrency: selectedCurrency
    }));
  }, [selectedCurrency]);

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
        <div className="bg-white rounded-3xl shadow-2xl border border-white/30 p-8 w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <img src="/logo.png" alt="Bitcoin Holding" className="h-16 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900">Crescer - Bitcoin Holding</h1>
            <p className="text-gray-600">Sistema de Rastreamento de Bitcoin</p>
          </div>

          {/* Erro */}
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl mb-4">
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
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                  placeholder="Digite seu usuário"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">Senha</label>
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                  placeholder="Digite sua senha"
                />
              </div>

              <button
                onClick={loginUser}
                className="w-full bg-gradient-to-r from-primary-500 to-orange-600 text-white py-3 rounded-xl font-bold hover:from-primary-600 hover:to-orange-700 transition-all flex items-center justify-center gap-2"
              >
                <LogIn className="w-5 h-5" />
                Entrar
              </button>

              <div className="text-center">
                <button
                  onClick={() => setShowRegister(true)}
                  className="text-primary-600 hover:text-primary-800 font-medium"
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
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                  placeholder="Escolha um nome de usuário"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">Email</label>
                <input
                  type="email"
                  value={registerForm.email}
                  onChange={(e) => setRegisterForm({...registerForm, email: e.target.value})}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                  placeholder="Digite seu email"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">Senha</label>
                <input
                  type="password"
                  value={registerForm.password}
                  onChange={(e) => setRegisterForm({...registerForm, password: e.target.value})}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                  placeholder="Crie uma senha (min. 6 caracteres)"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">Confirmar Senha</label>
                <input
                  type="password"
                  value={registerForm.confirmPassword}
                  onChange={(e) => setRegisterForm({...registerForm, confirmPassword: e.target.value})}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                  placeholder="Confirme sua senha"
                />
              </div>

              <button
                onClick={registerUser}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-3 rounded-xl font-bold hover:from-green-600 hover:to-emerald-700 transition-all flex items-center justify-center gap-2"
              >
                <UserPlus className="w-5 h-5" />
                Criar Conta
              </button>

              <div className="text-center">
                <button
                  onClick={() => setShowRegister(false)}
                  className="text-primary-600 hover:text-primary-800 font-medium"
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

      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-4">
            <img src="/logo.png" alt="Bitcoin Holding" className="h-12" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Crescer - Bitcoin Holding</h1>
              <p className="text-gray-600">Bem-vindo, {currentUser?.username}!</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-xl font-medium transition-all flex items-center gap-2"
          >
            <X className="w-4 h-4" />
            Sair
          </button>
        </div>

        <div className="glass-morphism rounded-3xl shadow-2xl border border-white/30 p-12 md:p-16 relative overflow-hidden">
          {/* Hero Background */}
          <div className="absolute inset-0 gradient-glass rounded-3xl"></div>
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-primary-400/20 to-transparent rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-orange-400/20 to-transparent rounded-full blur-3xl"></div>
          
          <div className="relative">
            {/* Hero Section */}
            <div className="text-center mb-20">
              <h1 className="text-6xl md:text-8xl font-black mb-8 leading-none">
                <span className="bg-gradient-to-r from-gray-900 via-primary-800 to-orange-900 bg-clip-text text-transparent">
                  Crescer - Bitcoin Holding
                </span>
              </h1>
              <h2 className="text-3xl md:text-4xl font-bold text-blue-600 mb-8 tracking-tight">
                Estratégias Inteligentes para Crescimento Sustentável
              </h2>
              <p className="text-xl md:text-2xl text-gray-700 max-w-4xl mx-auto leading-relaxed font-medium">
                Nossa plataforma oferece soluções inovadoras em investimentos digitais, focando no crescimento de longo prazo através de estratégias consolidadas no mercado de criptomoedas.
              </p>
            </div>

            {/* Bitcoin Portfolio Summary */}
            <div className="space-y-12">
              {/* Seletor de Moeda */}
              <div className="flex justify-center mb-8">
                <div className="bg-white/60 backdrop-blur-sm border border-white/60 rounded-2xl p-6">
                  <h4 className="text-lg font-bold text-gray-900 mb-4 text-center">Moeda de Referência</h4>
                  <select 
                    value={selectedCurrency} 
                    onChange={(e) => setSelectedCurrency(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-xl bg-white/80 text-gray-900 font-medium focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="BRL">🇧🇷 Real Brasileiro (BRL)</option>
                    <option value="USD">🇺🇸 Dólar Americano (USD)</option>
                    <option value="EUR">🇪🇺 Euro (EUR)</option>
                    <option value="GBP">🇬🇧 Libra Esterlina (GBP)</option>
                  </select>
                </div>
              </div>

              {/* Preço Atual do Bitcoin */}
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-8 rounded-3xl shadow-2xl text-center">
                <h4 className="text-2xl font-bold mb-4">Preço Atual do Bitcoin</h4>
                <p className="text-5xl font-black mb-2">
                  {selectedCurrency} {currentBitcoinPrice.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                </p>
                <div className="flex items-center justify-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <p className="text-lg opacity-90">Binance • Atualizado a cada segundo</p>
                </div>
              </div>

              {/* Card de Totais */}
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 text-white p-8 rounded-3xl shadow-2xl">
                <h3 className="text-3xl font-bold mb-8 text-center">💼 Resumo do Portfolio</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="text-4xl mb-2">₿</div>
                    <h5 className="text-lg font-bold mb-2">Total Bitcoin</h5>
                    <p className="text-2xl font-black">{calculateTotalBitcoin().toFixed(8)} BTC</p>
                    <p className="text-sm opacity-75">{calculateTotalSatoshis().toLocaleString('pt-BR')} sats</p>
                  </div>
                  <div className="text-center">
                    <div className="text-4xl mb-2">💰</div>
                    <h5 className="text-lg font-bold mb-2">Total Investido</h5>
                    <p className="text-2xl font-black">{selectedCurrency} {calculateTotalInvested().toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                  </div>
                  <div className="text-center">
                    <div className="text-4xl mb-2">📈</div>
                    <h5 className="text-lg font-bold mb-2">Valor Atual</h5>
                    <p className="text-2xl font-black">
                      {selectedCurrency} {(calculateTotalBitcoin() * currentBitcoinPrice).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                    </p>
                    {currentBitcoinPrice > 0 && (
                      <p className={`text-sm font-bold ${(calculateTotalBitcoin() * currentBitcoinPrice) - calculateTotalInvested() >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {((calculateTotalBitcoin() * currentBitcoinPrice) - calculateTotalInvested() >= 0 ? '+' : '')}
                        {selectedCurrency} {((calculateTotalBitcoin() * currentBitcoinPrice) - calculateTotalInvested()).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                        ({((((calculateTotalBitcoin() * currentBitcoinPrice) - calculateTotalInvested()) / calculateTotalInvested()) * 100).toFixed(2)}%)
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={() => setShowPasswordBuy(true)}
                  className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-8 py-4 rounded-2xl font-bold hover:from-green-600 hover:to-emerald-700 transition-all flex items-center justify-center gap-2"
                >
                  <TrendingUp className="w-5 h-5" />
                  Registrar Compra
                </button>
                <button
                  onClick={() => setShowPasswordSell(true)}
                  className="bg-gradient-to-r from-red-500 to-pink-600 text-white px-8 py-4 rounded-2xl font-bold hover:from-red-600 hover:to-pink-700 transition-all flex items-center justify-center gap-2"
                >
                  <TrendingDown className="w-5 h-5" />
                  Registrar Venda
                </button>
              </div>

              {/* Cards Individuais das Transações */}
              {userTransactions.length > 0 && (
                <div>
                  <h3 className="text-3xl md:text-4xl font-bold text-gray-900 mb-8 text-center">📊 Histórico de Transações</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {userTransactions.slice().reverse().map((transaction) => {
                      const { profit, percentage } = calculateProfitLoss(transaction);
                      const isProfit = profit >= 0;
                      
                      return (
                        <div key={transaction.id} className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-xl transition-all duration-300">
                          {/* Header com data e ações */}
                          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                            <h4 className="font-bold text-gray-900 text-lg">
                              {transaction.type === 'buy' ? '🟢 Compra' : '🔴 Venda'} Bitcoin
                            </h4>
                            <div className="flex items-center gap-2">
                              <Edit2 className="w-4 h-4 text-gray-400 cursor-pointer hover:text-primary-500" />
                              <Trash2 
                                className="w-4 h-4 text-gray-400 cursor-pointer hover:text-red-500" 
                                onClick={() => deleteTransaction(transaction.id)}
                              />
                            </div>
                          </div>

                          {/* Status */}
                          {transaction.type === 'buy' && (
                            <div className="px-4 py-2">
                              <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
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
                          <div className="p-4 space-y-4">
                            <div className="flex justify-between items-center">
                              <span className="text-gray-600 text-sm">Data/Hora</span>
                              <span className="font-semibold text-gray-900">{transaction.date} • {transaction.time}</span>
                            </div>

                            <div className="flex justify-between items-center">
                              <span className="text-gray-600 text-sm">Quantidade</span>
                              <div className="text-right">
                                <div className="font-bold text-gray-900">{transaction.bitcoinAmount.toFixed(8)} BTC</div>
                                <div className="text-xs text-gray-500">{transaction.satoshis.toLocaleString('pt-BR')} sats</div>
                              </div>
                            </div>

                            <div className="flex justify-between items-center">
                              <span className="text-gray-600 text-sm">Preço Unitário</span>
                              <span className="font-semibold text-gray-900">
                                {transaction.fiatCurrency} {transaction.bitcoinPrice.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                              </span>
                            </div>

                            <div className="flex justify-between items-center">
                              <span className="text-gray-600 text-sm">Valor Total</span>
                              <span className={`font-bold text-lg ${transaction.type === 'buy' ? 'text-gray-900' : 'text-green-600'}`}>
                                {transaction.fiatCurrency} {transaction.fiatAmount.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                              </span>
                            </div>

                            {currentBitcoinPrice > 0 && transaction.type === 'buy' && (
                              <div className="flex justify-between items-center">
                                <span className="text-gray-600 text-sm">Valor Atual</span>
                                <span className={`font-bold text-lg ${isProfit ? 'text-green-600' : 'text-red-600'}`}>
                                  {selectedCurrency} {(transaction.bitcoinAmount * currentBitcoinPrice).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Barra de progresso do resultado */}
                          {currentBitcoinPrice > 0 && transaction.type === 'buy' && (
                            <div className="px-4 pb-4">
                              <div className={`w-full rounded-full h-2 ${isProfit ? 'bg-green-200' : 'bg-red-200'}`}>
                                <div 
                                  className={`h-2 rounded-full ${isProfit ? 'bg-green-500' : 'bg-red-500'}`} 
                                  style={{width: `${Math.min(Math.abs(percentage), 100)}%`}}
                                ></div>
                              </div>
                              <div className="flex justify-between items-center mt-2">
                                <span className={`text-sm font-medium ${isProfit ? 'text-green-600' : 'text-red-600'}`}>
                                  {isProfit ? '+' : ''}{profit.toLocaleString('pt-BR', {minimumFractionDigits: 2})} {selectedCurrency}
                                </span>
                                <span className={`text-sm font-bold ${isProfit ? 'text-green-600' : 'text-red-600'}`}>
                                  {isProfit ? '+' : ''}{percentage.toFixed(2)}%
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Rodapé com ações */}
                          <div className="p-4 bg-gray-50 border-t border-gray-100">
                            <button className="w-full text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors">
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-white/30 p-8 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-900">Registrar Compra</h3>
              <button
                onClick={() => setShowPasswordBuy(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl mb-4">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-2">Data</label>
                  <input
                    type="date"
                    value={newBuyTransaction.date}
                    onChange={(e) => setNewBuyTransaction({...newBuyTransaction, date: e.target.value})}
                    className="w-full px-4 py-3 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-2">Hora</label>
                  <input
                    type="time"
                    value={newBuyTransaction.time}
                    onChange={(e) => setNewBuyTransaction({...newBuyTransaction, time: e.target.value})}
                    className="w-full px-4 py-3 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">Quantidade Bitcoin</label>
                <input
                  type="number"
                  step="0.00000001"
                  value={newBuyTransaction.bitcoinAmount}
                  onChange={(e) => setNewBuyTransaction({...newBuyTransaction, bitcoinAmount: parseFloat(e.target.value) || 0})}
                  className="w-full px-4 py-3 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                  placeholder="0.00000000"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">Valor Pago</label>
                <input
                  type="number"
                  step="0.01"
                  value={newBuyTransaction.fiatAmount}
                  onChange={(e) => setNewBuyTransaction({...newBuyTransaction, fiatAmount: parseFloat(e.target.value) || 0})}
                  className="w-full px-4 py-3 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">Moeda</label>
                <select
                  value={newBuyTransaction.fiatCurrency}
                  onChange={(e) => setNewBuyTransaction({...newBuyTransaction, fiatCurrency: e.target.value})}
                  className="w-full px-4 py-3 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                >
                  <option value="BRL">🇧🇷 Real Brasileiro (BRL)</option>
                  <option value="USD">🇺🇸 Dólar Americano (USD)</option>
                  <option value="EUR">🇪🇺 Euro (EUR)</option>
                  <option value="GBP">🇬🇧 Libra Esterlina (GBP)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">Preço Bitcoin ({newBuyTransaction.fiatCurrency})</label>
                <input
                  type="number"
                  step="0.01"
                  value={newBuyTransaction.bitcoinPrice}
                  onChange={(e) => setNewBuyTransaction({...newBuyTransaction, bitcoinPrice: parseFloat(e.target.value) || 0})}
                  className="w-full px-4 py-3 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                  placeholder="0.00"
                />
              </div>
              <button
                onClick={addBuyTransaction}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-3 rounded-xl font-bold hover:from-green-600 hover:to-emerald-700 transition-all"
              >
                Registrar Compra
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Venda */}
      {showPasswordSell && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-white/30 p-8 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-900">Registrar Venda</h3>
              <button
                onClick={() => setShowPasswordSell(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl mb-4">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-xl">
                <p className="text-sm text-blue-800">
                  <strong>Saldo disponível:</strong> {calculateTotalSatoshis().toLocaleString('pt-BR')} satoshis
                </p>
                <p className="text-sm text-blue-800">
                  <strong>Preço atual:</strong> {selectedCurrency} {currentBitcoinPrice.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">Quantidade de Satoshis para Vender</label>
                <input
                  type="number"
                  value={newSellTransaction.satoshiAmount}
                  onChange={(e) => setNewSellTransaction({...newSellTransaction, satoshiAmount: parseInt(e.target.value) || 0})}
                  className="w-full px-4 py-3 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                  placeholder="Quantidade em satoshis"
                  max={calculateTotalSatoshis()}
                />
              </div>
              
              {newSellTransaction.satoshiAmount > 0 && (
                <div className="bg-green-50 p-4 rounded-xl">
                  <p className="text-sm text-green-800">
                    <strong>Bitcoin a vender:</strong> {(newSellTransaction.satoshiAmount / 100000000).toFixed(8)} BTC
                  </p>
                  <p className="text-sm text-green-800">
                    <strong>Valor estimado:</strong> {selectedCurrency} {((newSellTransaction.satoshiAmount / 100000000) * currentBitcoinPrice).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                  </p>
                </div>
              )}
              
              <button
                onClick={addSellTransaction}
                disabled={newSellTransaction.satoshiAmount <= 0 || newSellTransaction.satoshiAmount > calculateTotalSatoshis()}
                className="w-full bg-gradient-to-r from-red-500 to-pink-600 text-white py-3 rounded-xl font-bold hover:from-red-600 hover:to-pink-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Registrar Venda
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}