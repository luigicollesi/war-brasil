# Battle Pass Timeline Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/campaign` as a minimal continuous Battle Pass timeline: horizontal on desktop with Elite above/Free below, vertical on mobile with Elite left/Free right, while reusing the persistent Pre-game Foundation and preserving all existing claim/purchase behavior.

**Architecture:** Register `/campaign` as a first-class Foundation scene mode whose initial pose exactly matches Home's existing Campaign destination intent. Split reward/timeline presentation out of `battle-pass-page.tsx`, render all 100 levels in one native scroll container, and use responsive CSS to rotate only the geometry while keeping one semantic data flow. Backend contracts, Economy V2, reward state, claims and Season 1 remain unchanged.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, CSS Modules, existing Pre-game Foundation/Three.js runtime, Node test runner.

**Spec:** `docs/superpowers/specs/2026-10-02-battle-pass-timeline-redesign-design.md`

## Global Constraints

- Follow `skills/frontend-quality/SKILL.md`.
- Do not add dependencies.
- Do not start a dev/server/watch process.
- Do not modify Battle Pass rewards, XP, prices, Season 1, database schema or backend service contracts.
- Reuse the single `PreGameCommandRuntime` already mounted by the RootLayout; never create a second `CommandShell` or Canvas.
- Route-stable Campaign scene must use `focus=table`, `conflictLevel=0`, `territoryExplode=0.06`, `orbitalAlignment=1`, `entranceState=settled`.
- Campaign camera must match Home's entrance/table pose exactly: desktop `[0.55,2.35,10.2] / [0.25,-0.15,-0.2] / 33`; compact `[1,2.8,14.4] / [1.05,0.55,-0.2] / 39`.
- Desktop timeline: Elite above, axis center, Free below, native horizontal scroll.
- Mobile timeline: Elite left, axis center, Free right, native vertical scroll.
- No structural reward/level cards or permanent borders inside the timeline.
- Claimable/locked/premium-locked/claiming/claimed must remain distinguishable without color alone.
- Preserve claim individual, claim group, claim-all, purchase Elite, reward reveal and focus restoration.
- Use lazy/static reward previews; do not add per-level timers, scroll-driven React state, virtualization, or 3D reward renderers.

## Review Focus

- **Route handoff continuity:** changing `/home` → `/campaign` must not snap camera/table presentation; Task 1 pins matching route intent + camera presets.
- **100-level rendering:** no eight-level slicing or hidden pagination may survive; Task 3 asserts every `snapshot.levels` entry reaches the timeline.
- **Mobile overflow:** timeline must switch to vertical geometry without page-level horizontal overflow; Task 3 pins the mobile CSS contract.
- **Reward semantics after extraction:** group claim, individual claim and reward state labels must still use existing authoritative data; Task 2 updates the grouped-reward contract tests.
- **Focus/accessibility:** scroll-to-current and reveal dialogs must not steal/lose focus; Tasks 3 and 5 retain visible focus, keyboard scroll target, dialog trap and reduced-motion assertions.

---

### Task 1: Add Campaign to the persistent Pre-game Foundation

**Files:**
- Modify: `src/components/pre-game/foundation/scene-contract.ts`
- Modify: `src/components/pre-game/foundation/pre-game-route-intent.ts`
- Modify: `src/components/pre-game/foundation/scene-presets.ts`
- Modify: `tests/pre-game-foundation-runtime.test.mjs`
- Modify: `tests/pre-game-foundation-pages-integration.test.mjs`
- Modify: `tests/pre-game-home.test.mjs`

**Interfaces:**
- Consumes: existing `CommandSceneMode`, `CommandSceneIntent`, `resolveCommandCameraPose()`.
- Produces: `CommandSceneMode = ... | "campaign"`; `resolvePreGameSceneIntent("/campaign")` returning the route-stable Campaign intent; Campaign desktop/compact camera presets matching Home table focus.

- [ ] **Step 1: Write failing Foundation contract assertions**

In `tests/pre-game-foundation-runtime.test.mjs` and `tests/pre-game-foundation-pages-integration.test.mjs`, assert:

```js
assert.match(routes, /"\/campaign": "campaign"/);
assert.match(contract, /"campaign"/);
assert.match(contract, /campaign: "CAMPANHA"/);
```

Add assertions that route intent for Campaign contains the stable `table / 0.06 / 1 / settled` values rather than only `{ mode }`.

