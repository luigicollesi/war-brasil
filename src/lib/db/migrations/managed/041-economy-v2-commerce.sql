-- Up Migration

CREATE TABLE IF NOT EXISTS catalog.offers (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name VARCHAR(96) NOT NULL,
  description TEXT,
  currency_code TEXT NOT NULL REFERENCES economy.currencies(code) ON DELETE RESTRICT,
  price BIGINT NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'draft',
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT catalog_offers_price_check CHECK (price > 0),
  CONSTRAINT catalog_offers_currency_check CHECK (currency_code = 'campaign-credit'),
  CONSTRAINT catalog_offers_status_check CHECK (status IN ('draft', 'available', 'retired'))
);

CREATE INDEX IF NOT EXISTS catalog_offers_storefront_idx
  ON catalog.offers(status, sort_order, id);

CREATE TABLE IF NOT EXISTS catalog.offer_items (
  offer_id TEXT NOT NULL REFERENCES catalog.offers(id) ON DELETE CASCADE,
  cosmetic_id TEXT NOT NULL REFERENCES catalog.cosmetics(id) ON DELETE RESTRICT,
  position SMALLINT NOT NULL DEFAULT 0 CHECK (position >= 0),
  PRIMARY KEY (offer_id, cosmetic_id),
  UNIQUE (offer_id, position)
);

CREATE INDEX IF NOT EXISTS catalog_offer_items_cosmetic_idx
  ON catalog.offer_items(cosmetic_id, offer_id);

