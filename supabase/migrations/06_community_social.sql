-- ==============================================================================
-- 06: COMMUNITY FEED & SOCIAL EVENTS
-- ==============================================================================

-- 1. Community events table
CREATE TABLE IF NOT EXISTS public.community_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  event_type TEXT NOT NULL, -- 'workout', 'achievement', 'milestone'
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Row Level Security
ALTER TABLE public.community_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view community events" ON public.community_events;
DROP POLICY IF EXISTS "Users can insert their own events" ON public.community_events;

CREATE POLICY "Anyone can view community events" 
ON public.community_events FOR SELECT USING (true);

CREATE POLICY "Users can insert their own events" 
ON public.community_events FOR INSERT WITH CHECK (auth.uid() = user_id);