In `tests/pre-game-home.test.mjs`, assert Campaign presets contain the exact desktop and compact pose values from the spec.

- [ ] **Step 2: Run the focused tests and verify failure**

Run:

```bash
node --test tests/pre-game-foundation-runtime.test.mjs tests/pre-game-foundation-pages-integration.test.mjs tests/pre-game-home.test.mjs
```

Expected: FAIL because `campaign` is not yet a scene mode/route preset.

- [ ] **Step 3: Extend `CommandSceneMode` and labels**

Modify `scene-contract.ts`:

- add `"campaign"` to `COMMAND_SCENE_MODES`;
- add `campaign: "table"` to `DEFAULT_FOCUS_BY_MODE`;
- add `campaign: "CAMPANHA"` to `COMMAND_SCENE_MODE_LABELS`.

- [ ] **Step 4: Make `/campaign` resolve the full stable intent**

In `pre-game-route-intent.ts`, preserve exact route ownership of mode while allowing Campaign to return:

```ts
{
  mode: "campaign",
  focus: "table",
  conflictLevel: 0,
  territoryExplode: 0.06,
  orbitalAlignment: 1,
  entranceState: "settled",
}
```

Do not add mode selection inside the page component.

- [ ] **Step 5: Add Campaign camera presets**

In `scene-presets.ts`, add:

- desktop Campaign = Home `ENTRANCE_FOCUS_PRESETS.table` numeric pose;
- compact Campaign = Home `COMPACT_ENTRANCE_FOCUS_PRESETS.table` numeric pose.

Keep the values explicit in the mode preset so `resolveCommandCameraPose()` remains total for every `CommandSceneMode`.

- [ ] **Step 6: Run focused tests and verify pass**

Run the same three test files.

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/pre-game/foundation/scene-contract.ts \
  src/components/pre-game/foundation/pre-game-route-intent.ts \
  src/components/pre-game/foundation/scene-presets.ts \
  tests/pre-game-foundation-runtime.test.mjs \
  tests/pre-game-foundation-pages-integration.test.mjs \
  tests/pre-game-home.test.mjs
git commit -m "feat(campaign): integrate battle pass with command foundation"
```

---

### Task 2: Extract borderless reward presentation without changing claim semantics

**Files:**
- Create: `src/components/progression/battle-pass/battle-pass-reward.tsx`
- Modify: `src/components/progression/battle-pass/battle-pass-page.tsx`
- Modify: `tests/battle-pass-grouped-rewards.test.mjs`
- Modify: `tests/battle-pass-frontend-contract.test.mjs`

**Interfaces:**
- Consumes: `BattlePassRewardPresentation`; existing `groupedRewards()`/group-state semantics and claim callbacks.
- Produces:
  - `BattlePassReward` props:
    `{ reward, pending, onClaim }`
  - `BattlePassRewardGroup` props:
    `{ rewards, pending, onClaim }`
  - `groupBattlePassRewards(rewards)` if grouping helper is moved with presentation code.

- [ ] **Step 1: Update tests to describe borderless reward components**

In `tests/battle-pass-grouped-rewards.test.mjs`:

- stop requiring `<RewardGroupCard`;
- require `BattlePassRewardGroup`;
- keep assertions for `groupedRewards`/group endpoint/`Conjunto Inicial de Elite`/composite reveal.

In `tests/battle-pass-frontend-contract.test.mjs`:

- require imported/extracted `BattlePassReward`;
- retain assertions for reward states, claim-all and reveal behavior;
- add source assertion that reward component does not use card naming.

- [ ] **Step 2: Run focused tests and verify failure**

Run:

```bash
node --test tests/battle-pass-grouped-rewards.test.mjs tests/battle-pass-frontend-contract.test.mjs
```

Expected: FAIL because reward presentation is still local `RewardCard/RewardGroupCard`.

- [ ] **Step 3: Create `battle-pass-reward.tsx`**

Move only presentation concerns:

- `RewardVisual`;
- state label;
- grouped reward visual;
- individual reward action;
- group reward action.

Expose the exact components above. Preserve:

- `campaign_credit` coin;
- title renderer;
- territory preview;
- profile cosmetic image;
- `premium_locked`, `locked`, `claimed`, `claiming`, `claimable`;
- minimum 44px interactive target.

Do not move fetch/purchase/claim side effects from `battle-pass-page.tsx`.

- [ ] **Step 4: Replace local card functions in `battle-pass-page.tsx`**

Delete `RewardCard` and `RewardGroupCard` local definitions and consume the extracted components.

Keep group claim callback shape unchanged:

```ts
onClaim: (rewards: ReadonlyArray<BattlePassRewardPresentation>) => void
```

- [ ] **Step 5: Run focused tests**

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/progression/battle-pass/battle-pass-reward.tsx \
  src/components/progression/battle-pass/battle-pass-page.tsx \
  tests/battle-pass-grouped-rewards.test.mjs \
  tests/battle-pass-frontend-contract.test.mjs
git commit -m "refactor(campaign): extract battle pass reward presentation"
```

