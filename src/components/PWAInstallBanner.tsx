import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;

// Captura o evento antes que o browser mostre o banner nativo
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e as BeforeInstallPromptEvent;
});

export function PWAInstallBanner() {
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Verifica se já instalou ou dispensou recentemente
    const dismissedAt = localStorage.getItem('pwa-dismissed');
    if (dismissedAt) {
      const days = (Date.now() - Number(dismissedAt)) / (1000 * 60 * 60 * 24);
      if (days < 7) return; // Não mostra por 7 dias após dispensar
    }

    // Detecta iOS (Safari não suporta beforeinstallprompt)
    const ios =
      /iphone|ipad|ipod/i.test(navigator.userAgent) &&
      !('MSStream' in window);
    setIsIOS(ios);

    // Detecta se já está instalado como PWA
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      ('standalone' in window.navigator && (window.navigator as any).standalone);

    if (isStandalone) return; // Já é PWA, não mostra

    // Dispara o banner após 3s de interação (gatilho inteligente pós-login)
    const timer = setTimeout(() => {
      if (deferredPrompt || ios) {
        setShow(true);
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  const handleInstall = async () => {
    if (isIOS) {
      // iOS: apenas mostra instruções (não tem API de instalação)
      return;
    }
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      deferredPrompt = null;
    }
    handleDismiss();
  };

  const handleDismiss = () => {
    setDismissed(true);
    setShow(false);
    localStorage.setItem('pwa-dismissed', String(Date.now()));
  };

  if (dismissed) return null;

  return (
    <AnimatePresence>
      {show && (
        <>
          {/* Overlay semitransparente */}
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleDismiss}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100]"
          />

          {/* Bottom Sheet */}
          <motion.div
            key="sheet"
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-[101] max-w-lg mx-auto"
          >
            <div className="bg-[#1a1a1a] border border-white/10 rounded-t-[2rem] p-7 shadow-2xl">
              {/* Handle bar */}
              <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-6" />

              {/* Header */}
              <div className="flex items-start justify-between mb-5">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl overflow-hidden bg-[#C8102E]/10 flex items-center justify-center">
                    <img
                      src="/assets/corpus_isologo.png"
                      alt="Corpus Prime"
                      className="w-10 h-10 object-contain"
                    />
                  </div>
                  <div>
                    <h3 className="text-white font-display font-black text-lg leading-tight">
                      Corpus Prime
                    </h3>
                    <p className="text-white/50 text-xs font-medium">
                      Instalar aplicativo
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleDismiss}
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:bg-white/20 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Description */}
              {isIOS ? (
                <div className="bg-white/5 rounded-2xl p-4 mb-5 border border-white/10">
                  <p className="text-white/80 text-sm font-medium mb-3 flex items-center gap-2">
                    <Smartphone size={16} className="text-[#C8102E]" />
                    Como instalar no iPhone:
                  </p>
                  <ol className="space-y-2 text-white/60 text-xs">
                    <li className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-[#C8102E]/20 text-[#C8102E] text-[10px] font-black flex items-center justify-center shrink-0">1</span>
                      Toque no botão <strong className="text-white">Compartilhar</strong> (ícone de caixa com seta)
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-[#C8102E]/20 text-[#C8102E] text-[10px] font-black flex items-center justify-center shrink-0">2</span>
                      Role e toque em <strong className="text-white">"Adicionar à Tela de Início"</strong>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-[#C8102E]/20 text-[#C8102E] text-[10px] font-black flex items-center justify-center shrink-0">3</span>
                      Confirme tocando em <strong className="text-white">Adicionar</strong>
                    </li>
                  </ol>
                </div>
              ) : (
                <p className="text-white/60 text-sm mb-5 leading-relaxed">
                  Instale o <strong className="text-white">Corpus Prime</strong> para acessar seus treinos com experiência de app nativo — mais rápido, sem barra de endereço e com suporte offline.
                </p>
              )}

              {/* Benefits */}
              <div className="grid grid-cols-3 gap-2 mb-6">
                {[
                  { emoji: '⚡', label: 'Mais rápido' },
                  { emoji: '📵', label: 'Funciona offline' },
                  { emoji: '🏠', label: 'Na tela inicial' },
                ].map((b) => (
                  <div key={b.label} className="bg-white/5 rounded-xl p-2.5 text-center border border-white/5">
                    <p className="text-lg mb-1">{b.emoji}</p>
                    <p className="text-white/60 text-[10px] font-bold uppercase tracking-wide">{b.label}</p>
                  </div>
                ))}
              </div>

              {/* Actions */}
              {!isIOS && (
                <button
                  onClick={handleInstall}
                  className="w-full bg-[#C8102E] hover:bg-[#a50d26] text-white py-4 rounded-2xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-[#C8102E]/30"
                >
                  <Download size={18} />
                  Instalar Agora
                </button>
              )}

              <button
                onClick={handleDismiss}
                className="w-full mt-3 text-white/30 text-xs font-semibold text-center py-2 hover:text-white/50 transition-colors"
              >
                Agora não
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
