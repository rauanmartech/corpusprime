-- View para extrair a progressão de carga máxima de cada exercício por sessão de treino.
-- Criamos a View com 'security_invoker = true' para herdar sua privacidade de conta automaticamente.
CREATE OR REPLACE VIEW public.user_exercise_progression WITH (security_invoker = true) AS
SELECT 
    l.exercise_id,
    e.name as exercise_name,
    h.workout_id,
    h.user_id,
    MAX(l.weight) as max_weight,
    date_trunc('day', l.created_at) as training_day
FROM 
    public.workout_logs l
JOIN
    public.workout_history h ON l.history_id = h.id
JOIN
    public.exercises e ON l.exercise_id = e.id
GROUP BY 
    l.exercise_id, e.name, h.workout_id, h.user_id, training_day
ORDER BY 
    training_day ASC;
