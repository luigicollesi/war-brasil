-- Passe de Campanha V1: Elite must remain an isolated, undiscounted
-- Economy V2 entitlement so the authoritative purchase quote is exactly 3000 CR.
--
-- Up Migration

CREATE OR REPLACE FUNCTION catalog.validate_battle_pass_elite_economy_activation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $body$
DECLARE
  valid_offer_count INTEGER;
BEGIN
  IF NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*)::int
    INTO valid_offer_count
    FROM catalog.product_entitlements entitlement
    JOIN catalog.products product
      ON product.id=entitlement.product_id
    JOIN catalog.offers offer
      ON offer.product_id=product.id
    JOIN catalog.battle_pass_pricing pricing
      ON pricing.season_id=entitlement.battle_pass_season_id
   WHERE entitlement.entitlement_kind='battle_pass_access'
     AND entitlement.battle_pass_season_id=NEW.id
     AND pricing.fixed_price=3000
     AND product.active=TRUE
     AND product.bundle_discount_bps=0
     AND product.collection_id IS NULL
     AND (
       SELECT COUNT(*)
         FROM catalog.product_entitlements sibling
        WHERE sibling.product_id=product.id
     )=1
     AND offer.active=TRUE
     AND offer.status='available'
     AND offer.currency_code='campaign-credit'
     AND (offer.starts_at IS NULL OR offer.starts_at <= NEW.starts_at)
     AND (offer.ends_at IS NULL OR offer.ends_at >= NEW.ends_at);

  IF valid_offer_count <> 1 THEN
    RAISE EXCEPTION
      'active battle pass Elite must have exactly one isolated undiscounted 3000-credit offer';
  END IF;

  RETURN NEW;
END
$body$;

DROP TRIGGER IF EXISTS battle_pass_seasons_elite_economy_guard
  ON catalog.battle_pass_seasons;
CREATE TRIGGER battle_pass_seasons_elite_economy_guard
BEFORE INSERT OR UPDATE OF status ON catalog.battle_pass_seasons
FOR EACH ROW
EXECUTE FUNCTION catalog.validate_battle_pass_elite_economy_activation();

COMMENT ON FUNCTION catalog.validate_battle_pass_elite_economy_activation() IS
  'Prevents bundle/collection discounts or mixed entitlements from changing the V1 Elite price from exactly 3000 campaign credits.';

-- Down Migration
-- Battle Pass commerce constraints are forward-only once a season can be sold.
