-- Passe de Campanha V1: concrete Season 1 activation and revised 17-item reward matrix.
-- Up Migration

-- Passe de Campanha V1: strict catalog activation validator.
-- Extends the 070 activation guard with the complete V1 reward matrix and
-- Economy V2 Elite offer requirements.
--
-- Up Migration

CREATE OR REPLACE FUNCTION catalog.validate_battle_pass_activation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $body$
DECLARE
  level_count INTEGER;
  level_one_xp BIGINT;
  invalid_threshold_count INTEGER;
  free_credit BIGINT;
  premium_credit BIGINT;
  invalid_credit_count INTEGER;
  missing_credit_count INTEGER;
  extra_credit_count INTEGER;
  free_cosmetic_count INTEGER;
  premium_cosmetic_count INTEGER;
  invalid_cosmetic_count INTEGER;
  free_level_100_titles INTEGER;
  premium_level_100_titles INTEGER;
  level_100_credit_count INTEGER;
  empty_level_mismatch_count INTEGER;
  elite_offer_count INTEGER;
BEGIN
  IF NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*)::int,
         MIN(required_total_xp) FILTER (WHERE level=1)
    INTO level_count,level_one_xp
    FROM catalog.battle_pass_levels
   WHERE season_id=NEW.id;

  IF level_count <> 100 THEN
    RAISE EXCEPTION 'active battle pass requires exactly 100 levels';
  END IF;

  IF level_one_xp <> 0 THEN
    RAISE EXCEPTION 'active battle pass level 1 must start at 0 XP';
  END IF;

  SELECT COUNT(*)::int
    INTO invalid_threshold_count
    FROM (
      SELECT level,
             required_total_xp,
             LAG(required_total_xp) OVER (ORDER BY level) AS previous_xp
        FROM catalog.battle_pass_levels
       WHERE season_id=NEW.id
    ) thresholds
   WHERE level > 1
     AND (previous_xp IS NULL OR required_total_xp <= previous_xp);

  IF invalid_threshold_count <> 0 THEN
    RAISE EXCEPTION 'active battle pass XP thresholds must increase strictly';
  END IF;

  SELECT
    COALESCE(SUM(credit_amount) FILTER (
      WHERE track='free' AND reward_kind='campaign_credit'
    ),0),
    COALESCE(SUM(credit_amount) FILTER (
      WHERE track='premium' AND reward_kind='campaign_credit'
    ),0),
    COUNT(*) FILTER (
      WHERE reward_kind='campaign_credit' AND credit_amount < 5
    ),
    COUNT(*) FILTER (
      WHERE level=100 AND track='free' AND reward_kind='commander_title'
    ),
    COUNT(*) FILTER (
      WHERE level=100 AND track='premium' AND reward_kind='commander_title'
    ),
    COUNT(*) FILTER (
      WHERE level=100 AND reward_kind='campaign_credit'
    )
  INTO
    free_credit,
    premium_credit,
    invalid_credit_count,
    free_level_100_titles,
    premium_level_100_titles,
    level_100_credit_count
  FROM catalog.battle_pass_rewards
  WHERE season_id=NEW.id;

  IF free_credit <> 1000 THEN
    RAISE EXCEPTION 'active battle pass free track must grant exactly 1000 campaign credits';
  END IF;
  IF premium_credit <> 2500 THEN
    RAISE EXCEPTION 'active battle pass premium track must grant exactly 2500 campaign credits';
  END IF;
  IF invalid_credit_count <> 0 THEN
    RAISE EXCEPTION 'active battle pass credit rewards must grant at least 5 campaign credits';
  END IF;
  IF free_level_100_titles <> 1 OR premium_level_100_titles <> 1 THEN
    RAISE EXCEPTION 'active battle pass requires one free and one premium title at level 100';
  END IF;
  IF level_100_credit_count <> 0 THEN
    RAISE EXCEPTION 'battle pass level 100 cannot grant campaign credits';
  END IF;

  WITH expected(track,level,amount) AS (
    VALUES
      ('free'::varchar,2::smallint,5::bigint),
      ('free',4,15),('free',7,30),('free',10,50),
      ('free',12,5),('free',14,15),('free',17,30),('free',20,50),
      ('free',22,5),('free',24,15),('free',27,30),('free',30,50),
      ('free',32,5),('free',34,15),('free',37,30),('free',40,50),
      ('free',42,5),('free',44,15),('free',47,30),('free',50,50),
      ('free',52,5),('free',54,15),('free',57,30),('free',60,50),
      ('free',62,5),('free',64,15),('free',67,30),('free',70,50),
      ('free',72,5),('free',74,15),('free',77,30),('free',80,50),
      ('free',82,5),('free',84,15),('free',87,30),('free',90,50),
      ('free',92,5),('free',94,15),('free',97,30),('free',99,50),

      ('premium',1,5),('premium',3,20),('premium',5,50),
      ('premium',8,75),('premium',10,100),
      ('premium',11,5),('premium',13,20),('premium',15,50),
      ('premium',18,75),('premium',20,100),
      ('premium',21,5),('premium',23,20),('premium',25,50),
      ('premium',28,75),('premium',30,100),
      ('premium',31,5),('premium',33,20),('premium',35,50),
      ('premium',38,75),('premium',40,100),
      ('premium',41,5),('premium',43,20),('premium',45,50),
      ('premium',48,75),('premium',50,100),
      ('premium',51,5),('premium',53,20),('premium',55,50),
      ('premium',58,75),('premium',60,100),
      ('premium',61,5),('premium',63,20),('premium',65,50),
      ('premium',68,75),('premium',70,100),
      ('premium',71,5),('premium',73,20),('premium',75,50),
      ('premium',78,75),('premium',80,100),
      ('premium',81,5),('premium',83,20),('premium',85,50),
      ('premium',88,75),('premium',90,100),
      ('premium',91,5),('premium',93,20),('premium',95,50),
      ('premium',98,75),('premium',99,100)
  ),
  actual AS (
    SELECT track,level,credit_amount AS amount
      FROM catalog.battle_pass_rewards
     WHERE season_id=NEW.id
       AND reward_kind='campaign_credit'
  )
  SELECT
    (SELECT COUNT(*) FROM expected e
      WHERE NOT EXISTS (
        SELECT 1 FROM actual a
         WHERE a.track=e.track AND a.level=e.level AND a.amount=e.amount
      )),
    (SELECT COUNT(*) FROM actual a
      WHERE NOT EXISTS (
        SELECT 1 FROM expected e
         WHERE e.track=a.track AND e.level=a.level AND e.amount=a.amount
      ))
  INTO missing_credit_count,extra_credit_count;

  IF missing_credit_count <> 0 OR extra_credit_count <> 0 THEN
    RAISE EXCEPTION 'active battle pass credit matrix does not match V1';
  END IF;

  SELECT
    COUNT(*) FILTER (
      WHERE track='free' AND reward_kind<>'campaign_credit'
    ),
    COUNT(*) FILTER (
      WHERE track='premium' AND reward_kind<>'campaign_credit'
    )
  INTO free_cosmetic_count,premium_cosmetic_count
  FROM catalog.battle_pass_rewards
  WHERE season_id=NEW.id;

  IF free_cosmetic_count <> 6 OR premium_cosmetic_count <> 11 THEN
    RAISE EXCEPTION 'active battle pass must contain exactly 17 V1 cosmetic rewards';
  END IF;

  WITH actual AS (
    SELECT reward.level,reward.track,reward.reward_kind,
           cosmetic.slot,
           reward.presentation_group_key
      FROM catalog.battle_pass_rewards reward
      LEFT JOIN catalog.cosmetics cosmetic ON cosmetic.id=reward.cosmetic_id
     WHERE reward.season_id=NEW.id
       AND reward.reward_kind<>'campaign_credit'
  ),
  expected(level,track,reward_kind,slot,presentation_group_key) AS (
    VALUES
      (15::smallint,'free'::varchar,'game_cosmetic'::varchar,'dice_attack'::varchar,NULL::text),
      (35,'free','game_cosmetic','dice_defense',NULL),
      (55,'free','game_cosmetic','dice_neutral',NULL),
      (75,'free','game_cosmetic','territory_skin',NULL),
      (90,'free','profile_background',NULL,NULL),
      (100,'free','commander_title',NULL,NULL),

      (1,'premium','game_cosmetic','dice_attack','premium-initial-set'),
      (1,'premium','game_cosmetic','dice_defense','premium-initial-set'),
      (1,'premium','game_cosmetic','dice_neutral','premium-initial-set'),
      (25,'premium','game_cosmetic','territory_skin',NULL),
      (50,'premium','profile_background',NULL,NULL),

      (60,'premium','game_cosmetic','dice_attack',NULL),
      (70,'premium','game_cosmetic','dice_defense',NULL),
      (80,'premium','game_cosmetic','dice_neutral',NULL),
      (90,'premium','game_cosmetic','territory_skin',NULL),
      (95,'premium','profile_background',NULL,NULL),
      (100,'premium','commander_title',NULL,NULL)
  )
  SELECT COUNT(*)::int
    INTO invalid_cosmetic_count
    FROM expected e
   WHERE NOT EXISTS (
     SELECT 1
       FROM actual a
      WHERE a.level=e.level
        AND a.track=e.track
        AND a.reward_kind=e.reward_kind
        AND a.slot IS NOT DISTINCT FROM e.slot
        AND (
          e.presentation_group_key IS NULL
          OR a.presentation_group_key=e.presentation_group_key
        )
   );

  IF invalid_cosmetic_count <> 0 THEN
    RAISE EXCEPTION 'active battle pass cosmetic matrix does not match V1';
  END IF;

  WITH expected(level) AS (
    VALUES
      (6::smallint),(9),(16),(19),(26),(29),(36),(39),(46),(49),
      (56),(59),(66),(69),(76),(79),(86),(89),(96)
  ),
  actual AS (
    SELECT level
      FROM catalog.battle_pass_levels level
     WHERE level.season_id=NEW.id
       AND NOT EXISTS (
         SELECT 1
           FROM catalog.battle_pass_rewards reward
          WHERE reward.season_id=NEW.id
            AND reward.level=level.level
       )
  )
  SELECT
    (SELECT COUNT(*) FROM expected e
      WHERE NOT EXISTS (SELECT 1 FROM actual a WHERE a.level=e.level))
    +
    (SELECT COUNT(*) FROM actual a
      WHERE NOT EXISTS (SELECT 1 FROM expected e WHERE e.level=a.level))
  INTO empty_level_mismatch_count;

  IF empty_level_mismatch_count <> 0 THEN
    RAISE EXCEPTION 'active battle pass empty-level matrix does not match V1';
  END IF;

  SELECT COUNT(*)::int
    INTO elite_offer_count
    FROM catalog.product_entitlements entitlement
    JOIN catalog.products product
      ON product.id=entitlement.product_id
     AND product.active=TRUE
    JOIN catalog.offers offer
      ON offer.product_id=product.id
     AND offer.active=TRUE
     AND offer.status='available'
     AND offer.currency_code='campaign-credit'
    JOIN catalog.battle_pass_pricing pricing
      ON pricing.season_id=entitlement.battle_pass_season_id
     AND pricing.fixed_price=3000
   WHERE entitlement.entitlement_kind='battle_pass_access'
     AND entitlement.battle_pass_season_id=NEW.id
     AND (offer.starts_at IS NULL OR offer.starts_at <= NEW.starts_at)
     AND (offer.ends_at IS NULL OR offer.ends_at >= NEW.ends_at);

  IF elite_offer_count <> 1 THEN
    RAISE EXCEPTION 'active battle pass requires exactly one Elite offer covering the season at 3000 campaign credits';
  END IF;

  RETURN NEW;