---

### Task 3: Replace eight-level pagination with one responsive 100-level timeline

**Files:**
- Create: `src/components/progression/battle-pass/battle-pass-timeline.tsx`
- Create: `src/components/progression/battle-pass/battle-pass-timeline.module.css`
- Create: `tests/battle-pass-timeline-redesign.test.mjs`
- Modify: `src/components/progression/battle-pass/battle-pass-page.tsx`
- Modify: `tests/battle-pass-frontend-contract.test.mjs`

**Interfaces:**
- Consumes:
  - `levels: BattlePassSnapshot["levels"]`
  - `currentLevel: number`
  - `pendingRewardId: string | null`
  - `onClaimReward(reward)`
  - `onClaimRewardGroup(rewards)`
- Produces:
  - `BattlePassTimeline(props)`;
  - internal `Map<number, HTMLElement>` or equivalent level refs;
  - `scrollToCurrentLevel(): void` triggered by the timeline's `NÍVEL ATUAL` control.

- [ ] **Step 1: Add failing timeline structure test**

Create `tests/battle-pass-timeline-redesign.test.mjs` asserting:

```js
assert.match(timeline, /levels\.map/);
assert.doesNotMatch(page, /railStart|visibleLevels|maxRailStart/);
assert.doesNotMatch(page, /showPreviousLevels|showNextLevels/);
assert.doesNotMatch(page, /PRÓXIMOS →|← ANTERIORES/);
assert.match(timeline, /scrollIntoView/);
assert.match(timelineCss, /overflow-x:\s*auto/);
assert.match(timelineCss, /@media \(max-width: 760px\)/);
assert.match(timelineCss, /overflow-y:\s*auto/);
```

Also assert desktop ordering uses premium → axis → free and mobile grid uses premium / axis / free columns.

- [ ] **Step 2: Run test and verify failure**

Run:

```bash
node --test tests/battle-pass-timeline-redesign.test.mjs tests/battle-pass-frontend-contract.test.mjs
```

Expected: FAIL.

- [ ] **Step 3: Create `BattlePassTimeline`**

Implement one semantic mapping over all `levels`.

Desktop level node:

```text
premium-zone
premium-connector
axis-marker
free-connector
free-zone
```

Mobile uses CSS only to recompose the same node into:

```text
premium | axis | free
```

Do not branch into two separate arrays/data models.

- [ ] **Step 4: Implement current-level refs without scroll-state updates**

Use a scroll viewport ref and level element refs.

On initial mount after snapshot is available, call `scrollIntoView`/equivalent once for current level with a non-dramatic placement.

The `NÍVEL ATUAL` button calls the same helper.

Do not attach `scroll` listeners that update React state.

- [ ] **Step 5: Implement desktop timeline CSS**

Required contract:

- `overflow-x: auto`;
- `overflow-y: hidden`;
- a single continuous axis;
- fixed/minimum level spacing appropriate for reward previews;
- no border around level node;
- no border around reward/reward group;
- current level indicated via marker scale/halo/text, not box shadow around the level;
- track labels visible without creating boxed headers.

- [ ] **Step 6: Implement mobile timeline CSS**

At `max-width: 760px`:

- vertical scroll viewport;
- no horizontal page overflow;
- level node becomes `grid-template-columns: minmax(0,1fr) auto minmax(0,1fr)`;
- premium on left;
- axis center;
- free on right;
- continuous vertical axis;
- reward visual/text must use `min-width:0` and line clamping where required.

- [ ] **Step 7: Remove old pagination from page**

Delete:

- `initialRailStart`;
- `railStart`;
- `maxRailStart`;
- `visibleLevels`;
- previous/next functions and buttons;
- old `trackLabels`/level mapping.

