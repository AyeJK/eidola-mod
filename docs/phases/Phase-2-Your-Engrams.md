# Phase 2 — Make Your Own

People make their own Engrams the way the Kraken and the Lich were made: by describing them to Claude. They can start from nothing or remix any Engram, keep changing it by talking to Claude, see it live in the pane, and publish it for others to install and remix in turn.

An Engram you make is code, so it ships as its own small Claude Code plugin: an **Engram plugin**. The mod can't load code from a folder (Client modules must sit inside the plugin, and there is no `import()` or `eval`), so a plugin is the only way. Eidola stays the host: it keeps the frame, the HUD, the corner, the picker and the Shrine, and hands the drawing of the creature to the Engram's plugin. An **Eidola skill**, shipped inside the mod, knows how to create, remix, check and publish one.

This replaces the earlier Phase 2 (a folder of settings files naming a bundled scene). That idea couldn't change the creature itself, which is the whole point.

Plan: `docs/Plan-EngramSpecV2-2026-10-16.html` (decision 14; §Next: scene plugins, which this phase now covers; the 16 Oct probe). Design: `docs/design/design-system.md` and its canvas. Probe: `.probe/SCENE-PROBE.md`.

---

# Sprint 2.1 — Picker and Engram Page

### Goal

The picker matches the new design, and clicking a card opens that Engram's own page, where you can preview its moods, see where it draws and awaken it.

### Tasks

| Status | # | Task | Module | Reference |
|--------|---|------|--------|-----------|
| x | 1 | Add `hooks/theme.ts` with the pane colours from the design system, and use only those in every screen the picker draws | hooks/theme.ts | docs/design/design-system.md §Colours |
| x | 2 | Bake the pixel "Eidola" wordmark as one `Svg` of paths (no web font), and the three surface icons (pane, band, Shrine) as small `Svg`s that take a colour | hooks/wordmark.ts, hooks/icons.ts | docs/design/design-system.md §What the pane can and can't do |
| x | 3 | Rebuild the picker header: back button, wordmark, and a Surfaces button whose icons are amber when that surface is on. Then the "Engrams" title with its count label and the ember-to-gold rule | hooks/register.tsx | design-system §Header, §Title and rule |
| x | 4 | Add the awake strip: thumbnail with the mood in amber, the "AWAKE" label, the name, "drawing in …" from `whereItDraws`, and Details and Sleep | hooks/register.tsx | design-system §Awake strip |
| x | 5 | Restyle the filters as chips with counts (All, Pane, Band), amber when selected. Yours comes in 2.6 and Shrine in Phase 4 | hooks/register.tsx | design-system §Filter chips |
| x | 6 | Restyle the cards: thumbnail, name, two-line description, and a footer with the surface icons, the short "pane + band" text and Awaken or Sleep. The awake card gets the amber border and badge | hooks/register.tsx | design-system §Engram card |
| x | 7 | Make the card body open the Engram page; Awaken and Sleep still act straight away | hooks/register.tsx |
| x | 8 | Add the Engram page: back to the picker; the HUD preview running the Engram's live scene in a `Client`; three mood chips and an Error button that change the preview only; the label, name, rule and description; Awaken or Sleep; the Where it draws panel from `whereItDraws` with a link to Surfaces; and the Draws, Source, Rights and On error cards. Remix comes in 2.6 | hooks/register.tsx, hooks/engram-page.tsx | design-system §HUD preview, §Panel |
| x | 9 | Terminal and mobile: the same screens in plain text, with no `Svg` or `Client` | hooks/register.tsx |
| x | 10 | Render tests on desktop and terminal: the picker with the awake strip, chips and cards; a card opening its page; the page in each mood and with the error preview; the preview buttons leaving the session's mood alone | hooks/picker.test.ts, hooks/engram-page.test.ts |
| MANUAL | 11 | Open the picker and the Lich's page in the desktop app and compare them with the canvas |

### Acceptance Criteria

- Every colour in the picker and the Engram page comes from `theme.ts`
- Clicking a card opens its page, and the back button returns to the picker
- The preview's mood chips and Error button change the preview only, never the session
- Terminal and mobile show the same screens in text

### Dependencies

- Phase 1 (`whereItDraws` and the surfaces setting)

### Verification