END
$body$;

COMMENT ON FUNCTION catalog.validate_battle_pass_activation() IS
  'Rejects activation unless the complete Bellum Civile Battle Pass V1 catalog matrix is valid.';

-- Passe de Campanha V1: reward identity integrity before activation.
-- The V1 layout already validates positions and slots in 072; this migration
-- ensures those positions represent distinct seasonal items rather than
-- repeating the same catalog ownership across multiple milestones.
--
-- Up Migration

CREATE OR REPLACE FUNCTION catalog.validate_battle_pass_reward_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $body$
DECLARE
  distinct_dice_count INTEGER;
  distinct_territory_count INTEGER;
  distinct_background_count INTEGER;
  distinct_title_count INTEGER;
BEGIN
  IF NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;

  SELECT
    COUNT(DISTINCT reward.cosmetic_id) FILTER (
      WHERE reward.reward_kind='game_cosmetic'
        AND cosmetic.slot IN ('dice_attack','dice_defense','dice_neutral')
    ),
    COUNT(DISTINCT reward.cosmetic_id) FILTER (
      WHERE reward.reward_kind='game_cosmetic'
        AND cosmetic.slot='territory_skin'
    ),
    COUNT(DISTINCT reward.background_id) FILTER (
      WHERE reward.reward_kind='profile_background'
    ),
    COUNT(DISTINCT reward.title_id) FILTER (
      WHERE reward.reward_kind='commander_title'
    )
  INTO
    distinct_dice_count,
    distinct_territory_count,
    distinct_background_count,
    distinct_title_count
  FROM catalog.battle_pass_rewards reward
  LEFT JOIN catalog.cosmetics cosmetic
    ON cosmetic.id=reward.cosmetic_id
  WHERE reward.season_id=NEW.id;

  IF distinct_dice_count <> 9 THEN
    RAISE EXCEPTION
      'active battle pass requires 9 distinct seasonal dice rewards';
  END IF;

  IF distinct_territory_count <> 3 THEN
    RAISE EXCEPTION
      'active battle pass requires 3 distinct seasonal territory skins';
  END IF;

  IF distinct_background_count <> 3 THEN
    RAISE EXCEPTION
      'active battle pass requires 3 distinct seasonal backgrounds';
  END IF;

  IF distinct_title_count <> 2 THEN
    RAISE EXCEPTION
      'active battle pass requires distinct free and Elite level-100 titles';
  END IF;

  RETURN NEW;
