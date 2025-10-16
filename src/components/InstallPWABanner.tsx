import { Download, X } from 'lucide-react';
import { useState } from 'react';
import { useInstallPWA } from '../hooks/useInstallPWA';

export default function InstallPWABanner() {
  const { supportsPWA, isInstalled, handleInstallClick } = useInstallPWA();
  const [dismissed, setDismissed] = useState(false);

  // Não mostrar se já está instalado ou foi dispensado
  if (!supportsPWA || isInstalled || dismissed) {
    return null;
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      left: '20px',
      right: '20px',
      zIndex: 1000,
      background: 'linear-gradient(135deg, #fb923c 0%, #f97316 100%)',
      borderRadius: '16px',
      padding: '16px',
      boxShadow: '0 10px 40px rgba(251, 146, 60, 0.5)',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      animation: 'slideUp 0.3s ease-out'
    }}>
      <div style={{
        background: 'rgba(255, 255, 255, 0.2)',
        borderRadius: '12px',
        padding: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <Download style={{ width: '24px', height: '24px', color: 'white' }} />
      </div>
      
      <div style={{ flex: 1 }}>
        <h4 style={{
          color: 'white',
          fontSize: '16px',
          fontWeight: 'bold',
          marginBottom: '4px'
        }}>
          Instalar Aplicativo
        </h4>
        <p style={{
          color: 'rgba(255, 255, 255, 0.9)',
          fontSize: '14px'
        }}>
          Adicione à tela inicial para acesso rápido
        </p>
      </div>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <button
          onClick={handleInstallClick}
          style={{
            background: 'white',
            color: '#f97316',
            border: 'none',
            borderRadius: '8px',
            padding: '8px 16px',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: 'pointer',
            whiteSpace: 'nowrap'
          }}
        >
          Instalar
        </button>
        
        <button
          onClick={() => setDismissed(true)}
          style={{
            background: 'rgba(255, 255, 255, 0.2)',
            border: 'none',
            borderRadius: '8px',
            padding: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <X style={{ width: '20px', height: '20px', color: 'white' }} />
        </button>
      </div>

      <style>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
