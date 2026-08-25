-- ==============================================================================
-- 04: ATOMIC STREAK, XP & LEVELING RPC FUNCTION
-- ==============================================================================

-- 1. Ensure user_stats table has necessary tracking fields
CREATE TABLE IF NOT EXISTS public.user_stats (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    streak INT DEFAULT 0,
    longest_streak INT DEFAULT 0,
    xp INT DEFAULT 0,
    level INT DEFAULT 1,
    total_sessions INT DEFAULT 0,
    last_sync_date DATE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own stats" ON public.user_stats;
CREATE POLICY "Users can read own stats" ON public.user_stats FOR SELECT USING (auth.uid() = user_id);

-- 2. Atomic workout completion processor with row locking against race conditions
CREATE OR REPLACE FUNCTION process_workout_completion(p_user_id UUID, p_client_date DATE)
RETURNS jsonb AS $$
DECLARE
    v_last_date DATE;
    v_streak INT;
    v_longest INT;
    v_xp INT;
    v_level INT;
    v_sessions INT;
    v_is_first BOOLEAN := FALSE;
    v_result jsonb;
BEGIN
    -- Row-level locking to prevent race conditions during rapid submissions
    SELECT last_sync_date, streak, longest_streak, xp, level, total_sessions
    INTO v_last_date, v_streak, v_longest, v_xp, v_level, v_sessions
    FROM public.user_stats 
    WHERE user_id = p_user_id
    FOR UPDATE;

    -- If user_stats does not exist yet, provision with initial values
    IF NOT FOUND THEN
        v_streak := 1;
        v_longest := 1;
        v_xp := 150;
        v_level := 1;
        v_sessions := 1;
        v_is_first := TRUE;

        INSERT INTO public.user_stats (user_id, streak, longest_streak, xp, level, last_sync_date, total_sessions)
        VALUES (p_user_id, v_streak, v_longest, v_xp, v_level, p_client_date, v_sessions);
        
        v_result := jsonb_build_object(
            'new_streak', v_streak,
            'new_xp', v_xp,
            'new_level', v_level,
            'total_sessions', v_sessions,
            'is_first_of_day', v_is_first
        );
        RETURN v_result;
    END IF;

    -- Null-safety guards
    v_streak := COALESCE(v_streak, 0);
    v_longest := COALESCE(v_longest, 0);
    v_xp := COALESCE(v_xp, 0);
    v_level := COALESCE(v_level, 1);
    v_sessions := COALESCE(v_sessions, 0);

    -- Streak and streak continuity logic
    IF v_last_date IS NULL THEN
        v_streak := 1;
        v_longest := GREATEST(v_longest, 1);
        v_is_first := TRUE;
    ELSIF v_last_date = p_client_date - INTERVAL '1 day' THEN
        -- Trained yesterday: increment streak
        v_streak := v_streak + 1;
        v_longest := GREATEST(v_longest, v_streak);
        v_is_first := TRUE;
    ELSIF v_last_date >= p_client_date THEN
        -- Already completed a session today
        v_is_first := FALSE;
    ELSE
        -- Missed 1+ days: reset streak to 1
        v_streak := 1;
        v_is_first := TRUE;
    END IF;

    -- Update stats if first session of the day
    IF v_is_first THEN
        v_xp := v_xp + 150;
        v_level := FLOOR(v_xp / 1500) + 1;
        v_sessions := v_sessions + 1;

        UPDATE public.user_stats 
        SET streak = v_streak, 
            longest_streak = v_longest,
            xp = v_xp,
            level = v_level,
            total_sessions = v_sessions,
            last_sync_date = p_client_date,
            updated_at = NOW()
        WHERE user_id = p_user_id;
    END IF;

    v_result := jsonb_build_object(
        'new_streak', v_streak,
        'new_xp', v_xp,
        'new_level', v_level,
        'total_sessions', v_sessions,
        'is_first_of_day', v_is_first
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