END
$body$;

DROP TRIGGER IF EXISTS battle_pass_seasons_reward_identity_guard
  ON catalog.battle_pass_seasons;
CREATE TRIGGER battle_pass_seasons_reward_identity_guard
BEFORE INSERT OR UPDATE OF status
ON catalog.battle_pass_seasons
FOR EACH ROW
EXECUTE FUNCTION catalog.validate_battle_pass_reward_identity();

COMMENT ON FUNCTION catalog.validate_battle_pass_reward_identity() IS
  'Requires the 17 V1 cosmetic reward positions to resolve to 9 distinct dice, 3 distinct territory skins, 3 backgrounds and 2 titles before activation.';


-- ---------------------------------------------------------------------------
-- Season 1 concrete catalog and reward-exclusive commerce policy.
-- Window: 2026-09-30 through 2026-12-31 (America/Sao_Paulo), claims through
-- 2027-01-07. Editorial hero/logo remain NULL until dedicated season assets exist.
-- ---------------------------------------------------------------------------

INSERT INTO catalog.commander_titles(
  id,name,description,rarity,is_active,display_text,font_key,style_key,texture_ref,collection_id
)
VALUES
(
  'title.battle-pass.primeiro-pecador',
  'Primeiro Pecador',
  'Alcançou o nível 100 da trilha Livre do primeiro Passe de Campanha.',
  'epic',TRUE,'PRIMEIRO PECADOR','ceremonial',
  'crimson-metal-sheen_glow-red-medium',NULL,NULL
),
(
  'title.battle-pass.portador-da-luz',
  'Portador da Luz',
  'Alcançou o nível 100 da trilha Elite do primeiro Passe de Campanha.',
  'legendary',TRUE,'PORTADOR DA LUZ','imperial',
  'gold-metal-sheen_glow-gold-strong-breathe',NULL,NULL
)
ON CONFLICT (id) DO UPDATE
SET name=EXCLUDED.name,
    description=EXCLUDED.description,
    rarity=EXCLUDED.rarity,
    is_active=TRUE,
    display_text=EXCLUDED.display_text,
    font_key=EXCLUDED.font_key,
    style_key=EXCLUDED.style_key,
    texture_ref=NULL,
    collection_id=NULL,
    updated_at=NOW();