- cli: claude plugin validate . && npx -p typescript tsc -p . && claude plugin test . && node scripts/bake-thumbs.mjs --check
- skip-ui: true
- assert: Picker and Engram page render tests pass on desktop and terminal
- assert: No hex colour appears in `register.tsx` or `engram-page.tsx` outside `theme.ts` imports

---

# Sprint 2.2 — Surfaces Screen and Ways In

### Goal

You can set the surfaces from a screen instead of a command, and reach the picker and any Engram's page from a command or from any band.

### Tasks

| Status | # | Task | Module | Reference |
|--------|---|------|--------|-----------|
| x | 1 | Add the Surfaces screen: a row each for Pane and Band with its switch; the "Hide the band while the pane is open" check under Band; a Status line row; and a warning when every surface is off. Each control writes the setting with `$.config.set`, as `/eidola place` does | hooks/register.tsx, hooks/surfaces-page.tsx | design-system §Surface row, §Switch |
| x | 2 | `/eidola place` with no arguments opens the Surfaces screen on desktop and prints the switches elsewhere | hooks/register.tsx |
| x | 3 | Ways in: `/engrams` opens the picker on desktop and still prints the list elsewhere. `/engrams <id>` opens that Engram's page. The corner triangle shows on every Engram's band, not only the Wisp's | hooks/register.tsx, hooks/frame-corner.tsx |
| x | 4 | Tests: each switch and the check write the setting and the screen redraws; the all-off warning; `/engrams kraken` opens the Kraken's page; the band corner shows for each of the three | hooks/surfaces-page.test.ts, hooks/picker.test.ts |
| MANUAL | 5 | In the desktop app: switch the band off and on from the Surfaces screen, and open the picker from a band's corner |

### Acceptance Criteria

- Every control on the Surfaces screen changes the same setting `/eidola place` changes, and both show the same values
- `/engrams` and `/engrams <id>` open the picker and a page on desktop
- Every band has the corner triangle

### Dependencies

- Sprint 2.1

### Verification

- cli: claude plugin validate . && npx -p typescript tsc -p . && claude plugin test . && node scripts/bake-thumbs.mjs --check
- skip-ui: true
- assert: Surfaces screen render tests pass on desktop and terminal
- assert: `/engrams lich` opens the Lich's page in a render test

---

# Sprint 2.3 — The Hand-off and the Engram Plugin Contract

### Goal

Another plugin can draw an Engram's creature inside Eidola's pane and band, Eidola can find it, and what such a plugin must provide is written down.

### Tasks

