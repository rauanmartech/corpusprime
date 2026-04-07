import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Play, Info, Flame, Trophy, TrendingUp, Loader2, Dumbbell, History, BookOpen, Clock, Activity, Zap, CheckCircle2, Plus, ChevronRight, Trash2, LogIn, Edit2, CalendarDays, Circle, LayoutGrid, X, ArrowDown, Timer, SkipForward, Pause } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { checkAndAwardAchievements } from "@/lib/achievements";
import { cache } from "@/lib/cache";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "@/components/PullToRefreshIndicator";

// Tipagens do Banco
type DBWorkout = { id: string; name: string };
type DBWeeklySchedule = { id: string; day_of_week: number; workout_id: string; };

type DBExerciseSet = {
  weight: number | null;
  reps: number | null;
  set_type?: 'warmup' | 'normal' | 'failure' | 'drop' | 'time';
  target_duration?: number;
};

type DBExercise = {
  id: string;
  workout_id: string;
  name: string;
  weight: number | null;
  sets: number;
  reps: number | null;
  sets_config?: DBExerciseSet[];
};

const SET_TYPES = {
  normal: { icon: Play, color: "text-zinc-400", bg: "bg-zinc-500/5", border: "border-zinc-500/10", label: "Normal" },
  warmup: { icon: Flame, color: "text-orange-500", bg: "bg-orange-500/10", border: "border-orange-500/20", label: "Aquecimento" },
  failure: { icon: Activity, color: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/20", label: "Falha" },
  drop: { icon: ArrowDown, color: "text-purple-500", bg: "bg-purple-500/10", border: "border-purple-500/20", label: "Drop" },
  time: { icon: Clock, color: "text-cyan-500", bg: "bg-cyan-500/10", border: "border-cyan-500/20", label: "Tempo" },
};

// Componente de Contagem Regressiva de Descanso
function RestCountdown({ 
  defaultSeconds = 60, 
  onFinish 
}: { 
  defaultSeconds?: number; 
  onFinish: () => void; 
}) {
  const [total, setTotal] = useState(defaultSeconds);
  const [remaining, setRemaining] = useState(defaultSeconds);
  const [isRunning, setIsRunning] = useState(true);
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState(String(defaultSeconds));
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (!isRunning || remaining <= 0) return;
    const interval = setInterval(() => {
      setRemaining(r => {
        if (r <= 1) {
          clearInterval(interval);
          setIsRunning(false);
          setFinished(true);
          if ("vibrate" in navigator) navigator.vibrate([300, 100, 300, 100, 300]);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning, remaining]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const progress = total > 0 ? (remaining / total) : 0;
  const circumference = 2 * Math.PI * 28;
  const strokeDashoffset = circumference * (1 - progress);

  const handleEditSubmit = () => {
    const newVal = Math.max(5, Math.min(600, parseInt(inputVal) || defaultSeconds));
    setTotal(newVal);
    setRemaining(newVal);
    setIsRunning(true);
    setFinished(false);
    setEditing(false);
  };

  const handleAddTime = (secs: number) => {
    setRemaining(r => Math.max(1, r + secs));
    setTotal(t => Math.max(1, t + secs));
    setFinished(false);
    setIsRunning(true);
  };

  return (
    <div className={`mt-2 rounded-2xl overflow-hidden transition-all ${
      finished 
        ? "bg-emerald-500/10 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)]" 
        : isRunning 
          ? "bg-gradient-to-br from-red-950/90 via-zinc-950 to-zinc-950 border border-red-900/30 shadow-[0_0_20px_rgba(153,27,27,0.15)]" 
          : "bg-zinc-950/60 border border-zinc-800/40"
    }`}>
      <div className="flex items-center gap-3 p-3">
        {/* Ring Progress */}
        <div className="relative shrink-0">
          <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90">
            <circle
              cx="32" cy="32" r="28"
              fill="none"
              stroke="rgba(255,255,255,0.03)"
              strokeWidth="4"
            />
            <circle
              cx="32" cy="32" r="28"
              fill="none"
              stroke={finished ? "#10b981" : remaining <= 5 ? "#ef4444" : "#b91c1c"}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            {finished ? (
              <CheckCircle2 size={20} className="text-emerald-400" />
            ) : (
              <span className={`text-sm font-black tabular-nums leading-none ${
                remaining <= 5 ? "text-red-500 animate-pulse" : "text-white"
              }`}>
                {formatTime(remaining)}
              </span>
            )}
          </div>
        </div>

        {/* Info + Controls */}
        <div className="flex-1 min-w-0">
          {finished ? (
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-0.5">Pronto! 🔥</p>
              <p className="text-xs text-muted-foreground font-medium">Vá para a próxima série</p>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <Timer size={10} className="text-red-500" />
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Descanso</span>
              </div>
              {editing ? (
                <div className="flex items-center gap-1.5">
                  <input
                    autoFocus
                    type="number"
                    value={inputVal}
                    onChange={e => setInputVal(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleEditSubmit()}
                    onBlur={handleEditSubmit}
                    className="w-16 bg-red-950/40 border border-red-900/40 rounded-lg px-2 py-1 text-sm font-bold text-white outline-none text-center"
                    min={5} max={600}
                  />
                  <span className="text-xs text-muted-foreground">seg</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleAddTime(-15)}
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-zinc-800/60 text-zinc-400 hover:bg-red-900/40 hover:text-white transition-colors"
                  >-15s</button>
                  <button
                    onClick={() => setEditing(true)}
                    className="text-xs font-black text-white tabular-nums hover:text-red-500 transition-colors"
                  >
                    {formatTime(total)} total
                  </button>
                  <button
                    onClick={() => handleAddTime(15)}
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-zinc-800/60 text-zinc-400 hover:bg-red-900/40 hover:text-white transition-colors"
                  >+15s</button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-1.5 shrink-0">
          {finished ? (
            <button
              onClick={onFinish}
              className="h-9 px-3 bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-1.5 hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20"
            >
              <SkipForward size={12} /> OK
            </button>
          ) : (
            <>
              <button
                onClick={() => setIsRunning(r => !r)}
                className={`h-9 w-9 rounded-xl flex items-center justify-center transition-colors ${
                  isRunning 
                    ? "bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700" 
                    : "bg-red-500/20 text-red-500 hover:bg-red-500/30"
                }`}
              >
                {isRunning ? <Pause size={14} /> : <Play size={14} fill="currentColor" />}
              </button>
              <button
                onClick={onFinish}
                className="h-9 w-9 rounded-xl bg-zinc-800/50 text-zinc-500 hover:bg-red-900/20 hover:text-red-400 flex items-center justify-center transition-colors px-1"
                title="Pular"
              >
                <SkipForward size={14} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TimerWidget({ target, onComplete, isFinished, initialValue }: { target?: number, onComplete: (time: number) => void, isFinished: boolean, initialValue?: number }) {
  const [seconds, setSeconds] = useState(initialValue || 0);
  const [isActive, setIsActive] = useState(false);
  const [hasNotified, setHasNotified] = useState(false);

  useEffect(() => {
    let interval: any = null;
    if (isActive) {
      interval = setInterval(() => {
        setSeconds(s => s + 1);
      }, 1000);
    } else if (!isActive && seconds !== 0) {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isActive, seconds]);

  useEffect(() => {
    if (target && seconds >= target && !hasNotified) {
      setHasNotified(true);
      if ("vibrate" in navigator) navigator.vibrate([200, 100, 200]);
    }
  }, [seconds, target, hasNotified]);

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isFinished) {
    return (
      <div className="flex-1 flex items-center justify-center bg-primary/10 rounded-xl py-3 border border-primary/20">
        <span className="text-sm font-black text-primary uppercase">Tempo: {formatTime(initialValue || seconds)}</span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center gap-3">
      <div className={`flex-1 h-12 flex flex-col items-center justify-center rounded-xl border transition-all ${seconds >= (target || 9999) ? "bg-primary/20 border-primary shadow-red-glow animate-pulse" : "bg-background/50 border-border/40"}`}>
        <span className="text-[8px] font-black uppercase text-muted-foreground leading-none mb-0.5">Tempo</span>
        <span className={`text-lg font-black leading-none ${seconds >= (target || 9999) ? "text-primary" : "text-foreground"}`}>{formatTime(seconds)}</span>
      </div>
      
      {!isActive && seconds === 0 ? (
        <button 
          onClick={() => setIsActive(true)}
          className="h-12 px-4 bg-primary text-white rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2"
        >
          <Play size={14} fill="currentColor" /> Start
        </button>
      ) : (
        <button 
          onClick={() => {
            setIsActive(false);
            onComplete(seconds);
          }}
          className="h-12 px-4 bg-foreground text-background rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2"
        >
          <CheckCircle2 size={16} /> Concluir
        </button>
      )}
    </div>
  );
}

function SetTypePicker({ 
  value, 
  onSelect, 
  isOpen, 
  onToggle 
}: { 
  value: keyof typeof SET_TYPES, 
  onSelect: (val: keyof typeof SET_TYPES) => void,
  isOpen: boolean,
  onToggle: () => void
}) {
  const current = SET_TYPES[value] || SET_TYPES.normal;
  const Icon = current.icon;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${current.bg} ${current.color} border ${current.border} shadow-sm active:scale-95`}
      >
        <Icon size={18} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-[60]" 
              onClick={(e) => {
                e.stopPropagation();
                onToggle();
              }} 
            />
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute top-12 left-0 z-[100] bg-card border border-border shadow-2xl rounded-2xl p-1.5 min-w-[170px] overflow-hidden"
              >
                {Object.entries(SET_TYPES).map(([key, config]) => {
                  const OptionIcon = config.icon;
                  const isSelected = value === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(key as any);
                        onToggle();
                      }}
                      className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-xl transition-colors text-left ${isSelected ? `${config.bg} ${config.color} font-bold` : "hover:bg-muted text-muted-foreground"}`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${config.bg} ${config.color}`}>
                        <OptionIcon size={14} />
                      </div>
                      <span className="text-xs">{config.label}</span>
                    </button>
                  );
                })}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    );
  }

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
  const [hasHydrated, setHasHydrated] = useState(false);
  const [sessionLogs, setSessionLogs] = useState<Record<string, { weight: number, reps: number, completed: boolean }[]>>({});
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null);
  const [showExitModal, setShowExitModal] = useState(false);
  // Rest timer: key = `${exerciseId}-${setIndex}`
  const [activeRestKey, setActiveRestKey] = useState<string | null>(null);
  const [restDuration, setRestDuration] = useState(60); // segundos padrão de descanso

  // Formulários Treino
  const [showNewWorkout, setShowNewWorkout] = useState(false);
  const [newWorkoutName, setNewWorkoutName] = useState("");
  const [editingWorkoutId, setEditingWorkoutId] = useState<string | null>(null);
  const [editWorkoutName, setEditWorkoutName] = useState("");
  const [assigningDay, setAssigningDay] = useState<number | null>(null);

  // Formulários Exercícios
  const [showNewExercise, setShowNewExercise] = useState(false);
  const [activePickerId, setActivePickerId] = useState<string | null>(null);
  const [newExercise, setNewExercise] = useState({ 
    name: "", 
    sets_config: [{ weight: 0, reps: 10 }] as DBExerciseSet[]
  });

  // Edição de Exercícios
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);
  const [editExerciseData, setEditExerciseData] = useState({ 
    name: "", 
    sets_config: [] as DBExerciseSet[]
  });

  // Pull to Refresh
  const { pullProgress, refreshing: ptRefreshing } = usePullToRefresh({
    onRefresh: async () => {
      if (user) await fetchWorkouts(user.id);
    }
  });

  // Autenticação & Carregamento Inicial
  useEffect(() => {
    if (user?.id) {
      const userId = user.id;
      // 1. Optimistic UI: Carregar dados do cache instantaneamente
      const cachedWorkouts = cache.get<DBWorkout[]>(`workout_list_${userId}`);
      const cachedSchedule = cache.get<DBWeeklySchedule[]>(`weekly_schedule_${userId}`);
      if (cachedWorkouts) setWorkouts(cachedWorkouts);
      if (cachedSchedule) setSchedule(cachedSchedule);
      
      fetchWorkouts(userId);
      
      // 2. Predictive Navigation: Pré-carregar dados da aba Evolução em background
      prefetchEvolution(userId);
    } else {
      setLoading(false);
    }
  }, [user?.id]);

  const prefetchEvolution = async (userId: string) => {
    try {
       // Puxa as fichas para a evolução
       const { data: evolutionWorkouts } = await supabase
         .from('workouts')
         .select('id, name')
         .eq('user_id', userId)
         .order('created_at', { ascending: true });
       
       if (evolutionWorkouts) {
         cache.set(`evolution_workouts_${userId}`, evolutionWorkouts);
         // Puxa os dados do gráfico da primeira ficha (mais provável ser visualizada)
         if (evolutionWorkouts.length > 0) {
           const firstId = evolutionWorkouts[0].id;
           const { data: progression } = await supabase
             .from('user_exercise_progression')
             .select('*')
             .eq('workout_id', firstId)
             .eq('user_id', userId)
             .order('training_day', { ascending: true });
           
           if (progression) {
             const grouped: Record<string, { name: string; data: any[] }> = {};
             progression.forEach((row) => {
               if (!grouped[row.exercise_id]) {
                 grouped[row.exercise_id] = { name: row.exercise_name, data: [] };
               }
               const dateObj = new Date(row.training_day);
               const formattedDate = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
               grouped[row.exercise_id].data.push({ date: formattedDate, weight: Number(row.max_weight) });
             });
             cache.set(`evolution_chart_${firstId}_${userId}`, grouped);
           }
         }
       }
    } catch(e) {}
  };

  const fetchWorkouts = async (userId: string) => {
    setLoading(true);
    try {
      const [workoutsRes, scheduleRes] = await Promise.all([
        supabase.from('workouts').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
        supabase.from('weekly_schedule').select('*').eq('user_id', userId)
      ]);

      if (workoutsRes.error) toast.error("Erro ao puxar treinos.");
      else {
        setWorkouts(workoutsRes.data || []);
        cache.set(`workout_list_${userId}`, workoutsRes.data);
      }

      if (scheduleRes.error) {
        toast.error("Erro ao puxar agenda.");
      } else {
        setSchedule(scheduleRes.data || []);
        cache.set(`weekly_schedule_${userId}`, scheduleRes.data);
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
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Função de Atualização de Set Log
  const updateSetLog = (exerciseId: string, setIndex: number, field: 'weight' | 'reps' | 'completed' | 'realized_duration', value: number | boolean) => {
    setSessionLogs(prev => {
      const currentLogs = [...(prev[exerciseId] || [])];
      currentLogs[setIndex] = { ...currentLogs[setIndex], [field]: value };
      const newSessionLogs = { ...prev, [exerciseId]: currentLogs };
      
      if (field === 'completed' && value === true) {
        const allSetsCompleted = currentLogs.every(s => s.completed);
        // Disparar contador de descanso se houver próxima série no mesmo exercício
        const hasNextSet = setIndex < currentLogs.length - 1;
        if (hasNextSet && !allSetsCompleted) {
          setTimeout(() => setActiveRestKey(`${exerciseId}-${setIndex}`), 150);
        }
        if (allSetsCompleted) {
          setActiveRestKey(null);
          const currentIndex = todayExercises.findIndex(ex => ex.id === exerciseId);
          if (currentIndex !== -1 && currentIndex < todayExercises.length - 1) {
            setTimeout(() => setExpandedExerciseId(todayExercises[currentIndex + 1].id), 300);
          } else if (allSetsCompleted) {
            setTimeout(() => setExpandedExerciseId(null), 300);
          }
        }
      }
      // Ao desmarcar série, remove o descanso ativo deste set
      if (field === 'completed' && value === false) {
        setActiveRestKey(prev2 => prev2 === `${exerciseId}-${setIndex}` ? null : prev2);
      }
      return newSessionLogs;
    });
  };

  // 4. Hydration: Restaurar estado do rascunho de hoje via localStorage
  useEffect(() => {
    if (todayWorkout && todayExercises.length > 0 && !hasHydrated && user?.id) {
      const saved = localStorage.getItem(`evolve_workout_state_${user.id}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          const todayStr = new Date().toISOString().split('T')[0];
          if (parsed.date === todayStr && parsed.workoutId === todayWorkout.id) {
            setWorkoutStarted(parsed.started || false);
            if (parsed.sessionLogs) setSessionLogs(parsed.sessionLogs);
            else setCompletedExercises(parsed.completed || []);
          } else {
            localStorage.removeItem(`evolve_workout_state_${user.id}`);
          }
        } catch(e) {}
      }
      setHasHydrated(true);
    }
  }, [todayWorkout, todayExercises, hasHydrated, user?.id]);

  // Persistência Atômica do Andamento (Salvar Offline e Sync Background)
  useEffect(() => {
    if (todayWorkout && user?.id) {
      const todayStr = new Date().toISOString().split('T')[0];
      const draftPayload = {
        date: todayStr,
        workoutId: todayWorkout.id,
        started: workoutStarted,
        sessionLogs: sessionLogs
      };

      if (workoutStarted || Object.keys(sessionLogs).length > 0) {
        localStorage.setItem(`evolve_workout_state_${user.id}`, JSON.stringify(draftPayload));
        
        if (session?.user) {
          supabase.from('workout_drafts').upsert({
            user_id: session.user.id,
            workout_id: todayWorkout.id,
            payload: draftPayload,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id,workout_id' }).then(({ error }) => {
            if (error && error.code !== '42P01') console.warn("Draft sync error:", error.message);
          });
        }
      }
    }
  }, [workoutStarted, sessionLogs, todayWorkout, session, user?.id]);

  const handleCancelWorkout = () => {
    setShowExitModal(true);
  };

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

    // 1. Criar objeto otimista temporário (id temporário)
    const tempId = crypto.randomUUID();
    const optimisticExercise: DBExercise = {
      id: tempId,
      workout_id: activeWorkout.id,
      name: newExercise.name.trim(),
      sets: newExercise.sets_config.length,
      sets_config: newExercise.sets_config,
      weight: Math.max(...newExercise.sets_config.map(s => s.weight || 0), 0),
      reps: newExercise.sets_config[0]?.reps || 0
    };

    // 2. Atualizar UI instantaneamente
    setExercises(prev => [...prev, optimisticExercise]);
    
    // Se estiver editando a ficha que é o treino de hoje, atualiza lá também
    if (todayWorkout?.id === activeWorkout.id) {
      setTodayExercises(prev => [...prev, optimisticExercise]);
    }

    setShowNewExercise(false);
    setNewExercise({ name: "", sets_config: [{ weight: 0, reps: 10 }] });

    try {
      const { data, error } = await supabase.from('exercises').insert([{
        workout_id: activeWorkout.id,
        name: optimisticExercise.name,
        sets: optimisticExercise.sets,
        sets_config: optimisticExercise.sets_config,
        order_index: exercises.length
      }]).select();

      if (error) throw error;
      
      // 3. Substituir o objeto otimista pelo real (com ID do banco)
      setExercises(prev => prev.map(ex => ex.id === tempId ? data[0] : ex));
      if (todayWorkout?.id === activeWorkout.id) {
        setTodayExercises(prev => prev.map(ex => ex.id === tempId ? data[0] : ex));
      }
      
      toast.success("Exercício adicionado!");
    } catch (err: any) {
      // Rollback em caso de erro
      setExercises(prev => prev.filter(ex => ex.id !== tempId));
      if (todayWorkout?.id === activeWorkout.id) {
        setTodayExercises(prev => prev.filter(ex => ex.id !== tempId));
      }
      toast.error("Erro ao salvar exercício.");
    }
  };

  const handleDeleteExercise = async (id: string) => {
    // Optimistic delete
    const previousExercises = [...exercises];
    setExercises(prev => prev.filter(e => e.id !== id));
    setTodayExercises(prev => prev.filter(e => e.id !== id));

    const { error } = await supabase.from('exercises').delete().eq('id', id);
    if (error) {
      toast.error("Erro ao remover.");
      setExercises(previousExercises);
      // Re-fill today exercises if needed
      if (todayWorkout) {
         const { data: excs } = await supabase.from('exercises').select('*').eq('workout_id', todayWorkout.id).order('order_index');
         setTodayExercises(excs || []);
      }
    }
  };

  const handleStartEdit = (exc: DBExercise) => {
    setEditingExerciseId(exc.id);
    
    // Se não tiver sets_config, cria um a partir dos dados legados
    let setsConfig = exc.sets_config;
    if (!setsConfig || !Array.isArray(setsConfig) || setsConfig.length === 0) {
      setsConfig = Array.from({ length: exc.sets || 1 }, () => ({
        weight: exc.weight || 0,
        reps: exc.reps || 10
      }));
    }

    setEditExerciseData({
      name: exc.name,
      sets_config: setsConfig
    });
  };

  const handleStartWorkout = () => {
    setWorkoutStarted(true);
    if (Object.keys(sessionLogs).length === 0) {
      const initialLogs: Record<string, { weight: number, reps: number, completed: boolean }[]> = {};
      todayExercises.forEach(ex => {
        // Se tiver sets_config, usa ele. Se não, fallback para o antigo sets
        if (ex.sets_config && Array.isArray(ex.sets_config) && ex.sets_config.length > 0) {
          initialLogs[ex.id] = ex.sets_config.map(s => ({
            weight: s.weight || 0,
            reps: s.reps || 0,
            completed: false,
            set_type: s.set_type || 'normal',
            target_duration: s.target_duration
          }));
        } else {
          initialLogs[ex.id] = Array.from({ length: ex.sets }, () => ({
            weight: ex.weight || 0,
            reps: ex.reps || 0,
            completed: false,
            set_type: 'normal'
          }));
        }
      });
      setSessionLogs(initialLogs);
      if (todayExercises.length > 0) {
        setExpandedExerciseId(todayExercises[0].id);
      }
    }
  };

  const processFinishWorkout = async (updateTemplates: boolean) => {
    if (!todayWorkout || !session) return;
    setFinishingWorkout(true);
    setShowExitModal(false);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const completedExsCount = todayExercises.filter(ex => sessionLogs[ex.id]?.length > 0 && sessionLogs[ex.id].every(s => s.completed)).length;
      const isWorkoutFinishedReady = completedExsCount === todayExercises.length && todayExercises.length > 0;
      
      // --- LÓGICA DE REGISTRO CONDICIONAL ---
      // Apenas registra no histórico/streak se:
      // 1. O treino foi concluído por completo (isWorkoutFinishedReady) 
      // 2. OU o usuário escolheu explicitamente "Atualizar e Sair" (updateTemplates)
      const shouldRegisterHistory = updateTemplates || isWorkoutFinishedReady;

      if (shouldRegisterHistory) {
        // 1. Atualizar Templates (Fichas Master) se solicitado
        if (updateTemplates) {
          const updatePromises = todayExercises.map(ex => {
            const logs = sessionLogs[ex.id];
            if (!logs) return null;
            const newSetsConfig = logs.map(s => ({
              weight: s.weight,
              reps: s.reps,
              set_type: (s as any).set_type || 'normal',
              target_duration: (s as any).target_duration
            }));
            return supabase.from('exercises').update({ 
              sets_config: newSetsConfig,
              sets: newSetsConfig.length,
              weight: Math.max(...newSetsConfig.map(s => s.weight || 0), 0),
              reps: newSetsConfig[0]?.reps || 0
            }).eq('id', ex.id);
          }).filter(Boolean);
          
          await Promise.all(updatePromises);
          
          // Atualização Otimista local
          const updateState = (prev: DBExercise[]) => prev.map(ex => {
            const logs = sessionLogs[ex.id];
            if (!logs) return ex;
            return {
              ...ex,
              sets_config: logs.map(s => ({ 
                weight: s.weight, 
                reps: s.reps, 
                set_type: (s as any).set_type || 'normal', 
                target_duration: (s as any).target_duration 
              })),
              sets: logs.length,
              weight: Math.max(...logs.map(s => s.weight || 0), 0),
              reps: logs[0]?.reps || 0
            };
          });
          setTodayExercises(prev => updateState(prev));
          if (activeWorkout?.id === todayWorkout.id) setExercises(prev => updateState(prev));
        }

        // 2. Inserir no Histórico
        const { data: historyData, error: historyError } = await supabase.from('workout_history').insert([{
          user_id: session.user.id,
          workout_id: todayWorkout.id
        }]).select('id').single();

        if (historyError) throw historyError;

        // 3. Inserir Logs individuais
        if (historyData?.id && Object.keys(sessionLogs).length > 0) {
          const logsToInsert = [];
          for (const [exerciseId, sets] of Object.entries(sessionLogs)) {
            for (const set of sets) {
              if (set.completed) {
                logsToInsert.push({
                  history_id: historyData.id,
                  exercise_id: exerciseId,
                  weight: set.weight,
                  reps: set.reps,
                  set_type: (set as any).set_type,
                  realized_duration: (set as any).realized_duration
                });
              }
            }
          }
          if (logsToInsert.length > 0) {
            await supabase.from('workout_logs').insert(logsToInsert);
          }
        }

        // 4. Processar Streak e XP via RPC
        const { data: rpcResult, error: rpcError } = await supabase.rpc('process_workout_completion', {
          p_user_id: session.user.id,
          p_client_date: todayStr
        });

        if (rpcError) throw rpcError;

        const result = rpcResult as any;

        // 5. Feedback Visual e Conquistas
        if (result && result.is_first_of_day) {
          await supabase.from('community_events').insert([{
            user_id: session.user.id,
            event_type: 'workout',
            title: `Finalizou o treino: ${todayWorkout.name}`,
            description: `Completou sua ${result.total_sessions}ª sessão de treino! 🔥`,
            metadata: { workout_name: todayWorkout.name, total_sessions: result.total_sessions }
          }]);
          
          await checkAndAwardAchievements(session.user.id);

          // Atualizar Cache
          const cachedDashboard = cache.get<any>(`dashboard_data_${session.user.id}`);
          if (cachedDashboard) {
            cachedDashboard.stats = {
              ...cachedDashboard.stats,
              streak: result.new_streak,
              xp: result.new_xp,
              level: result.new_level,
              total_sessions: result.total_sessions
            };
            cachedDashboard.workoutsThisWeek = (cachedDashboard.workoutsThisWeek || 0) + 1;
            cache.set(`dashboard_data_${session.user.id}`, cachedDashboard);
          }
        }
        toast.success(isWorkoutFinishedReady ? "Treino Finalizado com Sucesso! 💪🔥" : "Progresso Salvo com Sucesso!");
      } else {
        toast.info("Sessão encerrada sem salvar no histórico.");
      }

      // --- LIMPEZA FINAL (Sempre ocorre) ---
      setWorkoutStarted(false);
      setCompletedExercises([]);
      setSessionLogs({});
      setExpandedExerciseId(null);
      setShowExitModal(false);
      if (user?.id) localStorage.removeItem(`evolve_workout_state_${user.id}`);
      if (todayWorkout && user?.id) {
        supabase.from('workout_drafts').delete().eq('user_id', user.id).eq('workout_id', todayWorkout.id).then();
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar histórico.");
    }
    setFinishingWorkout(false);
  };

  const handleUpdateExercise = async (id: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!editExerciseData.name.trim()) return;

    // 1. Preparar Payload e Objeto Otimista
    const updatedSetsConfig = editExerciseData.sets_config;
    const optimisticUpdate = {
      name: editExerciseData.name.trim(),
      sets: updatedSetsConfig.length,
      sets_config: updatedSetsConfig,
      weight: Math.max(...updatedSetsConfig.map(s => s.weight || 0), 0),
      reps: updatedSetsConfig[0]?.reps || 0
    };

    // 2. Atualização Local Otimista (nas duas listas se necessário)
    setExercises(prev => prev.map(exc => exc.id === id ? { ...exc, ...optimisticUpdate } : exc));
    setTodayExercises(prev => prev.map(exc => exc.id === id ? { ...exc, ...optimisticUpdate } : exc));
    setEditingExerciseId(null);

    try {
      const { data, error } = await supabase.from('exercises').update({
        name: optimisticUpdate.name,
        sets: optimisticUpdate.sets,
        sets_config: optimisticUpdate.sets_config,
        weight: optimisticUpdate.weight,
        reps: optimisticUpdate.reps
      }).eq('id', id).select();

      if (error) throw error;
      
      // Sincronizar com o dado real do banco por segurança
      if (data && data[0]) {
        setExercises(prev => prev.map(exc => exc.id === id ? data[0] : exc));
        setTodayExercises(prev => prev.map(exc => exc.id === id ? data[0] : exc));
      }
      
      toast.success("Exercício atualizado!");
    } catch (err: any) {
      toast.error("Erro ao atualizar exercício.");
      // Forçar re-sync em caso de falha crítica
      if (user?.id) fetchWorkouts(user.id);
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
      <PullToRefreshIndicator pullProgress={pullProgress} refreshing={ptRefreshing} />
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
                      {(() => {
                        const completedExsCount = todayExercises.filter(ex => sessionLogs[ex.id]?.length > 0 && sessionLogs[ex.id].every(s => s.completed)).length;
                        const isWorkoutFinishedReady = completedExsCount === todayExercises.length && todayExercises.length > 0;
                        return (
                          <>
                            <div className="flex items-center justify-between mb-2">
                              <h2 className="text-2xl font-display font-semibold text-foreground">{todayWorkout.name}</h2>
                              {workoutStarted && (
                                <span className="text-xs font-semibold px-3 py-1 bg-primary/10 text-primary rounded-full">
                                  {completedExsCount}/{todayExercises.length} concluídos
                                </span>
                              )}
                            </div>
                      
                      <div className="space-y-3 mb-8">
                        {todayExercises.map((exc) => {
                          if (!workoutStarted) {
                            const setsToDisplay = exc.sets_config && exc.sets_config.length > 0 
                              ? exc.sets_config 
                              : Array.from({ length: exc.sets }, () => ({ weight: exc.weight, reps: exc.reps }));

                            return (
                              <div key={exc.id} className="bg-card border border-border/40 rounded-2xl p-4 shadow-sm flex flex-col gap-3">
                                <div className="flex-1">
                                  <p className="text-base font-black uppercase tracking-tight text-foreground">{exc.name}</p>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                  {setsToDisplay.map((s: any, idx) => {
                                    const meta = SET_TYPES[s.set_type as keyof typeof SET_TYPES] || SET_TYPES.normal;
                                    const Icon = meta.icon;
                                    return (
                                      <div key={idx} className={`relative flex flex-col items-center justify-center py-2 px-1 rounded-xl border ${meta.bg} ${meta.border} transition-all overflow-hidden group`}>
                                        <div className={`absolute -top-1 -right-1 opacity-10 group-hover:opacity-20 transition-opacity ${meta.color}`}>
                                          <Icon size={28} />
                                        </div>
                                        <div className="flex items-center gap-1 mb-0.5 relative z-10">
                                          <Icon size={8} className={meta.color} />
                                          <span className="text-[7px] font-black uppercase tracking-tighter text-muted-foreground">SET {idx+1}</span>
                                        </div>
                                        <span className="text-[10px] font-black text-foreground leading-none relative z-10">
                                          {s.set_type === 'time' ? `${(s as any).target_duration || 0}s` : `${s.weight || 0}k × ${s.reps || 0}`}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          }

                          const logs = sessionLogs[exc.id] || [];
                          const isDone = logs.length > 0 && logs.every(s => s.completed);
                          const isExpanded = expandedExerciseId === exc.id;

                          return (
                            <div 
                              key={exc.id} 
                              className={`bg-card border transition-all ${isDone ? "border-primary/50 bg-primary/5" : "border-border/40"} rounded-2xl p-4 shadow-sm flex flex-col gap-3`}
                            >
                              <div 
                                onClick={() => setExpandedExerciseId(isExpanded ? null : exc.id)}
                                className="flex items-center gap-4 cursor-pointer"
                              >
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${isDone ? "text-primary bg-primary/10" : "text-muted-foreground/40"}`}>
                                  {isDone ? <CheckCircle2 size={16} /> : <Circle size={16} strokeWidth={1.5} />}
                                </div>
                                <div className="flex-1 flex items-center justify-between">
                                  <p className={`text-base font-black uppercase tracking-tight ${isDone ? "text-foreground line-through opacity-40" : "text-foreground"}`}>
                                    {exc.name}
                                  </p>
                                  <ChevronRight size={20} className={`text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                                </div>
                              </div>

                              <AnimatePresence>
                                {isExpanded && (
                                  <motion.div 
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="mt-2 space-y-2 overflow-hidden"
                                  >
                                    {logs.map((set, setIndex) => {
                                      const meta = SET_TYPES[(set as any).set_type as keyof typeof SET_TYPES] || SET_TYPES.normal;
                                      const Icon = meta.icon;
                                      const restKey = `${exc.id}-${setIndex}`;
                                      const isRestActive = activeRestKey === restKey;

                                      return (
                                      <div key={setIndex}>
                                        <div className={`flex items-center gap-3 p-3 rounded-xl border ${set.completed ? "bg-primary/10 border-primary/20" : "bg-muted/30 border-border/10"} transition-colors`}>
                                          <div className="w-8 flex flex-col items-center justify-center gap-1">
                                            <div className={`w-7 h-7 rounded-lg ${meta.bg} flex items-center justify-center shrink-0`}>
                                              <Icon size={14} className={meta.color} />
                                            </div>
                                            <span className="text-[8px] font-black text-muted-foreground uppercase">S{setIndex+1}</span>
                                          </div>
                                          
                                          {(set as any).set_type === 'time' ? (
                                            <TimerWidget 
                                              target={(set as any).target_duration} 
                                              isFinished={set.completed}
                                              initialValue={(set as any).realized_duration}
                                              onComplete={(time) => {
                                                updateSetLog(exc.id, setIndex, 'realized_duration', time);
                                                updateSetLog(exc.id, setIndex, 'completed', true);
                                              }} 
                                            />
                                          ) : (
                                            <>
                                              <div className="flex-1 flex gap-2">
                                                <div className="flex-1 flex flex-col bg-background/50 rounded-lg p-1.5 focus-within:ring-1 ring-primary/30">
                                                  <span className="text-[9px] font-bold text-muted-foreground ml-1">KG</span>
                                                  <input 
                                                    type="number" 
                                                    value={set.weight || ''}
                                                    disabled={set.completed}
                                                    onChange={(e) => updateSetLog(exc.id, setIndex, 'weight', Number(e.target.value))}
                                                    className="bg-transparent text-sm font-semibold w-full outline-none px-1 text-center disabled:opacity-50"
                                                  />
                                                </div>
                                                <div className="flex-1 flex flex-col bg-background/50 rounded-lg p-1.5 focus-within:ring-1 ring-primary/30">
                                                  <span className="text-[9px] font-bold text-muted-foreground ml-1">REPS</span>
                                                  <input 
                                                    type="number" 
                                                    value={set.reps || ''}
                                                    disabled={set.completed}
                                                    onChange={(e) => updateSetLog(exc.id, setIndex, 'reps', Number(e.target.value))}
                                                    className="bg-transparent text-sm font-semibold w-full outline-none px-1 text-center disabled:opacity-50"
                                                  />
                                                </div>
                                              </div>

                                              <button 
                                                onClick={() => updateSetLog(exc.id, setIndex, 'completed', !set.completed)}
                                                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors shrink-0 ${set.completed ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-primary/20 hover:text-primary"}`}
                                              >
                                                <CheckCircle2 size={20} className={set.completed ? "fill-primary-foreground/20" : ""} />
                                              </button>
                                            </>
                                          )}
                                        </div>

                                        {/* Contador de Descanso entre Séries */}
                                        <AnimatePresence>
                                          {isRestActive && (
                                            <motion.div
                                              key={restKey}
                                              initial={{ opacity: 0, height: 0, scale: 0.95 }}
                                              animate={{ opacity: 1, height: 'auto', scale: 1 }}
                                              exit={{ opacity: 0, height: 0, scale: 0.95 }}
                                              transition={{ duration: 0.25, ease: 'easeOut' }}
                                              className="overflow-hidden"
                                            >
                                              <RestCountdown
                                                key={restKey}
                                                defaultSeconds={restDuration}
                                                onFinish={() => setActiveRestKey(null)}
                                              />
                                            </motion.div>
                                          )}
                                        </AnimatePresence>
                                      </div>
                                      );
                                    })}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        })}
                      </div>

                      {/* Espaçador Dinâmico para o FAB não cobrir as últimas listas */}
                      <div className="h-44"></div>

                      <AnimatePresence>
                        <motion.div 
                          initial={{ y: 100, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          exit={{ y: 100, opacity: 0 }}
                          className="fixed bottom-20 left-0 right-0 px-5 z-40 pointer-events-none"
                        >
                          <div className="max-w-md mx-auto bg-background/80 backdrop-blur-xl border border-border/50 p-4 rounded-[32px] shadow-[0_8px_32px_rgba(0,0,0,0.12)] pointer-events-auto">
                            {!workoutStarted ? (
                              <button 
                                onClick={handleStartWorkout} 
                                className="w-full bg-primary text-primary-foreground py-4 rounded-3xl font-black uppercase tracking-widest shadow-[0_0_20px_rgba(255,59,48,0.3)] text-sm flex items-center justify-center gap-2 transition-transform hover:scale-[1.02] active:scale-[0.98]"
                              >
                                <Play size={18} fill="currentColor" /> COMEÇAR TREINO
                              </button>
                            ) : (
                              <div className="flex gap-3">
                                <button 
                                  onClick={handleCancelWorkout}
                                  className="w-14 h-14 bg-foreground border border-border/20 text-background hover:bg-destructive hover:text-destructive-foreground rounded-2xl transition-colors flex items-center justify-center shrink-0 shadow-sm"
                                >
                                  <Trash2 size={20} />
                                </button>
                                <button 
                                  onClick={() => processFinishWorkout(true)}
                                  disabled={!isWorkoutFinishedReady || finishingWorkout}
                                  className={`flex-1 h-14 rounded-2xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 transition-all shadow-elevated
                                    ${isWorkoutFinishedReady 
                                      ? "bg-primary text-primary-foreground shadow-[0_0_20px_rgba(255,59,48,0.3)] hover:scale-[1.02] active:scale-[0.98]" 
                                      : "bg-muted text-muted-foreground opacity-50 cursor-not-allowed"
                                    }`}
                                >
                                  {finishingWorkout ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={18} />}
                                  {isWorkoutFinishedReady ? "FINALIZAR" : "EM ANDAMENTO"}
                                </button>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      </AnimatePresence>
                          </>
                        );
                      })()}
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
                          <div className="space-y-4 mb-4">
                            <input
                              autoFocus
                              type="text"
                              placeholder="Nome do Exercício"
                              required
                              value={editExerciseData.name}
                              onChange={(e) => setEditExerciseData({...editExerciseData, name: e.target.value})}
                              className="w-full bg-muted/50 border border-border/40 rounded-xl px-4 py-3 outline-none focus:border-foreground transition-colors font-medium"
                            />
                            
                            <div className="space-y-2">
                               <label className="text-[10px] uppercase text-muted-foreground font-black tracking-widest px-1">Gestão de Séries</label>
                               <div className="space-y-2 pr-1 pb-20">
                                 {editExerciseData.sets_config.map((set, idx) => (
                                   <div key={idx} className="flex items-center gap-2 bg-muted/20 p-2 rounded-xl border border-border/10">
                                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                        <span className="text-[10px] font-black text-muted-foreground">S{idx+1}</span>
                                      </div>
                                      <div className="flex-1 flex items-center gap-2">
                                          <SetTypePicker 
                                            value={(set.set_type || 'normal') as keyof typeof SET_TYPES}
                                            isOpen={activePickerId === `edit-${idx}`}
                                            onToggle={() => setActivePickerId(activePickerId === `edit-${idx}` ? null : `edit-${idx}`)}
                                            onSelect={(val) => {
                                              const newSets = [...editExerciseData.sets_config];
                                              newSets[idx] = { ...newSets[idx], set_type: val };
                                              setEditExerciseData({ ...editExerciseData, sets_config: newSets });
                                            }}
                                          />
                                          
                                          <div className="flex-1 flex gap-1.5">
                                            {set.set_type === 'time' ? (
                                              <div className="flex-1 flex flex-col bg-background/50 rounded-lg p-1.5 focus-within:ring-1 ring-primary/30 border border-border/10">
                                                <span className="text-[8px] font-bold text-muted-foreground uppercase text-center">Tempo (s)</span>
                                                <input 
                                                  type="number" 
                                                  value={set.target_duration ?? ''}
                                                  onChange={(e) => {
                                                    const newSets = [...editExerciseData.sets_config];
                                                    newSets[idx] = { ...newSets[idx], target_duration: Number(e.target.value) };
                                                    setEditExerciseData({ ...editExerciseData, sets_config: newSets });
                                                  }}
                                                  className="bg-transparent text-sm font-semibold w-full outline-none px-1 text-center"
                                                />
                                              </div>
                                            ) : (
                                              <>
                                                <div className="flex-1 flex flex-col bg-background/50 rounded-lg p-1.5 focus-within:ring-1 ring-primary/30 border border-border/10">
                                                  <span className="text-[8px] font-bold text-muted-foreground uppercase text-center">KG</span>
                                                  <input 
                                                    type="number" 
                                                    value={set.weight ?? ''}
                                                    onChange={(e) => {
                                                      const newSets = [...editExerciseData.sets_config];
                                                      newSets[idx] = { ...newSets[idx], weight: Number(e.target.value) };
                                                      setEditExerciseData({ ...editExerciseData, sets_config: newSets });
                                                    }}
                                                    className="bg-transparent text-sm font-semibold w-full outline-none px-1 text-center"
                                                  />
                                                </div>
                                                <div className="flex-1 flex flex-col bg-background/50 rounded-lg p-1.5 focus-within:ring-1 ring-primary/30 border border-border/10">
                                                  <span className="text-[8px] font-bold text-muted-foreground uppercase text-center">Reps</span>
                                                  <input 
                                                    type="number" 
                                                    value={set.reps ?? ''}
                                                    onChange={(e) => {
                                                      const newSets = [...editExerciseData.sets_config];
                                                      newSets[idx] = { ...newSets[idx], reps: Number(e.target.value) };
                                                      setEditExerciseData({ ...editExerciseData, sets_config: newSets });
                                                    }}
                                                    className="bg-transparent text-sm font-semibold w-full outline-none px-1 text-center"
                                                  />
                                                </div>
                                              </>
                                            )}
                                          </div>

                                          <button 
                                            type="button"
                                            onClick={() => {
                                              const newSets = editExerciseData.sets_config.filter((_, i) => i !== idx);
                                              setEditExerciseData({ ...editExerciseData, sets_config: newSets });
                                            }}
                                            className="w-10 h-10 rounded-xl bg-destructive/5 text-destructive/30 flex items-center justify-center transition-colors hover:bg-destructive/10 hover:text-destructive shrink-0"
                                          >
                                            <Trash2 size={16} />
                                          </button>
                                       </div>
                                   </div>
                                 ))}
                                 <button 
                                   type="button"
                                   onClick={() => setEditExerciseData({ ...editExerciseData, sets_config: [...editExerciseData.sets_config, { weight: 0, reps: 10 }] })}
                                   className="w-full py-3 rounded-xl border-2 border-dashed border-border/40 text-muted-foreground hover:text-foreground hover:border-border/60 transition-all text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2"
                                 >
                                   <Plus size={14} /> Adicionar Série
                                 </button>
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
                              <p className="text-base font-black uppercase tracking-tight text-foreground">{exc.name}</p>
                              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-widest mt-1 opacity-60">Exercício {index + 1}</p>
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
                          
                          <div className="space-y-2">
                             <div className="grid grid-cols-3 gap-2">
                                {(exc.sets_config && exc.sets_config.length > 0 ? exc.sets_config : Array.from({ length: exc.sets }, () => ({ weight: exc.weight, reps: exc.reps }))).map((s, idx) => {
                                  const meta = SET_TYPES[(s as any).set_type as keyof typeof SET_TYPES] || SET_TYPES.normal;
                                  const Icon = meta.icon;
                                  return (
                                  <div key={idx} className={`relative flex flex-col items-center justify-center p-2 rounded-2xl border ${meta.bg} ${meta.border} transition-all group overflow-hidden`}>
                                    <div className={`absolute -top-2 -right-2 opacity-10 group-hover:opacity-25 transition-opacity ${meta.color}`}>
                                      <Icon size={40} />
                                    </div>
                                    
                                    <div className="flex items-center gap-1 mb-1.5 relative z-10">
                                      <div className={`p-1 rounded-md ${meta.bg} ${meta.color} border ${meta.border}`}>
                                        <Icon size={10} />
                                      </div>
                                      <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">S{idx+1}</span>
                                    </div>

                                    <div className="flex flex-col items-center leading-none relative z-10">
                                       {(s as any).set_type === 'time' ? (
                                         <div className="flex items-baseline gap-0.5">
                                            <span className="text-sm font-display font-black text-foreground">{(s as any).target_duration || 0}</span>
                                            <span className="text-[8px] font-bold text-muted-foreground uppercase">seg</span>
                                         </div>
                                       ) : (
                                         <div className="space-y-0.5 flex flex-col items-center">
                                           <div className="flex items-baseline gap-0.5">
                                              <span className="text-sm font-display font-black text-foreground">{s.weight || 0}</span>
                                              <span className="text-[8px] font-bold text-muted-foreground uppercase">kg</span>
                                           </div>
                                           <div className="flex items-baseline gap-0.5 opacity-60">
                                              <span className="text-[10px] font-display font-bold text-foreground">{s.reps || 0}</span>
                                              <span className="text-[7px] font-bold text-muted-foreground uppercase">reps</span>
                                           </div>
                                         </div>
                                       )}
                                    </div>
                                  </div>
                                )})}
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
                      <div className="space-y-4 mb-4">
                        <input
                          autoFocus
                          type="text"
                          placeholder="Nome do Exercício"
                          required
                          value={newExercise.name}
                          onChange={(e) => setNewExercise({...newExercise, name: e.target.value})}
                          className="w-full bg-muted/50 border border-border/40 rounded-xl px-4 py-3 outline-none focus:border-foreground transition-colors font-medium"
                        />
                        
                        <div className="space-y-2">
                           <label className="text-[10px] uppercase text-muted-foreground font-black tracking-widest px-1">Configurar Séries</label>
                           <div className="space-y-2 pr-1 pb-20">
                             {newExercise.sets_config.map((set, idx) => (
                               <div key={idx} className="flex items-center gap-2 bg-muted/20 p-2 rounded-xl border border-border/10 relative z-[100]">
                                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                    <span className="text-[10px] font-black text-muted-foreground">S{idx+1}</span>
                                  </div>
                                  <div className="flex-1 flex items-center gap-2">
                                          <SetTypePicker 
                                            value={(set.set_type || 'normal') as keyof typeof SET_TYPES}
                                            isOpen={activePickerId === `new-${idx}`}
                                            onToggle={() => setActivePickerId(activePickerId === `new-${idx}` ? null : `new-${idx}`)}
                                            onSelect={(val) => {
                                              const newSets = [...newExercise.sets_config];
                                              newSets[idx] = { ...newSets[idx], set_type: val };
                                              setNewExercise({ ...newExercise, sets_config: newSets });
                                            }}
                                          />
                                          
                                          <div className="flex-1 flex gap-1.5">
                                            {set.set_type === 'time' ? (
                                              <div className="flex-1 flex flex-col bg-background/50 rounded-lg p-1.5 focus-within:ring-1 ring-primary/30 border border-border/10">
                                                <span className="text-[8px] font-bold text-muted-foreground uppercase text-center">Tempo (s)</span>
                                                <input 
                                                  type="number" 
                                                  value={set.target_duration ?? ''}
                                                  onChange={(e) => {
                                                    const newSets = [...newExercise.sets_config];
                                                    newSets[idx] = { ...newSets[idx], target_duration: Number(e.target.value) };
                                                    setNewExercise({ ...newExercise, sets_config: newSets });
                                                  }}
                                                  className="bg-transparent text-sm font-semibold w-full outline-none px-1 text-center"
                                                />
                                              </div>
                                            ) : (
                                              <>
                                                <div className="flex-1 flex flex-col bg-background/50 rounded-lg p-1.5 focus-within:ring-1 ring-primary/30 border border-border/10">
                                                  <span className="text-[8px] font-bold text-muted-foreground uppercase text-center">KG</span>
                                                  <input 
                                                    type="number" 
                                                    value={set.weight ?? ''}
                                                    onChange={(e) => {
                                                      const newSets = [...newExercise.sets_config];
                                                      newSets[idx] = { ...newSets[idx], weight: Number(e.target.value) };
                                                      setNewExercise({ ...newExercise, sets_config: newSets });
                                                    }}
                                                    className="bg-transparent text-sm font-semibold w-full outline-none px-1 text-center"
                                                  />
                                                </div>
                                                <div className="flex-1 flex flex-col bg-background/50 rounded-lg p-1.5 focus-within:ring-1 ring-primary/30 border border-border/10">
                                                  <span className="text-[8px] font-bold text-muted-foreground uppercase text-center">Reps</span>
                                                  <input 
                                                    type="number" 
                                                    value={set.reps ?? ''}
                                                    onChange={(e) => {
                                                      const newSets = [...newExercise.sets_config];
                                                      newSets[idx] = { ...newSets[idx], reps: Number(e.target.value) };
                                                      setNewExercise({ ...newExercise, sets_config: newSets });
                                                    }}
                                                    className="bg-transparent text-sm font-semibold w-full outline-none px-1 text-center"
                                                  />
                                                </div>
                                              </>
                                            )}
                                          </div>

                                          <button 
                                            type="button"
                                            onClick={() => {
                                              const newSets = newExercise.sets_config.filter((_, i) => i !== idx);
                                              setNewExercise({ ...newExercise, sets_config: newSets });
                                            }}
                                            className="w-10 h-10 rounded-xl bg-destructive/5 text-destructive/30 flex items-center justify-center transition-colors hover:bg-destructive/10 hover:text-destructive shrink-0"
                                          >
                                            <Trash2 size={16} />
                                          </button>
                                       </div>
                               </div>
                             ))}
                             <button 
                               type="button"
                               onClick={() => setNewExercise({ ...newExercise, sets_config: [...newExercise.sets_config, { weight: 0, reps: 10 }] })}
                               className="w-full py-3 rounded-xl border-2 border-dashed border-border/40 text-muted-foreground hover:text-foreground hover:border-border/60 transition-all text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2"
                             >
                               <Plus size={14} /> Adicionar Série
                             </button>
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

      {/* Modal Premium de Saída Condicional */}
      <AnimatePresence>
        {showExitModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-5 bg-background/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-card border border-border/50 rounded-3xl p-6 w-full max-w-sm shadow-2xl flex flex-col items-center text-center"
            >
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                <Info size={28} className="text-destructive" />
              </div>
              <h3 className="text-xl font-display font-semibold text-foreground mb-2">Encerrar Sessão?</h3>
              <p className="text-sm text-muted-foreground mb-8">
                Você está prestes a sair sem finalizar todas as séries. Escolha como deseja tratar o progresso atingido:
              </p>
              
              <div className="w-full space-y-3">
                <button 
                  onClick={() => processFinishWorkout(true)}
                  disabled={finishingWorkout}
                  className="w-full py-3.5 rounded-xl font-semibold bg-foreground text-background hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-elevated disabled:opacity-50"
                >
                  Atualizar e Sair
                  <span className="block text-[10px] font-normal opacity-70">Salva e transfere suas novas cargas para a Ficha</span>
                </button>
                <button 
                  onClick={() => processFinishWorkout(false)}
                  disabled={finishingWorkout}
                  className="w-full py-3.5 rounded-xl font-semibold bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
                >
                  Finalizar sem Atualizar
                  <span className="block text-[10px] font-normal text-muted-foreground mt-0.5">Apenas salva o treino (útil para dias de Deload)</span>
                </button>
                <button 
                  onClick={() => setShowExitModal(false)}
                  className="w-full py-3.5 rounded-xl font-medium text-muted-foreground hover:text-foreground transition-colors mt-2"
                >
                  Continuar Treinando
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