INSERT INTO catalog.commander_title_stats(title_id,acquisition_count)
SELECT title.id,COUNT(owned.user_id)::bigint
  FROM catalog.commander_titles title
  LEFT JOIN profile.commander_titles owned ON owned.title_id=title.id
 WHERE title.id IN (
   'title.battle-pass.primeiro-pecador',
   'title.battle-pass.portador-da-luz'
 )
 GROUP BY title.id
ON CONFLICT (title_id) DO NOTHING;

DO $body$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname='commander_titles_battle_pass_exclusive_no_collection_check'
       AND conrelid='catalog.commander_titles'::regclass
  ) THEN
    ALTER TABLE catalog.commander_titles
      ADD CONSTRAINT commander_titles_battle_pass_exclusive_no_collection_check
      CHECK (
        id NOT IN (
          'title.battle-pass.primeiro-pecador',
          'title.battle-pass.portador-da-luz'
        )
        OR collection_id IS NULL
      );
  END IF;
END
$body$;

CREATE OR REPLACE FUNCTION catalog.reject_battle_pass_exclusive_title_commerce()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $body$
BEGIN
  IF NEW.title_id IN (
    'title.battle-pass.primeiro-pecador',
    'title.battle-pass.portador-da-luz'
  ) THEN
    RAISE EXCEPTION
      'battle pass completion title % is reward-exclusive and cannot be attached to commerce',
      NEW.title_id
      USING ERRCODE='check_violation';
  END IF;
  RETURN NEW;
