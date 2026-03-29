# Atualização de Banco de Dados: Conquistas

Execute este SQL no console do seu projeto Supabase para habilitar o sistema de conquistas e streaks.

```sql
-- 1. Tabela mestre de conquistas (metadados)
CREATE TABLE IF NOT EXISTS public.master_achievements (
    id TEXT PRIMARY KEY, -- ex: 'primeiro_passo', 'century_ride'
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    category TEXT,
    xp INTEGER DEFAULT 0,
    max_progress INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabela de progresso do usuário
CREATE TABLE IF NOT EXISTS public.user_achievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    achievement_id TEXT REFERENCES public.master_achievements(id) ON DELETE CASCADE,
    progress INTEGER DEFAULT 0,
    unlocked BOOLEAN DEFAULT FALSE,
    unlocked_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, achievement_id)
);

-- 3. Limpar conquistas antigas e inserir apenas as solicitadas (Consistência e Hábito)
DELETE FROM public.master_achievements;

INSERT INTO public.master_achievements (id, name, description, icon, category, xp, max_progress) VALUES
('primeiro_passo', 'Primeiro Passo', 'Concedida ao completar o primeiro treino e registro de presença', '👟', 'Consistência e Hábito', 50, 1),
('ritmo_inabalavel', 'Ritmo Inabalável', 'Completar 3 treinos na mesma semana', '⚡', 'Consistência e Hábito', 250, 3),
('guerreiro_semanal', 'Guerreiro Semanal', 'Manter uma sequência de 7 dias consecutivos de atividade registrada', '🔥', 'Consistência e Hábito', 500, 7),
('habituado', 'Habituado', 'Treinar pelo menos 3 vezes por semana durante um mês inteiro', '💎', 'Consistência e Hábito', 1500, 4),
('century_ride', 'Century Ride', 'Alcançar o marco histórico de 100 sessões de treino completadas na academia', '⚔️', 'Consistência e Hábito', 3000, 100),
('inquebravel', 'Inquebrável', 'Manter o registro de atividades por um ano completo (365 dias)', '🏆', 'Consistência e Hábito', 15000, 365),

-- Evolução Física e Performance
('quebra_de_recorde', 'Quebra de Recorde', 'Alcançar o primeiro PR (Personal Record) em qualquer exercício monitorado', '📈', 'Evolução Física e Performance', 300, 1),
('mestre_do_ferro', 'Mestre do Ferro', 'Levantar 1,5x o peso corporal no Deadlift (Levantamento Terra)', '⛓️', 'Evolução Física e Performance', 2000, 1),
('tita_de_volume', 'Titã de Volume', 'Alcançar um volume total de carga superior a 10 toneladas em uma única semana', '🌋', 'Evolução Física e Performance', 1200, 10),
('ajuste_fino', 'Ajuste Fino', 'Registrar o feedback de RPE em todas as séries de um treino completo', '🎯', 'Evolução Física e Performance', 500, 1),
('evolucao_constante', 'Evolução Constante', 'Melhorar o e1RM em um exercício principal por 4 semanas seguidas', '🌀', 'Evolução Física e Performance', 1800, 4),
('versatilidade_atleta', 'Versatilidade Atleta', 'Completar treinos em três categorias diferentes (ex: Força, Cardio e Mobilidade)', '🤸', 'Evolução Física e Performance', 1000, 3);

-- 4. Adicionar total_sessions à tabela user_stats
ALTER TABLE public.user_stats ADD COLUMN IF NOT EXISTS total_sessions INTEGER DEFAULT 0;

-- 6. Storage (Avatares)
-- Criar bucket para avatares (se não existir via SQL, pode ser feito no painel, mas as políticas são necessárias)
-- Nota: O bucket deve ser criado manualmente no painel Storage como "avatars" e marcado como Public.
-- Abaixo estão as políticas de acesso:

-- Política para permitir que qualquer pessoa veja os avatares
CREATE POLICY "Avatar Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

-- Política para permitir que o usuário faça upload do seu próprio avatar
CREATE POLICY "Users can upload their own avatar" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'avatars' AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- Política para permitir que o usuário atualize seu próprio avatar
CREATE POLICY "Users can update their own avatar" ON storage.objects FOR UPDATE USING (
  bucket_id = 'avatars' AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- Garantir coluna avatar_url na tabela profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
```
