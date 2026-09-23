-- Commander title achievement catalogue.
-- This migration seeds presentation metadata only. Automatic acquisition rules
-- are specified in docs/pre-game/profile/title-achievements/SPEC.md and are
-- intentionally deferred to a future implementation.
--
-- Up Migration

INSERT INTO catalog.commander_titles(
  id,
  name,
  description,
  rarity,
  is_active,
  display_text,
  font_key,
  style_key,
  texture_ref
)
VALUES
  (
    'title.beta-tester',
    'Beta Tester',
    'Participou da fase beta de Bellum Civile.',
    'epic',
    TRUE,
    'BETA TESTER',
    'tactical-tech',
    'cyan-holo-drift_glow-blue-medium',
    NULL
  ),
  (
    'title.first-victory',
    'Vitorioso',
    'Venceu sua primeira partida.',
    'uncommon',
    TRUE,
    'VITORIOSO',
    'command-display',
    'bronze-metal',
    NULL
  ),
  (
    'title.total-conquest-1',
    'Conquistador',
    'Venceu uma partida controlando todos os territórios.',
    'rare',
    TRUE,
    'CONQUISTADOR',
    'military-stencil',
    'red-metal_glow-red-soft',
    NULL
  ),
  (
    'title.total-conquest-10',
    'Dominador',
    'Alcançou 10 vitórias controlando todos os territórios.',
    'epic',
    TRUE,
    'DOMINADOR',
    'military-stencil',
    'crimson-metal-sheen_glow-red-medium',
    NULL
  ),
  (
    'title.total-conquest-100',
    'Imperador',
    'Alcançou 100 vitórias controlando todos os territórios.',
    'legendary',
    TRUE,
    'IMPERADOR',
    'imperial',
    'gold-metal-sheen_glow-gold-strong-breathe',
    NULL
  ),
  (
    'title.victories-1000',
    'Soberano',
    'Alcançou 1.000 vitórias em partidas.',
    'legendary',
    TRUE,
    'SOBERANO',
    'imperial',
    'night-aurora-drift_glow-gold-strong',
    NULL
  ),
  (
    'title.store-purchase',
    'Patrono',
    'Realizou sua primeira compra na Intendência.',
    'rare',
    TRUE,
    'PATRONO',
    'ceremonial',
    'bronze-satin_glow-amber-medium',
    NULL
  ),
  (
    'title.store-spend-100-brl',
    'Grão-Patrono',
    'Ultrapassou R$ 100,00 em gastos reais elegíveis.',
    'epic',
    TRUE,
    'GRÃO-PATRONO',
    'ceremonial',
    'gold-satin-sheen_glow-amber-medium',
    NULL
  ),
  (
    'title.store-spend-1000-brl',
    'Mecenas',
    'Ultrapassou R$ 1.000,00 em gastos reais elegíveis.',
    'legendary',
    TRUE,
    'MECENAS',
    'ceremonial',
    'gold-metal-sheen_glow-gold-strong-breathe',
    NULL
  )
ON CONFLICT (id) DO UPDATE
SET name=EXCLUDED.name,
    description=EXCLUDED.description,
    rarity=EXCLUDED.rarity,
    is_active=TRUE,
    display_text=EXCLUDED.display_text,
    font_key=EXCLUDED.font_key,
    style_key=EXCLUDED.style_key,
    texture_ref=EXCLUDED.texture_ref,
    updated_at=NOW();

-- These are achievement/promotion rewards, not directly purchasable titles.
DELETE FROM catalog.commander_title_pricing
 WHERE title_id IN (
   'title.beta-tester',
   'title.first-victory',
   'title.total-conquest-1',
   'title.total-conquest-10',
   'title.total-conquest-100',
   'title.victories-1000',
   'title.store-purchase',
   'title.store-spend-100-brl',
   'title.store-spend-1000-brl'
 );

-- Be resilient if a catalogue row existed before the stats trigger was installed.
INSERT INTO catalog.commander_title_stats(title_id,acquisition_count)
SELECT title.id,0
  FROM catalog.commander_titles title
 WHERE title.id IN (
   'title.beta-tester',
   'title.first-victory',
   'title.total-conquest-1',
   'title.total-conquest-10',
   'title.total-conquest-100',
   'title.victories-1000',
   'title.store-purchase',
   'title.store-spend-100-brl',
   'title.store-spend-1000-brl'
 )
ON CONFLICT (title_id) DO NOTHING;

-- Down Migration
-- Forward fixes are preferred because title ownership can become durable
-- user-facing achievement history after automatic grants are implemented.