CREATE TABLE IF NOT EXISTS economy.purchases (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  offer_id TEXT NOT NULL REFERENCES catalog.offers(id) ON DELETE RESTRICT,
  currency_code TEXT NOT NULL,
  price_paid BIGINT NOT NULL,
  offer_item_count SMALLINT NOT NULL,
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT economy_purchases_price_check CHECK (price_paid > 0),
  CONSTRAINT economy_purchases_offer_item_count_check CHECK (offer_item_count > 0),
  CONSTRAINT economy_purchases_currency_check CHECK (currency_code = 'campaign-credit'),
  CONSTRAINT economy_purchases_idempotency_key_check
    CHECK (char_length(btrim(idempotency_key)) BETWEEN 8 AND 128),
  CONSTRAINT economy_purchases_wallet_fk
    FOREIGN KEY (user_id, currency_code)
    REFERENCES economy.wallets(user_id, currency_code)
    ON DELETE RESTRICT,
  UNIQUE (user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS economy_purchases_user_created_idx
  ON economy.purchases(user_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS economy_purchases_offer_idx
  ON economy.purchases(offer_id, created_at DESC);

CREATE TABLE IF NOT EXISTS economy.purchase_items (
  purchase_id UUID NOT NULL REFERENCES economy.purchases(id) ON DELETE RESTRICT,
  cosmetic_id TEXT NOT NULL REFERENCES catalog.cosmetics(id) ON DELETE RESTRICT,
  PRIMARY KEY (purchase_id, cosmetic_id)
);

CREATE INDEX IF NOT EXISTS economy_purchase_items_cosmetic_idx
  ON economy.purchase_items(cosmetic_id, purchase_id);

CREATE TABLE IF NOT EXISTS catalog.credit_packs (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name VARCHAR(96) NOT NULL,
  credit_amount BIGINT NOT NULL,
  price_brl_cents BIGINT NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'announced',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT catalog_credit_packs_credit_amount_check CHECK (credit_amount > 0),
  CONSTRAINT catalog_credit_packs_price_brl_check CHECK (price_brl_cents > 0),
  CONSTRAINT catalog_credit_packs_status_check CHECK (status IN ('draft', 'announced', 'retired'))
);

CREATE INDEX IF NOT EXISTS catalog_credit_packs_storefront_idx
  ON catalog.credit_packs(status, sort_order, id);

INSERT INTO catalog.offers(
  id,
  slug,
  name,
  description,
  currency_code,
  price,
  status,
  is_featured,
  sort_order
)
VALUES
  ('offer.exercito', 'exercito', 'Exército', 'Conjunto de dados militares clássicos.', 'campaign-credit', 400, 'available', TRUE, 10),
  ('offer.lancas', 'lancas', 'Lanças', 'Conjunto de dados inspirado em lanças medievais.', 'campaign-credit', 400, 'available', FALSE, 20),
  ('offer.viking', 'viking', 'Viking', 'Conjunto de dados de temática Viking.', 'campaign-credit', 400, 'available', FALSE, 30),
  ('offer.gato', 'gato', 'Gato', 'Conjunto de dados de temática felina.', 'campaign-credit', 400, 'available', FALSE, 40),
  ('offer.cachorro', 'cachorro', 'Cachorro', 'Conjunto de dados de temática canina.', 'campaign-credit', 400, 'available', FALSE, 50),
  ('offer.futebol', 'futebol', 'Futebol', 'Conjunto de dados de temática futebolística.', 'campaign-credit', 400, 'available', FALSE, 60)
ON CONFLICT (id) DO NOTHING;

WITH offer_sets(offer_id, set_id) AS (
  VALUES
    ('offer.exercito', 'set.exercito'),
    ('offer.lancas', 'set.lancas'),
    ('offer.viking', 'set.viking'),
    ('offer.gato', 'set.gato'),
    ('offer.cachorro', 'set.cachorro'),
    ('offer.futebol', 'set.futebol')
)
INSERT INTO catalog.offer_items(offer_id, cosmetic_id, position)
SELECT mapping.offer_id, membership.cosmetic_id, membership.position
  FROM offer_sets mapping
  JOIN catalog.cosmetic_set_items membership ON membership.set_id=mapping.set_id
ON CONFLICT (offer_id, cosmetic_id) DO NOTHING;

UPDATE catalog.cosmetics item
   SET status='available',
       updated_at=NOW()
 WHERE item.id IN (
   SELECT offer_item.cosmetic_id
     FROM catalog.offer_items offer_item
     JOIN catalog.offers offer ON offer.id=offer_item.offer_id
    WHERE offer.status='available'
 );

UPDATE catalog.cosmetic_sets cosmetic_set
   SET status='available',
       updated_at=NOW()
 WHERE cosmetic_set.id IN (
   'set.exercito',
   'set.lancas',
   'set.viking',
   'set.gato',
   'set.cachorro',
   'set.futebol'
 );

INSERT INTO catalog.credit_packs(
  id,
  slug,
  name,
  credit_amount,
  price_brl_cents,
  status,
  sort_order
)
VALUES
  ('credits.500', '500-creditos', '500 Créditos', 500, 990, 'announced', 10),
  ('credits.1200', '1200-creditos', '1.200 Créditos', 1200, 1990, 'announced', 20),
  ('credits.3000', '3000-creditos', '3.000 Créditos', 3000, 3990, 'announced', 30)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE catalog.offers IS
  'Commercial units for Economy V2. Price and composition are authoritative PostgreSQL data.';
COMMENT ON TABLE catalog.offer_items IS
  'Individual cosmetics granted by one offer. Offers never create ownership of sets.';
COMMENT ON TABLE economy.purchases IS
  'Confirmed Economy V2 purchase receipts. price_paid and offer_item_count preserve historical commercial value.';
COMMENT ON TABLE economy.purchase_items IS
  'Items actually granted by a confirmed purchase, retained for exact idempotent replay.';
COMMENT ON TABLE catalog.credit_packs IS
  'Non-purchasable BRL presentation catalog for future campaign-credit acquisition.';
COMMENT ON TABLE economy.ledger_entries IS
  'Append-only audit log for application balance mutations. Economy V2 purchases write one debit here.';

-- Down Migration

DROP TABLE IF EXISTS catalog.credit_packs;
DROP TABLE IF EXISTS economy.purchase_items;
DROP TABLE IF EXISTS economy.purchases;
DROP TABLE IF EXISTS catalog.offer_items;
DROP TABLE IF EXISTS catalog.offers;
