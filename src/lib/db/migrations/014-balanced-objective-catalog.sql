-- Catálogo balanceado de objetivos por quantidade de jogadores.
-- Mantém objetivos históricos intactos para partidas já iniciadas e ativa
-- somente as missões abaixo para novos sorteios.

UPDATE objective_rules
SET is_active = FALSE
WHERE is_active = TRUE;

UPDATE objectives
SET is_active = FALSE
WHERE is_active = TRUE;

INSERT INTO objectives (
  id,
  type,
  name,
  description,
  difficulty,
  params,
  target_selector,
  fallback_objective_id,
  is_active
) VALUES
  (
    'balanced_territory_control',
    'territories',
    'Expansão Nacional',
    'Controle a quantidade de territórios definida para esta partida.',
    'medium',
    '{}'::jsonb,
    NULL,
    NULL,
    TRUE
  ),
  (
    'balanced_regions_sul_sudeste',
    'regions',
    'Eixo Sul-Sudeste',
    'Domine completamente as regiões Sul e Sudeste.',
    'medium',
    '{}'::jsonb,
    NULL,
    NULL,
    TRUE
  ),
  (
    'balanced_regions_norte_centro_oeste',
    'regions',
    'Eixo Norte-Centro-Oeste',
    'Domine completamente as regiões Norte e Centro-Oeste.',
    'medium',
    '{}'::jsonb,
    NULL,
    NULL,
    TRUE
  ),
  (
    'balanced_regions_nordeste_centro_oeste',
    'regions',
    'Eixo Nordeste-Centro-Oeste',
    'Domine completamente as regiões Nordeste e Centro-Oeste.',
    'medium',
    '{}'::jsonb,
    NULL,
    NULL,
    TRUE
  ),
  (
    'balanced_regions_norte_sul',
    'regions',
    'Eixo Norte-Sul',
    'Domine completamente as regiões Norte e Sul.',
    'medium',
    '{}'::jsonb,
    NULL,
    NULL,
    TRUE
  ),
  (
    'balanced_regions_sudeste_centro_oeste',
    'regions',
    'Eixo Sudeste-Centro-Oeste',
    'Domine completamente as regiões Sudeste e Centro-Oeste.',
    'medium',
    '{}'::jsonb,
    NULL,
    NULL,
    TRUE
  ),
  (
    'balanced_regions_nordeste_sul',
    'regions',
    'Eixo Nordeste-Sul',
    'Domine completamente as regiões Nordeste e Sul.',
    'medium',
    '{}'::jsonb,
    NULL,
    NULL,
    TRUE
  )
ON CONFLICT (id) DO UPDATE SET
  type = EXCLUDED.type,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  difficulty = EXCLUDED.difficulty,
  params = EXCLUDED.params,
  target_selector = EXCLUDED.target_selector,
  fallback_objective_id = EXCLUDED.fallback_objective_id,
  is_active = TRUE;

INSERT INTO objectives (
  id,
  type,
  name,
  description,
  difficulty,
  params,
  target_selector,
  fallback_objective_id,
  is_active
) VALUES (
  'balanced_elimination',
  'elimination',
  'Eliminar Rival',
  'Elimine {targetPlayer} e mantenha presença territorial suficiente.',
  'medium',
  '{}'::jsonb,
  'random_other_player',
  'balanced_territory_control',
  TRUE
)
ON CONFLICT (id) DO UPDATE SET
  type = EXCLUDED.type,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  difficulty = EXCLUDED.difficulty,
  params = EXCLUDED.params,
  target_selector = EXCLUDED.target_selector,
  fallback_objective_id = EXCLUDED.fallback_objective_id,
  is_active = TRUE;

-- Domínio territorial: a parcela final do mapa diminui conforme cresce o número
-- de jogadores, mas o esforço adicional permanece próximo de 9 a 13 conquistas.
INSERT INTO objective_rules (
  objective_id, player_count, revision, params, difficulty, is_active
) VALUES
  ('balanced_territory_control', 2, 1, '{"territories":30}'::jsonb, 'medium', TRUE),
  ('balanced_territory_control', 3, 1, '{"territories":25}'::jsonb, 'medium', TRUE),
  ('balanced_territory_control', 4, 1, '{"territories":23}'::jsonb, 'medium', TRUE),
  ('balanced_territory_control', 5, 1, '{"territories":21}'::jsonb, 'medium', TRUE),
  ('balanced_territory_control', 6, 1, '{"territories":20}'::jsonb, 'medium', TRUE)
ON CONFLICT (objective_id, player_count, revision) DO UPDATE SET
  params = EXCLUDED.params,
  difficulty = EXCLUDED.difficulty,
  is_active = TRUE;

-- 2 jogadores: cada jogador começa com 21 territórios. Uma única região seria
-- curta demais; os pares abaixo exigem expansão focalizada comparável a +9
-- territórios, compensando Sul periférico com Sudeste disputado e regiões
-- centrais/expostas com Norte/Nordeste maiores.
INSERT INTO objective_rules (
  objective_id, player_count, revision, params, difficulty, is_active
) VALUES
  ('balanced_regions_sul_sudeste', 2, 1, '{"regions":["sul","sudeste"]}'::jsonb, 'medium', TRUE),
  ('balanced_regions_norte_centro_oeste', 2, 1, '{"regions":["norte","centro-oeste"]}'::jsonb, 'medium', TRUE),
  ('balanced_regions_nordeste_centro_oeste', 2, 1, '{"regions":["nordeste","centro-oeste"]}'::jsonb, 'medium', TRUE)