| Status | # | Task | Module | Reference |
|--------|---|------|--------|-----------|
| x | 1 | Hand-off in the pane: when the awake Engram belongs to another plugin, Eidola's `Pane` hook calls `next(e)` with the drawing area's size and places what comes back inside its own frame, HUD and corner. Otherwise it draws as today | hooks/register.tsx | .probe/SCENE-PROBE.md |
| x | 2 | The same hand-off for the band | hooks/register.tsx |
| x | 3 | If the plugin's drawing throws, returns nothing or runs over the frame budget, Eidola shows the Engram it was remixed from (or the resting sprite), marks the Engram "not loading" with the file and line, and keeps the session running | hooks/register.tsx |
| x | 4 | Discovery: Eidola adds an `eidola` noun in `engine.create` with `announce({ root })`, which an Engram plugin calls at `session.start`. Eidola reads its `engram.json` from that root, validates it with `validate.ts` and adds it to the registry. A `plugin.register` hook catches plugins that load after Eidola, as a backup | hooks/register.tsx, hooks/loader.ts | Plan §Next: scene plugins |
| x | 5 | Make Eidola's `PluginState` a public contract: document `engram`, `mood`, `moodBefore`, `moodAt`, `ink`, `inkAt` and `epoch`, add `contract: 1`, and ship the types so an Engram plugin listing Eidola under `dependencies` gets them | types/index.d.ts |
| x | 6 | Write `docs/spec/engram-plugin.md`: the folder (plugin.json, engram.json with `scene: "self"` and an optional `remixOf`, the drawing module, an optional Shrine module, thumbnails), how it announces itself, which state it reads, what it must draw for each mood and for the error effect, the limits (700 drawing blocks, 10 ticks a second, thumbnails at 131,072 characters), and what it must never do (write Eidola's state, add prompt text) | docs/spec/engram-plugin.md |
| x | 7 | Add a test Engram plugin under `test/fixtures/engram-plugin/` that follows the contract and draws a simple creature in all three moods | test/fixtures/engram-plugin/ |
| x | 8 | Tests with the fixture: it announces and appears in the registry; awake, its drawing appears inside Eidola's frame in the pane and the band; a throwing fixture falls back and is marked not loading; both load orders are found | hooks/handoff.test.ts |
| x | 9 | Find out how a pane button can start Claude on a task (for Create, Edit, Fix and Remix with Claude): `$.command.run` on the skill's slash command, or anything better the engine offers. Record the answer in the spec | docs/spec/engram-plugin.md |
| MANUAL | 10 | Install the fixture from a local marketplace, awaken it in a desktop session, and confirm it draws inside Eidola's pane and band |

### Acceptance Criteria

- An installed Engram plugin draws its creature inside Eidola's pane and band, with Eidola's HUD and corner around it
- A broken Engram plugin never breaks the session or the pane
- Eidola finds Engram plugins whichever loads first
- `docs/spec/engram-plugin.md` is enough to write the fixture from scratch

### Dependencies

- Sprint 2.1

### Verification

- cli: claude plugin validate . && npx -p typescript tsc -p . && claude plugin test . && node scripts/bake-thumbs.mjs --check && claude plugin validate test/fixtures/engram-plugin
- skip-ui: true
- assert: Hand-off tests pass with the fixture in both load orders
- assert: The throwing fixture is marked not loading and the session keeps running

---

# Sprint 2.4 — The Bundled Three, Ready to Remix

### Goal

The Kraken, the Lich and the Wisp follow the same contract as any Engram plugin, so remixing one gives a complete, working plugin of your own.

### Tasks

| Status | # | Task | Module | Reference |
|--------|---|------|--------|-----------|
| x | 1 | Give each bundled Engram the Engram plugin layout inside `engrams/<id>/`: its `engram.json`, its drawing module and its thumbnails together, drawing through the same interface an Engram plugin uses | engrams/, hooks/register.tsx | docs/spec/engram-plugin.md |
| x | 2 | Write `scripts/export-engram.mjs <id> <folder>`: turn a bundled Engram into a standalone, installable Engram plugin (plugin.json, the announce call, its scene, its thumbnails, `remixOf`) under a new id | scripts/export-engram.mjs |
| x | 3 | Prove an exported Lich, installed locally, draws exactly as the bundled one: the fixed-seed run matches | hooks/export.test.ts |
| x | 4 | Write `scripts/check-engram.mjs <folder>`: check an Engram plugin against the contract (engram.json through `validate.ts`, the announce call, the drawing module, thumbnails against their limit) and print ok, warnings and errors, each with the file and the fix | scripts/check-engram.mjs | Plan decision 8 |
| x | 5 | Test the checker on the exported three, the fixture, and broken copies of each | hooks/check.test.ts |

### Acceptance Criteria

- Each exported bundled Engram installs, passes the checker and draws as the bundled one does
- The checker names the file and the fix for every problem

### Dependencies

- Sprint 2.3

### Verification

- cli: claude plugin validate . && npx -p typescript tsc -p . && claude plugin test . && node scripts/bake-thumbs.mjs --check && node scripts/check-engram.mjs test/fixtures/engram-plugin
- skip-ui: true
- assert: The exported Lich's fixed-seed run matches the bundled Lich

---

# Sprint 2.5 — The Eidola Skill

### Goal

A skill shipped with the mod lets Claude create, remix, change, check and publish an Engram with you.

### Tasks

| Status | # | Task | Module | Reference |
|--------|---|------|--------|-----------|
| x | 1 | Write `skills/eidola-engram/SKILL.md`: what an Engram is, the contract, the limits and how each surface differs, and step-by-step guides for create, remix, change, fix, check and publish. Keep the contract in `docs/spec/engram-plugin.md` and point to it, so the two never drift | skills/eidola-engram/ | docs/spec/engram-plugin.md |
| x | 2 | Add a starter Engram plugin for "create from nothing": a small, working creature in all three moods with the error effect, under `skills/eidola-engram/starter/` | skills/eidola-engram/starter/ |
| x | 3 | Your Engrams live in `~/.claude/eidola/engrams/<id>/`, listed in a local marketplace (`eidola-local`) that the skill keeps up to date and installs from, so changes show up live | skills/eidola-engram/ |
| x | 4 | Remix: from a bundled Engram through `export-engram.mjs`; from an installed Engram plugin by copying its folder under a new id with `remixOf` set. Never overwrite an existing id | skills/eidola-engram/ |
| x | 5 | Publish: run the checker, then push the Engram to a GitHub repo of the creator's with a `marketplace.json`, and print the two commands others run to install it. Never publish without the creator's yes | skills/eidola-engram/ |
| x | 6 | Add `/eidola new`, `/eidola remix <id>`, `/eidola edit <id>` and `/eidola publish <id>`, each starting the skill on that task | hooks/register.tsx |
| MANUAL | 7 | Run the skill's evals with `claude plugin eval`: create a creature from a description, remix the Lich into a new colour and motion, fix a broken fixture, and publish to a test repo. Each result must pass the checker and draw | evals/eidola-engram/ |
| MANUAL | 8 | Create one Engram from nothing and remix one, start to finish, in a desktop session, and publish one to a real repo |

### Acceptance Criteria

- Create, remix, fix and publish each end with an Engram that passes the checker and draws in the pane
- Nothing is published without the creator saying yes
- The skill never writes inside Eidola's own folder

### Dependencies

- Sprint 2.4

### Verification

- cli: claude plugin validate . && npx -p typescript tsc -p . && claude plugin test . && node scripts/check-engram.mjs skills/eidola-engram/starter
- skip-ui: true
- assert: The skill's evals pass

---

# Sprint 2.6 — Your Engrams in the Picker

### Goal

Your Engrams sit beside the bundled ones, and every Engram page offers Remix.

### Tasks

| Status | # | Task | Module | Reference |
|--------|---|------|--------|-----------|
| x | 1 | Add the Yours chip and its count. The Yours view starts with the New Engram tile (Create with Claude, and "or remix one" back to the picker), then your Engrams as cards with "Remix of …", an Edit with Claude icon button and Awaken | hooks/register.tsx | design-system §Engram card; canvas Yours artboard |
| x | 2 | A not-loading Engram shows as a card with a dimmed thumbnail, the "Not loading" badge, the file and line, and Fix with Claude | hooks/register.tsx | canvas Yours artboard |
| x | 3 | The Yours empty state: Make your own Engram, Create with Claude, "or remix one" | hooks/register.tsx | canvas Yours · empty artboard |
| x | 4 | Add Remix with Claude to every Engram page, and Publish to the pages of your own | hooks/engram-page.tsx | canvas Engram page artboard |
| x | 5 | Wire Create, Edit, Fix, Remix and Publish to the skill, as 2.3 #9 found | hooks/register.tsx |
| x | 6 | Add an Engrams line to `/eidola`: bundled count, yours, and each not-loading Engram with its file and line | hooks/register.tsx |
| x | 7 | Render tests on desktop and terminal: Yours with one working and one broken Engram, the empty state, and Remix on a bundled page | hooks/picker.test.ts, hooks/engram-page.test.ts |
| MANUAL | 8 | From the picker alone: create an Engram, remix the Kraken, fix a broken one, and publish one |

### Acceptance Criteria

- Every action on the Yours view and the Engram page reaches the skill
- A broken Engram shows where it broke and how to fix it, and never breaks the picker

### Dependencies

- Sprint 2.5

### Verification

- cli: claude plugin validate . && npx -p typescript tsc -p . && claude plugin test . && node scripts/bake-thumbs.mjs --check
- skip-ui: true
- assert: Yours and Engram page render tests pass on desktop and terminal

---

## Risk Mitigations

- **The pane hand-off doesn't work as the probe suggests.** Sprint 2.3 starts with it and ends with a manual check before anything else depends on it. The band hand-off already worked in the 16 Oct probe.
- **A third-party Engram plugin misbehaves.** It's code the person chose to install, like any plugin. Eidola contains the damage: a throw, an empty drawing or a blown budget falls back and is marked not loading.
- **Load order.** Discovery uses an announce call that works whichever plugin loads first, with `plugin.register` as a backup; both orders are tested.
- **A pane button can't start Claude.** 2.3 #9 finds out early. The fallback is the slash commands from 2.5 #6, which a button can run.
- **The pane can't use the site's fonts.** The design system says how the look carries without them, and 2.1 #11 checks the result against the canvas by eye.

## Scope Guard

No Directory, marketplace site or uploads: publishing means a GitHub repo people install from. No Soul, persona or prompt text in any Engram. No settings-only Engrams: every Engram of yours is a full Engram plugin. Cloud sessions aren't supported.
