import { Bitcoin } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function SplashScreen() {
  const [show, setShow] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShow(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  if (!show) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      animation: 'fadeOut 0.5s ease-out 1.5s forwards'
    }}>
      {/* Logo animado */}
      <div style={{
        width: '120px',
        height: '120px',
        borderRadius: '30px',
        background: 'linear-gradient(135deg, #fb923c 0%, #f97316 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 20px 60px rgba(251, 146, 60, 0.6)',
        animation: 'pulse 2s ease-in-out infinite'
      }}>
        <Bitcoin style={{ width: '60px', height: '60px', color: '#0f172a' }} />
      </div>

      {/* Título */}
      <h1 style={{
        color: 'white',
        fontSize: '28px',
        fontWeight: 'bold',
        marginTop: '24px',
        marginBottom: '8px'
      }}>
        Bitcoin Portfolio
      </h1>

      {/* Subtítulo */}
      <p style={{
        color: '#94a3b8',
        fontSize: '16px'
      }}>
        Crescer
      </p>

      {/* Loading indicator */}
      <div style={{
        marginTop: '40px',
        display: 'flex',
        gap: '8px'
      }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#fb923c',
              animation: `bounce 1.4s ease-in-out ${i * 0.2}s infinite`
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes fadeOut {
          to {
            opacity: 0;
            visibility: hidden;
          }
        }

        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.05);
          }
        }

        @keyframes bounce {
          0%, 80%, 100% {
            transform: translateY(0);
          }
          40% {
            transform: translateY(-12px);
          }
        }
      `}</style>
    </div>
  );
}
