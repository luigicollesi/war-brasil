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

  IF free_cosmetic_count <> 6 OR premium_cosmetic_count <> 10 THEN
    RAISE EXCEPTION 'active battle pass must contain exactly 16 V1 cosmetic rewards';
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
      (1,'premium','game_cosmetic','territory_skin','premium-initial-set'),

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

-- Down Migration
-- Keep validation forward-only once seasonal catalog data exists.
