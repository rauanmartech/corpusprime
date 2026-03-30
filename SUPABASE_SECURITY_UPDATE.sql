-- Atualização da Tabela de Profiles e Users para suporte a segurança e onboarding
-- Este script adiciona metadados de segurança e status de verificação.

-- 1. Garantir que a tabela profiles tenha as colunas necessárias
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS last_security_audit TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS privacy_accepted BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS security_metadata JSONB DEFAULT '{}';

-- 2. Habilitar RLS estrito em todas as tabelas críticas (Isolamento de Dados)
ALTER TABLE public.workout_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;

-- 3. Criar Políticas de RLS para garantir que NENHUM usuário veja dados de terceiros
-- Observação: Se as políticas já existirem, elas serão recriadas.

-- Políticas para WORKOUTS
DROP POLICY IF EXISTS "Users can only see their own workouts" ON public.workouts;
CREATE POLICY "Users can only see their own workouts" ON public.workouts
    FOR ALL USING (auth.uid() = user_id);

-- Políticas para EXERCISES (Herdadas de workouts ou via join, mas aqui usamos o campo direto se existir)
-- Se exercises não tem user_id, precisamos filtrar via workout_id que pertence ao usuário.
DROP POLICY IF EXISTS "Users can only see exercises from their own workouts" ON public.exercises;
CREATE POLICY "Users can only see exercises from their own workouts" ON public.exercises
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.workouts 
            WHERE workouts.id = exercises.workout_id 
            AND workouts.user_id = auth.uid()
        )
    );

-- Políticas para WORKOUT_HISTORY
DROP POLICY IF EXISTS "Users can only see their own history" ON public.workout_history;
CREATE POLICY "Users can only see their own history" ON public.workout_history
    FOR ALL USING (auth.uid() = user_id);

-- Políticas para WORKOUT_LOGS
DROP POLICY IF EXISTS "Users can only see their own logs" ON public.workout_logs;
CREATE POLICY "Users can only see their own logs" ON public.workout_logs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.workout_history 
            WHERE workout_history.id = workout_logs.history_id 
            AND workout_history.user_id = auth.uid()
        )
    );

-- Políticas para WEEKLY_SCHEDULE
DROP POLICY IF EXISTS "Users can only see their own schedule" ON public.weekly_schedule;
CREATE POLICY "Users can only see their own schedule" ON public.weekly_schedule
    FOR ALL USING (auth.uid() = user_id);

-- 4. Função para auto-verificar e-mail no profile quando confirmado no Auth
CREATE OR REPLACE FUNCTION public.handle_email_verification()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles
  SET email_verified = (NEW.email_confirmed_at IS NOT NULL)
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Gatilho no auth.users (precisa de permissão de superuser ou ser rodado no console do Supabase)
-- DROP TRIGGER IF EXISTS on_auth_user_verified ON auth.users;
-- CREATE TRIGGER on_auth_user_verified
--   AFTER UPDATE OF email_confirmed_at ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION public.handle_email_verification();
