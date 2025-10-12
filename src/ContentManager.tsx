import { useState, useEffect } from 'react';
import { Edit2, Save, X, Key, Plus, Trash2, Shield } from 'lucide-react';
import { db } from './firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

interface AdminCredentials {
  username: string;
  password: string;
}

interface BitcoinRecord {
  id: string;
  date: string;
  time: string;
  bitcoinAmount: number;
  satoshis: number;
  fiatAmount: number;
  fiatCurrency: string;
  bitcoinPrice: number;
}

interface ContentData {
  title: string;
  subtitle: string;
  description: string;
  bitcoinRecords: BitcoinRecord[];
}

export default function ContentManager() {
  const [keySequence, setKeySequence] = useState('');
  const [showLogin, setShowLogin] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [showCredentialsEditor, setShowCredentialsEditor] = useState(false);
  const [newCredentials, setNewCredentials] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [currentBitcoinPrice, setCurrentBitcoinPrice] = useState<number>(0);
  const [selectedCurrency, setSelectedCurrency] = useState<string>('BRL');

  const [adminCredentials, setAdminCredentials] = useState<AdminCredentials>({
    username: 'admin',
    password: 'admin123'
  });

  const [content, setContent] = useState<ContentData>({
    title: 'Crescer - Bitcoin Holding',
    subtitle: 'Estratégias Inteligentes para Crescimento Sustentável',
    description: 'Nossa plataforma oferece soluções inovadoras em investimentos digitais, focando no crescimento de longo prazo através de estratégias consolidadas no mercado de criptomoedas.',
    bitcoinRecords: []
  });

  const [newRecord, setNewRecord] = useState({
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().split(' ')[0].slice(0, 5),
    bitcoinAmount: 0,
    fiatAmount: 0,
    fiatCurrency: selectedCurrency,
    bitcoinPrice: 0
  });

  const [editedContent, setEditedContent] = useState<ContentData>(content);

  const SECRET_SEQUENCE = '59387063';

  // Função para adicionar registro de Bitcoin
  const addBitcoinRecord = () => {
    const satoshis = Math.round(newRecord.bitcoinAmount * 100000000); // Converter BTC para satoshis
    const record: BitcoinRecord = {
      id: Date.now().toString(),
      date: newRecord.date,
      time: newRecord.time,
      bitcoinAmount: newRecord.bitcoinAmount,
      satoshis: satoshis,
      fiatAmount: newRecord.fiatAmount,
      fiatCurrency: newRecord.fiatCurrency,
      bitcoinPrice: newRecord.bitcoinPrice
    };

    setEditedContent({
      ...editedContent,
      bitcoinRecords: [...editedContent.bitcoinRecords, record]
    });

    // Reset form
    setNewRecord({
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().split(' ')[0].slice(0, 5),
      bitcoinAmount: 0,
      fiatAmount: 0,
      fiatCurrency: selectedCurrency,
      bitcoinPrice: 0
    });
  };

  // Função para deletar registro
  const deleteRecord = (id: string) => {
    setEditedContent({
      ...editedContent,
      bitcoinRecords: editedContent.bitcoinRecords.filter(record => record.id !== id)
    });
  };

  // Calcular totais
  const totalSatoshis = content.bitcoinRecords.reduce((sum, record) => sum + record.satoshis, 0);
  const totalBitcoin = totalSatoshis / 100000000;
  const totalFiat = content.bitcoinRecords.reduce((sum, record) => sum + record.fiatAmount, 0);

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

  // Calcular lucro/prejuízo para uma compra específica
  const calculateProfitLoss = (record: BitcoinRecord) => {
    if (currentBitcoinPrice === 0) return { profit: 0, percentage: 0 };
    
    const currentValue = record.bitcoinAmount * currentBitcoinPrice;
    const profit = currentValue - record.fiatAmount;
    const percentage = ((currentValue - record.fiatAmount) / record.fiatAmount) * 100;
    
    return { profit, percentage };
  };



  // Load data from Firebase
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load content
        const contentDoc = await getDoc(doc(db, 'app', 'content'));
        if (contentDoc.exists()) {
          const contentData = contentDoc.data() as ContentData;
          setContent(contentData);
          setEditedContent(contentData);
        }

        // Load admin credentials
        const credentialsDoc = await getDoc(doc(db, 'app', 'credentials'));
        if (credentialsDoc.exists()) {
          setAdminCredentials(credentialsDoc.data() as AdminCredentials);
        }
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };

    loadData();

    // Listen for real-time updates
    const unsubscribe = onSnapshot(doc(db, 'app', 'content'), (doc) => {
      if (doc.exists()) {
        const contentData = doc.data() as ContentData;
        setContent(contentData);
        if (!isEditing) {
          setEditedContent(contentData);
        }
      }
    });

    return () => unsubscribe();
  }, [isEditing]);

  // Buscar preço do Bitcoin periodicamente
  useEffect(() => {
    fetchBitcoinPrice(); // Buscar imediatamente
    const interval = setInterval(fetchBitcoinPrice, 30000); // Atualizar a cada 30 segundos
    return () => clearInterval(interval);
  }, [selectedCurrency]);

  // Sincronizar moeda selecionada com o formulário
  useEffect(() => {
    setNewRecord(prev => ({
      ...prev,
      fiatCurrency: selectedCurrency
    }));
  }, [selectedCurrency]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!isAdmin && !showLogin) {
        const key = e.key;
        if (/[0-9]/.test(key)) {
          const newSequence = keySequence + key;
          setKeySequence(newSequence);

          if (newSequence === SECRET_SEQUENCE) {
            setShowLogin(true);
            setKeySequence('');
          } else if (newSequence.length >= SECRET_SEQUENCE.length) {
            setKeySequence('');
          }
        }
      }
    };

    window.addEventListener('keypress', handleKeyPress);
    return () => window.removeEventListener('keypress', handleKeyPress);
  }, [keySequence, isAdmin, showLogin]);

  const handleLogin = () => {
    if (
      loginForm.username === adminCredentials.username &&
      loginForm.password === adminCredentials.password
    ) {
      setIsAdmin(true);
      setShowLogin(false);
      setError('');
      setLoginForm({ username: '', password: '' });
    } else {
      setError('Usuário ou senha incorretos');
    }
  };

  const handleLogout = () => {
    setIsAdmin(false);
    setIsEditing(false);
    setShowCredentialsEditor(false);
  };

  const handleSaveContent = async () => {
    try {
      await setDoc(doc(db, 'app', 'content'), editedContent);
      setContent(editedContent);
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving content:', error);
      alert('Erro ao salvar conteúdo. Tente novamente.');
    }
  };

  const handleCancelEdit = () => {
    setEditedContent(content);
    setIsEditing(false);
  };

  const handleUpdateCredentials = async () => {
    if (newCredentials.username && newCredentials.password) {
      try {
        await setDoc(doc(db, 'app', 'credentials'), newCredentials);
        setAdminCredentials(newCredentials);
        setShowCredentialsEditor(false);
        setNewCredentials({ username: '', password: '' });
        alert('Credenciais atualizadas com sucesso!');
      } catch (error) {
        console.error('Error updating credentials:', error);
        alert('Erro ao atualizar credenciais. Tente novamente.');
      }
    }
  };



  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-orange-100 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute inset-0 bg-gradient-to-r from-primary-400/10 via-orange-400/10 to-amber-400/10"></div>
      </div>
      
      {showLogin && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-xl flex items-center justify-center z-50 p-4">
          <div className="glass-morphism rounded-3xl shadow-2xl border border-white/30 p-10 max-w-md w-full mx-4 transform transition-all scale-100 animate-scale-in">
            <div className="text-center mb-8">
              <div className="w-16 h-16 gradient-primary rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg glow-primary">
                <Shield className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Bem-vindo de volta</h2>
              <p className="text-gray-600">Faça login para gerenciar seu conteúdo</p>
              <button
                onClick={() => {
                  setShowLogin(false);
                  setError('');
                  setLoginForm({ username: '', password: '' });
                }}
                className="absolute top-4 right-4 w-10 h-10 bg-gray-100/80 hover:bg-gray-200/80 rounded-full flex items-center justify-center transition-all btn-hover-lift"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-3">
                  Nome de usuário
                </label>
                <input
                  type="text"
                  value={loginForm.username}
                  onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                  onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                  className="w-full px-5 py-4 bg-white/80 border-0 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-gray-900 placeholder-gray-500 font-medium focus-ring"
                  placeholder="Digite seu usuário"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-3">
                  Senha
                </label>
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                  className="w-full px-5 py-4 bg-white/80 border-0 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-gray-900 placeholder-gray-500 font-medium focus-ring"
                  placeholder="Digite sua senha"
                />
              </div>
              {error && (
                <div className="bg-red-50/80 backdrop-blur-sm border border-red-200/50 text-red-700 px-5 py-4 rounded-2xl text-sm font-medium">
                  {error}
                </div>
              )}
              <button
                onClick={handleLogin}
                className="w-full gradient-primary text-white py-4 rounded-2xl hover:glow-primary-strong transition-all font-semibold shadow-xl hover:shadow-2xl btn-hover-lift text-lg"
              >
                Entrar no sistema
              </button>
            </div>
          </div>
        </div>
      )}

      {showCredentialsEditor && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-xl flex items-center justify-center z-50 p-4">
          <div className="glass-morphism rounded-3xl shadow-2xl border border-white/30 p-10 max-w-md w-full mx-4">
            <div className="text-center mb-8">
              <div className="w-16 h-16 gradient-primary rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg glow-primary">
                <Key className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Segurança</h2>
              <p className="text-gray-600">Atualize suas credenciais de acesso</p>
              <button
                onClick={() => {
                  setShowCredentialsEditor(false);
                  setNewCredentials({ username: '', password: '' });
                }}
                className="absolute top-4 right-4 w-10 h-10 bg-gray-100/80 hover:bg-gray-200/80 rounded-full flex items-center justify-center transition-all btn-hover-lift"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-3">
                  Novo usuário
                </label>
                <input
                  type="text"
                  value={newCredentials.username}
                  onChange={(e) => setNewCredentials({ ...newCredentials, username: e.target.value })}
                  onKeyPress={(e) => e.key === 'Enter' && handleUpdateCredentials()}
                  className="w-full px-5 py-4 bg-white/80 border-0 rounded-2xl focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all text-gray-900 placeholder-gray-500 font-medium focus-ring"
                  placeholder="Digite o novo usuário"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-3">
                  Nova senha
                </label>
                <input
                  type="password"
                  value={newCredentials.password}
                  onChange={(e) => setNewCredentials({ ...newCredentials, password: e.target.value })}
                  onKeyPress={(e) => e.key === 'Enter' && handleUpdateCredentials()}
                  className="w-full px-5 py-4 bg-white/80 border-0 rounded-2xl focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all text-gray-900 placeholder-gray-500 font-medium focus-ring"
                  placeholder="Digite a nova senha"
                />
              </div>
              <button
                onClick={handleUpdateCredentials}
                className="w-full gradient-primary text-white py-4 rounded-2xl hover:glow-primary-strong transition-all font-semibold shadow-xl hover:shadow-2xl btn-hover-lift text-lg"
              >
                Atualizar credenciais
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="glass-morphism border-b border-white/20 sticky top-0 z-40 relative">
        <div className="max-w-7xl mx-auto px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img 
                src="/logo.png" 
                alt="Bitcoin Holding Logo" 
                className="w-8 h-8 object-contain"
              />
              <div>
                <h1 className="text-2xl font-bold gradient-text tracking-tight">
                  Crescer - Bitcoin Holding
                </h1>
                <p className="text-sm text-gray-600 font-medium">Gestão inteligente de investimentos</p>
              </div>
            </div>
            
            {isAdmin && (
              <div className="flex items-center gap-4">
                {!isEditing && (
                  <>
                    <button
                      onClick={() => setShowCredentialsEditor(true)}
                      className="px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-2xl transition-all flex items-center gap-3 shadow-lg hover:shadow-xl btn-hover-lift font-semibold"
                    >
                      <Key className="w-4 h-4" />
                      Segurança
                    </button>
                    <button
                      onClick={() => {
                        setEditedContent(content);
                        setIsEditing(true);
                      }}
                      className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-2xl transition-all flex items-center gap-3 shadow-lg hover:shadow-xl btn-hover-lift font-semibold"
                    >
                      <Edit2 className="w-4 h-4" />
                      Editar Conteúdo
                    </button>
                  </>
                )}
                <button
                  onClick={handleLogout}
                  className="px-6 py-3 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white rounded-2xl transition-all shadow-lg hover:shadow-xl btn-hover-lift font-semibold"
                >
                  Sair
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-12 relative">
        {isEditing ? (
          <div className="glass-morphism rounded-3xl shadow-2xl border border-white/30 p-12 relative">
            <div className="absolute inset-0 gradient-glass rounded-3xl"></div>
            <div className="relative">
              <div className="mb-12 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div>
                  <h2 className="text-4xl font-bold text-gray-900 mb-4 tracking-tight">Modo de Edição</h2>
                  <p className="text-lg text-gray-600 font-medium">Personalize cada detalhe da sua experiência</p>
                </div>
                <div className="flex gap-4">
                  <button
                    onClick={handleSaveContent}
                    className="px-8 py-4 gradient-primary text-white rounded-2xl hover:glow-primary-strong transition-all flex items-center gap-3 shadow-xl hover:shadow-2xl btn-hover-lift font-semibold text-lg"
                  >
                    <Save className="w-5 h-5" />
                    Salvar Alterações
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="px-8 py-4 bg-white/80 hover:bg-white text-gray-700 hover:text-gray-900 rounded-2xl transition-all flex items-center gap-3 shadow-lg hover:shadow-xl btn-hover-lift font-semibold text-lg border border-gray-200/50"
                  >
                    <X className="w-5 h-5" />
                    Cancelar
                  </button>
                </div>
              </div>

            <div className="space-y-10">
              <div className="grid lg:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <label className="block text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider">
                    Título Principal
                  </label>
                  <input
                    type="text"
                    value={editedContent.title}
                    onChange={(e) => setEditedContent({ ...editedContent, title: e.target.value })}
                    className="w-full px-6 py-5 bg-white/90 border-0 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-gray-900 font-semibold text-lg shadow-lg focus-ring"
                    placeholder="Digite o título principal"
                  />
                </div>

                <div className="space-y-4">
                  <label className="block text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider">
                    Subtítulo
                  </label>
                  <input
                    type="text"
                    value={editedContent.subtitle}
                    onChange={(e) => setEditedContent({ ...editedContent, subtitle: e.target.value })}
                    className="w-full px-6 py-5 bg-white/90 border-0 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-gray-900 font-semibold text-lg shadow-lg focus-ring"
                    placeholder="Digite o subtítulo"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <label className="block text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider">
                  Descrição Principal
                </label>
                <textarea
                  value={editedContent.description}
                  onChange={(e) => setEditedContent({ ...editedContent, description: e.target.value })}
                  rows={5}
                  className="w-full px-6 py-5 bg-white/90 border-0 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-gray-900 font-medium text-lg resize-none shadow-lg focus-ring"
                  placeholder="Descreva o propósito do seu sistema"
                />
              </div>

              <div className="space-y-8">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">Registros de Bitcoin</h3>
                    <p className="text-gray-600 font-medium">Gerencie suas compras e acompanhe seu portfólio</p>
                  </div>
                </div>
                
                {/* Formulário para novo registro */}
                <div className="bg-white/60 backdrop-blur-sm border border-white/30 p-8 rounded-2xl shadow-lg mb-8">
                  <h4 className="text-xl font-bold text-gray-900 mb-6">Novo Registro de Compra</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-sm font-bold text-gray-900 mb-2">Data</label>
                      <input
                        type="date"
                        value={newRecord.date}
                        onChange={(e) => setNewRecord({...newRecord, date: e.target.value})}
                        className="w-full px-4 py-3 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-900 mb-2">Hora</label>
                      <input
                        type="time"
                        value={newRecord.time}
                        onChange={(e) => setNewRecord({...newRecord, time: e.target.value})}
                        className="w-full px-4 py-3 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-900 mb-2">Quantidade Bitcoin</label>
                      <input
                        type="number"
                        step="0.00000001"
                        value={newRecord.bitcoinAmount}
                        onChange={(e) => setNewRecord({...newRecord, bitcoinAmount: parseFloat(e.target.value) || 0})}
                        className="w-full px-4 py-3 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                        placeholder="0.00000000"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-900 mb-2">Valor Pago</label>
                      <input
                        type="number"
                        step="0.01"
                        value={newRecord.fiatAmount}
                        onChange={(e) => setNewRecord({...newRecord, fiatAmount: parseFloat(e.target.value) || 0})}
                        className="w-full px-4 py-3 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-900 mb-2">Moeda</label>
                      <select
                        value={newRecord.fiatCurrency}
                        onChange={(e) => setNewRecord({...newRecord, fiatCurrency: e.target.value})}
                        className="w-full px-4 py-3 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                      >
                        <option value="BRL">🇧🇷 Real Brasileiro (BRL)</option>
                        <option value="USD">🇺🇸 Dólar Americano (USD)</option>
                        <option value="EUR">🇪🇺 Euro (EUR)</option>
                        <option value="GBP">🇬🇧 Libra Esterlina (GBP)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-900 mb-2">Preço Bitcoin ({newRecord.fiatCurrency})</label>
                      <input
                        type="number"
                        step="0.01"
                        value={newRecord.bitcoinPrice}
                        onChange={(e) => setNewRecord({...newRecord, bitcoinPrice: parseFloat(e.target.value) || 0})}
                        className="w-full px-4 py-3 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-900 mb-2">Moeda</label>
                      <select
                        value={newRecord.fiatCurrency}
                        onChange={(e) => setNewRecord({...newRecord, fiatCurrency: e.target.value})}
                        className="w-full px-4 py-3 bg-white/80 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                      >
                        <option value="BRL">BRL (Real)</option>
                        <option value="USD">USD (Dólar)</option>
                        <option value="EUR">EUR (Euro)</option>
                      </select>
                    </div>
                  </div>
                  <div className="mt-6">
                    <button
                      onClick={addBitcoinRecord}
                      className="px-8 py-4 gradient-primary text-white rounded-2xl hover:glow-primary-strong transition-all flex items-center gap-3 shadow-xl hover:shadow-2xl font-semibold"
                    >
                      <Plus className="w-5 h-5" />
                      Adicionar Registro
                    </button>
                  </div>
                </div>

                {/* Resumo dos totais */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div className="bg-gradient-to-br from-primary-500 to-orange-600 text-white p-6 rounded-2xl shadow-lg">
                    <h5 className="text-lg font-bold mb-2">Total Bitcoin</h5>
                    <p className="text-3xl font-black">{totalBitcoin.toFixed(8)} BTC</p>
                  </div>
                  <div className="bg-gradient-to-br from-amber-500 to-yellow-600 text-white p-6 rounded-2xl shadow-lg">
                    <h5 className="text-lg font-bold mb-2">Total Satoshis</h5>
                    <p className="text-3xl font-black">{totalSatoshis.toLocaleString('pt-BR')}</p>
                  </div>
                  <div className="bg-gradient-to-br from-green-500 to-emerald-600 text-white p-6 rounded-2xl shadow-lg">
                    <h5 className="text-lg font-bold mb-2">Total Investido</h5>
                    <p className="text-3xl font-black">R$ {totalFiat.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                  </div>
                </div>
                
                {/* Lista de registros */}
                <div className="space-y-4">
                  {editedContent.bitcoinRecords.map((record) => (
                    <div key={record.id} className="bg-white/60 backdrop-blur-sm border border-white/30 p-6 rounded-2xl shadow-lg">
                      <div className="flex items-center justify-between">
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 flex-1">
                          <div>
                            <span className="text-sm text-gray-600 font-medium">Data/Hora</span>
                            <p className="font-bold text-gray-900">{record.date} {record.time}</p>
                          </div>
                          <div>
                            <span className="text-sm text-gray-600 font-medium">Bitcoin</span>
                            <p className="font-bold text-gray-900">{record.bitcoinAmount.toFixed(8)} BTC</p>
                            <p className="text-xs text-gray-500">{record.satoshis.toLocaleString('pt-BR')} sats</p>
                          </div>
                          <div>
                            <span className="text-sm text-gray-600 font-medium">Valor Pago</span>
                            <p className="font-bold text-gray-900">{record.fiatCurrency} {record.fiatAmount.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                          </div>
                          <div>
                            <span className="text-sm text-gray-600 font-medium">Preço Bitcoin</span>
                            <p className="font-bold text-gray-900">{record.fiatCurrency} {record.bitcoinPrice.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                          </div>
                          <div>
                            <span className="text-sm text-gray-600 font-medium">Preço/Sat</span>
                            <p className="font-bold text-gray-900">{record.fiatCurrency} {(record.bitcoinPrice / 100000000).toFixed(8)}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => deleteRecord(record.id)}
                          className="ml-4 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          </div>
        ) : (
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
                    {content.title}
                  </span>
                </h1>
                <h2 className="text-3xl md:text-4xl font-bold text-blue-600 mb-8 tracking-tight">
                  {content.subtitle}
                </h2>
                <p className="text-xl md:text-2xl text-gray-700 max-w-4xl mx-auto leading-relaxed font-medium">
                  {content.description}
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
                  <p className="text-lg opacity-90">Binance • Atualizado em tempo real</p>
                </div>

                {/* Card de Totais */}
                <div className="bg-gradient-to-br from-gray-800 to-gray-900 text-white p-8 rounded-3xl shadow-2xl">
                  <h3 className="text-3xl font-bold mb-8 text-center">💼 Resumo do Portfolio</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="text-center">
                      <div className="text-4xl mb-2">₿</div>
                      <h5 className="text-lg font-bold mb-2">Total Bitcoin</h5>
                      <p className="text-2xl font-black">{totalBitcoin.toFixed(8)} BTC</p>
                      <p className="text-sm opacity-75">{totalSatoshis.toLocaleString('pt-BR')} sats</p>
                    </div>
                    <div className="text-center">
                      <div className="text-4xl mb-2">💰</div>
                      <h5 className="text-lg font-bold mb-2">Total Investido</h5>
                      <p className="text-2xl font-black">{selectedCurrency} {totalFiat.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                    </div>
                    <div className="text-center">
                      <div className="text-4xl mb-2">�</div>
                      <h5 className="text-lg font-bold mb-2">Valor Atual</h5>
                      <p className="text-2xl font-black">
                        {selectedCurrency} {(totalBitcoin * currentBitcoinPrice).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                      </p>
                      {currentBitcoinPrice > 0 && (
                        <p className={`text-sm font-bold ${(totalBitcoin * currentBitcoinPrice) - totalFiat >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {((totalBitcoin * currentBitcoinPrice) - totalFiat >= 0 ? '+' : '')}
                          {selectedCurrency} {((totalBitcoin * currentBitcoinPrice) - totalFiat).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                          ({((((totalBitcoin * currentBitcoinPrice) - totalFiat) / totalFiat) * 100).toFixed(2)}%)
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Cards Individuais das Compras */}
                {content.bitcoinRecords.length > 0 && (
                  <div>
                    <h3 className="text-3xl md:text-4xl font-bold text-gray-900 mb-8 text-center">📊 Histórico de Compras</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      {content.bitcoinRecords.slice().reverse().map((record) => {
                        const { profit, percentage } = calculateProfitLoss(record);
                        const isProfit = profit >= 0;
                        
                        return (
                          <div key={record.id} className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-xl transition-all duration-300">
                            {/* Header com data e ações */}
                            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                              <h4 className="font-bold text-gray-900 text-lg">Compra Bitcoin</h4>
                              <div className="flex items-center gap-2">
                                <Edit2 className="w-4 h-4 text-gray-400 cursor-pointer hover:text-primary-500" />
                                <Trash2 className="w-4 h-4 text-gray-400 cursor-pointer hover:text-red-500" />
                              </div>
                            </div>

                            {/* Status */}
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

                            {/* Informações principais */}
                            <div className="p-4 space-y-4">
                              <div className="flex justify-between items-center">
                                <span className="text-gray-600 text-sm">Data/Hora</span>
                                <span className="font-semibold text-gray-900">{record.date} • {record.time}</span>
                              </div>

                              <div className="flex justify-between items-center">
                                <span className="text-gray-600 text-sm">Quantidade</span>
                                <div className="text-right">
                                  <div className="font-bold text-gray-900">{record.bitcoinAmount.toFixed(8)} BTC</div>
                                  <div className="text-xs text-gray-500">{record.satoshis.toLocaleString('pt-BR')} sats</div>
                                </div>
                              </div>

                              <div className="flex justify-between items-center">
                                <span className="text-gray-600 text-sm">Valor Unitário</span>
                                <span className="font-semibold text-gray-900">
                                  {record.fiatCurrency} {record.bitcoinPrice.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                                </span>
                              </div>

                              <div className="flex justify-between items-center">
                                <span className="text-gray-600 text-sm">Valor Total Bruto</span>
                                <span className="font-bold text-gray-900 text-lg">
                                  {record.fiatCurrency} {record.fiatAmount.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                                </span>
                              </div>

                              {currentBitcoinPrice > 0 && (
                                <div className="flex justify-between items-center">
                                  <span className="text-gray-600 text-sm">Valor Atual</span>
                                  <span className={`font-bold text-lg ${isProfit ? 'text-green-600' : 'text-red-600'}`}>
                                    {selectedCurrency} {(record.bitcoinAmount * currentBitcoinPrice).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Barra de progresso do resultado */}
                            {currentBitcoinPrice > 0 && (
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
        )}

        {!isAdmin && (
          <div className="mt-20 flex justify-center">
            <div className="glass-morphism rounded-3xl p-8 border border-white/30 max-w-xl w-full shadow-2xl relative overflow-hidden">
              {/* Background Elements */}
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-blue-400/20 to-transparent rounded-full blur-2xl"></div>
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-purple-400/20 to-transparent rounded-full blur-2xl"></div>
              
              <div className="relative text-center">
                <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl">
                  <img 
                    src="/logo.png" 
                    alt="Bitcoin Holding Logo" 
                    className="w-12 h-12 object-contain"
                  />
                </div>
                
                <h3 className="text-2xl font-bold gradient-text mb-3">Painel Administrativo</h3>
                <p className="text-gray-600 font-medium mb-6">Gestão de conteúdo Bitcoin Holding</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}