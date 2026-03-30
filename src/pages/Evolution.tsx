import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
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
    // Optimistic UI: Carregar do cache imediatamente
    const cachedWorkouts = cache.get<{ id: string; name: string }[]>("evolution_workouts");
    if (cachedWorkouts) {
      setWorkouts(cachedWorkouts);
      const firstId = cachedWorkouts[0].id;
      setSelectedWorkoutId(firstId);
      
      const cachedCharts = cache.get<Record<string, { name: string; data: any[] }>>(`evolution_chart_${firstId}`);
      if (cachedCharts) {
        setChartData(cachedCharts);
      }
    }

    async function init() {
      if (!user?.id) return;
      setLoading(true);
      try {
        const { data: workoutsData, error: wError } = await supabase
          .from('workouts')
          .select('id, name')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true });

        if (wError) throw wError;
        
        if (workoutsData && workoutsData.length > 0) {
          setWorkouts(workoutsData);
          cache.set("evolution_workouts", workoutsData);
          const firstId = workoutsData[0].id;
          setSelectedWorkoutId(firstId);
          await loadProgressionData(firstId, user.id);
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
          grouped[row.exercise_id].data.push({ date: formattedDate, weight: Number(row.max_weight) });
        });
      }
      setChartData(grouped);
      cache.set(`evolution_chart_${workoutId}`, grouped);
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
        <div className="bg-background border border-border p-3 rounded-xl shadow-xl">
          <p className="font-bold text-muted-foreground text-xs mb-1">{label}</p>
          <p className="font-black text-primary text-lg">{payload[0].value} kg</p>
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
                    
                    <div className="h-44 w-full">
                      <ResponsiveContainer width="100%" height="100%" debounce={100}>
                        <LineChart data={exercise.data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                          <XAxis 
                            dataKey="date" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontWeight: 600 }} 
                            dy={10}
                          />
                          <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fill: 'white', fontSize: 11, fontWeight: 700 }} 
                          />
                          <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'hsl(var(--border))', strokeWidth: 1, strokeDasharray: '5 5' }} />
                          <Line 
                            type="monotone" 
                            dataKey="weight" 
                            stroke="hsl(var(--primary))" 
                            strokeWidth={3} 
                            dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4, stroke: 'hsl(var(--background))' }} 
                            activeDot={{ r: 6, fill: 'hsl(var(--primary))', stroke: 'hsl(var(--background))', strokeWidth: 2 }}
                            animationDuration={1500}
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
