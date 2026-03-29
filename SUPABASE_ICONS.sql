-- Atualizar os ícones da tabela master_achievements para nomes do Lucide React
UPDATE public.master_achievements SET icon = 'footprints' WHERE id = 'primeiro_passo';
UPDATE public.master_achievements SET icon = 'zap' WHERE id = 'ritmo_inabalavel';
UPDATE public.master_achievements SET icon = 'flame' WHERE id = 'guerreiro_semanal';
UPDATE public.master_achievements SET icon = 'calendar-check-2' WHERE id = 'habituado';
UPDATE public.master_achievements SET icon = 'medal' WHERE id = 'century_ride';
UPDATE public.master_achievements SET icon = 'infinity' WHERE id = 'inquebravel';

-- Evolução Física e Performance
UPDATE public.master_achievements SET icon = 'trending-up' WHERE id = 'quebra_de_recorde';
UPDATE public.master_achievements SET icon = 'dumbbell' WHERE id = 'mestre_do_ferro';
UPDATE public.master_achievements SET icon = 'mountain' WHERE id = 'tita_de_volume';
UPDATE public.master_achievements SET icon = 'target' WHERE id = 'ajuste_fino';
UPDATE public.master_achievements SET icon = 'activity' WHERE id = 'evolucao_constante';
UPDATE public.master_achievements SET icon = 'shapes' WHERE id = 'versatilidade_atleta';
