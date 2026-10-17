# Phase 4 — Local Shrine

Bring the Vessel back to the Kraken's pump display, a browser tab or an OBS source, served by the mod from Jeremy's own computer. When the Shrine switch in the surfaces setting is on, the mod starts a small Node server and only tells it what's happening (state, mood, ink). The Shrine page draws the Engram itself, from the same Engram files and the same simulation code the pane runs, so the Kraken, the Lich and the Wisp move live in 3D on a canvas, free of the pane's limits. The page fits whatever it's shown in, from the pump's round screen to a band-shaped strip, with no resolution setting: the window's shape picks the view, and the URL can override it per screen. No relay, no eidola.app, no media tier.

Plan: `docs/Plan-EngramSpecV2-2026-10-16.html` (decisions 11, 13; §Local Shrine; Q7, Q8 verified 16 Oct; Q9, Q10, Q11).

---

# Sprint 4.1 — Split the Kraken

### Goal

Separate the Kraken's creature from its drawing, so the pane and the Shrine can run the same simulation (Q11).

### Tasks

| Status | # | Task | Module | Reference |
|--------|---|------|--------|-----------|
| — | 1 | Record a fixed-seed run of the live Kraken today: the colours of every pixel for 50 ticks in each mood, as a test fixture | hooks/kraken.test.ts |
| — | 2 | Move the creature into `hooks/kraken-sim.ts`: its model (from `kraken3d.ts`), the mood plans, one `step(dt)` and the colour at any pixel. The frame's width, height and view are inputs, as `camera`, `sizeOf`, `pickSpot` and `isOutOfView` take them today, never fixed to the pane's cols and rows. No `claude-code` import, no drawing | hooks/kraken-sim.ts | Plan §One simulation, two renderers; §Any size |
| — | 3 | Make `kraken-live.tsx` tick the simulation and draw it as Boxes, within the 700-Box budget, as before | hooks/kraken-live.tsx |
| — | 4 | Prove the fixed-seed run matches the recorded fixture exactly | hooks/kraken.test.ts |
| — | 5 | Run the simulation on a grid twice as fine each way and record the time per tick | hooks/kraken.test.ts |

### Acceptance Criteria

- The fixed-seed run is identical before and after the split
- `kraken-sim.ts` imports nothing from `claude-code` and draws nothing
- `kraken-sim.ts` takes the frame size and view as inputs; nothing in it assumes the pane's size
- The finer grid runs, and its time per tick is written in the test output

### Dependencies

- Phase 1 (the loader and `shows` list)

### Verification

- cli: claude plugin validate . && npx -p typescript tsc -p . && claude plugin test . && node scripts/bake-thumbs.mjs --check
- skip-ui: true
- assert: `kraken.test.ts` passes with the recorded fixture unchanged

---

# Sprint 4.2 — The Shrine Server and the Mod's Side

### Goal

The mod starts the Shrine at session start and tells it each change; the server keeps the latest and passes it on.

### Tasks

