import { AlertCircle, CheckCircle } from 'lucide-react';

interface CustomAlertProps {
  message: string;
  type?: 'info' | 'success' | 'error' | 'warning';
  onClose: () => void;
  isDarkTheme?: boolean;
}

export default function CustomAlert({ message, type = 'info', onClose, isDarkTheme = true }: CustomAlertProps) {
  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle style={{ width: '48px', height: '48px', color: '#10b981' }} />;
      case 'error':
        return <AlertCircle style={{ width: '48px', height: '48px', color: '#ef4444' }} />;
      case 'warning':
        return <AlertCircle style={{ width: '48px', height: '48px', color: '#f59e0b' }} />;
      default:
        return <AlertCircle style={{ width: '48px', height: '48px', color: '#3b82f6' }} />;
    }
  };

  const getColor = () => {
    switch (type) {
      case 'success':
        return { bg: '#10b981', shadow: 'rgba(16, 185, 129, 0.4)' };
      case 'error':
        return { bg: '#ef4444', shadow: 'rgba(239, 68, 68, 0.4)' };
      case 'warning':
        return { bg: '#f59e0b', shadow: 'rgba(245, 158, 11, 0.4)' };
      default:
        return { bg: '#3b82f6', shadow: 'rgba(59, 130, 246, 0.4)' };
    }
  };

  const colors = getColor();

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(8px)',
        animation: 'fadeIn 0.2s ease-out'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: isDarkTheme 
            ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' 
            : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
          borderRadius: '24px',
          padding: '32px',
          maxWidth: '400px',
          width: '100%',
          boxShadow: `0 25px 50px -12px ${colors.shadow}`,
          border: isDarkTheme ? '1px solid #334155' : '1px solid #e2e8f0',
          animation: 'slideUp 0.3s ease-out'
        }}
      >
        {/* Ícone */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: '20px'
        }}>
          {getIcon()}
        </div>

        {/* Mensagem */}
        <p style={{
          color: isDarkTheme ? '#ffffff' : '#0f172a',
          fontSize: '16px',
          lineHeight: '1.6',
          textAlign: 'center',
          margin: '0 0 24px 0'
        }}>
          {message}
        </p>

        {/* Botão OK */}
        <button
          onClick={onClose}
          style={{
            width: '100%',
            background: `linear-gradient(135deg, ${colors.bg} 0%, ${colors.bg} 100%)`,
            color: 'white',
            padding: '14px 24px',
            fontSize: '16px',
            fontWeight: 'bold',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            boxShadow: `0 4px 12px ${colors.shadow}`,
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = `0 6px 20px ${colors.shadow}`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = `0 4px 12px ${colors.shadow}`;
          }}
        >
          OK
        </button>
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slideUp {
          from {
            transform: translateY(20px);
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
