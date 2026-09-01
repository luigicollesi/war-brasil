-- Expande o modelo de objetivos sem remover o contrato legado.
-- Nesta etapa cada objetivo atual recebe uma regra equivalente para 2..6 jogadores,
-- preservando o comportamento até que o catálogo seja rebalanceado explicitamente.

CREATE TABLE IF NOT EXISTS objective_rules (
  id BIGSERIAL PRIMARY KEY,
  objective_id TEXT NOT NULL REFERENCES objectives(id) ON DELETE CASCADE,
  player_count SMALLINT NOT NULL CHECK (player_count BETWEEN 2 AND 6),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  params JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(params) = 'object'),
  difficulty TEXT NOT NULL CHECK (
    difficulty IN ('easy', 'medium', 'hard', 'very_hard')
  ),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (objective_id, player_count, revision)
);

CREATE UNIQUE INDEX IF NOT EXISTS objective_rules_active_objective_player_count_idx
  ON objective_rules(objective_id, player_count)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS objective_rules_player_count_idx
  ON objective_rules(player_count, is_active);

-- Compatibilidade: replica os parâmetros atuais para todas as quantidades
-- suportadas. O balanceamento real entra em revisões posteriores do catálogo.
INSERT INTO objective_rules (
  objective_id,
  player_count,
  revision,
  params,
  difficulty,
  is_active
)
SELECT
  o.id,
  player_count,
  1,
  o.params,
  o.difficulty,
  o.is_active
FROM objectives o
CROSS JOIN generate_series(2, 6) AS player_count
ON CONFLICT (objective_id, player_count, revision) DO NOTHING;

ALTER TABLE game_player_objectives
  ADD COLUMN IF NOT EXISTS objective_rule_id BIGINT
    REFERENCES objective_rules(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS resolved_params JSONB
    CHECK (resolved_params IS NULL OR jsonb_typeof(resolved_params) = 'object');

CREATE INDEX IF NOT EXISTS game_player_objectives_rule_idx
  ON game_player_objectives(objective_rule_id);

-- Faz snapshot das partidas já existentes. Regras inativas continuam válidas
-- historicamente; is_active controla apenas novos sorteios.
UPDATE game_player_objectives assignment
SET
  objective_rule_id = rule.id,
  resolved_params = rule.params
FROM objective_rules rule
WHERE assignment.objective_rule_id IS NULL
  AND rule.objective_id = assignment.objective_id
  AND rule.player_count = (
    SELECT COUNT(*)::int
    FROM room_players player
    WHERE player.room_id = assignment.room_id
  )
  AND rule.revision = (
    SELECT MAX(latest.revision)
    FROM objective_rules latest
    WHERE latest.objective_id = rule.objective_id
      AND latest.player_count = rule.player_count
  );
