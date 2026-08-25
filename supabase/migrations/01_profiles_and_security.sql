-- ==============================================================================
-- 01: PROFILES, AUTHENTICATION HOOKS & ROW LEVEL SECURITY (RLS)
-- ==============================================================================

-- 1. Profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  avatar_url TEXT,
  email_verified BOOLEAN DEFAULT FALSE,
  last_security_audit TIMESTAMPTZ DEFAULT NOW(),
  privacy_accepted BOOLEAN DEFAULT TRUE,
  security_metadata JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profile Policies
DROP POLICY IF EXISTS "Users can view any profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can view any profile" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 2. Trigger to automatically provision profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (new.id, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. Strict RLS for workouts, exercises, history, and weekly schedules
ALTER TABLE IF EXISTS public.workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.workout_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.weekly_schedule ENABLE ROW LEVEL SECURITY;

-- Policies for WORKOUTS
DROP POLICY IF EXISTS "Users can only see their own workouts" ON public.workouts;
CREATE POLICY "Users can only see their own workouts" ON public.workouts
  FOR ALL USING (auth.uid() = user_id);

-- Policies for EXERCISES
DROP POLICY IF EXISTS "Users can only see exercises from their own workouts" ON public.exercises;
CREATE POLICY "Users can only see exercises from their own workouts" ON public.exercises
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.workouts 
      WHERE workouts.id = exercises.workout_id 
      AND workouts.user_id = auth.uid()
    )
  );

-- Policies for WORKOUT_HISTORY
DROP POLICY IF EXISTS "Users can only see their own history" ON public.workout_history;
CREATE POLICY "Users can only see their own history" ON public.workout_history
  FOR ALL USING (auth.uid() = user_id);

-- Policies for WEEKLY_SCHEDULE
DROP POLICY IF EXISTS "Users can only see their own schedule" ON public.weekly_schedule;
CREATE POLICY "Users can only see their own schedule" ON public.weekly_schedule
  FOR ALL USING (auth.uid() = user_id);

-- 4. Function to sync email confirmation status
CREATE OR REPLACE FUNCTION public.handle_email_verification()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles
  SET email_verified = (NEW.email_confirmed_at IS NOT NULL)
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
