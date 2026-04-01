import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { TrendingUp, Loader2, Dumbbell } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";

import { cache } from "@/lib/cache";

export default function Evolution() {
  const { user } = useAuth();
  
  // States
  const [workouts, setWorkouts] = useState<{ id: string; name: string }[]>([]);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | null>(null);
  
  // Chart Data State
  const [chartData, setChartData] = useState<Record<string, { name: string; data: any[] }>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    const userId = user.id;

    // Optimistic UI: Carregar do cache imediatamente (chave por usuário para isolamento)
    const cachedWorkouts = cache.get<{ id: string; name: string }[]>(`evolution_workouts_${userId}`);
    if (cachedWorkouts) {
      setWorkouts(cachedWorkouts);
      const firstId = cachedWorkouts[0].id;
      setSelectedWorkoutId(firstId);
      
      const cachedCharts = cache.get<Record<string, { name: string; data: any[] }>>(`evolution_chart_${firstId}_${userId}`);
      if (cachedCharts) {
        setChartData(cachedCharts);
      }
    }

    async function init() {
      setLoading(true);
      try {
        const { data: workoutsData, error: wError } = await supabase
          .from('workouts')
          .select('id, name')
          .eq('user_id', userId)
          .order('created_at', { ascending: true });

        if (wError) throw wError;
        
        if (workoutsData && workoutsData.length > 0) {
          setWorkouts(workoutsData);
          cache.set(`evolution_workouts_${userId}`, workoutsData);
          // Prioridade para o workout selecionado ou o primeiro
          const targetId = selectedWorkoutId || workoutsData[0].id;
          if (!selectedWorkoutId) setSelectedWorkoutId(targetId);
          await loadProgressionData(targetId, userId);
        } else {
          setWorkouts([]);
        }
      } catch (err) {
        console.error("Evolution init error:", err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [user?.id]);

  const loadProgressionData = async (workoutId: string, userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_exercise_progression')
        .select('*')
        .eq('workout_id', workoutId)
        .eq('user_id', userId)
        .order('training_day', { ascending: true });
        
      if (error) throw error;

      const grouped: Record<string, { name: string; data: any[] }> = {};
      if (data) {
        data.forEach((row) => {
          if (!grouped[row.exercise_id]) {
            grouped[row.exercise_id] = { name: row.exercise_name, data: [] };
          }
          const dateObj = new Date(row.training_day);
          const formattedDate = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
          grouped[row.exercise_id].data.push({ 
            date: formattedDate, 
            weight: Number(row.max_weight),
            reps: Number(row.top_set_reps || 0)
          });
        });
      }
      setChartData(grouped);
      cache.set(`evolution_chart_${workoutId}_${userId}`, grouped);
    } catch (err) {
      console.error("Progression fetch error:", err);
    }
  };

  const handleWorkoutChange = async (val: string) => {
    setSelectedWorkoutId(val);
    if (user?.id) {
      setLoading(true);
      await loadProgressionData(val, user.id);
      setLoading(false);
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background/95 backdrop-blur-md border border-border p-3 rounded-2xl shadow-xl">
          <p className="font-bold text-muted-foreground text-[10px] mb-2 uppercase tracking-widest">{label}</p>
          <div className="space-y-1.5">
            {payload.map((entry: any, index: number) => (
              <div key={index} className="flex items-center justify-between gap-4">
                <span className="text-[10px] font-black uppercase text-muted-foreground">{entry.name}:</span>
                <span className="text-sm font-black" style={{ color: entry.stroke }}>
                  {entry.value} {entry.name === "CARGA" ? "kg" : "reps"}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-background pb-28 pt-6 px-5">
      <div className="mb-8">
        <h1 className="text-2xl font-display font-bold text-foreground mb-1 flex items-center gap-2">
          <TrendingUp className="text-primary" /> Evolução
        </h1>
        <p className="text-xs text-muted-foreground tracking-wide font-medium">SOBRECARGA PROGRESSIVA (TOP SET)</p>
      </div>

      {workouts.length > 0 ? (
        <div className="space-y-6">
          <div className="flex flex-col gap-2">
             <label className="text-xs font-bold text-muted-foreground uppercase ml-1">Ficha de Treino</label>
             <Select value={selectedWorkoutId || ''} onValueChange={handleWorkoutChange}>
               <SelectTrigger className="w-full bg-card border-border/40 h-14 rounded-2xl font-semibold text-foreground">
                 <SelectValue placeholder="Selecione um treino" />
               </SelectTrigger>
               <SelectContent className="bg-card border-border">
                 {workouts.map(w => (
                   <SelectItem key={w.id} value={w.id} className="font-medium cursor-pointer">
                     {w.name}
                   </SelectItem>
                 ))}
               </SelectContent>
             </Select>
          </div>

          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div 
                key="loading"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="py-20 flex flex-col items-center justify-center gap-3 text-muted-foreground"
              >
                <Loader2 className="animate-spin w-8 h-8 text-primary" />
                <span className="text-sm font-medium">Buscando histórico...</span>
              </motion.div>
            ) : Object.keys(chartData).length > 0 ? (
              <motion.div 
                key="charts"
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                {Object.values(chartData).map((exercise, index) => (
                  <div key={index} className="bg-card border border-border/40 rounded-3xl p-5 shadow-sm">
                    <h3 className="font-display font-bold text-foreground mb-6 uppercase text-sm tracking-tight flex items-center gap-2">
                       <Dumbbell size={16} className="text-primary" /> {exercise.name}
                    </h3>
                    
                    <div className="h-56 w-full mt-4">
                      <ResponsiveContainer width="100%" height="100%" debounce={100}>
                        <LineChart data={exercise.data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                          <XAxis 
                            dataKey="date" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9, fontWeight: 700 }} 
                            dy={10}
                          />
                          <YAxis 
                            yAxisId="left"
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fill: 'hsl(0 65% 50%)', fontSize: 10, fontWeight: 800 }} 
                            tickFormatter={(v) => `${v}k`}
                          />
                          <YAxis 
                            yAxisId="right"
                            orientation="right"
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fill: '#3B82F6', fontSize: 10, fontWeight: 800 }} 
                            tickFormatter={(v) => `${v}r`}
                          />
                          <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'hsl(var(--border))', strokeWidth: 1, strokeDasharray: '5 5' }} />
                          <Legend 
                            verticalAlign="top" 
                            align="right" 
                            height={40} 
                            iconType="circle" 
                            iconSize={6}
                            wrapperStyle={{ fontSize: '9px', fontWeight: '900', paddingBottom: '10px' }} 
                          />
                          <Line 
                            yAxisId="left"
                            type="monotone" 
                            dataKey="weight" 
                            stroke="hsl(0 65% 50%)" 
                            strokeWidth={4} 
                            dot={{ fill: 'hsl(0 65% 50%)', r: 4, strokeWidth: 0 }} 
                            activeDot={{ r: 6, fill: 'hsl(0 65% 50%)', stroke: 'hsl(var(--background))', strokeWidth: 2 }}
                            name="CARGA"
                            animationDuration={1500}
                          />
                          {/* Camada 1: Linha Tracejada (sem pontos para evitar distorção) */}
                          <Line 
                            yAxisId="right"
                            type="monotone" 
                            dataKey="reps" 
                            stroke="#3B82F6" 
                            strokeWidth={2} 
                            strokeDasharray="5 5"
                            dot={false}
                            activeDot={false}
                            name="REPS"
                            animationDuration={2000}
                          />
                          {/* Camada 2: Apenas os Pontos (sem linha para garantir formato circular perfeito) */}
                          <Line 
                            yAxisId="right"
                            type="monotone" 
                            dataKey="reps" 
                            stroke="transparent" 
                            strokeWidth={0}
                            dot={{ fill: '#3B82F6', r: 4, strokeWidth: 0 }} 
                            activeDot={{ r: 6, fill: '#3B82F6', stroke: 'hsl(var(--background))', strokeWidth: 2 }}
                            name="REPS_POINTS"
                            legendType="none"
                            animationDuration={2000}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ))}
              </motion.div>
            ) : (
              <motion.div 
                key="empty"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="text-center py-16 px-4 bg-muted/20 border border-dashed border-border/40 rounded-3xl"
              >
                <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
                  <TrendingUp className="text-muted-foreground opacity-50" />
                </div>
                <h3 className="font-semibold text-foreground mb-1">Nenhum dado encontrado</h3>
                <p className="text-xs text-muted-foreground">Complete sessões de treino para ver sua evolução na carga máxima.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : (
        <div className="text-center py-20">
           <p className="text-muted-foreground text-sm">Você ainda não possui fichas de treino cadastradas.</p>
        </div>
      )}
    </div>
  );
}