Render `<BattlePassTimeline ... />` with all `snapshot.levels`.

- [ ] **Step 8: Run focused tests**

Run:

```bash
node --test tests/battle-pass-timeline-redesign.test.mjs tests/battle-pass-frontend-contract.test.mjs tests/battle-pass-grouped-rewards.test.mjs
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/components/progression/battle-pass/battle-pass-timeline.tsx \
  src/components/progression/battle-pass/battle-pass-timeline.module.css \
  src/components/progression/battle-pass/battle-pass-page.tsx \
  tests/battle-pass-timeline-redesign.test.mjs \
  tests/battle-pass-frontend-contract.test.mjs \
  tests/battle-pass-grouped-rewards.test.mjs
git commit -m "feat(campaign): add continuous responsive reward timeline"
```

---

### Task 4: Remove card chrome from Campaign page and preserve safe financial/reveal boundaries

**Files:**
- Modify: `src/components/progression/battle-pass/battle-pass-page.module.css`
- Modify: `src/components/progression/battle-pass/battle-pass-timeline.module.css`
- Modify: `src/components/progression/battle-pass/battle-pass-reward.tsx`
- Modify: `src/components/progression/battle-pass/battle-pass-page.tsx`
- Modify: `tests/battle-pass-frontend-contract.test.mjs`
- Modify: `tests/battle-pass-premium-contract.test.mjs`
- Modify: `tests/battle-pass-timeline-redesign.test.mjs`

**Interfaces:**
- Consumes: Foundation CSS variables exposed by `CommandShell`, existing page states and reward callbacks.
- Produces: minimal Campaign surface with transparent/atmospheric DOM layers over Foundation; no custom full-page background authority.

- [ ] **Step 1: Add failing minimal-chrome assertions**

Tests should require:

- `.surface` no longer defines the old opaque/radial full-page Campaign background as scene authority;
- no structural `border` on reward/level/group selectors;
- premium confirmation and reveal remain visually delimited;
- focus-visible styles remain explicit;
- `@media (prefers-reduced-motion: reduce)` remains present.

- [ ] **Step 2: Run focused tests and verify failure**

Run:

```bash
node --test tests/battle-pass-frontend-contract.test.mjs tests/battle-pass-premium-contract.test.mjs tests/battle-pass-timeline-redesign.test.mjs
```

Expected: FAIL on old card/border styles.

- [ ] **Step 3: Simplify page surface and hero**

In `battle-pass-page.module.css`:

- make page background transparent or only use subtle non-owning overlays;
- use Foundation content clearances where needed;
- remove decorative `border-block` from hero;
- preserve readable text contrast over scene;
- keep progress indicator readable;
- keep utility navigation/wallet compact.

- [ ] **Step 4: Flatten Elite control**

Make `.premiumPanel` presentation borderless/minimal in normal state.

Keep explicit bordered/background container only for `.premiumConfirmation`, because purchase confirmation is financial and requires strong grouping.

Do not change purchase handlers or price logic.

- [ ] **Step 5: Flatten reward/timeline visual states**

In reward/timeline CSS:

- no permanent outer border;
- claimable = subtle halo/contrast + text action;
- claimed = opacity reduction + check label;
- locked = opacity reduction + lock/level text;
- claiming = semantic text and disabled interaction;
- buttons retain clear focus and >=44px target.

- [ ] **Step 6: Preserve reveal modal as an exception**

Do not remove the backdrop/card boundary from the claim reveal dialog. It remains a modal surface and must keep:

- `role="dialog"`;
- `aria-modal="true"`;
- focus trap/restore;
- Escape handling;
- reduced motion.

- [ ] **Step 7: Run focused tests**

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/progression/battle-pass/battle-pass-page.module.css \
  src/components/progression/battle-pass/battle-pass-timeline.module.css \
  src/components/progression/battle-pass/battle-pass-reward.tsx \
  src/components/progression/battle-pass/battle-pass-page.tsx \
  tests/battle-pass-frontend-contract.test.mjs \
  tests/battle-pass-premium-contract.test.mjs \
  tests/battle-pass-timeline-redesign.test.mjs
