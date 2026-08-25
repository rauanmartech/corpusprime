-- ==============================================================================
-- 02: WORKOUT DRAFTS & PERSISTENT EXERCISE LOGS (e1RM Tracking)
-- ==============================================================================

-- 1. Active drafts table (Server synchronization of active workout state)
CREATE TABLE IF NOT EXISTS public.workout_drafts (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  workout_id UUID REFERENCES public.workouts(id) ON DELETE CASCADE,
  payload JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (user_id, workout_id)
);

ALTER TABLE public.workout_drafts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own drafts" ON public.workout_drafts;
CREATE POLICY "Users can manage their own drafts" ON public.workout_drafts
  FOR ALL USING (auth.uid() = user_id);

-- 2. Workout logs (Persistent execution logs per set with e1RM Epley Formula)
CREATE TABLE IF NOT EXISTS public.workout_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  history_id UUID REFERENCES public.workout_history(id) ON DELETE CASCADE,
  exercise_id UUID REFERENCES public.exercises(id) ON DELETE CASCADE,
  weight NUMERIC,
  reps INTEGER,
  rpe NUMERIC DEFAULT NULL,
  e1rm NUMERIC GENERATED ALWAYS AS (weight * (1 + (reps / 30.0))) STORED,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.workout_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own workout logs" ON public.workout_logs;
CREATE POLICY "Users can view their own workout logs" ON public.workout_logs
  FOR SELECT USING (
    history_id IN (
      SELECT id FROM public.workout_history WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert their own workout logs" ON public.workout_logs;
CREATE POLICY "Users can insert their own workout logs" ON public.workout_logs
  FOR INSERT WITH CHECK (
    history_id IN (
      SELECT id FROM public.workout_history WHERE user_id = auth.uid()
    )
  );
