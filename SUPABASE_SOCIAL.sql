-- 1. Criar Tabela de Eventos da Comunidade
CREATE TABLE IF NOT EXISTS public.community_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  event_type TEXT NOT NULL, -- 'workout', 'achievement', 'milestone'
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb, -- Armazenar ícone, nome do treino, etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Habilitar RLS
ALTER TABLE public.community_events ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de Acesso
DROP POLICY IF EXISTS "Anyone can view community events" ON public.community_events;
DROP POLICY IF EXISTS "Users can insert their own events" ON public.community_events;

CREATE POLICY "Anyone can view community events" 
ON public.community_events FOR SELECT USING (true);

CREATE POLICY "Users can insert their own events" 
ON public.community_events FOR INSERT WITH CHECK (auth.uid() = user_id);
