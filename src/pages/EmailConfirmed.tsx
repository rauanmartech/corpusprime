import { motion } from "framer-motion";
import { CheckCircle2, ArrowRight, Smartphone } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function EmailConfirmed() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden">
      {/* Decorative Background */}
      <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 bg-accent/5 rounded-full blur-[100px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-card border border-border/40 rounded-[2.5rem] p-10 shadow-elevated relative z-10 text-center"
      >
        <div className="mb-8 relative">
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", damping: 12, stiffness: 200, delay: 0.2 }}
            className="w-24 h-24 bg-gradient-fire rounded-3xl flex items-center justify-center mx-auto shadow-red-glow"
          >
            <CheckCircle2 className="text-white w-12 h-12" strokeWidth={2.5} />
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="absolute -top-2 -right-2 bg-foreground text-background text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-tighter"
          >
            Sucesso
          </motion.div>
        </div>

        <h1 className="text-3xl font-display font-bold text-foreground mb-4 tracking-tight">
          E-mail Confirmado!
        </h1>
        
        <p className="text-muted-foreground mb-10 leading-relaxed">
          Sua conta foi validada com sucesso. Agora você faz parte da elite 
          <span className="text-foreground font-semibold"> Evolve Strong</span>.
        </p>

        <div className="space-y-4">
          <div className="bg-muted/30 border border-border/20 rounded-2xl p-5 flex items-start gap-4 text-left">
            <div className="bg-foreground/5 p-2 rounded-lg mt-0.5">
              <Smartphone size={18} className="text-foreground" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground mb-1">Retorne ao App</h3>
              <p className="text-xs text-muted-foreground leading-snug">
                Para garantir a melhor experiência, abra o aplicativo e realize o login.
              </p>
            </div>
          </div>

          <button
            onClick={() => navigate("/auth")}
            className="w-full bg-foreground text-background h-16 rounded-2xl font-bold flex items-center justify-center gap-2 group hover:gap-4 transition-all active:scale-[0.98]"
          >
            Fazer Login Agora
            <ArrowRight size={20} className="transition-transform group-hover:translate-x-1" />
          </button>
        </div>

        <p className="mt-8 text-[10px] text-muted-foreground uppercase font-bold tracking-[0.2em]">
          Powered by Corpus Prime
        </p>
      </motion.div>
      
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="mt-8 flex items-center gap-2"
      >
        <img src="/assets/corpus_logo.png" alt="Logo" className="h-6 w-auto grayscale opacity-50" />
      </motion.div>
    </div>
  );
}