END
$body$;

DROP TRIGGER IF EXISTS battle_pass_exclusive_title_pricing_guard
  ON catalog.commander_title_pricing;
CREATE TRIGGER battle_pass_exclusive_title_pricing_guard
BEFORE INSERT OR UPDATE OF title_id
ON catalog.commander_title_pricing
FOR EACH ROW
EXECUTE FUNCTION catalog.reject_battle_pass_exclusive_title_commerce();

DROP TRIGGER IF EXISTS battle_pass_exclusive_title_product_guard
  ON catalog.product_entitlements;
CREATE TRIGGER battle_pass_exclusive_title_product_guard
BEFORE INSERT OR UPDATE OF title_id,entitlement_kind
ON catalog.product_entitlements
FOR EACH ROW
WHEN (NEW.entitlement_kind='commander_title')
EXECUTE FUNCTION catalog.reject_battle_pass_exclusive_title_commerce();

-- Reward-only cosmetics remain catalog-visible/equippable, but their direct
-- storefront windows are retired while the season is live/historical.
UPDATE catalog.offers offer
   SET status='retired',
       active=FALSE,
       is_featured=FALSE,
       updated_at=NOW()
 WHERE offer.product_id IN (
   SELECT product.id
     FROM catalog.products product
    WHERE product.collection_id IN (
      'collection.first-blood',
      'collection.alvorada',
      'collection.prima-lux'
    )
   UNION
   SELECT membership.product_id
     FROM catalog.product_items membership
     JOIN catalog.cosmetics item ON item.id=membership.cosmetic_id
    WHERE item.collection_id IN (
      'collection.first-blood',
      'collection.alvorada',
      'collection.prima-lux'
    )
   UNION
   SELECT entitlement.product_id
     FROM catalog.product_entitlements entitlement
    WHERE entitlement.entitlement_kind='profile_background'
      AND entitlement.background_id IN (
        'profile.background.first-blood',
        'profile.background.alvorada',
        'profile.background.prima-lux'
      )
 );

