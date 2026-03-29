import { supabase } from "./supabase";
import { toast } from "sonner";

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  xp: number;
  maxProgress: number;
}

export const ACHIEVEMENTS: Record<string, Achievement> = {
  PRIMEIRO_PASSO: { id: "primeiro_passo", name: "Primeiro Passo", description: "Completar o primeiro treino", icon: "🦶", xp: 50, maxProgress: 1 },
  RITMO_INABALAVEL: { id: "ritmo_inabalavel", name: "Ritmo Inabalável", description: "3 treinos na mesma semana", icon: "⚡", xp: 250, maxProgress: 3 },
  GUERREIRO_SEMANAL: { id: "guerreiro_semanal", name: "Guerreiro Semanal", description: "7 dias seguidos de atividade", icon: "⚔️", xp: 500, maxProgress: 7 },
  HABITUADO: { id: "habituado", name: "Habituado", description: "3x por semana durante um mês", icon: "📅", xp: 1500, maxProgress: 4 },
  CENTURY_RIDE: { id: "century_ride", name: "Century Ride", description: "100 sessões de treino completadas", icon: "💯", xp: 3000, maxProgress: 100 },
  INQUEBRAVEL: { id: "inquebravel", name: "Inquebrável", description: "Registro por 365 dias seguidos", icon: "♾️", xp: 15000, maxProgress: 365 },
};

export async function checkAndAwardAchievements(userId: string) {
  try {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    // 1. Get user stats and history
    const { data: stats } = await supabase.from('user_stats').select('*').eq('user_id', userId).single();
    const { data: history } = await supabase.from('workout_history').select('completed_at').eq('user_id', userId);
    
    if (!stats || !history) return;

    // Métricas principais
    const totalSessions = stats.total_sessions || 0;
    const currentStreak = stats.streak || 0;
    const historyDates = history.map(h => new Date(h.completed_at).toISOString().split('T')[0]);
    const uniqueDays = new Set(historyDates).size;

    // Helper to check progress and unlock
    const updateProgress = async (achievement: Achievement, currentProgress: number) => {
      const { data: existing } = await supabase
        .from('user_achievements')
        .select('*')
        .eq('user_id', userId)
        .eq('achievement_id', achievement.id)
        .maybeSingle();

      if (existing?.unlocked) return;

      const progress = Math.min(currentProgress, achievement.maxProgress);
      const isUnlocking = progress >= achievement.maxProgress;

      if (existing) {
        await supabase.from('user_achievements').update({
          progress,
          unlocked: isUnlocking,
          unlocked_at: isUnlocking ? new Date().toISOString() : null,
          updated_at: new Date().toISOString()
        }).eq('id', existing.id);
      } else {
        await supabase.from('user_achievements').insert([{
          user_id: userId,
          achievement_id: achievement.id,
          progress,
          unlocked: isUnlocking,
          unlocked_at: isUnlocking ? new Date().toISOString() : null
        }]);
      }

      if (isUnlocking && (!existing || !existing.unlocked)) {
        // Award XP - Fetch fresh stats to avoid overlap
        const { data: freshStats } = await supabase.from('user_stats').select('xp, level').eq('user_id', userId).single();
        const currentXP = freshStats?.xp || 0;
        const currentLevel = freshStats?.level || 1;
        const newXP = currentXP + achievement.xp;
        const newLevel = Math.floor(newXP / 1500) + 1;

        await supabase.from('user_stats').update({
          xp: newXP,
          level: newLevel
        }).eq('user_id', userId);

        // --- NOVO: Registrar na Comunidade ---
        await supabase.from('community_events').insert([{
          user_id: userId,
          event_type: 'achievement',
          title: `Desbloqueou: ${achievement.name}`,
          description: achievement.description,
          metadata: {
            icon: achievement.icon,
            xp: achievement.xp
          }
        }]);
        // -------------------------------------
        
        toast.success(`Conquista Desbloqueada: ${achievement.name}! +${achievement.xp} XP`, {
          icon: "🚀",
          duration: 6000,
        });

        if (newLevel > currentLevel) {
          toast.success(`PARABÉNS! Você subiu para o NÍVEL ${newLevel}! 🔥🧗‍♂️`, {
            duration: 8000,
            style: { background: 'var(--blood-red)', color: 'white', fontWeight: 'bold' }
          });
        }
      }
    };

    // --- LÓGICA DE CÁLCULO DAS CONQUISTAS ---

    // 1. Primeiro Passo (1 treino)
    await updateProgress(ACHIEVEMENTS.PRIMEIRO_PASSO, uniqueDays);

    // 2. Century Ride (100 sessões totais)
    await updateProgress(ACHIEVEMENTS.CENTURY_RIDE, totalSessions);

    // 3. Guerreiro Semanal (Streak de 7 dias consecutivos)
    await updateProgress(ACHIEVEMENTS.GUERREIRO_SEMANAL, currentStreak);

    // 4. Inquebrável (Streak de 365 dias)
    await updateProgress(ACHIEVEMENTS.INQUEBRAVEL, currentStreak);

    // 5. Ritmo Inabalável (3 treinos na mesma semana civil: dom-sab)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diffToSunday = dayOfWeek;
    const lastSunday = new Date(now);
    lastSunday.setDate(now.getDate() - diffToSunday);
    lastSunday.setHours(0,0,0,0);

    const workoutsThisWeek = history.filter(h => {
      const d = new Date(h.completed_at);
      return d >= lastSunday;
    }).length;
    await updateProgress(ACHIEVEMENTS.RITMO_INABALAVEL, workoutsThisWeek);

    // 6. Habituado (3x por semana durante 4 semanas seguidas)
    // Vamos simplificar: se treinou 12 vezes nos últimos 28 dias
    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(now.getDate() - 28);
    const workoutsLast28Days = history.filter(h => new Date(h.completed_at) >= fourWeeksAgo).length;
    // Progresso baseado em semanas completas de 3 treinos
    const progressHabituado = Math.floor(workoutsLast28Days / 3);
    await updateProgress(ACHIEVEMENTS.HABITUADO, progressHabituado);

  } catch (error) {
    console.error("Error checking achievements:", error);
  }
}
