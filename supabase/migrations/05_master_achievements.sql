-- ==============================================================================
-- 05: ACHIEVEMENTS & GAMIFICATION ENGINE
-- ==============================================================================

-- 1. Master achievements metadata table
CREATE TABLE IF NOT EXISTS public.master_achievements (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    category TEXT,
    xp INTEGER DEFAULT 0,
    max_progress INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. User achievement progress table
CREATE TABLE IF NOT EXISTS public.user_achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    achievement_id TEXT REFERENCES public.master_achievements(id) ON DELETE CASCADE,
    progress INTEGER DEFAULT 0,
    unlocked BOOLEAN DEFAULT FALSE,
    unlocked_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, achievement_id)
);

ALTER TABLE public.master_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view master achievements" ON public.master_achievements;
CREATE POLICY "Public can view master achievements" ON public.master_achievements FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage their achievements" ON public.user_achievements;
CREATE POLICY "Users can manage their achievements" ON public.user_achievements FOR ALL USING (auth.uid() = user_id);

-- 3. Populate default catalog (Consistency, Performance & Evolution) with Lucide icon keys
DELETE FROM public.master_achievements;

INSERT INTO public.master_achievements (id, name, description, icon, category, xp, max_progress) VALUES
-- Consistency & Habits
('primeiro_passo', 'Primeiro Passo', 'Concedida ao completar o primeiro treino e registro de presença', 'footprints', 'Consistência e Hábito', 50, 1),
('ritmo_inabalavel', 'Ritmo Inabalável', 'Completar 3 treinos na mesma semana', 'zap', 'Consistência e Hábito', 250, 3),
('guerreiro_semanal', 'Guerreiro Semanal', 'Manter uma sequência de 7 dias consecutivos de atividade registrada', 'flame', 'Consistência e Hábito', 500, 7),
('habituado', 'Habituado', 'Treinar pelo menos 3 vezes por semana durante um mês inteiro', 'calendar-check-2', 'Consistência e Hábito', 1500, 4),
('century_ride', 'Century Ride', 'Alcançar o marco histórico de 100 sessões de treino completadas na academia', 'medal', 'Consistência e Hábito', 3000, 100),
('inquebravel', 'Inquebrável', 'Manter o registro de atividades por um ano completo (365 dias)', 'infinity', 'Consistência e Hábito', 15000, 365),

-- Physical Evolution & Performance
('quebra_de_recorde', 'Quebra de Recorde', 'Alcançar o primeiro PR (Personal Record) em qualquer exercício monitorado', 'trending-up', 'Evolução Física e Performance', 300, 1),
('mestre_do_ferro', 'Mestre do Ferro', 'Levantar 1,5x o peso corporal no Deadlift (Levantamento Terra)', 'dumbbell', 'Evolução Física e Performance', 2000, 1),
('tita_de_volume', 'Titã de Volume', 'Alcançar um volume total de carga superior a 10 toneladas em uma única semana', 'mountain', 'Evolução Física e Performance', 1200, 10),
('ajuste_fino', 'Ajuste Fino', 'Registrar o feedback de RPE em todas as séries de um treino completo', 'target', 'Evolução Física e Performance', 500, 1),
('evolucao_constante', 'Evolução Constante', 'Melhorar o e1RM em um exercício principal por 4 semanas seguidas', 'activity', 'Evolução Física e Performance', 1800, 4),
('versatilidade_atleta', 'Versatilidade Atleta', 'Completar treinos em três categorias diferentes (ex: Força, Cardio e Mobilidade)', 'shapes', 'Evolução Física e Performance', 1000, 3);
