# Supabase Database Architecture & Migrations

Este diretório contém todas as definições estruturais, tabelas, views analíticas, funções RPC com proteção de concorrência e políticas de Row Level Security (RLS) do **Corpus Prime**.

---

## Estrutura das Migrations

| Arquivo | Descrição |
| :--- | :--- |
| `01_profiles_and_security.sql` | Tabela `profiles`, trigger de provisionamento no SignUp (`handle_new_user`), sincronização de verificação de e-mail e políticas RLS para treinos/exercícios. |
| `02_workout_logs_and_drafts.sql` | Tabela `workout_drafts` para rascunhos de treino ativo e `workout_logs` com coluna gerada de `e1rm` (fórmula clássica de Epley). |
| `03_evolution_views.sql` | View SQL `user_exercise_progression` com `security_invoker = true` para gráficos de progressão de carga por exercício. |
| `04_streaks_rpc.sql` | Tabela `user_stats` e função RPC atômica `process_workout_completion` com lock transacional (`FOR UPDATE`) para cálculo de sequências, XP e níveis. |
| `05_master_achievements.sql` | Catálogo de conquistas mestre (`master_achievements`) com ícones Lucide e tabela de progresso do usuário (`user_achievements`). |
| `06_community_social.sql` | Feed social da comunidade (`community_events`) para compartilhamento de recordes e treinos finalizados. |
| `07_storage_buckets.sql` | Bucket público `avatars` e políticas de isolamento de upload vinculadas ao `auth.uid()`. |

---

## Como Executar as Migrations

1. Acesse o painel do seu projeto no **[Supabase Dashboard](https://app.supabase.com/)**.
2. Vá até a seção **SQL Editor**.
3. Execute os arquivos em ordem numérica sequencial (`01` a `07`).
4. Verifique na aba **Table Editor** e **Database > Functions** se todas as entidades foram criadas corretamente.