INSERT INTO catalog.battle_pass_xp_profiles(
  id,completion_xp,victory_bonus_xp,solo_human_bot_multiplier_bps,
  action_model_version,
  troop_placed_xp,troop_placed_cap_xp,
  card_trade_xp,card_trade_cap_xp,
  troop_lost_dice_xp,troop_lost_dice_cap_xp,
  enemy_troop_defeated_xp,enemy_troop_defeated_cap_xp,
  territory_first_conquest_xp,territory_second_conquest_xp
)
VALUES(
  'battle-pass-xp.v1',150,200,4000,
  2,
  1,60,
  20,80,
  1,50,
  2,100,
  25,10
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO catalog.battle_pass_seasons(
  id,slug,name,description,
  starts_at,ends_at,claim_ends_at,status,max_level,xp_profile_id,
  hero_asset_ref,logo_asset_ref
)
VALUES(
  'battle-pass.season-1',
  'season-1',
  'Temporada 1',
  'Primeira temporada do Passe de Campanha de Bellum Civile.',
  TIMESTAMPTZ '2026-09-30 00:00:00-03',
  TIMESTAMPTZ '2026-12-31 23:59:59-03',
  TIMESTAMPTZ '2027-01-07 23:59:59-03',
  'draft',
  100,
  'battle-pass-xp.v1',
  NULL,
  NULL
)
ON CONFLICT (id) DO NOTHING;

WITH steps AS (
  SELECT
    level,
    (
      5 * ROUND(
        (
          225
          + 3 * (level - 1)
          + 0.01 * (level - 1) * (level - 1)
        ) / 5.0
      )
    )::bigint AS step_xp
  FROM generate_series(1,99) AS level
),
thresholds AS (
  SELECT 1::smallint AS level,0::bigint AS required_total_xp
  UNION ALL
  SELECT
    (level + 1)::smallint,
    SUM(step_xp) OVER (ORDER BY level)::bigint
  FROM steps
)
INSERT INTO catalog.battle_pass_levels(season_id,level,required_total_xp)
SELECT 'battle-pass.season-1',level,required_total_xp
  FROM thresholds
 WHERE EXISTS (
   SELECT 1 FROM catalog.battle_pass_seasons season
    WHERE season.id='battle-pass.season-1'
      AND season.status IN ('draft','announced')
 )
ON CONFLICT (season_id,level) DO NOTHING;

WITH matrix(level,amount) AS (
  VALUES
    (2::smallint,5::bigint),(4,15),(7,30),(10,50),
    (12,5),(14,15),(17,30),(20,50),
    (22,5),(24,15),(27,30),(30,50),
    (32,5),(34,15),(37,30),(40,50),
    (42,5),(44,15),(47,30),(50,50),
    (52,5),(54,15),(57,30),(60,50),
    (62,5),(64,15),(67,30),(70,50),
    (72,5),(74,15),(77,30),(80,50),
    (82,5),(84,15),(87,30),(90,50),
    (92,5),(94,15),(97,30),(99,50)
)
INSERT INTO catalog.battle_pass_rewards(
  id,season_id,level,track,position,reward_kind,credit_amount,
  cosmetic_id,title_id,background_id,presentation_group_key
)
SELECT
  'reward.season-1.free.credit.' || LPAD(level::text,3,'0'),
  'battle-pass.season-1',level,'free',0,'campaign_credit',amount,
  NULL,NULL,NULL,NULL
FROM matrix
WHERE EXISTS (
  SELECT 1 FROM catalog.battle_pass_seasons season
   WHERE season.id='battle-pass.season-1'
     AND season.status IN ('draft','announced')
)
ON CONFLICT (id) DO NOTHING;

WITH matrix(level,amount) AS (
  VALUES
    (1::smallint,5::bigint),(3,20),(5,50),(8,75),(10,100),
    (11,5),(13,20),(15,50),(18,75),(20,100),
    (21,5),(23,20),(25,50),(28,75),(30,100),
    (31,5),(33,20),(35,50),(38,75),(40,100),
    (41,5),(43,20),(45,50),(48,75),(50,100),
    (51,5),(53,20),(55,50),(58,75),(60,100),
    (61,5),(63,20),(65,50),(68,75),(70,100),
    (71,5),(73,20),(75,50),(78,75),(80,100),
    (81,5),(83,20),(85,50),(88,75),(90,100),
    (91,5),(93,20),(95,50),(98,75),(99,100)
)
INSERT INTO catalog.battle_pass_rewards(
  id,season_id,level,track,position,reward_kind,credit_amount,
  cosmetic_id,title_id,background_id,presentation_group_key
)
SELECT
  'reward.season-1.premium.credit.' || LPAD(level::text,3,'0'),
  'battle-pass.season-1',level,'premium',0,'campaign_credit',amount,
  NULL,NULL,NULL,NULL
FROM matrix
WHERE EXISTS (
  SELECT 1 FROM catalog.battle_pass_seasons season
   WHERE season.id='battle-pass.season-1'
     AND season.status IN ('draft','announced')
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO catalog.battle_pass_rewards(
  id,season_id,level,track,position,reward_kind,credit_amount,
  cosmetic_id,title_id,background_id,presentation_group_key
)
SELECT
  reward.id,
  reward.season_id,
  reward.level::smallint,
  reward.track::varchar,
  reward.position::smallint,
  reward.reward_kind::varchar,
  NULL::bigint,
  reward.cosmetic_id,
  reward.title_id,
  reward.background_id,
  reward.presentation_group_key
FROM (VALUES
  ('reward.season-1.free.first-blood.attack','battle-pass.season-1',15,'free',0,'game_cosmetic',NULL,'dice.attack.first-blood',NULL,NULL,NULL),
  ('reward.season-1.free.first-blood.defense','battle-pass.season-1',35,'free',0,'game_cosmetic',NULL,'dice.defense.first-blood',NULL,NULL,NULL),
  ('reward.season-1.free.first-blood.neutral','battle-pass.season-1',55,'free',0,'game_cosmetic',NULL,'dice.neutral.first-blood',NULL,NULL,NULL),
  ('reward.season-1.free.first-blood.territory','battle-pass.season-1',75,'free',0,'game_cosmetic',NULL,'territory.effect.first-blood',NULL,NULL,NULL),
  ('reward.season-1.free.first-blood.background','battle-pass.season-1',90,'free',1,'profile_background',NULL,NULL,NULL,'profile.background.first-blood',NULL),
  ('reward.season-1.free.primeiro-pecador','battle-pass.season-1',100,'free',0,'commander_title',NULL,NULL,'title.battle-pass.primeiro-pecador',NULL,NULL),

  ('reward.season-1.premium.alvorada.attack','battle-pass.season-1',1,'premium',1,'game_cosmetic',NULL,'dice.attack.alvorada',NULL,NULL,'premium-initial-set'),
  ('reward.season-1.premium.alvorada.defense','battle-pass.season-1',1,'premium',2,'game_cosmetic',NULL,'dice.defense.alvorada',NULL,NULL,'premium-initial-set'),
  ('reward.season-1.premium.alvorada.neutral','battle-pass.season-1',1,'premium',3,'game_cosmetic',NULL,'dice.neutral.alvorada',NULL,NULL,'premium-initial-set'),
  ('reward.season-1.premium.alvorada.territory','battle-pass.season-1',25,'premium',1,'game_cosmetic',NULL,'territory.effect.alvorada',NULL,NULL,NULL),
  ('reward.season-1.premium.alvorada.background','battle-pass.season-1',50,'premium',1,'profile_background',NULL,NULL,NULL,'profile.background.alvorada',NULL),

  ('reward.season-1.premium.prima-lux.attack','battle-pass.season-1',60,'premium',1,'game_cosmetic',NULL,'dice.attack.prima-lux',NULL,NULL,NULL),
  ('reward.season-1.premium.prima-lux.defense','battle-pass.season-1',70,'premium',1,'game_cosmetic',NULL,'dice.defense.prima-lux',NULL,NULL,NULL),
  ('reward.season-1.premium.prima-lux.neutral','battle-pass.season-1',80,'premium',1,'game_cosmetic',NULL,'dice.neutral.prima-lux',NULL,NULL,NULL),
  ('reward.season-1.premium.prima-lux.territory','battle-pass.season-1',90,'premium',1,'game_cosmetic',NULL,'territory.effect.prima-lux',NULL,NULL,NULL),
  ('reward.season-1.premium.prima-lux.background','battle-pass.season-1',95,'premium',1,'profile_background',NULL,NULL,NULL,'profile.background.prima-lux',NULL),
  ('reward.season-1.premium.portador-da-luz','battle-pass.season-1',100,'premium',0,'commander_title',NULL,NULL,'title.battle-pass.portador-da-luz',NULL,NULL)
) AS reward(
  id,season_id,level,track,position,reward_kind,ignored_credit_amount,
  cosmetic_id,title_id,background_id,presentation_group_key
)
WHERE EXISTS (
  SELECT 1 FROM catalog.battle_pass_seasons season
   WHERE season.id='battle-pass.season-1'
     AND season.status IN ('draft','announced')
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO catalog.battle_pass_pricing(season_id,fixed_price)
SELECT 'battle-pass.season-1',3000
WHERE EXISTS (
  SELECT 1 FROM catalog.battle_pass_seasons season
   WHERE season.id='battle-pass.season-1'
     AND season.status IN ('draft','announced')
)
ON CONFLICT (season_id) DO NOTHING;

INSERT INTO catalog.battle_pass_stats(season_id,acquisition_count)
VALUES('battle-pass.season-1',0)
ON CONFLICT (season_id) DO NOTHING;

INSERT INTO catalog.products(
  id,collection_id,slug,name,description,product_type,bundle_discount_bps,active
)
VALUES(
  'product.battle-pass.season-1',
  NULL,
  'battle-pass-season-1',
  'Passe Elite · Temporada 1',
  'Acesso à trilha Elite da Temporada 1 do Passe de Campanha.',
  'single',
  0,
  TRUE
)
ON CONFLICT (id) DO UPDATE
SET collection_id=NULL,
    slug=EXCLUDED.slug,
    name=EXCLUDED.name,
    description=EXCLUDED.description,
    product_type='single',
    bundle_discount_bps=0,
    active=TRUE,
    updated_at=NOW();

INSERT INTO catalog.product_entitlements(
  product_id,position,entitlement_kind,
  cosmetic_id,title_id,background_id,battle_pass_season_id
)
VALUES(
  'product.battle-pass.season-1',0,'battle_pass_access',
  NULL,NULL,NULL,'battle-pass.season-1'
)
ON CONFLICT (product_id,position) DO UPDATE
SET entitlement_kind='battle_pass_access',
    cosmetic_id=NULL,
    title_id=NULL,
    background_id=NULL,
    battle_pass_season_id='battle-pass.season-1';

INSERT INTO catalog.offers(
  id,slug,name,description,currency_code,price,status,is_featured,sort_order,
  product_id,pricing_model,starts_at,ends_at,active,priority
)
VALUES(
  'offer.battle-pass.season-1',
  'battle-pass-season-1',
  'Passe Elite · Temporada 1',
  'Desbloqueia a trilha Elite da Temporada 1.',
  'campaign-credit',
  3000,
  'available',
  TRUE,
  50,
  'product.battle-pass.season-1',
  'itemized',
  TIMESTAMPTZ '2026-09-30 00:00:00-03',
  TIMESTAMPTZ '2026-12-31 23:59:59-03',
  TRUE,
  50
)
ON CONFLICT (id) DO UPDATE
SET slug=EXCLUDED.slug,
    name=EXCLUDED.name,
    description=EXCLUDED.description,
    currency_code='campaign-credit',
    price=3000,
    status='available',
    is_featured=TRUE,
    sort_order=50,
    product_id='product.battle-pass.season-1',
    pricing_model='itemized',
    starts_at=EXCLUDED.starts_at,
    ends_at=EXCLUDED.ends_at,
    active=TRUE,
    priority=50,
    updated_at=NOW();

CREATE OR REPLACE FUNCTION catalog.reject_battle_pass_reward_direct_offer()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $body$
BEGIN
  IF NEW.active=TRUE AND NEW.status='available' AND EXISTS (
    SELECT 1
      FROM catalog.battle_pass_rewards reward
      JOIN catalog.battle_pass_seasons season ON season.id=reward.season_id
     WHERE season.status IN ('announced','active','ended')
       AND (
         (
           reward.reward_kind='game_cosmetic'
           AND EXISTS (
             SELECT 1
               FROM catalog.product_items item_membership
              WHERE item_membership.product_id=NEW.product_id
                AND item_membership.cosmetic_id=reward.cosmetic_id
           )
         )
         OR
         (
           reward.reward_kind='profile_background'
           AND EXISTS (
             SELECT 1
               FROM catalog.product_entitlements entitlement
              WHERE entitlement.product_id=NEW.product_id
                AND entitlement.entitlement_kind='profile_background'
                AND entitlement.background_id=reward.background_id
           )
         )
         OR
         (
           reward.reward_kind='commander_title'
           AND EXISTS (
             SELECT 1
               FROM catalog.product_entitlements entitlement
              WHERE entitlement.product_id=NEW.product_id
                AND entitlement.entitlement_kind='commander_title'
                AND entitlement.title_id=reward.title_id
           )
         )
       )
  ) THEN
    RAISE EXCEPTION
      'battle pass reward product % cannot have an active direct offer while its season is live or claimable',
      NEW.product_id
      USING ERRCODE='check_violation';
  END IF;

  RETURN NEW;
END
$body$;

DROP TRIGGER IF EXISTS battle_pass_reward_direct_offer_guard
  ON catalog.offers;
CREATE TRIGGER battle_pass_reward_direct_offer_guard
BEFORE INSERT OR UPDATE OF product_id,status,active
ON catalog.offers
FOR EACH ROW
EXECUTE FUNCTION catalog.reject_battle_pass_reward_direct_offer();

COMMENT ON FUNCTION catalog.reject_battle_pass_reward_direct_offer() IS
  'Prevents Battle Pass reward cosmetics, backgrounds and titles from being sold directly while their season is announced, active or still claimable.';

UPDATE catalog.battle_pass_seasons
   SET status='active'
 WHERE id='battle-pass.season-1'
   AND status IN ('draft','announced');

-- Down Migration
-- Season progression, ownership and purchase history are durable. Evolve forward.
