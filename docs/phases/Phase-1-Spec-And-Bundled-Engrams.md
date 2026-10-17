# Phase 1 — Spec and Bundled Engrams

Write Engram spec v2 down, build the one validator everything shares, and move the three bundled Engrams (the Kraken, the Lich and the Wisp) out of `hooks/engrams.ts` into `engrams/<id>/` folders that the mod loads at session start, with no visible change to their picker cards, thumbnails or scenes. Snapshots of today's output are taken before anything moves, so "no visible change" is a test, not a hope.

Three changes are intended, and each has its own test. Sprint 1.3 removes the five frames Engrams (Spirit, Skull, Moon, Sigil, Starfield) and the frames path, since v2 is scenes only. Sprint 1.3 also removes the Soul: Eidola stops injecting anything into the prompt, and the Wisp loses its custom voice. Sprint 1.5 replaces the `placement` option with one surfaces setting, which also fixes `/eidola place both` opening a band-only Engram in the pane.

Plan: `docs/Plan-EngramSpecV2-2026-10-16.html` (decisions 1–9, 12; the spec section).

---

# Sprint 1.1 — Spec, Types and Validator

### Goal

Write the v2 format down and build the pure validator the loader, the checker and `/eidola check` will all use.

### Tasks

| Status | # | Task | Module | Reference |
|--------|---|------|--------|-----------|
| x | 1 | Write `docs/spec/engram-format.md`: the folder, every field with required/type/default/read-by, the validation rules. Scenes only: no frame files, no frame fallback table. No `SOUL.md` and no prompt text of any kind. Only fields the mod reads; `extensions` kept and never read | docs/spec/ | Plan §The spec, drafted |
| x | 2 | Port v1 `vessel-reactivity.md` to `docs/spec/vessel-states.md`: the resolver's nine states (named in HUD and status-line text only), the three moods scenes draw and blend between, the error effect on top, and the three scene views (pane, band, shrine) | docs/spec/ | eidola-runtime/docs/spec/vessel-reactivity.md |
| x | 3 | Add the v2 package types: the `engram.json` shape with `vessel.scene` required, `Shows` as a list of `pane` / `band` / `shrine`, `Hud`; keep the registry's `Engram` type with defaults filled | hooks/engram-types.ts | Plan decisions 1–4 |
| x | 4 | Write `hooks/validate.ts`: a pure function over a package's files (passed in, no `$`) returning `{ errors, warnings }`, each with file, problem and fix text, for every rule in the spec's validation table | hooks/validate.ts | Plan §Validation rules |
| x | 5 | Test every rule with one passing and one failing package, including a missing or unknown `vessel.scene`, a thumbnail over 131,072 characters, a `<script>`, an `http` href, a leftover `vessel/idle.svg` frame (warning), a v1 `engram.yaml` package and an unknown key | hooks/validate.test.ts |
| x | 6 | Write `docs/spec/engram.schema.json` for editor hints, and a test that its required fields and enums match `validate.ts` | docs/spec/, hooks/validate.test.ts |
| x | 7 | Point the header comment in `hooks/resolver.ts` at `docs/spec/vessel-states.md` instead of eidola-runtime | hooks/resolver.ts |

### Acceptance Criteria

- `docs/spec/engram-format.md` lists no field the mod doesn't read (no `voice_id`, `tags`, `created`, `engram_version`, `forge`, `pack`, `type`, `placement`, `fallback`), no `vessel/<state>.svg` frames and no `SOUL.md` or Soul limits
- Every validation rule in the spec has a passing and a failing test
- `validate.ts` imports nothing from `claude-code` and never throws on bad input
- The schema test fails if a required field or enum is added to one side only

### Dependencies

- None

### Verification

- cli: claude plugin validate . && npx -p typescript tsc -p . && claude plugin test . && node scripts/bake-thumbs.mjs --check
- skip-ui: true
- assert: All tests pass, including the new validate tests

---

# Sprint 1.2 — Snapshot Today's Engrams

### Goal

Freeze what the three kept Engrams (the Kraken, the Lich and the Wisp) look like in 0.6.0, so the removal in 1.3 and the move in 1.4 can be proven to leave them unchanged. Their Souls aren't snapshotted: 1.3 removes them.

### Tasks

