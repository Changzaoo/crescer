import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const useInstallPWA = () => {
  const [supportsPWA, setSupportsPWA] = useState(false);
  const [promptInstall, setPromptInstall] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Verifica se já está instalado
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    // @ts-ignore
    const isIOSStandalone = window.navigator.standalone === true;
    
    setIsInstalled(isStandalone || isIOSStandalone);

    // Listener para o evento beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setSupportsPWA(true);
      setPromptInstall(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!promptInstall) {
      return;
    }

    promptInstall.prompt();
    const { outcome } = await promptInstall.userChoice;

    if (outcome === 'accepted') {
      setPromptInstall(null);
      setSupportsPWA(false);
    }
  };

  return {
    supportsPWA,
    isInstalled,
    handleInstallClick
  };
};
