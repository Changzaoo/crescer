import { AlertTriangle } from 'lucide-react';

interface CustomConfirmProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  isDarkTheme?: boolean;
}

export default function CustomConfirm({ 
  message, 
  onConfirm, 
  onCancel,
  confirmText = 'OK',
  cancelText = 'Cancelar',
  isDarkTheme = true
}: CustomConfirmProps) {
  return (
    <div
      onClick={onCancel}
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
          maxWidth: '450px',
          width: '100%',
          boxShadow: '0 25px 50px -12px rgba(245, 158, 11, 0.5)',
          border: isDarkTheme ? '1px solid #334155' : '1px solid #e2e8f0',
          animation: 'slideUp 0.3s ease-out'
        }}
      >
        {/* Ícone de Aviso */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: '20px'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(245, 158, 11, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <AlertTriangle style={{ width: '36px', height: '36px', color: '#f59e0b' }} />
          </div>
        </div>

        {/* Mensagem */}
        <p style={{
          color: isDarkTheme ? '#ffffff' : '#0f172a',
          fontSize: '16px',
          lineHeight: '1.6',
          textAlign: 'center',
          margin: '0 0 28px 0'
        }}>
          {message}
        </p>

        {/* Botões */}
        <div style={{
          display: 'flex',
          gap: '12px'
        }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              background: isDarkTheme ? 'rgba(100, 116, 139, 0.3)' : 'rgba(226, 232, 240, 0.8)',
              color: isDarkTheme ? '#cbd5e1' : '#475569',
              padding: '14px 24px',
              fontSize: '16px',
              fontWeight: '600',
              border: isDarkTheme ? '1px solid #475569' : '1px solid #cbd5e1',
              borderRadius: '12px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = isDarkTheme ? 'rgba(100, 116, 139, 0.5)' : 'rgba(203, 213, 225, 1)';
              e.currentTarget.style.borderColor = isDarkTheme ? '#64748b' : '#94a3b8';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = isDarkTheme ? 'rgba(100, 116, 139, 0.3)' : 'rgba(226, 232, 240, 0.8)';
              e.currentTarget.style.borderColor = isDarkTheme ? '#475569' : '#cbd5e1';
            }}
          >
            {cancelText}
          </button>
          
          <button
            onClick={onConfirm}
            style={{
              flex: 1,
              background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
              color: 'white',
              padding: '14px 24px',
              fontSize: '16px',
              fontWeight: 'bold',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(139, 92, 246, 0.4)',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(139, 92, 246, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.4)';
            }}
          >
            {confirmText}
          </button>
        </div>
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