git commit -m "style(campaign): remove battle pass card chrome"
```

---

### Task 5: Lock transition, accessibility and regression behavior

**Files:**
- Modify: `src/components/pre-game/home/command-home-client.tsx` only if transition timing/scroll behavior needs a Campaign-specific adjustment
- Modify: `src/components/pre-game/home/command-home.module.css` only if Campaign requires a destination-specific compositor transition
- Modify: `tests/pre-game-home.test.mjs`
- Modify: `tests/battle-pass-frontend-contract.test.mjs`
- Modify: `tests/battle-pass-timeline-redesign.test.mjs`
- Modify: `docs/progression/battle-pass/SPEC.md`

**Interfaces:**
- Consumes: existing `transitioningTo="campaign"`, Foundation route intent, timeline current-level helper.
- Produces: documented final responsive behavior and source-level regression coverage.

- [ ] **Step 1: Add/adjust transition assertions before changing Home**

Require that Campaign navigation:

- continues using the existing destination link;
- sets `transitioningTo("campaign")`;
- does not add timeout choreography;
- does not add Canvas/Three imports to Home or Campaign;
- respects reduced motion.

If current Home code already satisfies this after Task 1, do not change production Home code.

- [ ] **Step 2: Add accessibility assertions**

In timeline/frontend tests assert:

- timeline viewport has a useful accessible label;
- `NÍVEL ATUAL` is a real button;
- claim buttons remain real buttons;
- track labels exist in semantic text;
- reduced-motion CSS disables transition/animation where appropriate;
- reward dialog focus assertions from existing tests still pass.

- [ ] **Step 3: Update the central Battle Pass SPEC**

Update `docs/progression/battle-pass/SPEC.md` frontend sections to replace obsolete “4 columns / 2x2 / mobile vertical cards” direction with:

- continuous horizontal desktop timeline;
- continuous vertical mobile timeline;
- Elite/Free placement;
- minimal border policy;
- Foundation-backed Campaign surface.

Do not rewrite unrelated progression/economy sections.

- [ ] **Step 4: Run the complete focused Battle Pass/Foundation regression set**

Run:

```bash
node --test \
  tests/pre-game-foundation-runtime.test.mjs \
  tests/pre-game-foundation-pages-integration.test.mjs \
  tests/pre-game-home.test.mjs \
  tests/battle-pass-timeline-redesign.test.mjs \
  tests/battle-pass-frontend-contract.test.mjs \
  tests/battle-pass-grouped-rewards.test.mjs \
  tests/battle-pass-premium-contract.test.mjs \
  tests/battle-pass-claim-contract.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Run finite compile/lint checks**

Inspect scripts first (already verified in `package.json`), then run:

```bash
npm run test:compile
npx eslint \
  src/components/pre-game/foundation/scene-contract.ts \
  src/components/pre-game/foundation/pre-game-route-intent.ts \
  src/components/pre-game/foundation/scene-presets.ts \
  src/components/progression/battle-pass/battle-pass-page.tsx \
  src/components/progression/battle-pass/battle-pass-timeline.tsx \
  src/components/progression/battle-pass/battle-pass-reward.tsx
```

Expected: exit 0.

- [ ] **Step 6: Review source for forbidden regressions**

Verify with repository search:

- no `railStart`;
- no `visibleLevels`;
- no old previous/next pagination;
- no new `Canvas`, `@react-three/fiber` or `three` imports in Campaign;
- no new backend/database changes;
- no permanent reward/level card border.

- [ ] **Step 7: Commit**

```bash
git add docs/progression/battle-pass/SPEC.md \
  src/components/pre-game/home/command-home-client.tsx \
  src/components/pre-game/home/command-home.module.css \
  tests/pre-game-home.test.mjs \
  tests/battle-pass-frontend-contract.test.mjs \
  tests/battle-pass-timeline-redesign.test.mjs
git commit -m "test(campaign): lock responsive battle pass redesign"
```

Only include Home source files in the commit if they actually changed.

---

## Final Verification

After all task commits:

- [ ] Run the focused regression command from Task 5 again.
- [ ] Run `npm run test:compile`.
- [ ] Run targeted ESLint from Task 5.
- [ ] Compare `main...dev` and inspect the final diff for backend/database drift.
- [ ] Confirm `/campaign` owns no Canvas/Three imports and Foundation still has exactly one `CommandShell` host.
- [ ] Record that browser visual validation is still required for 1440x900, 1366x768, low-height desktop, tablet, 390x844, 360x800 and reduced motion if no browser/E2E run is available.
