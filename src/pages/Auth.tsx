import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { toast } from "sonner";
import { LogIn, UserPlus, Mail, Lock, KeyRound, ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  
  const [activeTab, setActiveTab] = useState<"login" | "register" | "forgot">("login");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Determine where to redirect after successful login
  const from = location.state?.from?.pathname || "/";

  // Se já estiver logado (e não estiver checando a sessão), vai pro Dashboard
  if (!authLoading && user) {
    return <Navigate to={from} replace />;
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || (activeTab !== "forgot" && !password)) {
      toast.error("Por favor, preencha os campos obrigatórios.");
      return;
    }

    setLoading(true);
    let error = null;

    if (activeTab === "login") {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      error = signInError;
      if (!error) {
        toast.success("Login realizado com sucesso!");
        // O AuthContext vai detectar o SIGNED_IN e atualizar o estado user,
        // o que vai acionar automaticamente o <Navigate> no topo deste componente.
      }
    } else if (activeTab === "register") {
      if (password !== confirmPassword) {
        toast.error("As senhas não coincidem.");
        setLoading(false);
        return;
      }
      
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: 'https://corpusprime.vercel.app/email-confirmed',
        }
      });
      error = signUpError;
      if (!error) {
        setShowSuccessModal(true);
      }
    } else if (activeTab === "forgot") {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'https://corpusprime.vercel.app/auth',
      });
      error = resetError;
      if (!error) {
        toast.success("Link de recuperação enviado para " + email);
        setActiveTab("login");
      }
    }

    if (error) {
      // Supabase error messages are usually in English, we can map common ones or just show them.
      toast.error(error.message);
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center px-6 pb-24 relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-64 h-64 bg-accent/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[20%] right-[-10%] w-64 h-64 bg-foreground/5 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 max-w-sm w-full mx-auto"
      >
        <div className="flex justify-center mb-8">
          <img
            src="/assets/corpus_logo.png"
            alt="Corpus Logo"
            className="h-20 w-auto object-contain"
          />
        </div>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-display font-semibold text-foreground tracking-tight mb-2">
            {activeTab === "login" && "Bem-vindo de volta"}
            {activeTab === "register" && "Crie sua conta"}
            {activeTab === "forgot" && "Recuperar Senha"}
          </h1>
          <p className="text-sm text-muted-foreground w-4/5 mx-auto">
            {activeTab === "login" && "Acesse seus treinos personalizados e continue evoluindo."}
            {activeTab === "register" && "Junte-se a nós e comece a construir seu corpo agora."}
            {activeTab === "forgot" && "Digite seu e-mail para receber um link de redefinição de senha."}
          </p>
        </div>

        <div className="bg-card border border-border/40 p-6 rounded-3xl shadow-sm">
          {activeTab !== "forgot" ? (
            <div className="flex bg-muted/50 p-1 rounded-xl mb-6">
              <button
                type="button"
                onClick={() => setActiveTab("login")}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                  activeTab === "login"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Entrar
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("register")}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                  activeTab === "register"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Criar Conta
              </button>
            </div>
          ) : (
            <button
              onClick={() => setActiveTab("login")}
              className="mb-6 flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft size={14} /> Voltar para o Login
            </button>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase font-semibold text-muted-foreground tracking-wider ml-1">
                E-mail
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <Mail size={18} strokeWidth={1.5} />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full bg-muted/40 border border-border/40 rounded-xl pl-10 pr-4 py-3 text-sm outline-none focus:border-foreground transition-colors font-medium"
                />
              </div>
            </div>

            {activeTab !== "forgot" && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between ml-1">
                  <label className="text-[11px] uppercase font-semibold text-muted-foreground tracking-wider">
                    Senha
                  </label>
                  {activeTab === "login" && (
                    <button
                      type="button"
                      onClick={() => setActiveTab("forgot")}
                      className="text-[10px] font-semibold text-foreground hover:underline"
                    >
                      Esqueceu a senha?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    <Lock size={18} strokeWidth={1.5} />
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={activeTab === "login" ? "Sua senha segura" : "Crie uma senha forte"}
                    className="w-full bg-muted/40 border border-border/40 rounded-xl pl-10 pr-4 py-3 text-sm outline-none focus:border-foreground transition-colors font-medium"
                  />
                </div>
              </div>
            )}

            {activeTab === "register" && (
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase font-semibold text-muted-foreground tracking-wider ml-1">
                  Confirmar Senha
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    <KeyRound size={18} strokeWidth={1.5} />
                  </div>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita sua senha"
                    className={`w-full bg-muted/40 border rounded-xl pl-10 pr-4 py-3 text-sm outline-none transition-colors font-medium ${
                      confirmPassword && password !== confirmPassword 
                        ? "border-red-500/50 focus:border-red-500" 
                        : "border-border/40 focus:border-foreground"
                    }`}
                  />
                </div>
                {confirmPassword && password !== confirmPassword && (
                  <p className="text-[10px] text-red-500 font-medium ml-1">As senhas não coincidem</p>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-fire text-white py-3.5 rounded-[1.125rem] font-bold shadow-red-glow mt-6 flex items-center justify-center gap-2 hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
            >
              {loading ? (
                "Carregando..."
              ) : activeTab === "login" ? (
                <>
                  <LogIn size={18} />
                  Entrar na Conta
                </>
              ) : activeTab === "register" ? (
                <>
                  <UserPlus size={18} />
                  Cadastrar
                </>
              ) : (
                <>
                  <KeyRound size={18} />
                  Enviar E-mail de Recuperação
                </>
              )}
            </button>
          </form>
        </div>
      </motion.div>

      {/* Registration Success Modal */}
      <AnimatePresence>
        {showSuccessModal && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-background/80 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="bg-card border border-border/40 p-8 rounded-[2rem] max-w-sm w-full text-center shadow-2xl"
            >
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Mail className="text-primary w-8 h-8" />
              </div>
              <h2 className="text-2xl font-display font-bold text-foreground mb-3">Verifique seu E-mail</h2>
              <p className="text-sm text-muted-foreground mb-8">
                Enviamos um link de confirmação para <span className="text-foreground font-bold">{email}</span>. 
                Por favor, valide sua conta para começar a treinar.
              </p>
              <button
                onClick={() => {
                  setShowSuccessModal(false);
                  setActiveTab("login");
                }}
                className="w-full bg-foreground text-background py-4 rounded-2xl font-bold hover:opacity-90 transition-all"
              >
                Entendi, ir para o Login
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
