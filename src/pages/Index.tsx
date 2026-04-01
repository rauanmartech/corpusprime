import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, Flame, Calendar, Dumbbell, ArrowRight, Trophy, Zap, Clock, Activity, Loader2, Plus, Users, LayoutGrid, Ruler, Weight, Scissors } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { useNavigate } from "react-router-dom";
import StatsCard from "@/components/StatsCard";
import { supabase } from "@/lib/supabase";
import { cache } from "@/lib/cache";
import { useAuth } from "@/contexts/AuthContext";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "@/components/PullToRefreshIndicator";

export default function Index() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [rank, setRank] = useState("#--");
  const [measurements, setMeasurements] = useState<any>(null);
  const [recentWorkouts, setRecentWorkouts] = useState<any[]>([]);
  const [workoutsThisWeek, setWorkoutsThisWeek] = useState(0);
  const [todayWorkout, setTodayWorkout] = useState<any>(null);
  const [allMeasurements, setAllMeasurements] = useState<any[]>([]);

  // Pull to Refresh
  const { pullProgress, refreshing } = usePullToRefresh({
    onRefresh: async () => {
      await fetchDashboardData();
    }
  });

  useEffect(() => {
    if (!user?.id) return;
    const userId = user.id;

    // Camada de Cache Otimista: Tentar carregar dados instantaneamente
    const cached = cache.get<any>(`dashboard_data_${userId}`);
    if (cached) {
      setProfile(cached.profile);
      setStats(cached.stats);
      setRank(cached.rank);
      setMeasurements(cached.measurements);
      setRecentWorkouts(cached.recentWorkouts);
      setWorkoutsThisWeek(cached.workoutsThisWeek || 0);
      setTodayWorkout(cached.todayWorkout || null);
      setAllMeasurements(cached.allMeasurements || []);
      setLoading(false); // Mata a latência visual
    }
    
    fetchDashboardData();
  }, [user?.id]);

  const fetchDashboardData = async () => {
    if (!user?.id) return;
    const userId = user.id;

    try {
      // 1. Fetch Profile
      const { data: profileData } = await supabase.from('profiles').select('full_name, avatar_url').eq('id', userId).single();

      // 2. Fetch User Stats
      const { data: statsData } = await supabase.from('user_stats').select('*').eq('user_id', userId).single();

      // 3. Ranking total (Público, mas filtrado logicamente)
      const { data: allStats } = await supabase.from('user_stats').select('user_id, xp').order('xp', { ascending: false });
      const userRank = allStats?.findIndex(s => s.user_id === userId) + 1;

      // 4. Medidas
      const { data: allMeasures } = await supabase.from('body_measurements')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(10);
      
      const measureData = allMeasures && allMeasures.length > 0 ? allMeasures[allMeasures.length - 1] : null;
      setAllMeasurements(allMeasures || []);

      // 5. Histórico Recente
      const { data: historyData } = await supabase.from('workout_history')
        .select(`
          id,
          workout_id,
          completed_at,
          workouts (
            id,
            name
          )
        `)
        .eq('user_id', userId)
        .order('completed_at', { ascending: false })
        .limit(3);

      // 6. Treinos da Semana
      const now = new Date();
      const dayOfWeek = now.getDay();
      const lastSunday = new Date(now);
      lastSunday.setDate(now.getDate() - dayOfWeek);
      lastSunday.setHours(0,0,0,0);
      
      const { count: weeklyCount } = await supabase
        .from('workout_history')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('completed_at', lastSunday.toISOString());

      // 7. Treino de Hoje
      const today = new Date().getDay();
      const { data: todaySched } = await supabase
        .from('weekly_schedule')
        .select(`
          workout_id,
          workouts (
            id,
            name
          )
        `)
        .eq('user_id', userId)
        .eq('day_of_week', today)
        .maybeSingle();

      let exerciseCount = 0;
      if (todaySched?.workouts) {
        const { count } = await supabase
          .from('exercises')
          .select('*', { count: 'exact', head: true })
          .eq('workout_id', (todaySched.workouts as any).id);
        exerciseCount = count || 0;
      }

      const todayWorkoutData = todaySched?.workouts ? {
        ...(todaySched.workouts as any),
        exerciseCount
      } : null;

      const dashboardData = {
        profile: profileData,
        stats: statsData,
        rank: userRank > 0 ? `#${userRank}` : "#--",
        measurements: measureData,
        recentWorkouts: historyData || [],
        workoutsThisWeek: weeklyCount || 0,
        todayWorkout: todayWorkoutData,
        allMeasurements: allMeasures || []
      };

      // Update State
      setProfile(profileData);
      setStats(statsData);
      setRank(dashboardData.rank);
      setMeasurements(measureData);
      setRecentWorkouts(dashboardData.recentWorkouts);
      setWorkoutsThisWeek(dashboardData.workoutsThisWeek);
      setTodayWorkout(dashboardData.todayWorkout);
      
      // Update Cache (Chave por usuário)
      cache.set(`dashboard_data_${userId}`, dashboardData);
      
    } catch (e) {
      console.error("Dashboard fetch error:", e);
    } finally {
      setLoading(false);
    }
  };

  const initials = profile?.full_name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "AT";

  const todayDate = new Date().toLocaleDateString('pt-BR', { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'long' 
  });
  const formattedDate = todayDate.charAt(0).toUpperCase() + todayDate.slice(1);

  const leanMass = measurements?.weight && measurements?.body_fat 
    ? (measurements.weight * (1 - measurements.body_fat / 100)).toFixed(1) 
    : "--";

  const chartData = allMeasurements.map(m => ({
    date: new Date(m.created_at).toLocaleDateString("pt-BR", { day: '2-digit', month: 'short' }),
    peso: m.weight ? Number(m.weight) : undefined,
    gordura: m.body_fat ? Number(m.body_fat) : undefined,
    massa_magra: (m.weight && m.body_fat) ? Number((m.weight * (1 - m.body_fat / 100)).toFixed(1)) : undefined
  }));

  if (loading && !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="animate-spin text-blood-red" size={32} />
      </div>
    );
  }

  return (
    <div key="dashboard-page" className="min-h-screen bg-background pb-24">
      <PullToRefreshIndicator pullProgress={pullProgress} refreshing={refreshing} />
      {/* Welcome Section (Non-sticky) */}
      <div className="px-5 pt-12 pb-8 flex items-center justify-between">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <p className="text-sm text-muted-foreground mb-1 font-medium">Bom treino,</p>
          <h1 className="text-3xl font-display font-semibold text-foreground tracking-tight">
            {profile?.full_name || "Atleta"}!
          </h1>
        </motion.div>
        
        <button 
          onClick={() => navigate("/profile")}
          className="relative group transition-transform active:scale-95 shrink-0"
        >
          <div className="w-14 h-14 rounded-full bg-gradient-fire p-[2px] shadow-red-glow overflow-visible">
            <div className="w-full h-full bg-card rounded-full overflow-hidden flex items-center justify-center">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-lg font-display font-bold text-blood-red">{initials}</span>
              )}
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-success border-2 border-background rounded-full z-10" />
          </div>
        </button>
      </div>

      {/* Main Stats Summary */}
      <div className="px-5 grid grid-cols-2 gap-3 mb-8">
        <StatsCard icon={Flame} label="Streak" value={`${stats?.streak || 0} dias`} accent />
        <StatsCard icon={Dumbbell} label="Esta semana" value={String(workoutsThisWeek)} subtitle="treinos" />
        <StatsCard icon={Calendar} label="Total" value={String(stats?.total_sessions || 0)} subtitle="treinos" />
        <StatsCard icon={TrendingUp} label="Posição" value={rank} subtitle="Ranking" />
      </div>

      {/* Body Stats Replace Wearables */}
      <div className="px-5 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-display font-bold text-foreground flex items-center gap-2">
            <Ruler size={20} className="text-blood-red" /> Suas Medidas
          </h2>
          <button onClick={() => navigate("/profile")} className="text-xs font-bold text-blood-red flex items-center gap-1">
            VER HISTÓRICO <ArrowRight size={12} />
          </button>
        </div>
        
        <div className="grid grid-cols-3 gap-2">
           <div className="bg-card border border-border/40 rounded-3xl p-3 shadow-sm text-center flex flex-col items-center opacity-80">
             <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center mb-2">
               <Weight size={18} className="text-blue-500" />
             </div>
             <p className="text-[10px] text-muted-foreground uppercase font-black mb-1">PESO</p>
             <p className="text-base font-display font-black text-foreground leading-none">{measurements?.weight || "--"}<span className="text-[10px] ml-0.5 font-normal">kg</span></p>
           </div>

           <div className="bg-card border border-border/40 rounded-3xl p-3 shadow-sm text-center flex flex-col items-center opacity-80">
             <div className="w-8 h-8 rounded-xl bg-red-500/10 flex items-center justify-center mb-2">
               <Scissors size={18} className="text-red-500" />
             </div>
             <p className="text-[10px] text-muted-foreground uppercase font-black mb-1">GORDURA</p>
             <p className="text-base font-display font-black text-foreground leading-none">{measurements?.body_fat || "--"}<span className="text-[10px] ml-0.5 font-normal">%</span></p>
           </div>

           <div className="bg-card border border-border/40 rounded-3xl p-3 shadow-sm text-center flex flex-col items-center opacity-80">
             <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-2">
               <Activity size={18} className="text-emerald-500" />
             </div>
             <p className="text-[10px] text-muted-foreground uppercase font-black mb-1">M. MAGRA</p>
             <p className="text-base font-display font-black text-foreground leading-none">{leanMass}<span className="text-[10px] ml-0.5 font-normal">kg</span></p>
           </div>
        </div>
      </div>

      {/* Evolution Chart Integrated in Dashboard */}
      {allMeasurements.length > 1 && (
        <div className="px-5 mb-8">
          <div className="bg-card border border-border/40 rounded-[2rem] p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Gráfico de Evolução</p>
              <TrendingUp size={14} className="text-blood-red opacity-100" />
            </div>
            <div className="h-[180px] w-full">
              <ResponsiveContainer width="100%" height="100%" debounce={100}>
                <LineChart data={chartData} margin={{ top: 5, right: -15, left: -25, bottom: 0 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: "hsl(220 5% 60%)", fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" tickFormatter={(value) => `${value} kg`} tick={{ fontSize: 9, fill: "hsl(220 5% 60%)", fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="right" orientation="right" tickFormatter={(value) => `${value}%`} tick={{ fontSize: 9, fill: "hsl(220 5% 60%)", fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: "16px", border: "none", boxShadow: "0 10px 40px rgba(0,0,0,0.1)", fontSize: "11px", fontWeight: 'bold' }} />
                  <Legend verticalAlign="top" align="right" height={30} iconSize={6} wrapperStyle={{ fontSize: '8px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.05em' }} />
                  <Line yAxisId="left" type="monotone" dataKey="peso" stroke="#3B82F6" strokeWidth={3} dot={{ r: 2, fill: '#3B82F6' }} name="Peso" connectNulls />
                  <Line yAxisId="left" type="monotone" dataKey="massa_magra" stroke="#10B981" strokeWidth={3} dot={{ r: 2, fill: '#10B981' }} name="M. Magra" connectNulls />
                  <Line yAxisId="right" type="monotone" dataKey="gordura" stroke="#EF4444" strokeWidth={3} dot={{ r: 2, fill: '#EF4444' }} name="% Gord" connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Treino de Hoje Section */}
      <div className="px-5 mb-8">
        <div className="flex items-center justify-between mb-3 px-1">
           <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em]">
             {formattedDate}
           </p>
           <div className="text-muted-foreground/20">
              <Calendar size={13} strokeWidth={2.5} />
           </div>
        </div>

        {todayWorkout ? (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-black text-white rounded-[2rem] p-6 shadow-elevated relative overflow-hidden group flex items-center justify-between border border-white/10"
          >
            {/* Watermark */}
            <img
              src="/assets/corpus_isologo.png"
              alt=""
              aria-hidden="true"
              className="absolute left-0 top-0 h-full w-auto object-contain opacity-100 pointer-events-none select-none"
            />
            {/* Animated Background Element */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-blood-red/10 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-blood-red/20 transition-all duration-700" />
            
            <div className="relative z-10 flex-1 pr-4">
              <div className="flex items-center gap-2 mb-2">
                 <Dumbbell size={16} className="text-blood-red" />
                 <p className="text-[10px] text-white/50 font-black uppercase tracking-widest">Treino de Hoje</p>
              </div>
              <h3 className="text-2xl font-display font-black tracking-tight leading-tight text-white">
                {todayWorkout.name}
              </h3>
              <p className="text-[9px] text-white/40 font-bold uppercase mt-2 tracking-wider">
                1 Treino agendado • {todayWorkout.exerciseCount} exercícios
              </p>
            </div>

            <button 
              onClick={() => navigate("/workout")}
              className="relative z-10 w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-blood-red hover:bg-white/20 transition-all active:scale-95 shrink-0"
            >
              <ArrowRight size={24} strokeWidth={3} />
            </button>
          </motion.div>
        ) : (
          <div className="bg-black text-white rounded-[2rem] p-6 shadow-elevated flex items-center justify-between border border-white/10 relative overflow-hidden group">
             {/* Watermark */}
             <img
               src="/assets/corpus_isologo.png"
               alt=""
               aria-hidden="true"
               className="absolute left-0 top-0 h-full w-auto object-contain opacity-100 pointer-events-none select-none"
             />
             <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl opacity-50" />
             <div className="relative z-10 pr-4">
                <div className="flex items-center gap-2 mb-2">
                   <Calendar size={16} className="text-blood-red" />
                   <p className="text-[10px] text-white/50 font-black uppercase tracking-widest">Descanso Ativo</p>
                </div>
                <h3 className="text-xl font-display font-black text-white">Dia de Descanso</h3>
                <p className="text-[10px] text-white/40 font-bold uppercase mt-1 tracking-wider opacity-60">Recuperação e mobilidade</p>
             </div>
             <button 
               onClick={() => navigate("/workout")}
               className="relative z-10 w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-blood-red hover:bg-white/20 transition-all active:scale-95 shrink-0"
             >
               <ArrowRight size={24} strokeWidth={3} />
             </button>
          </div>
        )}
      </div>
      
      <div className="px-5 space-y-8">
        <section aria-label="Histórico Recente">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-display font-bold text-foreground">Histórico Recente</h2>
            <Clock size={18} className="text-muted-foreground/30" />
          </div>
          <div className="space-y-3">
            {recentWorkouts.length > 0 ? recentWorkouts.map((w) => (
              <div 
                key={w.id} 
                className="bg-card border border-border/40 rounded-3xl p-4 flex items-center gap-4 transition-transform active:scale-[0.98]"
                onClick={() => navigate("/workout", { state: { workoutId: w.workout_id } })}
              >
                 <div className="w-10 h-10 rounded-2xl bg-muted flex items-center justify-center flex-shrink-0">
                    <Activity size={20} className="text-muted-foreground" />
                 </div>
                 <div className="flex-1">
                    <h4 className="text-sm font-bold text-foreground">{w.workouts?.name || "Treino Finalizado"}</h4>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">
                       {new Date(w.completed_at).toLocaleDateString("pt-BR", { day: '2-digit', month: 'short' })}
                    </p>
                 </div>
                 <button className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-blood-red hover:bg-blood-red/10 transition-colors">
                    <ArrowRight size={14} />
                 </button>
              </div>
            )) : (
              <div className="text-center py-6 border-2 border-dashed border-border/20 rounded-3xl">
                <p className="text-xs text-muted-foreground italic">Nenhum treino registrado ainda.</p>
              </div>
            )}
          </div>
        </section>

        {/* Community Preview */}
        <section>
          <button 
            onClick={() => navigate("/social")}
            className="w-full bg-card border border-border/40 rounded-3xl p-5 flex items-center justify-between hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-4">
               <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                 <Users size={24} className="text-blue-500" />
               </div>
               <div className="text-left">
                 <h3 className="font-display font-bold text-foreground">Comunidade</h3>
                 <p className="text-[10px] text-muted-foreground font-bold uppercase">Veja quem está treinando</p>
               </div>
            </div>
            <div className="flex -space-x-3">
               {[
                 "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?w=100&h=100&fit=crop",
                 "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=100&h=100&fit=crop",
                 "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=100&h=100&fit=crop"
               ].map((src, i) => (
                 <img key={i} src={src} alt="Membro treinando" className="w-8 h-8 rounded-full border-2 border-card object-cover bg-muted" />
               ))}
            </div>
          </button>
        </section>
      </div>

      <div className="h-12" />
    </div>
  );
}