| Status | # | Task | Module | Reference |
|--------|---|------|--------|-----------|
| — | 1 | Write `shrine/server.mjs` (Node, no dependencies) on `127.0.0.1:9743`: `/health` naming itself as Eidola, `POST /state`, `/events` over server-sent events, the page under `/shrine/`, and Engram files from the folders it's given. Paths outside those folders are refused. Exits if the port is taken | shrine/server.mjs | Plan §How it works |
| — | 2 | Check for Node 20 or later at start and report the version | shrine/server.mjs | Plan Q8 |
| — | 3 | Add the Shrine switch to the surfaces setting (off by default) and to `whereItDraws`, so an Engram draws on the Shrine only if the switch is on and its `shows` lists `shrine`. `/eidola place shrine on` sets it | .claude-plugin/plugin.json, hooks/placement.ts | Plan decision 5 |
| — | 4 | In the mod, at `session.start` and with the Shrine switch on: ask `/health`; if nothing answers, spawn the server with `$.process.spawn`, passing the folders of the bundled Engrams and of each announced Engram plugin, for the session's life. A newly announced plugin's folder is added without a restart. If something else answers on 9743, say so in `/eidola` | hooks/shrine.ts |
| — | 5 | Post `{ engram, state, mood, ink }` on each change, debounced, fire and forget, never inside a tool call. A rise in `ink` is the error effect. If a post fails, start a server and try once more | hooks/shrine.ts |
| — | 6 | Add `/eidola shrine`: the URL, CAM's deep link and its `cam-redirect.nzxt.com` fallback, the Node version, whether the switch is on and whether the server is up | hooks/register.tsx |
| — | 7 | Add the Shrine row to the Surfaces screen: its switch, and while on, "Running on this computer · Node vX" (or why it isn't), the address with Copy, Open in NZXT CAM (the deep link), Open in browser, and the per-screen options (`?view=`, `?bg=transparent`, `?hud=0`) | hooks/surfaces-page.tsx | docs/design/design-system.md §Surface row; canvas Surfaces artboard |
| — | 8 | Test the server with `node --test`: health, a posted state reaching an events client, a path outside the folders refused, a second server exiting on a taken port | shrine/server.test.mjs |
| — | 9 | Test the Shrine switch: off starts and posts nothing; on starts the server; an Engram whose `shows` leaves out `shrine` posts nothing. Render-test the Shrine row with the switch off, on and running, and on but with no Node | hooks/placement.test.ts, hooks/surfaces-page.test.ts |
| MANUAL | 10 | In an interactive local desktop session with the mod, turn the Shrine switch on from the Surfaces screen, use Open in NZXT CAM, and confirm the server started (the one caveat left from the 16 Oct probe) |

### Acceptance Criteria

- With the Shrine switch off, the mod starts no server and posts nothing
- With it on, starting a session with nothing on 9743 brings the server up within a second
- A second session reuses the running server and doesn't start another
- A failed post never slows or breaks a turn
- The Surfaces screen's Shrine row turns the server on and off and shows its address

### Dependencies

- Phase 1
- Sprint 2.2 (the Surfaces screen)

### Verification

- cli: claude plugin validate . && npx -p typescript tsc -p . && claude plugin test . && node --test shrine/
- skip-ui: true
- assert: Server tests pass; `/eidola shrine` shows the server as up

---

# Sprint 4.3 — The Shrine Page and the Kraken LCD

### Goal

A page that follows the awake Engram's scene and mood, fits any window it's shown in, and fits the Kraken's round screen. There's no frames path: every Engram is a scene.

### Tasks

| Status | # | Task | Module | Reference |
|--------|---|------|--------|-----------|
| — | 1 | Write `shrine/page.ts`: subscribe to `/events`, load the awake Engram's `engram.json`, and hand its scene renderer the frame size, the view, the mood (blending between moods) and the error effect. Until the canvas renderers land in 4.4 and 4.5, a stand-in renderer draws the Engram's name, its mood and its HUD colours, filling the frame, so the page and the views can be tested | shrine/page.ts |
| — | 2 | Port CAM detection from v1: `window.nzxt.v1` or `?kraken=1`, its size, shape and `targetFps`, drawn as a 640 × 640 circle | shrine/kraken-screen.ts | eidola-runtime/packages/shrine/src/shared/kraken-detect.ts, renderer/kraken-setup.ts |
| — | 3 | Size the canvas to the window (times the device pixel ratio) and redraw on resize. Pick the view from the window's shape: round on the Kraken, wide at about 2.5:1 or wider, regular in between | shrine/view.ts | Plan §Any size |
| — | 4 | Read per-screen overrides from the URL: `?view=round\|wide\|regular`, `?bg=transparent` for OBS, `?hud=0` to drop the state and camera labels | shrine/view.ts | Plan §Any size |
| — | 5 | Add the page's resting states: waiting for a session, and nothing awake | shrine/page.ts |
| — | 6 | Test the view picker: shapes either side of each threshold, CAM detected, and each override winning over the shape | shrine/view.test.ts |
| — | 7 | Bundle the page to `shrine/page.js` with esbuild at a pinned version, and add `scripts/build-shrine.mjs --check` that fails when the committed bundle doesn't match its source | scripts/build-shrine.mjs |
| — | 8 | Add the bundle check to the README's pre-push checks | README.md |

### Acceptance Criteria

- Posting a new state changes the page within a second
- With `?kraken=1` the page draws a 640 × 640 circle
- At 1280 × 720 the page picks the regular view; at 1280 × 240, the wide one
- Resizing the window redraws at the new size with no reload
- `?bg=transparent` leaves everything but the Engram transparent
- The bundle check fails on a stale `page.js`

### Dependencies

- Sprint 4.2

### Verification

- cli: claude plugin validate . && npx -p typescript tsc -p . && claude plugin test . && node --test shrine/ && node scripts/build-shrine.mjs --check
- ui: http://127.0.0.1:9743/shrine/, http://127.0.0.1:9743/shrine/?kraken=1, http://127.0.0.1:9743/shrine/?bg=transparent&hud=0
- viewports: 640, 1280
- assert: With the Lich awake, posting `working` shows the stand-in's working mood, and a rise in `ink` then shows its error effect
- assert: `?kraken=1` draws a centred 640 × 640 circle
- assert: At 1280 × 240 the page picks the wide view and the stand-in fills the strip

---

# Sprint 4.4 — The Kraken on Canvas

### Goal

The live 3D Kraken swims on the Shrine, at the screen's frame rate and finer than the pane can draw.

### Tasks

| Status | # | Task | Module | Reference |
|--------|---|------|--------|-----------|
| — | 1 | Write `shrine/kraken.canvas.ts`: tick `kraken-sim.ts` at `targetFps` (30 elsewhere) and paint it on a canvas, passing the canvas size and the page's view as the frame, so the Kraken roams, leaves and re-enters at the window's real edges | shrine/kraken.canvas.ts | Plan §One simulation, two renderers; §Any size |
| — | 2 | Give `sizeOf` a creature size for in-between shapes that blends smoothly from the band rule (wide) to the pane rule (regular), so a 16:9 tab or a 3:1 strip gets a fitting Kraken. The pane's two views keep their sizes exactly | hooks/kraken-sim.ts | Plan §Any size |
| — | 3 | Set grid density from the canvas size: a minimum cell size keeps the pixel look, and a bigger window gets more cells, up to the frame budget | shrine/kraken.canvas.ts | Plan §Any size |
| — | 4 | Use the canvas renderer in place of the stand-in whenever the awake Engram names the Kraken's scene, fed mood and ink (the error effect: it inks) from the events | shrine/page.ts |
| — | 5 | Coarsen the grid when a frame runs over its time, and recover when it's back under | shrine/kraken.canvas.ts |
| — | 6 | Test the blended size: equal to the band and pane rules at their own shapes, and continuous between them | hooks/kraken.test.ts |
| — | 7 | Rebuild the bundle | shrine/page.js |
| MANUAL | 8 | In NZXT CAM, point the Web Integration at `http://127.0.0.1:9743/shrine/` (or use `/eidola shrine`'s deep link) and check the Kraken on the pump through idle, working and attention |

### Acceptance Criteria

- The Kraken moves continuously on the page whatever the pane is doing, including with the pane closed
- Mood changes reach the page within a second
- The page holds its frame rate on the pump, coarsening if it must
- The Kraken roams the whole window at any size, leaving and re-entering at its edges
- The pane's Kraken is unchanged: the 4.1 fixed-seed fixture still passes

### Dependencies

- Sprint 4.1, Sprint 4.3

### Verification

- cli: claude plugin validate . && npx -p typescript tsc -p . && claude plugin test . && node --test shrine/ && node scripts/build-shrine.mjs --check
- ui: http://127.0.0.1:9743/shrine/?kraken=1, http://127.0.0.1:9743/shrine/
- viewports: 640, 1280
- assert: With the Kraken awake, the canvas animates without a posted change
- assert: Posting `attention` brings the Kraken up to the glass
- assert: A rise in `ink` makes the Kraken ink, then it carries on in its mood
- assert: At 1280 × 720 and at 1280 × 240 the Kraken is sized to the window and swims across its full width

---

# Sprint 4.5 — The Lich, the Wisp and Release 0.8.0

### Goal

All three live Engrams run on the Shrine, the mod knows about Shrine-only Engrams, and 0.8.0 ships.

### Tasks

| Status | # | Task | Module | Reference |
|--------|---|------|--------|-----------|
| — | 1 | Split `lich-live.tsx` into `lich-sim.ts` (glyphs) and its Box drawing, proven by a fixed-seed test as in 4.1, with the frame size and view as inputs | hooks/lich-sim.ts |
| — | 2 | Split `wisp-live.tsx` the same way | hooks/wisp-sim.ts |
| — | 3 | Canvas renderers for the Lich and the Wisp, fed the canvas size, view, mood and error effect as in 4.4 (the Lich is scorched), with a blended size for in-between shapes. Remove the 4.3 stand-in, and rebuild the bundle | shrine/ | Plan §Any size |
| — | 4 | Load an Engram plugin's Shrine module from its own folder, as the 16 Oct probe did, when its `engram.json` names one; otherwise show its thumbnail. Add a Shrine module to the skill's starter and to `docs/spec/engram-plugin.md` | shrine/page.ts, skills/eidola-engram/starter/, docs/spec/engram-plugin.md | .probe/SCENE-PROBE.md |
| — | 5 | Support `"shows": ["shrine"]`: a Shrine filter chip with its count and a "Shrine only" label in the picker, styled as in Sprint 2.1, and the band's one line with the Engram's name and the Shrine's URL. If the Shrine switch is off, the line says so and how to turn it on | hooks/register.tsx | Plan Q10; docs/design/design-system.md §Filter chips |
| — | 6 | Add the `shrineBand` option to `userConfig` (on by default) to turn that band line off, and its checkbox under the Shrine row on the Surfaces screen | .claude-plugin/plugin.json, hooks/surfaces-page.tsx | Plan Q10 |
| — | 7 | Add a Shrine section to the README: what it is, the Shrine switch, `/eidola shrine`, CAM setup, Node 20 or later | README.md | eidola-runtime/docs/spec/nzxt-cam-web-integration.md |
| — | 8 | Set `plugin.json` to 0.8.0 and run every check | .claude-plugin/plugin.json |
| MANUAL | 9 | Try the Kraken, the Lich and the Wisp on the pump and in a browser tab, and approve the release |
| — | 10 | Commit, push `forge-vessels`, fast-forward `main`, and update the installed mod from GitHub | .claude-plugin/ |

### Acceptance Criteria

- The Lich and the Wisp pass their fixed-seed tests unchanged after the split
- All three live Engrams animate on the Shrine page, and each fills the window at any size
- No stand-in renderer is left in the bundle
- An Engram plugin that ships a Shrine module draws on the Shrine, served from its own folder; one without a Shrine module shows its thumbnail there
- With a Shrine-only test Engram awake, the band shows one line, and `shrineBand` off hides it
- The installed mod reports 0.8.0

### Dependencies

- Sprint 4.4

### Verification

- cli: claude plugin validate . && npx -p typescript tsc -p . && claude plugin test . && node scripts/bake-thumbs.mjs --check && node --test shrine/ && node scripts/build-shrine.mjs --check
- ui: http://127.0.0.1:9743/shrine/
- viewports: 640, 1280
- assert: Awakening the Lich, then the Wisp, switches the page's canvas to each
- assert: Each animates without a posted change

---

## Risk Mitigations

- **A split changes how the pane's creature moves.** Each split is proven by a fixed-seed run recorded before it (4.1, 4.5).
- **The pump's browser can't keep up.** The canvas honours `targetFps` and coarsens its grid when a frame runs long (4.4 #5).
- **Something else holds port 9743.** The v1 Shrine is the likely one: uninstall it first; `/eidola` says what's on the port.
- **The interactive desktop session behaves differently from the 16 Oct probe.** Checked by hand in 4.2 #9 before the page work starts.

## Scope Guard

No relay and nothing on eidola.app. No media tier. No Shrine for cloud sessions. Shrine-only Engrams themselves (a denser Kraken, a Lich in full fire) are new work after this phase; this phase only makes the mod ready for them. Scene plugins, and loading a plugin's scene on the Shrine, are the later phase after this one.
