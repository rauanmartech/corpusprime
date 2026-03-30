-- Configuração do Sistema de Logs (Rascunhos e Persistência e1RM)

-- 1. Criação da Tabela Temporária/Rascunho de Treino Ativo (Active Drafts)
-- Esta tabela pode ser utilizada para sincronizar "no servidor" o estado que já é mantido via IndexedDB/LocalStorage.
CREATE TABLE IF NOT EXISTS public.workout_drafts (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  workout_id UUID REFERENCES public.workouts(id) ON DELETE CASCADE,
  payload JSONB DEFAULT '{}'::jsonb, -- Armazena a lista de exercícios marcados, pesos ajustados na sessão, etc.
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (user_id, workout_id)
);

-- Habilitar RLS
ALTER TABLE public.workout_drafts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own drafts" ON public.workout_drafts;
CREATE POLICY "Users can manage their own drafts" ON public.workout_drafts
  FOR ALL USING (auth.uid() = user_id);

-- 2. Histórico Persistente de Exercícios (Logs Reais de cada Treino Finalizado)
-- Usado para calcular o e1RM real do aluno (Progressive Overload).
CREATE TABLE IF NOT EXISTS public.workout_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  history_id UUID REFERENCES public.workout_history(id) ON DELETE CASCADE,
  exercise_id UUID REFERENCES public.exercises(id) ON DELETE CASCADE,
  weight NUMERIC,
  reps INTEGER,
  rpe NUMERIC DEFAULT NULL, -- Rating of Perceived Exertion
  e1rm NUMERIC GENERATED ALWAYS AS (weight * (1 + (reps / 30.0))) STORED, -- Cálculo básico clássico de e1RM (Epley Formula)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.workout_logs ENABLE ROW LEVEL SECURITY;

-- Política de Consulta
DROP POLICY IF EXISTS "Users can view their own workout logs" ON public.workout_logs;
CREATE POLICY "Users can view their own workout logs" ON public.workout_logs
  FOR SELECT USING (
    history_id IN (
      SELECT id FROM public.workout_history WHERE user_id = auth.uid()
    )
  );

-- Política de Inserção
DROP POLICY IF EXISTS "Users can insert their own workout logs" ON public.workout_logs;
CREATE POLICY "Users can insert their own workout logs" ON public.workout_logs
  FOR INSERT WITH CHECK (
    history_id IN (
      SELECT id FROM public.workout_history WHERE user_id = auth.uid()
    )
  );
