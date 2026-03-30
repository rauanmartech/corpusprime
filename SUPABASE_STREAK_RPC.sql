-- 1. Atualizar a tabela user_stats para suportar streaks longos.
ALTER TABLE public.user_stats 
ADD COLUMN IF NOT EXISTS longest_streak INT DEFAULT 0;

-- 2. Função RPC segura para computar finalizar treinos Atômicamente
-- Impede Duplicidades, gerencia o Streak local e entrega o Leveling unificado.
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
    -- Bloqueia a linha do usuário contra requisições simultâneas (Race conditions lock)
    SELECT last_sync_date, streak, longest_streak, xp, level, total_sessions
    INTO v_last_date, v_streak, v_longest, v_xp, v_level, v_sessions
    FROM public.user_stats 
    WHERE user_id = p_user_id
    FOR UPDATE;

    -- Se não existir registro em user_stats (primeiro uso), insere com defaults e dá como first_of_day
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

    -- Proteções de Nulos (Garante que colunas default tenham número)
    v_streak := COALESCE(v_streak, 0);
    v_longest := COALESCE(v_longest, 0);
    v_xp := COALESCE(v_xp, 0);
    v_level := COALESCE(v_level, 1);
    v_sessions := COALESCE(v_sessions, 0);

    -- Lógica de Engajamento e Sequência
    IF v_last_date IS NULL THEN
        -- Nunca teve data (migração de users velhos)
        v_streak := 1;
        v_longest := GREATEST(v_longest, 1);
        v_is_first := TRUE;
    ELSIF v_last_date = p_client_date - INTERVAL '1 day' THEN
        -- Treinou ontem
        v_streak := v_streak + 1;
        v_longest := GREATEST(v_longest, v_streak);
        v_is_first := TRUE;
    ELSIF v_last_date >= p_client_date THEN
        -- Já treinou hoje (Bloqueio) ou client data bugada
        v_is_first := FALSE;
    ELSE
        -- Faltou 1 ou mais dias. Reseta.
        v_streak := 1;
        v_is_first := TRUE;
    END IF;

    -- Atualiza DB se for o primeiro do dia
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

    -- Retorna JSON pro Client
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