| Status | # | Task | Module |
|--------|---|------|--------|
| x | 1 | Snapshot the picker cards for the three: id, name, description, where it shows, and their order relative to each other | hooks/snapshot.test.ts |
| x | 2 | Snapshot each of the three's picker thumbnails at the pane and band sizes | hooks/snapshot.test.ts |
| x | 3 | Snapshot what the pane and band render for each of the three in each mood, with the clock fixed (for the Kraken, the water SVG and the live Client's props) | hooks/snapshot.test.ts |
| x | 4 | Snapshot the nothing-awake view in the pane and band (today, the Wisp's sleeping frame), so 1.3 changes it on purpose | hooks/snapshot.test.ts |
| x | 5 | Snapshot the effective placement for each of the three under each `placement` setting, recording today's band-only bug as-is with a comment | hooks/snapshot.test.ts |

### Acceptance Criteria

- Snapshots are committed and pass against 0.6.0 with no code changes
- Each snapshot names its Engram, so a diff points at what moved
- No snapshot covers Spirit, Skull, Moon, Sigil or Starfield

### Dependencies

- None (can run beside 1.1)

### Verification

- cli: claude plugin validate . && npx -p typescript tsc -p . && claude plugin test . && node scripts/bake-thumbs.mjs --check
- skip-ui: true
- assert: The new snapshot tests pass on an unchanged 0.6.0

---

# Sprint 1.3 — Remove the Frames Engrams and the Soul

### Goal

v2 is scenes only and carries no Soul. Remove the five frames Engrams, the frames drawing path and all prompt injection, on purpose and with their own tests, leaving the Kraken, the Lich and the Wisp looking the same.

### Tasks

| Status | # | Task | Module | Reference |
|--------|---|------|--------|-----------|
| x | 1 | Remove Spirit, Skull, Moon, Sigil and Starfield from `ENGRAMS`, and delete `vessels/spirit/`, `vessels/skull/`, `vessels/moon/`, `vessels/sigil/` and `vessels/starfield/` | hooks/engrams.ts, vessels/ | Plan decision 3 |
| x | 2 | Remove the frames path: the per-state frame reads in `vesselFor`, the missing-state fallback chain, and the frame stage in the pane and the band strip | hooks/register.tsx | Plan decisions 3, 4 |
| x | 3 | Delete the Wisp's frames (`vessels/wisp/<state>.svg`); its `thumb-band.svg` stays | vessels/wisp/ |
| x | 4 | With nothing awake, draw the resting Wisp's scene, dimmed, where its sleeping frame drew in the pane and band | hooks/register.tsx | Plan decision 4 |
| x | 5 | If the stored awake id is one of the five, clear it at session start, so nothing is awake, and have `/eidola` say once: "Skull was removed in 0.7.0. Pick another with /awaken." | hooks/register.tsx |
| x | 6 | Keep `bake-thumbs.mjs --check` passing with the five gone | scripts/bake-thumbs.mjs |
| x | 7 | Test the removal: the picker lists exactly the Kraken, the Lich and the Wisp; a stored removed id wakes nothing and gives the notice; nothing awake draws the Wisp's scene | hooks/removal.test.ts |
| x | 8 | Update the nothing-awake snapshot from 1.2, and no other snapshot | hooks/snapshot.test.ts |
| x | 9 | Remove Soul injection: the `prompt.submit` hook that adds `<eidola-soul>` and the `prompt.compose` hook that adds the `eidola:soul` section in `register.tsx`, `quietSoul` and `soulSection` in `engrams.ts`, and every Engram's `soul` text, including the Wisp's own | hooks/register.tsx, hooks/engrams.ts | Plan decision 9 |
| x | 10 | Test that nothing is injected: with each of the three awake, and with nothing awake, `prompt.submit` passes the prompt through unchanged and `prompt.compose` adds no Eidola section | hooks/soul-removal.test.ts |

### Acceptance Criteria

- The picker, `/awaken` and `/engrams` know only the Kraken, the Lich and the Wisp
- No `vessels/<state>.svg` frame file is left in the repo
- The three kept Engrams' snapshots pass unchanged; only the nothing-awake snapshot changed
- A session whose awake Engram was removed starts normally, with nothing awake
- Eidola adds nothing to the prompt on either path; `grep -rn "eidola-soul\|eidola:soul\|soulSection\|quietSoul" hooks` finds only the new test

### Dependencies

- Sprint 1.2 (snapshots)

### Verification

- cli: claude plugin validate . && npx -p typescript tsc -p . && claude plugin test . && node scripts/bake-thumbs.mjs --check
- skip-ui: true
- assert: The removal and no-injection tests pass; only the nothing-awake snapshot changed

---

# Sprint 1.4 — Bundled Engrams as Packages

### Goal

Turn the three bundled Engrams into `engrams/<id>/` packages and load them with a loader that never throws.

### Tasks

| Status | # | Task | Module | Reference |
|--------|---|------|--------|-----------|
| x | 1 | Write a one-off script that turns each `ENGRAMS` entry into `engrams/<id>/engram.json` and moves its thumbnails from `vessels/<pack>/` into `engrams/<id>/vessel/` | scripts/ |
| x | 2 | Run it, commit the three packages, delete `vessels/` and the one-off script | engrams/ |
| x | 3 | Write `hooks/loader.ts`: list `${$.plugin.root}/engrams/`, read each `engram.json`, validate, fill defaults, return `{ registry, skipped }`. Folders starting with `_` are ignored. Never throws | hooks/loader.ts | Plan decision 7 |
| x | 4 | Load at `session.start` and use the registry everywhere `ENGRAMS` is read today: picker, `/awaken`, `/engrams`, status line | hooks/register.tsx |
| x | 5 | Read thumbnails from `engrams/<id>/vessel/` on first use and cache them; draw each Engram with the scene its `vessel.scene` names | hooks/register.tsx | Plan decision 3 |
| x | 6 | Reduce `hooks/engrams.ts` to the resting Engram's id: no Engram data | hooks/engrams.ts |
| x | 7 | Test the loader: all three load; a broken fixture is skipped with its reason; an empty folder gives an empty registry | hooks/loader.test.ts |
| x | 8 | Update `bake-thumbs.mjs` to find thumbnails through each `engram.json` and write them to `engrams/<id>/vessel/` | scripts/bake-thumbs.mjs |

### Acceptance Criteria

- Every snapshot passes unchanged, as 1.3 left them
- `hooks/engrams.ts` holds no Engram data
- A package that fails validation is skipped and the session runs normally
- `node scripts/bake-thumbs.mjs --check` passes against the new layout

### Dependencies

- Sprint 1.1 (types, validator), Sprint 1.3 (removal)

### Verification

- cli: claude plugin validate . && npx -p typescript tsc -p . && claude plugin test . && node scripts/bake-thumbs.mjs --check
- skip-ui: true
- assert: Snapshot tests pass with no updated snapshots

---

# Sprint 1.5 — Where an Engram Draws

### Goal

One surfaces setting for all Engrams replaces `placement`, one function decides where the awake Engram draws, and the band-only bug is fixed.

### Tasks

| Status | # | Task | Module | Reference |
|--------|---|------|--------|-----------|
| x | 1 | Replace the `placement` option in `userConfig` with the surfaces switches: Pane (on by default), Band (on), and "hide the band while the pane is open" (on, as today's `auto`). `statusLine` stays its own toggle. The Shrine switch joins them in 4.2 | .claude-plugin/plugin.json | Plan decision 5 |
| x | 2 | Write `whereItDraws(surfaces, engram, isPaneOpen)`: an Engram draws on a surface only if that switch is on and its `shows` lists it; the band hides while the pane is open if that option is on; a band-only Engram never opens the pane by itself | hooks/placement.ts | Plan decision 5 |
| x | 3 | Replace every `shows` / `placement` read in `register.tsx` with `whereItDraws`, and drop `effectivePlacement` and the Engram-level `placement` suggestion | hooks/register.tsx |
| x | 4 | Change `/eidola place` to show the switches and set one, e.g. `/eidola place band off`, written through `$.config.set` as today | hooks/register.tsx |
| x | 5 | Update the picker's "where it shows" labels for the list form of `shows` | hooks/register.tsx |
| x | 6 | Test every switch combination against every `shows` value, plus a regression test: with Pane and Band on, the Wisp never opens the pane by itself, and `/eidola` still opens it with the band view | hooks/placement.test.ts |
| x | 7 | Update the placement snapshot from 1.2 for the new setting and the fixed bug, and no other snapshot | hooks/snapshot.test.ts |

### Acceptance Criteria

- With Wisp awake and Pane and Band on, the pane stays closed; `/eidola` opens it and draws the fen
- `userConfig` has no `placement` option, and no Engram carries a `placement` suggestion
- No other snapshot changes
- `register.tsx` reads `shows` only through `whereItDraws`

### Dependencies

- Sprint 1.4

### Verification

- cli: claude plugin validate . && npx -p typescript tsc -p . && claude plugin test . && node scripts/bake-thumbs.mjs --check
- skip-ui: true
- assert: The placement regression test passes; only the placement snapshot changed

---

## Risk Mitigations

- **The move changes how an Engram looks.** Sprint 1.2 freezes the three kept Engrams first, and 1.3 and 1.4 must pass it unchanged.
- **Someone has a removed Engram awake.** The stored id is cleared at start with a one-line notice (1.3 #5), so the session never breaks.
- **The bake script breaks.** It's kept passing in 1.3 and updated in the same sprint as the move (1.4 #8), and its `--check` is in every sprint's checks.
- **The plugin API changes under us.** The validator and loader stay pure where they can, and the full check runs every sprint.

## Scope Guard

No Engram plugins, hand-off, checker or Eidola skill (Phase 2), no Shrine and no Shrine switch (Phase 4). No new Engrams or scenes. No persona link of any kind. No change to how the Kraken, the Lich or the Wisp look, apart from the nothing-awake view and the placement fix.
