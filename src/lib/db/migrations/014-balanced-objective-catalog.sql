-- Catálogo balanceado de objetivos por quantidade de jogadores.
-- Mantém objetivos históricos intactos para partidas já iniciadas e ativa
-- somente missões desenhadas para esforço semelhante e variedade estratégica.
-- Todos os objetivos ativos pertencem à mesma faixa de balanceamento: não há
-- sorteio de missões deliberadamente fáceis ou difíceis.

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
    'balanced_fortification',
    'fortification',
    'Rede Fortificada',
    'Mantenha a quantidade exigida de territórios fortificados.',
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
    'balanced_regions_norte_sudeste',
    'regions',
    'Eixo Norte-Sudeste',
    'Domine completamente as regiões Norte e Sudeste.',
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
    'balanced_regions_sul_sudeste_plus',
    'region_plus',
    'Eixo Sul-Sudeste Ampliado',
    'Domine Sul e Sudeste e mantenha presença territorial adicional.',
    'medium',
    '{}'::jsonb,
    NULL,
    NULL,
    TRUE
  ),
  (
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

-- Domínio territorial.
-- Em vez de uma meta absoluta arbitrária, cada jogador precisa conquistar 40%
-- dos territórios que começaram fora do seu controle. O resolvedor transforma
-- esse percentual em uma meta total usando a posse inicial real e arredondamento
-- para o inteiro mais próximo.
--
-- Com a distribuição atual, isso resulta em 29, 25, 23, 22 e 21 territórios
-- para mesas de 2 a 6 jogadores. Em mesas não divisíveis, o cálculo individual
-- também neutraliza a diferença inicial: 10 ou 11 territórios viram meta 23;
-- 8 ou 9 territórios viram meta 22.
--
-- O campo territories permanece como fallback determinístico para conversões de
-- objetivo que ocorram depois do início da partida; novas atribuições resolvem
-- sempre unownedTerritoryPercent usando a posse inicial real.
INSERT INTO objective_rules (
  objective_id, player_count, revision, params, difficulty, is_active
) VALUES
  ('balanced_territory_control', 2, 1, '{"unownedTerritoryPercent":40,"territories":29}'::jsonb, 'medium', TRUE),
  ('balanced_territory_control', 3, 1, '{"unownedTerritoryPercent":40,"territories":25}'::jsonb, 'medium', TRUE),
  ('balanced_territory_control', 4, 1, '{"unownedTerritoryPercent":40,"territories":23}'::jsonb, 'medium', TRUE),
  ('balanced_territory_control', 5, 1, '{"unownedTerritoryPercent":40,"territories":22}'::jsonb, 'medium', TRUE),
  ('balanced_territory_control', 6, 1, '{"unownedTerritoryPercent":40,"territories":21}'::jsonb, 'medium', TRUE)
ON CONFLICT (objective_id, player_count, revision) DO UPDATE SET
  params = EXCLUDED.params,
  difficulty = EXCLUDED.difficulty,
  is_active = TRUE;

-- Fortificação.
-- A quantidade exigida é resolvida individualmente no início da partida a partir
-- da posse inicial real do jogador. O catálogo usa 110% como teto e o resolvedor
-- arredonda para baixo, portanto a meta final permanece sempre entre 100% e 110%
-- da posse inicial. Isso evita favorecer quem recebe um território a mais nas
-- distribuições não divisíveis por 4 ou 5 jogadores.
--
-- Além disso, cada território precisa ter pelo menos 4 tropas. A troca de cartas
-- deixa de transformar a missão em vitória quase automática: mesmo quando o
-- arredondamento inteiro não exige expansão (casos pequenos), o jogador precisa
-- sustentar uma rede ampla e cara, vulnerável a ataques adversários.
INSERT INTO objective_rules (
  objective_id, player_count, revision, params, difficulty, is_active
) VALUES
  ('balanced_fortification', 2, 1, '{"initialTerritoryPercent":110,"minTroops":4}'::jsonb, 'medium', TRUE),
  ('balanced_fortification', 3, 1, '{"initialTerritoryPercent":110,"minTroops":4}'::jsonb, 'medium', TRUE),
  ('balanced_fortification', 4, 1, '{"initialTerritoryPercent":110,"minTroops":4}'::jsonb, 'medium', TRUE),
  ('balanced_fortification', 5, 1, '{"initialTerritoryPercent":110,"minTroops":4}'::jsonb, 'medium', TRUE),
  ('balanced_fortification', 6, 1, '{"initialTerritoryPercent":110,"minTroops":4}'::jsonb, 'medium', TRUE)
ON CONFLICT (objective_id, player_count, revision) DO UPDATE SET
  params = EXCLUDED.params,
  difficulty = EXCLUDED.difficulty,
  is_active = TRUE;

-- 2 jogadores: cada um começa com 21 territórios.
-- Sul + Sudeste (14) continua fora: os pares abaixo somam 18, 18 e 19 territórios
-- e terminam próximos da referência territorial de 29 sem criar vitória curta.
INSERT INTO objective_rules (
  objective_id, player_count, revision, params, difficulty, is_active
) VALUES
  ('balanced_regions_nordeste_centro_oeste', 2, 1, '{"regions":["nordeste","centro-oeste"]}'::jsonb, 'medium', TRUE),
  ('balanced_regions_norte_sudeste', 2, 1, '{"regions":["norte","sudeste"]}'::jsonb, 'medium', TRUE),
  ('balanced_regions_nordeste_sul', 2, 1, '{"regions":["nordeste","sul"]}'::jsonb, 'medium', TRUE)
ON CONFLICT (objective_id, player_count, revision) DO UPDATE SET
  params = EXCLUDED.params,
  difficulty = EXCLUDED.difficulty,
  is_active = TRUE;

-- 3 jogadores: a referência territorial permanece 25.
-- Norte + Centro-Oeste tende a terminar perto de 24 territórios; Norte + Sul,
-- perto de 25; Nordeste + Centro-Oeste, perto de 26. A variação geográfica
-- compensa a pequena diferença: Centro-Oeste é exposto, Sul é periférico e
-- Nordeste é maior porém mais consolidável.
INSERT INTO objective_rules (
  objective_id, player_count, revision, params, difficulty, is_active
) VALUES
  ('balanced_regions_norte_centro_oeste', 3, 1, '{"regions":["norte","centro-oeste"]}'::jsonb, 'medium', TRUE),
  ('balanced_regions_norte_sul', 3, 1, '{"regions":["norte","sul"]}'::jsonb, 'medium', TRUE),
  ('balanced_regions_nordeste_centro_oeste', 3, 1, '{"regions":["nordeste","centro-oeste"]}'::jsonb, 'medium', TRUE)
ON CONFLICT (objective_id, player_count, revision) DO UPDATE SET
  params = EXCLUDED.params,
  difficulty = EXCLUDED.difficulty,
  is_active = TRUE;

-- 4 jogadores: a referência territorial permanece 23.
-- Os mesmos três eixos produzem aproximadamente 22, 23 e 24 territórios ao
-- serem completados sem perdas externas relevantes, mantendo rotas e pressões
-- estratégicas diferentes sem criar um objetivo deliberadamente superior.
INSERT INTO objective_rules (
  objective_id, player_count, revision, params, difficulty, is_active
) VALUES
  ('balanced_regions_norte_centro_oeste', 4, 1, '{"regions":["norte","centro-oeste"]}'::jsonb, 'medium', TRUE),
  ('balanced_regions_norte_sul', 4, 1, '{"regions":["norte","sul"]}'::jsonb, 'medium', TRUE),
  ('balanced_regions_nordeste_centro_oeste', 4, 1, '{"regions":["nordeste","centro-oeste"]}'::jsonb, 'medium', TRUE)
ON CONFLICT (objective_id, player_count, revision) DO UPDATE SET
  params = EXCLUDED.params,
  difficulty = EXCLUDED.difficulty,
  is_active = TRUE;

-- 5 jogadores: a nova referência territorial é 22.
-- Norte + Centro-Oeste e Norte + Sul continuam próximos dessa marca. Sul +
-- Sudeste permanece como region_plus para compensar a combinação regional menor.
INSERT INTO objective_rules (
  objective_id, player_count, revision, params, difficulty, is_active
) VALUES
  ('balanced_regions_norte_centro_oeste', 5, 1, '{"regions":["norte","centro-oeste"]}'::jsonb, 'medium', TRUE),
  ('balanced_regions_norte_sul', 5, 1, '{"regions":["norte","sul"]}'::jsonb, 'medium', TRUE),
  ('balanced_regions_sul_sudeste_plus', 5, 1, '{"regions":["sul","sudeste"],"territories":20}'::jsonb, 'medium', TRUE)
ON CONFLICT (objective_id, player_count, revision) DO UPDATE SET
  params = EXCLUDED.params,
  difficulty = EXCLUDED.difficulty,
  is_active = TRUE;

-- 6 jogadores: a nova referência territorial é 21.
-- Os dois eixos de 15-16 territórios permanecem proporcionais. Sul + Sudeste
-- continua exigindo presença territorial adicional para compensar seu tamanho.
INSERT INTO objective_rules (
  objective_id, player_count, revision, params, difficulty, is_active
) VALUES
  ('balanced_regions_norte_centro_oeste', 6, 1, '{"regions":["norte","centro-oeste"]}'::jsonb, 'medium', TRUE),
  ('balanced_regions_norte_sul', 6, 1, '{"regions":["norte","sul"]}'::jsonb, 'medium', TRUE),
  ('balanced_regions_sul_sudeste_plus', 6, 1, '{"regions":["sul","sudeste"],"territories":19}'::jsonb, 'medium', TRUE)
ON CONFLICT (objective_id, player_count, revision) DO UPDATE SET
  params = EXCLUDED.params,
  difficulty = EXCLUDED.difficulty,
  is_active = TRUE;

-- Eliminação só entra a partir de quatro jogadores. Eliminar um rival específico
-- já é a parte difícil da missão; o piso territorial serve apenas para impedir
-- vitória por último golpe em um alvo enfraquecido por terceiros. Ele fica bem
-- abaixo do objetivo de expansão e tende a ser atingido naturalmente por quem
-- participou de forma relevante da eliminação.
INSERT INTO objective_rules (
  objective_id, player_count, revision, params, difficulty, is_active
) VALUES
  ('balanced_elimination', 4, 1, '{"territories":14}'::jsonb, 'medium', TRUE),
  ('balanced_elimination', 5, 1, '{"territories":12}'::jsonb, 'medium', TRUE),
  ('balanced_elimination', 6, 1, '{"territories":10}'::jsonb, 'medium', TRUE)
ON CONFLICT (objective_id, player_count, revision) DO UPDATE SET
  params = EXCLUDED.params,
  difficulty = EXCLUDED.difficulty,
  is_active = TRUE;