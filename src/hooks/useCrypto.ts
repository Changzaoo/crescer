import { useState, useEffect } from 'react';

export interface Cryptocurrency {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price?: number;
  market_cap?: number;
  market_cap_rank?: number;
  price_change_percentage_24h?: number;
}

export const useCryptoList = () => {
  const [cryptos, setCryptos] = useState<Cryptocurrency[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCryptos = async () => {
      try {
        setLoading(true);
        // Buscar lista de criptomoedas com imagens (top 250 por página)
        // Vamos buscar as primeiras 1000 para ter boas opções com imagens
        const pages = 4; // 4 páginas x 250 = 1000 criptomoedas
        const allCryptos: Cryptocurrency[] = [];

        for (let page = 1; page <= pages; page++) {
          const response = await fetch(
            `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=${page}&sparkline=false`
          );
          
          if (!response.ok) {
            throw new Error('Erro ao buscar criptomoedas');
          }

          const data = await response.json();
          allCryptos.push(...data);
          
          // Pequeno delay entre requisições para não sobrecarregar a API
          if (page < pages) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }

        setCryptos(allCryptos);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro desconhecido');
        console.error('Erro ao buscar criptomoedas:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCryptos();
  }, []);

  return { cryptos, loading, error };
};

// Hook para buscar preço de uma criptomoeda específica
export const useCryptoPrice = (cryptoId: string) => {
  const [price, setPrice] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!cryptoId) {
      setLoading(false);
      return;
    }

    const fetchPrice = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${cryptoId}&vs_currencies=usd,brl,eur,gbp`
        );
        
        if (!response.ok) {
          throw new Error('Erro ao buscar preço');
        }

        const data = await response.json();
        if (data[cryptoId]) {
          setPrice(data[cryptoId].usd || 0);
        }
      } catch (err) {
        console.error('Erro ao buscar preço:', err);
        setPrice(0);
      } finally {
        setLoading(false);
      }
    };

    fetchPrice();
    
    // Atualizar preço a cada 30 segundos
    const interval = setInterval(fetchPrice, 30000);
    
    return () => clearInterval(interval);
  }, [cryptoId]);

  return { price, loading };
};
