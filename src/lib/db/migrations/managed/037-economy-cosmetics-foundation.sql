-- Economy, storefront and cosmetic loadout foundation.
-- This delivery intentionally has no purchase/reward/transfer flow.

-- Up Migration

CREATE SCHEMA IF NOT EXISTS economy;
CREATE SCHEMA IF NOT EXISTS inventory;
CREATE SCHEMA IF NOT EXISTS catalog;
CREATE SCHEMA IF NOT EXISTS profile;

CREATE TABLE IF NOT EXISTS economy.currencies (
  code TEXT PRIMARY KEY,
  display_name VARCHAR(64) NOT NULL,
  symbol VARCHAR(8) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (btrim(code) <> ''),
  CHECK (btrim(display_name) <> ''),
  CHECK (btrim(symbol) <> '')
);

CREATE TABLE IF NOT EXISTS economy.wallets (
  user_id UUID NOT NULL
    REFERENCES auth."user"(id) ON DELETE CASCADE,
  currency_code TEXT NOT NULL
    REFERENCES economy.currencies(code) ON DELETE RESTRICT,
  balance BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, currency_code),
  CONSTRAINT economy_wallets_balance_non_negative_check CHECK (balance >= 0)
);

CREATE TABLE IF NOT EXISTS economy.ledger_entries (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL,
  currency_code TEXT NOT NULL,
  delta BIGINT NOT NULL,
  reason VARCHAR(32) NOT NULL,
  domain_reference TEXT,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT economy_ledger_wallet_fkey
    FOREIGN KEY (user_id, currency_code)
    REFERENCES economy.wallets(user_id, currency_code)
    ON DELETE RESTRICT,
  CHECK (delta <> 0),
  CHECK (btrim(reason) <> ''),
  CHECK (domain_reference IS NULL OR btrim(domain_reference) <> ''),
  CHECK (idempotency_key IS NULL OR btrim(idempotency_key) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS economy_ledger_idempotency_key_uidx
  ON economy.ledger_entries (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS economy_ledger_user_created_idx
  ON economy.ledger_entries (user_id, created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS catalog.cosmetics (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name VARCHAR(96) NOT NULL,
  description TEXT,
  slot VARCHAR(32) NOT NULL,
  rarity VARCHAR(24),
  asset_ref TEXT,
  preview_ref TEXT,
  effect_key TEXT,
  status VARCHAR(16) NOT NULL DEFAULT 'draft',
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cosmetics_slot_check
    CHECK (slot IN ('dice_attack', 'dice_defense', 'dice_neutral', 'territory_effect')),
  CONSTRAINT cosmetics_status_check
    CHECK (status IN ('draft', 'announced', 'available', 'retired')),
  CHECK (btrim(id) <> ''),
  CHECK (btrim(slug) <> ''),
  CHECK (btrim(name) <> ''),
  CHECK (description IS NULL OR btrim(description) <> ''),
  CHECK (asset_ref IS NULL OR btrim(asset_ref) <> ''),
  CHECK (preview_ref IS NULL OR btrim(preview_ref) <> ''),
  CHECK (effect_key IS NULL OR btrim(effect_key) <> ''),
  UNIQUE (id, slot)
);

CREATE TABLE IF NOT EXISTS catalog.cosmetic_sets (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name VARCHAR(96) NOT NULL,
  description TEXT,
  preview_ref TEXT,
  status VARCHAR(16) NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cosmetic_sets_status_check
    CHECK (status IN ('draft', 'announced', 'available', 'retired')),
  CHECK (btrim(id) <> ''),
  CHECK (btrim(slug) <> ''),
  CHECK (btrim(name) <> ''),
  CHECK (description IS NULL OR btrim(description) <> ''),
  CHECK (preview_ref IS NULL OR btrim(preview_ref) <> '')
);

CREATE TABLE IF NOT EXISTS catalog.cosmetic_set_items (
  set_id TEXT NOT NULL
    REFERENCES catalog.cosmetic_sets(id) ON DELETE CASCADE,
  cosmetic_id TEXT NOT NULL
    REFERENCES catalog.cosmetics(id) ON DELETE RESTRICT,
  position SMALLINT NOT NULL,
  PRIMARY KEY (set_id, cosmetic_id),
  UNIQUE (set_id, position),
  CHECK (position >= 0)
);

CREATE TABLE IF NOT EXISTS inventory.cosmetics (
  user_id UUID NOT NULL
    REFERENCES auth."user"(id) ON DELETE CASCADE,
  cosmetic_id TEXT NOT NULL,
  slot VARCHAR(32) NOT NULL,
  acquisition_source VARCHAR(24) NOT NULL DEFAULT 'default',
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, cosmetic_id),
  UNIQUE (user_id, slot, cosmetic_id),
  CONSTRAINT inventory_cosmetic_slot_fkey
    FOREIGN KEY (cosmetic_id, slot)
    REFERENCES catalog.cosmetics(id, slot)
    ON DELETE RESTRICT,
  CONSTRAINT inventory_acquisition_source_check
    CHECK (acquisition_source IN ('default', 'purchase', 'reward', 'promotion', 'admin'))
);

CREATE INDEX IF NOT EXISTS inventory_cosmetics_user_slot_idx
  ON inventory.cosmetics (user_id, slot, acquired_at DESC);

CREATE TABLE IF NOT EXISTS profile.cosmetic_loadout (
  user_id UUID NOT NULL
    REFERENCES auth."user"(id) ON DELETE CASCADE,
  slot VARCHAR(32) NOT NULL,
  cosmetic_id TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, slot),
  CONSTRAINT cosmetic_loadout_slot_check
    CHECK (slot IN ('dice_attack', 'dice_defense', 'dice_neutral', 'territory_effect')),
  CONSTRAINT cosmetic_loadout_owned_item_fkey
    FOREIGN KEY (user_id, slot, cosmetic_id)
    REFERENCES inventory.cosmetics(user_id, slot, cosmetic_id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY IMMEDIATE
);

CREATE INDEX IF NOT EXISTS cosmetic_loadout_cosmetic_idx
  ON profile.cosmetic_loadout (cosmetic_id, user_id);

INSERT INTO economy.currencies(code, display_name, symbol, is_active)
VALUES ('campaign-credit', 'Créditos de Campanha', '◈', TRUE)
ON CONFLICT (code) DO UPDATE
SET display_name = EXCLUDED.display_name,
    symbol = EXCLUDED.symbol,
    is_active = TRUE,
    updated_at = NOW();

INSERT INTO catalog.cosmetics(
  id, slug, name, description, slot, rarity, asset_ref, preview_ref, effect_key, status, is_default
)
VALUES
  ('dice.attack.default', 'dado-ataque-padrao', 'Dado de Ataque Padrão', 'Visual padrão do dado ofensivo.', 'dice_attack', NULL, NULL, NULL, NULL, 'available', TRUE),
  ('dice.defense.default', 'dado-defesa-padrao', 'Dado de Defesa Padrão', 'Visual padrão do dado defensivo.', 'dice_defense', NULL, NULL, NULL, NULL, 'available', TRUE),
  ('dice.neutral.default', 'dado-neutro-padrao', 'Dado Neutro Padrão', 'Visual padrão para iniciativa e rolagens neutras.', 'dice_neutral', NULL, NULL, NULL, NULL, 'available', TRUE),
  ('territory.effect.default', 'territorio-padrao', 'Território Padrão', 'Acabamento padrão que preserva integralmente a cor do jogador.', 'territory_effect', NULL, NULL, NULL, 'default', 'available', TRUE),
  ('dice.attack.exercito', 'dado-ataque-exercito', 'Ataque — Exército Clássico', 'Dado ofensivo da coleção Exército Clássico.', 'dice_attack', NULL, '/dados/exercito/ataque.svg', NULL, NULL, 'announced', FALSE),
  ('dice.defense.exercito', 'dado-defesa-exercito', 'Defesa — Exército Clássico', 'Dado defensivo da coleção Exército Clássico.', 'dice_defense', NULL, '/dados/exercito/defesa.svg', NULL, NULL, 'announced', FALSE),
  ('dice.neutral.exercito', 'dado-neutro-exercito', 'Neutro — Exército Clássico', 'Dado neutro da coleção Exército Clássico.', 'dice_neutral', NULL, '/dados/exercito/neutro.svg', NULL, NULL, 'announced', FALSE),
  ('dice.attack.lancas', 'dado-ataque-lancas', 'Ataque — Lanças Medievais', 'Dado ofensivo da coleção Lanças Medievais.', 'dice_attack', NULL, '/dados/lancas/ataque.svg', NULL, NULL, 'announced', FALSE),
  ('dice.defense.lancas', 'dado-defesa-lancas', 'Defesa — Lanças Medievais', 'Dado defensivo da coleção Lanças Medievais.', 'dice_defense', NULL, '/dados/lancas/defesa.svg', NULL, NULL, 'announced', FALSE),
  ('dice.neutral.lancas', 'dado-neutro-lancas', 'Neutro — Lanças Medievais', 'Dado neutro da coleção Lanças Medievais.', 'dice_neutral', NULL, '/dados/lancas/neutro.svg', NULL, NULL, 'announced', FALSE),
  ('dice.attack.viking', 'dado-ataque-viking', 'Ataque — Viking', 'Dado ofensivo da coleção Viking.', 'dice_attack', NULL, '/dados/viking/ataque.svg', NULL, NULL, 'announced', FALSE),
  ('dice.defense.viking', 'dado-defesa-viking', 'Defesa — Viking', 'Dado defensivo da coleção Viking.', 'dice_defense', NULL, '/dados/viking/defesa.svg', NULL, NULL, 'announced', FALSE),
  ('dice.neutral.viking', 'dado-neutro-viking', 'Neutro — Viking', 'Dado neutro da coleção Viking.', 'dice_neutral', NULL, '/dados/viking/neutro.svg', NULL, NULL, 'announced', FALSE)
ON CONFLICT (id) DO UPDATE
SET slug = EXCLUDED.slug,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    slot = EXCLUDED.slot,
    rarity = EXCLUDED.rarity,
    asset_ref = EXCLUDED.asset_ref,
    preview_ref = EXCLUDED.preview_ref,
    effect_key = EXCLUDED.effect_key,
    status = EXCLUDED.status,
    is_default = EXCLUDED.is_default,
    updated_at = NOW();

INSERT INTO catalog.cosmetic_sets(id, slug, name, description, preview_ref, status)
VALUES
  ('set.exercito', 'exercito-classico', 'Exército Clássico', 'Remessa de dados com estética militar clássica.', NULL, 'announced'),
  ('set.lancas', 'lancas-medievais', 'Lanças Medievais', 'Remessa de dados inspirada em lanças e armamentos medievais.', NULL, 'announced'),
  ('set.viking', 'viking', 'Viking', 'Remessa de dados com estética nórdica e viking.', NULL, 'announced')
ON CONFLICT (id) DO UPDATE
SET slug = EXCLUDED.slug,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    preview_ref = EXCLUDED.preview_ref,
    status = EXCLUDED.status,
    updated_at = NOW();

INSERT INTO catalog.cosmetic_set_items(set_id, cosmetic_id, position)
VALUES
  ('set.exercito', 'dice.attack.exercito', 0),
  ('set.exercito', 'dice.defense.exercito', 1),
  ('set.exercito', 'dice.neutral.exercito', 2),
  ('set.lancas', 'dice.attack.lancas', 0),
  ('set.lancas', 'dice.defense.lancas', 1),
  ('set.lancas', 'dice.neutral.lancas', 2),
  ('set.viking', 'dice.attack.viking', 0),
  ('set.viking', 'dice.defense.viking', 1),
  ('set.viking', 'dice.neutral.viking', 2)
ON CONFLICT (set_id, cosmetic_id) DO UPDATE
SET position = EXCLUDED.position;

-- Existing commanders receive exactly the real zero-balance wallet and the four defaults.
INSERT INTO economy.wallets(user_id, currency_code, balance)
SELECT commander.user_id, 'campaign-credit', 0
FROM profile.commanders commander
ON CONFLICT (user_id, currency_code) DO NOTHING;

INSERT INTO inventory.cosmetics(user_id, cosmetic_id, slot, acquisition_source)
SELECT commander.user_id, item.id, item.slot, 'default'
FROM profile.commanders commander
CROSS JOIN catalog.cosmetics item
WHERE item.is_default = TRUE
ON CONFLICT (user_id, cosmetic_id) DO NOTHING;

INSERT INTO profile.cosmetic_loadout(user_id, slot, cosmetic_id)
SELECT commander.user_id, item.slot, item.id
FROM profile.commanders commander
CROSS JOIN catalog.cosmetics item
WHERE item.is_default = TRUE
ON CONFLICT (user_id, slot) DO NOTHING;

COMMENT ON TABLE economy.wallets IS
  'Persistent commander balances. Campaign credit is the only active currency in economy v1.';
COMMENT ON TABLE economy.ledger_entries IS
  'Append-only foundation for future audited balance mutations; expected to remain empty in economy v1.';
COMMENT ON TABLE catalog.cosmetics IS
  'Stable cosmetic definitions. Asset paths are references and are not ownership identifiers.';
COMMENT ON TABLE catalog.cosmetic_sets IS
  'Storefront presentation groups; a set never implies ownership.';
COMMENT ON TABLE inventory.cosmetics IS
  'Persistent per-user cosmetic ownership. Browser clients cannot grant rows directly.';
COMMENT ON TABLE profile.cosmetic_loadout IS
  'Four-slot equipped cosmetic state. Composite FK guarantees ownership and slot compatibility.';
