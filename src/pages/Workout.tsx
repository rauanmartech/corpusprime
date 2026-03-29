import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Play, Info, Flame, Trophy, TrendingUp, Loader2, Dumbbell, History, BookOpen, Clock, Activity, Zap, CheckCircle2, Plus, ChevronRight, Trash2, LogIn, Edit2, CalendarDays, Circle, LayoutGrid } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { checkAndAwardAchievements } from "@/lib/achievements";
import { cache } from "@/lib/cache";

// Tipagens do Banco
type DBWorkout = { id: string; name: string };
type DBWeeklySchedule = { id: string; day_of_week: number; workout_id: string; };
type DBExercise = {
  id: string;
  workout_id: string;
  name: string;
  weight: number | null;
  sets: number;
  reps: number | null;
};

export default function Workout() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Estados
  const { user } = useAuth();
  const session = user ? { user } : null;
  const checkingAuth = false;
  const [workouts, setWorkouts] = useState<DBWorkout[]>([]);
  const [schedule, setSchedule] = useState<DBWeeklySchedule[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Telas/Navegação Interna
  const [activeTab, setActiveTab] = useState<"hoje" | "semana" | "fichas">("hoje");
  const [activeWorkout, setActiveWorkout] = useState<DBWorkout | null>(null);
  const [exercises, setExercises] = useState<DBExercise[]>([]);
  const [loadingExercises, setLoadingExercises] = useState(false);

  // Treino do Dia
  const [todayWorkout, setTodayWorkout] = useState<DBWorkout | null>(null);
  const [todayExercises, setTodayExercises] = useState<DBExercise[]>([]);
  const [completedExercises, setCompletedExercises] = useState<string[]>([]);
  const [workoutStarted, setWorkoutStarted] = useState(false);
  const [finishingWorkout, setFinishingWorkout] = useState(false);

  // Formulários Treino
  const [showNewWorkout, setShowNewWorkout] = useState(false);
  const [newWorkoutName, setNewWorkoutName] = useState("");
  const [editingWorkoutId, setEditingWorkoutId] = useState<string | null>(null);
  const [editWorkoutName, setEditWorkoutName] = useState("");
  const [assigningDay, setAssigningDay] = useState<number | null>(null);

  // Formulários Exercícios
  const [showNewExercise, setShowNewExercise] = useState(false);
  const [newExercise, setNewExercise] = useState({ name: "", weight: 0, sets: 3, reps: 10, weightNA: false, repsNA: false });

  // Edição de Exercícios
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);
  const [editExerciseData, setEditExerciseData] = useState({ name: "", weight: 0, sets: 3, reps: 10, weightNA: false, repsNA: false });

  // Autenticação & Carregamento Inicial
  useEffect(() => {
    if (user) {
      fetchWorkouts(user.id);
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchWorkouts = async (userId: string) => {
    setLoading(true);
    const [workoutsRes, scheduleRes] = await Promise.all([
      supabase.from('workouts').select('*').order('created_at', { ascending: true }),
      supabase.from('weekly_schedule').select('*').eq('user_id', userId)
    ]);

    if (workoutsRes.error) toast.error("Erro ao puxar treinos.");
    else setWorkouts(workoutsRes.data || []);

    if (scheduleRes.error) {
      toast.error("Erro ao puxar agenda.");
    } else {
      setSchedule(scheduleRes.data || []);
      const today = new Date().getDay();
      const todaySched = scheduleRes.data?.find(s => s.day_of_week === today);
      if (todaySched && workoutsRes.data) {
        const w = workoutsRes.data.find(wr => wr.id === todaySched.workout_id);
        if (w) {
          setTodayWorkout(w);
          const { data: excs } = await supabase.from('exercises').select('*').eq('workout_id', w.id).order('order_index');
          setTodayExercises(excs || []);
        }
      } else {
        setTodayWorkout(null);
        setTodayExercises([]);
      }
      
      // Se viemos do Histórico com um workoutId no state
      const state = location.state as { workoutId?: string };
      if (state?.workoutId && workoutsRes.data) {
        const found = workoutsRes.data.find(w => w.id === state.workoutId);
        if (found) {
          setActiveTab("fichas");
          setActiveWorkout(found);
          setLoadingExercises(true);
          const { data: excs } = await supabase.from('exercises').select('*').eq('workout_id', found.id).order('order_index');
          setExercises(excs || []);
          setLoadingExercises(false);
        }
      }
    }

    setLoading(false);
  };

  // Função de Atualização Otimista para Pesos/Reps
  const updateExerciseOptimistically = async (id: string, field: 'weight' | 'reps', value: number) => {
    // 1. Atualizar UI imediatamente (Optimistic UI)
    const updatedExercises = todayExercises.map(ex => 
      ex.id === id ? { ...ex, [field]: value } : ex
    );
    setTodayExercises(updatedExercises);

    // 2. Persistir localmente para redundância
    cache.set(`workout_state_${todayWorkout?.id}`, {
      started: workoutStarted,
      completed: completedExercises,
      exercises: updatedExercises
    });

    // 3. Sincronizar com o banco em background (High Availability)
    try {
      const { error } = await supabase
        .from('exercises')
        .update({ [field]: value })
        .eq('id', id);
      
      if (error) throw error;
    } catch (err) {
      console.warn("Sync failed, retrying in 5s...", err);
      // Notificação silenciosa/discreta (vibrar ou toast pequeno se necessário)
      setTimeout(() => updateExerciseOptimistically(id, field, value), 5000);
    }
  };

  // Dentro do map dos exercícios (Hoje):
  const renderExerciseInputs = (exc: DBExercise, isDone: boolean) => (
    <div className={`flex items-center gap-3 text-sm mt-1 ${isDone ? "opacity-60" : ""} font-medium`}>
      <span>{exc.sets} séries</span>
      <span>•</span>
      <div className="flex items-center gap-1 bg-muted/30 px-2 py-0.5 rounded-md border border-border/10">
        <input 
          type="number" 
          value={exc.reps || 0} 
          disabled={isDone}
          onChange={(e) => updateExerciseOptimistically(exc.id, 'reps', Number(e.target.value))}
          className="w-10 bg-transparent text-foreground outline-none text-center"
        />
        <span className="text-[10px] text-muted-foreground">REPS</span>
      </div>
      <span>•</span>
      <div className="flex items-center gap-1 bg-muted/30 px-2 py-0.5 rounded-md border border-border/10">
        <input 
          type="number" 
          step="0.5"
          value={exc.weight || 0} 
          disabled={isDone}
          onChange={(e) => updateExerciseOptimistically(exc.id, 'weight', Number(e.target.value))}
          className="w-12 bg-transparent text-foreground outline-none text-center"
        />
        <span className="text-[10px] text-muted-foreground">KG</span>
      </div>
    </div>
  );

  // Persistência de Andamento do Treino (Salvar)
  useEffect(() => {
    if (todayWorkout) {
      const todayStr = new Date().toISOString().split('T')[0];
      if (workoutStarted || completedExercises.length > 0) {
        localStorage.setItem('evolve_workout_state', JSON.stringify({
          date: todayStr,
          workoutId: todayWorkout.id,
          started: workoutStarted,
          completed: completedExercises
        }));
      }
    }
  }, [workoutStarted, completedExercises, todayWorkout]);

  const loadExercises = async (workout: DBWorkout) => {
    setLoadingExercises(true);
    setActiveWorkout(workout);
    const { data, error } = await supabase.from('exercises').select('*').eq('workout_id', workout.id).order('order_index');
    if (error) toast.error("Erro ao puxar exercícios.");
    else setExercises(data || []);
    setLoadingExercises(false);
  };

  const handleCreateWorkout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkoutName.trim()) return;
    if (!session) return;

    try {
      const { data, error } = await supabase.from('workouts').insert([
        { name: newWorkoutName.trim(), user_id: session.user.id }
      ]).select();
      
      if (error) throw error;
      setWorkouts([...workouts, data[0]]);
      setShowNewWorkout(false);
      setNewWorkoutName("");
      toast.success("Treino criado!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar treino");
    }
  };

  const handleUpdateWorkout = async (id: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!editWorkoutName.trim()) return;

    try {
      const { data, error } = await supabase.from('workouts').update({
        name: editWorkoutName.trim()
      }).eq('id', id).select();

      if (error) throw error;
      setWorkouts(workouts.map(w => w.id === id ? data[0] : w));
      setEditingWorkoutId(null);
      
      // Update active workout context if it's currently open
      if (activeWorkout?.id === id) {
        setActiveWorkout(data[0]);
      }
      
      toast.success("Treino renomeado!");
    } catch (err: any) {
      toast.error("Erro ao renomear treino.");
    }
  };

  const handleStartEditWorkout = (w: DBWorkout, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingWorkoutId(w.id);
    setEditWorkoutName(w.name);
  };

  const handleDeleteWorkout = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const { error } = await supabase.from('workouts').delete().eq('id', id);
    if (error) toast.error("Erro ao deletar treino");
    else {
      setWorkouts(workouts.filter(w => w.id !== id));
      toast.success("Treino deletado.");
    }
  };

  const handleAssignWorkout = async (workoutId: string | null) => {
    if (assigningDay === null || !session) return;
    
    try {
      if (workoutId) {
        const { data, error } = await supabase.from('weekly_schedule')
          .upsert({ user_id: session.user.id, day_of_week: assigningDay, workout_id: workoutId }, { onConflict: 'user_id,day_of_week' })
          .select();
        if (error) throw error;
        setSchedule(prev => [...prev.filter(s => s.day_of_week !== assigningDay), data[0]]);
      } else {
        const { error } = await supabase.from('weekly_schedule')
          .delete()
          .eq('user_id', session.user.id)
          .eq('day_of_week', assigningDay);
        if (error) throw error;
        setSchedule(schedule.filter(s => s.day_of_week !== assigningDay));
      }
      setAssigningDay(null);
    } catch(err) {
      toast.error("Erro ao atualizar a agenda.");
    }
  };

  const handleCreateExercise = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkout || !newExercise.name.trim()) return;

    try {
      const { data, error } = await supabase.from('exercises').insert([{
        workout_id: activeWorkout.id,
        name: newExercise.name.trim(),
        weight: newExercise.weightNA ? null : newExercise.weight,
        sets: newExercise.sets,
        reps: newExercise.repsNA ? null : newExercise.reps,
        order_index: exercises.length
      }]).select();

      if (error) throw error;
      setExercises([...exercises, data[0]]);
      setShowNewExercise(false);
      setNewExercise({ name: "", weight: 0, sets: 3, reps: 10, weightNA: false, repsNA: false });
      toast.success("Exercício adicionado!");
    } catch (err: any) {
      toast.error("Erro ao salvar exercício.");
    }
  };

  const handleDeleteExercise = async (id: string) => {
    const { error } = await supabase.from('exercises').delete().eq('id', id);
    if (error) toast.error("Erro ao remover.");
    else setExercises(exercises.filter(e => e.id !== id));
  };

  const handleStartEdit = (exc: DBExercise) => {
    setEditingExerciseId(exc.id);
    setEditExerciseData({
      name: exc.name,
      weight: exc.weight ?? 0,
      sets: exc.sets,
      reps: exc.reps ?? 10,
      weightNA: exc.weight === null,
      repsNA: exc.reps === null
    });
  };

  const toggleExerciseCheck = (id: string) => {
    if (completedExercises.includes(id)) {
      setCompletedExercises(completedExercises.filter(e => e !== id));
    } else {
      setCompletedExercises([...completedExercises, id]);
    }
  };

  const handleFinishWorkout = async () => {
    if (!todayWorkout || !session) return;
    setFinishingWorkout(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      
      // 1. Check if already done today to avoid double counting streak
      const { data: doneToday } = await supabase
        .from('workout_history')
        .select('id')
        .eq('user_id', session.user.id)
        .gte('completed_at', todayStr + 'T00:00:00')
        .single();

      // 2. Insert to history
      await supabase.from('workout_history').insert([{
        user_id: session.user.id,
        workout_id: todayWorkout.id
      }]);

      // 3. Update Streak & XP if it's the first workout of the day
      if (!doneToday) {
        const { data: stats } = await supabase
          .from('user_stats')
          .select('streak, xp, total_sessions, level')
          .eq('user_id', session.user.id)
          .single();

        const currentStreak = stats?.streak || 0;
        const currentXP = stats?.xp || 0;
        const currentLevel = stats?.level || 1;
        const currentTotal = stats?.total_sessions || 0;
        
        const newXP = currentXP + 150;
        const newLevel = Math.floor(newXP / 1500) + 1;

        await supabase.from('user_stats').update({
          streak: currentStreak + 1,
          total_sessions: currentTotal + 1,
          xp: newXP,
          level: newLevel,
          last_sync_date: todayStr
        }).eq('user_id', session.user.id);

        // --- NOVO: Registrar na Comunidade ---
        const newStreak = currentStreak + 1;
        
        // 1. Evento de Treino
        await supabase.from('community_events').insert([{
          user_id: session.user.id,
          event_type: 'workout',
          title: `Finalizou o treino: ${todayWorkout.name}`,
          description: `Completou sua ${currentTotal + 1}ª sessão de treino! 🔥`,
          metadata: {
            workout_name: todayWorkout.name,
            total_sessions: currentTotal + 1
          }
        }]);

        // 2. Marcas de Streak (7, 14, 21, 30, 60, 90, 180, 365)
        const milestones = [7, 14, 21, 30, 60, 90, 180, 365];
        if (milestones.includes(newStreak)) {
          let label = `${newStreak} dias`;
          if (newStreak === 30) label = "1 mês";
          if (newStreak === 60) label = "2 meses";
          if (newStreak === 365) label = "1 ano";

          await supabase.from('community_events').insert([{
            user_id: session.user.id,
            event_type: 'milestone',
            title: `MARCO ALCANÇADO: ${label}!`,
            description: `Manteve a chama acesa por ${label} consecutivos! 🚀`,
            metadata: { streak: newStreak }
          }]);
        }
        // -------------------------------------

        if (newLevel > currentLevel) {
          toast.success(`EVOLUÇÃO! Você subiu para o NÍVEL ${newLevel}! 🔥🧗‍♂️`, {
            duration: 8000,
            style: { background: 'var(--blood-red)', color: 'white', fontWeight: 'bold' }
          });
        }

        // 4. Verificar Conquistas de Consistência
        await checkAndAwardAchievements(session.user.id);
      }

      toast.success("Treino Finalizado com Sucesso! 💪🔥");
      setWorkoutStarted(false);
      setCompletedExercises([]);
      localStorage.removeItem('evolve_workout_state');
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar histórico.");
    }
    setFinishingWorkout(false);
  };

  const handleUpdateExercise = async (id: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!editExerciseData.name.trim()) return;

    try {
      const { data, error } = await supabase.from('exercises').update({
        name: editExerciseData.name.trim(),
        weight: editExerciseData.weightNA ? null : editExerciseData.weight,
        sets: editExerciseData.sets,
        reps: editExerciseData.repsNA ? null : editExerciseData.reps
      }).eq('id', id).select();

      if (error) throw error;
      setExercises(exercises.map(exc => exc.id === id ? data[0] : exc));
      setEditingExerciseId(null);
      toast.success("Exercício atualizado!");
    } catch (err: any) {
      toast.error("Erro ao atualizar exercício.");
    }
  };

  if (checkingAuth) {
    return <div className="min-h-screen bg-background flex justify-center items-center pb-24 text-muted-foreground font-medium">Carregando...</div>;
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <LogIn size={24} className="text-foreground" />
        </div>
        <h2 className="text-2xl font-display font-semibold text-foreground mb-2">Login Necessário</h2>
        <p className="text-muted-foreground mb-8 max-w-xs">Para gerenciar seus treinos personalizados com segurança em nuvem, precisamos que você faça login.</p>
        <button onClick={() => navigate("/auth")} className="bg-foreground text-background px-6 py-3 rounded-xl font-medium shadow-elevated transition-transform hover:scale-105 active:scale-95">Configurar Autenticação</button>
      </div>
    );
  }

  const DAYS = [
    { id: 1, label: "Segunda-feira" },
    { id: 2, label: "Terça-feira" },
    { id: 3, label: "Quarta-feira" },
    { id: 4, label: "Quinta-feira" },
    { id: 5, label: "Sexta-feira" },
    { id: 6, label: "Sábado" },
    { id: 0, label: "Domingo" }
  ];

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Dynamic Header */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-lg border-b border-border/60">
        <div className="flex items-center px-5 py-4 gap-4">
          <button 
            onClick={() => activeWorkout ? setActiveWorkout(null) : navigate("/")} 
            className="w-10 h-10 rounded-full bg-muted flex items-center justify-center transition-colors hover:bg-muted/80"
          >
            <ArrowLeft size={20} strokeWidth={1.5} className="text-foreground" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-display font-semibold text-foreground">
              {activeWorkout ? activeWorkout.name : "Meus Treinos"}
            </h1>
            <p className="text-xs text-muted-foreground tracking-wide uppercase font-medium">
              {activeWorkout ? "Personalizar Exercícios" : "Suas personalizações"}
            </p>
          </div>
        </div>
      </div>

      <div className="px-5 mt-6">
        <AnimatePresence mode="wait">
          {!activeWorkout ? (
            <motion.div key="workouts" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              
              {/* Abas */}
              <div className="flex bg-muted/40 p-1 rounded-xl mb-6">
                <button
                  onClick={() => setActiveTab("hoje")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${
                    activeTab === "hoje" ? "bg-blood-red text-white shadow-red-glow" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Play size={14} fill={activeTab === "hoje" ? "currentColor" : "none"} /> Hoje
                </button>
                <button
                  onClick={() => setActiveTab("semana")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${
                    activeTab === "semana" ? "bg-blood-red text-white shadow-red-glow" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <CalendarDays size={14} /> Semana
                </button>
                <button
                  onClick={() => setActiveTab("fichas")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${
                    activeTab === "fichas" ? "bg-blood-red text-white shadow-red-glow" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <LayoutGrid size={14} /> Fichas
                </button>
              </div>

              {activeTab === "hoje" ? (
                <div className="space-y-4 pb-8">
                  {!todayWorkout ? (
                    <div className="bg-card border border-border/40 rounded-3xl p-8 text-center shadow-sm">
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                        <CalendarDays size={24} className="text-muted-foreground" />
                      </div>
                      <h3 className="text-xl font-display font-semibold text-foreground mb-2">Dia de Descanso</h3>
                      <p className="text-muted-foreground mb-6">Você não tem treinos agendados para hoje. Aproveite para recuperar!</p>
                      <button onClick={() => setActiveTab("semana")} className="bg-foreground text-background px-6 py-3 rounded-xl font-semibold hover:scale-105 transition-transform">
                        Ver Sua Semana
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <h2 className="text-2xl font-display font-semibold text-foreground">{todayWorkout.name}</h2>
                        {workoutStarted && (
                          <span className="text-xs font-semibold px-3 py-1 bg-primary/10 text-primary rounded-full">
                            {completedExercises.length}/{todayExercises.length} concluídos
                          </span>
                        )}
                      </div>
                      
                      <div className="space-y-3 mb-8">
                        {todayExercises.map((exc) => {
                          const isDone = completedExercises.includes(exc.id);
                          return (
                            <div 
                              key={exc.id} 
                              onClick={() => workoutStarted && toggleExerciseCheck(exc.id)}
                              className={`bg-card border ${workoutStarted && isDone ? "border-primary/50 bg-primary/5" : "border-border/40"} rounded-2xl p-4 shadow-sm flex items-center gap-4 transition-all ${workoutStarted ? "cursor-pointer active:scale-[0.98]" : ""}`}
                            >
                              {workoutStarted && (
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${isDone ? "text-primary" : "text-muted-foreground/40"}`}>
                                  {isDone ? <CheckCircle2 size={24} className="fill-primary/20" /> : <Circle size={24} strokeWidth={1.5} />}
                                </div>
                              )}
                              <div className="flex-1">
                                <p className={`text-base font-black uppercase tracking-tight ${isDone ? "text-foreground line-through opacity-40" : "text-foreground"}`}>{exc.name}</p>
                                {renderExerciseInputs(exc, isDone)}
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      {!workoutStarted ? (
                        <button 
                          onClick={() => setWorkoutStarted(true)} 
                          className="w-full bg-foreground text-background py-4 rounded-2xl font-semibold shadow-elevated text-lg flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-transform"
                        >
                          <Play size={20} fill="currentColor" /> Iniciar Treino
                        </button>
                      ) : (
                        <button 
                          onClick={handleFinishWorkout}
                          disabled={completedExercises.length !== todayExercises.length || finishingWorkout}
                          className={`w-full py-4 rounded-2xl font-semibold text-lg flex items-center justify-center gap-2 transition-all shadow-elevated
                            ${completedExercises.length === todayExercises.length 
                              ? "bg-primary text-primary-foreground hover:scale-[1.02] active:scale-[0.98]" 
                              : "bg-muted text-muted-foreground opacity-60 cursor-not-allowed"
                            }`}
                        >
                          {finishingWorkout ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={20} />}
                          Finalizar Treino
                        </button>
                      )}
                    </>
                  )}
                </div>
              ) : activeTab === "semana" ? (
                <div className="space-y-3 pb-8">
                  {DAYS.map(day => {
                    const sched = schedule.find(s => s.day_of_week === day.id);
                    const workout = sched ? workouts.find(w => w.id === sched.workout_id) : null;
                    
                    return (
                      <div key={day.id} className="bg-card border border-border/40 p-4 rounded-2xl flex items-center justify-between">
                        <div>
                          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">{day.label}</p>
                          {workout ? (
                            <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                              <Dumbbell size={14} className="text-primary"/> {workout.name}
                            </p>
                          ) : (
                            <p className="text-sm font-medium text-muted-foreground opacity-60 flex items-center gap-2">
                              Descanso
                            </p>
                          )}
                        </div>
                        <button 
                          onClick={() => setAssigningDay(day.id)} 
                          className={`text-xs font-semibold px-4 py-2 rounded-lg transition-colors ${
                            workout ? "bg-muted hover:bg-muted/80 text-foreground" : "bg-primary/10 text-primary hover:bg-primary/20"
                          }`}
                        >
                          {workout ? "Trocar" : "Planejar"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-4">
                  {workouts.map((workout) => (
                    <motion.div
                      key={workout.id}
                      className="group bg-card border border-border/40 rounded-2xl p-5 shadow-sm transition-all"
                    >
                      {editingWorkoutId === workout.id ? (
                        <form onSubmit={(e) => handleUpdateWorkout(workout.id, e)} className="animate-in fade-in zoom-in duration-200">
                          <input
                            autoFocus
                            type="text"
                            required
                            value={editWorkoutName}
                            onChange={(e) => setEditWorkoutName(e.target.value)}
                            className="w-full bg-muted/50 border border-border/40 rounded-xl px-4 py-3 outline-none focus:border-foreground transition-colors font-medium mb-3"
                          />
                          <div className="flex gap-2">
                            <button type="submit" className="flex-1 bg-foreground text-background py-2 rounded-xl font-semibold shadow-sm text-sm">Atualizar</button>
                            <button type="button" onClick={() => setEditingWorkoutId(null)} className="px-4 py-2 bg-muted text-foreground rounded-xl font-semibold text-sm">Cancelar</button>
                          </div>
                        </form>
                      ) : (
                        <div className="flex items-center justify-between cursor-pointer" onClick={() => loadExercises(workout)}>
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                              <Dumbbell size={20} className="text-foreground" strokeWidth={1.5} />
                            </div>
                            <p className="text-lg font-semibold text-foreground">{workout.name}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={(e) => handleStartEditWorkout(workout, e)} 
                              className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors"
                            >
                              <Edit2 size={16} strokeWidth={1.5} />
                            </button>
                            <button 
                              onClick={(e) => handleDeleteWorkout(workout.id, e)} 
                              className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                            >
                              <Trash2 size={16} strokeWidth={1.5} />
                            </button>
                            <div className="w-8 h-8 flex items-center justify-center group-hover:text-foreground text-muted-foreground transition-colors ml-1">
                              <ChevronRight size={20} strokeWidth={1.5} />
                            </div>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ))}
                  
                  {workouts.length === 0 && !loading && (
                    <div className="py-10 text-center text-muted-foreground">Você ainda não tem treinos criados.</div>
                  )}
                  
                  {!showNewWorkout ? (
                    <button 
                      onClick={() => setShowNewWorkout(true)}
                      className="w-full py-4 border-2 border-dashed border-border/60 hover:border-foreground/30 rounded-2xl flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground font-semibold transition-all mt-6"
                    >
                      <Plus size={18} strokeWidth={2} />
                      Novo Treino Personalizado
                    </button>
                  ) : (
                    <form onSubmit={handleCreateWorkout} className="bg-card border border-border/40 p-4 rounded-2xl shadow-sm mt-6">
                      <input
                        autoFocus
                        type="text"
                        placeholder="Nome (ex: Treino Perna)"
                        value={newWorkoutName}
                        onChange={(e) => setNewWorkoutName(e.target.value)}
                        className="w-full bg-muted/50 border border-border/40 rounded-xl px-4 py-3 outline-none focus:border-foreground transition-colors font-medium mb-3"
                      />
                      <div className="flex gap-2">
                        <button type="submit" className="flex-1 bg-foreground text-background py-3 rounded-xl font-semibold shadow-sm">Salvar</button>
                        <button type="button" onClick={() => setShowNewWorkout(false)} className="px-6 py-3 bg-muted text-foreground rounded-xl font-semibold">Cancelar</button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div key="exercises" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
              {/* Loading exercises */}
              {loadingExercises ? (
                <div className="py-12 flex justify-center text-muted-foreground"><Loader2 className="animate-spin" /></div>
              ) : (
                <div className="space-y-4">
                  {exercises.map((exc, index) => (
                    <div key={exc.id} className="bg-card border border-border/40 rounded-2xl p-5 shadow-sm">
                      {editingExerciseId === exc.id ? (
                        <form onSubmit={(e) => handleUpdateExercise(exc.id, e)} className="animate-in fade-in zoom-in duration-200">
                          <h3 className="font-semibold text-sm text-foreground mb-3">Editar Exercício</h3>
                          <div className="space-y-3 mb-4">
                            <input
                              autoFocus
                              type="text"
                              placeholder="Nome do Exercício"
                              required
                              value={editExerciseData.name}
                              onChange={(e) => setEditExerciseData({...editExerciseData, name: e.target.value})}
                              className="w-full bg-muted/50 border border-border/40 rounded-xl px-4 py-3 outline-none focus:border-foreground transition-colors font-medium"
                            />
                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <label className="text-[10px] uppercase text-muted-foreground font-semibold block">Peso (kg)</label>
                                  <label className="text-[10px] flex items-center gap-1 cursor-pointer text-muted-foreground hover:text-foreground">
                                    <input type="checkbox" checked={editExerciseData.weightNA} onChange={(e) => setEditExerciseData({...editExerciseData, weightNA: e.target.checked})} className="accent-foreground rounded-sm cursor-pointer" /> N/A
                                  </label>
                                </div>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.5"
                                  disabled={editExerciseData.weightNA}
                                  value={editExerciseData.weight}
                                  onChange={(e) => setEditExerciseData({...editExerciseData, weight: Number(e.target.value)})}
                                  className="w-full bg-muted/50 border border-border/40 rounded-xl px-3 py-2 outline-none focus:border-foreground transition-all font-medium disabled:opacity-30 disabled:cursor-not-allowed"
                                />
                              </div>
                              <div>
                                <div className="mb-1 h-3 flex items-center">
                                  <label className="text-[10px] uppercase text-muted-foreground font-semibold block">Séries</label>
                                </div>
                                <input
                                  type="number"
                                  min="1"
                                  value={editExerciseData.sets}
                                  onChange={(e) => setEditExerciseData({...editExerciseData, sets: Number(e.target.value)})}
                                  className="w-full bg-muted/50 border border-border/40 rounded-xl px-3 py-2 outline-none focus:border-foreground transition-colors font-medium"
                                />
                              </div>
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <label className="text-[10px] uppercase text-muted-foreground font-semibold block">Reps</label>
                                  <label className="text-[10px] flex items-center gap-1 cursor-pointer text-muted-foreground hover:text-foreground">
                                    <input type="checkbox" checked={editExerciseData.repsNA} onChange={(e) => setEditExerciseData({...editExerciseData, repsNA: e.target.checked})} className="accent-foreground rounded-sm cursor-pointer" /> N/A
                                  </label>
                                </div>
                                <input
                                  type="number"
                                  min="1"
                                  disabled={editExerciseData.repsNA}
                                  value={editExerciseData.reps}
                                  onChange={(e) => setEditExerciseData({...editExerciseData, reps: Number(e.target.value)})}
                                  className="w-full bg-muted/50 border border-border/40 rounded-xl px-3 py-2 outline-none focus:border-foreground transition-all font-medium disabled:opacity-30 disabled:cursor-not-allowed"
                                />
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button type="submit" className="flex-1 bg-foreground text-background py-3 rounded-xl font-semibold shadow-sm">Atualizar</button>
                            <button type="button" onClick={() => setEditingExerciseId(null)} className="px-6 py-3 bg-muted text-foreground rounded-xl font-semibold">Cancelar</button>
                          </div>
                        </form>
                      ) : (
                        <>
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <p className="text-base font-semibold text-foreground">{exc.name}</p>
                              <p className="text-xs text-muted-foreground uppercase tracking-widest mt-1">Exercício {index + 1}</p>
                            </div>
                            <div className="flex items-center gap-1">
                              <button onClick={() => handleStartEdit(exc)} className="text-muted-foreground hover:text-foreground p-1.5 rounded-md transition-colors">
                                <Edit2 size={16} strokeWidth={1.5} />
                              </button>
                              <button onClick={() => handleDeleteExercise(exc.id)} className="text-muted-foreground hover:text-destructive p-1.5 rounded-md transition-colors">
                                <Trash2 size={16} strokeWidth={1.5} />
                              </button>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-2">
                            <div className="bg-muted/40 rounded-xl p-3 flex flex-col items-center justify-center relative group">
                              <span className="text-[10px] uppercase font-semibold text-muted-foreground mb-1">Peso</span>
                              <span className="text-lg font-display font-semibold text-foreground">
                                {exc.weight === null ? "N/A" : `${exc.weight}kg`}
                              </span>
                            </div>
                            <div className="bg-muted/40 rounded-xl p-3 flex flex-col items-center justify-center group">
                              <span className="text-[10px] uppercase font-semibold text-muted-foreground mb-1">Séries</span>
                              <span className="text-lg font-display font-semibold text-foreground">{exc.sets}</span>
                            </div>
                            <div className="bg-muted/40 rounded-xl p-3 flex flex-col items-center justify-center group">
                              <span className="text-[10px] uppercase font-semibold text-muted-foreground mb-1">Reps</span>
                              <span className="text-lg font-display font-semibold text-foreground">
                                {exc.reps === null ? "N/A" : exc.reps}
                              </span>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ))}

                  {exercises.length === 0 && (
                    <div className="py-10 text-center text-muted-foreground">Nenhum exercício neste treino ainda.</div>
                  )}

                  {!showNewExercise ? (
                    <button 
                      onClick={() => setShowNewExercise(true)}
                      className="w-full py-4 border-2 border-dashed border-border/60 hover:border-foreground/30 rounded-2xl flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground font-semibold transition-all mt-6"
                    >
                      <Plus size={18} strokeWidth={2} />
                      Adicionar Exercício
                    </button>
                  ) : (
                    <form onSubmit={handleCreateExercise} className="bg-card border border-border/40 p-5 rounded-2xl shadow-sm mt-6">
                      <h3 className="font-semibold text-sm text-foreground mb-3">Novo Exercício</h3>
                      <div className="space-y-3 mb-4">
                        <input
                          autoFocus
                          type="text"
                          placeholder="Nome do Exercício"
                          required
                          value={newExercise.name}
                          onChange={(e) => setNewExercise({...newExercise, name: e.target.value})}
                          className="w-full bg-muted/50 border border-border/40 rounded-xl px-4 py-3 outline-none focus:border-foreground transition-colors font-medium"
                        />
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[10px] uppercase text-muted-foreground font-semibold block">Peso (kg)</label>
                              <label className="text-[10px] flex items-center gap-1 cursor-pointer text-muted-foreground hover:text-foreground">
                                <input type="checkbox" checked={newExercise.weightNA} onChange={(e) => setNewExercise({...newExercise, weightNA: e.target.checked})} className="accent-foreground rounded-sm cursor-pointer" /> N/A
                              </label>
                            </div>
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              disabled={newExercise.weightNA}
                              value={newExercise.weight}
                              onChange={(e) => setNewExercise({...newExercise, weight: Number(e.target.value)})}
                              className="w-full bg-muted/50 border border-border/40 rounded-xl px-3 py-2 outline-none focus:border-foreground transition-all font-medium disabled:opacity-30 disabled:cursor-not-allowed"
                            />
                          </div>
                          <div>
                            <div className="mb-1 h-3 flex items-center">
                              <label className="text-[10px] uppercase text-muted-foreground font-semibold block">Séries</label>
                            </div>
                            <input
                              type="number"
                              min="1"
                              value={newExercise.sets}
                              onChange={(e) => setNewExercise({...newExercise, sets: Number(e.target.value)})}
                              className="w-full bg-muted/50 border border-border/40 rounded-xl px-3 py-2 outline-none focus:border-foreground transition-colors font-medium"
                            />
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[10px] uppercase text-muted-foreground font-semibold block">Reps</label>
                              <label className="text-[10px] flex items-center gap-1 cursor-pointer text-muted-foreground hover:text-foreground">
                                <input type="checkbox" checked={newExercise.repsNA} onChange={(e) => setNewExercise({...newExercise, repsNA: e.target.checked})} className="accent-foreground rounded-sm cursor-pointer" /> N/A
                              </label>
                            </div>
                            <input
                              type="number"
                              min="1"
                              disabled={newExercise.repsNA}
                              value={newExercise.reps}
                              onChange={(e) => setNewExercise({...newExercise, reps: Number(e.target.value)})}
                              className="w-full bg-muted/50 border border-border/40 rounded-xl px-3 py-2 outline-none focus:border-foreground transition-all font-medium disabled:opacity-30 disabled:cursor-not-allowed"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button type="submit" className="flex-1 bg-foreground text-background py-3 rounded-xl font-semibold shadow-sm">Salvar Exercício</button>
                        <button type="button" onClick={() => setShowNewExercise(false)} className="px-6 py-3 bg-muted text-foreground rounded-xl font-semibold">Cancelar</button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {/* Modal de Adição p/ a Semana */}
      {assigningDay !== null && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <motion.div initial={{y: 50, opacity:0}} animate={{y:0, opacity:1}} className="bg-card border border-border/40 w-full max-w-sm rounded-[2rem] p-6 shadow-xl relative mt-auto sm:mt-0 mb-16 sm:mb-0">
             <h3 className="font-semibold text-lg text-foreground mb-4">
               Treino para {DAYS.find(d => d.id === assigningDay)?.label}
             </h3>
             
             <div className="space-y-2 mb-6 max-h-60 overflow-y-auto pr-1">
               <button 
                 onClick={() => handleAssignWorkout(null)}
                 className="w-full text-left p-4 rounded-xl border-2 border-transparent hover:border-border bg-muted/30 hover:bg-muted font-medium transition-colors"
               >
                  🛌 Descanso (Nenhum)
               </button>
               {workouts.map(w => (
                 <button 
                   key={w.id}
                   onClick={() => handleAssignWorkout(w.id)}
                   className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-transparent hover:border-border bg-muted/30 hover:bg-muted font-medium transition-colors text-left"
                 >
                    <Dumbbell size={18} className="text-primary" /> {w.name}
                 </button>
               ))}
             </div>
             <button onClick={() => setAssigningDay(null)} className="w-full py-4 bg-muted text-foreground hover:bg-muted/80 transition-colors rounded-xl font-semibold">Cancelar</button>
          </motion.div>
        </div>
      )}
    </div>
  );
}