ON CONFLICT (objective_id, player_count, revision) DO UPDATE SET
  params = EXCLUDED.params,
  difficulty = EXCLUDED.difficulty,
  is_active = TRUE;

-- 3 e 4 jogadores: os pares ficam próximos do esforço de 10 a 13 conquistas
-- esperadas. Nordeste ganha Sul (fácil de sustentar), enquanto Centro-Oeste
-- compensa seu tamanho pequeno pela alta exposição estratégica.
INSERT INTO objective_rules (
  objective_id, player_count, revision, params, difficulty, is_active
) VALUES
  ('balanced_regions_norte_sul', 3, 1, '{"regions":["norte","sul"]}'::jsonb, 'medium', TRUE),
  ('balanced_regions_sudeste_centro_oeste', 3, 1, '{"regions":["sudeste","centro-oeste"]}'::jsonb, 'medium', TRUE),
  ('balanced_regions_nordeste_sul', 3, 1, '{"regions":["nordeste","sul"]}'::jsonb, 'medium', TRUE),
  ('balanced_regions_norte_sul', 4, 1, '{"regions":["norte","sul"]}'::jsonb, 'medium', TRUE),
  ('balanced_regions_sudeste_centro_oeste', 4, 1, '{"regions":["sudeste","centro-oeste"]}'::jsonb, 'medium', TRUE),
  ('balanced_regions_nordeste_sul', 4, 1, '{"regions":["nordeste","sul"]}'::jsonb, 'medium', TRUE)
ON CONFLICT (objective_id, player_count, revision) DO UPDATE SET
  params = EXCLUDED.params,
  difficulty = EXCLUDED.difficulty,
  is_active = TRUE;

-- 5 jogadores: quatro alternativas regionais evitam que a missão dependa de
-- uma única região grande. Todos os pares combinam tamanho com exposição.
INSERT INTO objective_rules (
  objective_id, player_count, revision, params, difficulty, is_active
) VALUES
  ('balanced_regions_sul_sudeste', 5, 1, '{"regions":["sul","sudeste"]}'::jsonb, 'medium', TRUE),
  ('balanced_regions_norte_centro_oeste', 5, 1, '{"regions":["norte","centro-oeste"]}'::jsonb, 'medium', TRUE),
  ('balanced_regions_norte_sul', 5, 1, '{"regions":["norte","sul"]}'::jsonb, 'medium', TRUE),
  ('balanced_regions_sudeste_centro_oeste', 5, 1, '{"regions":["sudeste","centro-oeste"]}'::jsonb, 'medium', TRUE)
ON CONFLICT (objective_id, player_count, revision) DO UPDATE SET
  params = EXCLUDED.params,
  difficulty = EXCLUDED.difficulty,
  is_active = TRUE;

-- 6 jogadores: cinco alternativas regionais mantêm diversidade suficiente para
-- o sorteio sem usar pares excessivamente baratos, como Centro-Oeste + Sul.
INSERT INTO objective_rules (
  objective_id, player_count, revision, params, difficulty, is_active
) VALUES
  ('balanced_regions_sul_sudeste', 6, 1, '{"regions":["sul","sudeste"]}'::jsonb, 'medium', TRUE),
  ('balanced_regions_norte_centro_oeste', 6, 1, '{"regions":["norte","centro-oeste"]}'::jsonb, 'medium', TRUE),
  ('balanced_regions_norte_sul', 6, 1, '{"regions":["norte","sul"]}'::jsonb, 'medium', TRUE),
  ('balanced_regions_sudeste_centro_oeste', 6, 1, '{"regions":["sudeste","centro-oeste"]}'::jsonb, 'medium', TRUE),
  ('balanced_regions_nordeste_sul', 6, 1, '{"regions":["nordeste","sul"]}'::jsonb, 'medium', TRUE)
ON CONFLICT (objective_id, player_count, revision) DO UPDATE SET
  params = EXCLUDED.params,
  difficulty = EXCLUDED.difficulty,
  is_active = TRUE;

-- Eliminação só entra a partir de quatro jogadores. A exigência territorial
-- reduz vitórias por "último golpe" após outros jogadores enfraquecerem o alvo.
INSERT INTO objective_rules (
  objective_id, player_count, revision, params, difficulty, is_active
) VALUES
  ('balanced_elimination', 4, 1, '{"territories":17}'::jsonb, 'medium', TRUE),
  ('balanced_elimination', 5, 1, '{"territories":15}'::jsonb, 'medium', TRUE),
  ('balanced_elimination', 6, 1, '{"territories":14}'::jsonb, 'medium', TRUE)
ON CONFLICT (objective_id, player_count, revision) DO UPDATE SET
  params = EXCLUDED.params,
  difficulty = EXCLUDED.difficulty,
  is_active = TRUE;
