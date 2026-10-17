# Engram plugins, contract 1

An Engram you make is code, so it ships as its own small Claude Code plugin: an **Engram plugin**. Eidola stays the host. It keeps the frame, the HUD, the corner, the picker and the Shrine, and hands the drawing of the creature to the Engram's plugin. This page is everything such a plugin must provide and may rely on. The test plugin in [`test/fixtures/engram-plugin/`](../../test/fixtures/engram-plugin/) follows it line by line.

An Engram plugin carries no Soul, persona or prompt text of any kind. Eidola adds nothing to the prompt, and neither does an Engram plugin.

## The folder

```
my-engram/
  .claude-plugin/
    plugin.json        required: the plugin, depending on Eidola
  engram.json          required: the Engram, vessel.scene "self"
  hooks/
    hooks.json         required: { "modules": ["./register.tsx"] }
    register.tsx       required: the drawing module (announces, draws)
    creature.tsx       optional: a Client module, for a creature that moves
  vessel/
    thumb-pane.svg     optional picker stills, as in engram-format.md
    thumb-band.svg
  shrine/
    scene.js           optional: the Shrine's browser module (Phase 4; not read yet)
  tsconfig.json        optional: for type-checking
```

### plugin.json

```json
{
  "name": "my-engram",
  "version": "0.1.0",
  "description": "My Engram for Eidola.",
  "dependencies": ["eidola"]
}
```

`dependencies` lists Eidola, so the engine lays Eidola's contract (`types/index.d.ts` in the Eidola mod) into your `.claude-plugin/types/eidola/` and `$.eidola` and Eidola's state are typed in your module. Any plugin name will do; the Engram's own id is in `engram.json`.

### engram.json

The format is [engram-format.md](./engram-format.md), with three differences:

- `vessel.scene` is `"self"`: your plugin draws the creature. An Engram plugin's `engram.json` with any other scene is refused, as is a folder package (`engrams/<id>/`) that says `"self"`.
- `remixOf` (optional) is the id of the Engram it was remixed from, such as `"kraken"`. While your drawing can't be drawn, Eidola draws that Engram's scene in its place, as a still; without `remixOf`, the resting sprite. The picker's card uses it too when you ship no still.
- `id` stands alone. A plugin's folder is named by where it was installed, so the id needn't match it. It may not be a bundled Engram's id (`kraken`, `lich`, `wisp`), nor another Engram plugin's.

Everything else holds: the name, description, rights, `shows`, `thumbnails` and the HUD (`vessel.hud`), which Eidola draws over your creature.

```json
{
  "spec": 2,
  "id": "fixture",
  "name": "Fixture",
  "version": "0.1.0",
  "author": "you",
  "description": "A small creature, drawn by its own plugin inside Eidola's pane and band.",
  "rights": "original",
  "remixOf": "kraken",
  "vessel": { "scene": "self", "shows": ["pane", "band"], "thumbnails": { "pane": "thumb-pane.svg" } }
}
```

### The drawing module

`hooks/register.tsx` is the plugin's hooks module. It does two things: it announces the Engram, and it draws the creature when Eidola hands it the drawing. A creature that moves draws its frames in a Client module beside it (`<Client module="./creature.tsx" .../>`): a Client module must sit inside the plugin whose hook builds it, so your hook builds it, never Eidola's.

### Thumbnails

Optional stills for the picker, in `vessel/`, named in `vessel.thumbnails`: SVG, at most 131,072 characters each, no `<script>`, no `on*=` attribute, no `href` to `http:` or `https:` (the thumbnail rules of engram-format.md). Eidola reads one from your folder the first time the picker shows it.

## Announcing

At `session.start`, call `$.eidola.announce` with your folder:

```tsx
on('session.start', async ($, e, next) => {
  try {
    await $.eidola.announce({ root: $.plugin.root })
  } catch {
    // Eidola isn't installed: nothing to draw in.
  }
  return next(e)
})
```

Eidola reads `<root>/engram.json`, checks it with its validator, and adds the Engram to its registry. The call answers `{ contract, engram, issues }`: `engram` is your id once it is in, or `null` with each `issues` entry's file, problem and fix. `/eidola` lists an Engram plugin that didn't load, with why.

It works whichever plugin loaded first, because `$.eidola` is built before any `session.start` runs. If your Engram was awake when the session last ended, Eidola wakes it as soon as it announces. A plugin that loads after Eidola (installed, or reloaded mid-session) is also found by Eidola's `plugin.register` hook, whose list of what a module calls names `eidola.announce`; announcing again after a reload is still right, and clears a "not loading" mark.

## The hand-off

While your Engram is awake and Eidola shows it, Eidola draws its frame, HUD and corner around a drawing area and asks your plugin for the creature, `columns` × `rows` cells. Your hooks sit above Eidola's in the chain (your plugin loaded first) or beneath them (it loaded after), and the engine decides which. Handle both, with the same two hooks, one for the pane and one for the band:

```tsx
on('ui.render', { component: 'Pane', requestId: 'eidola' }, async ($, e, next) => { ... })
on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => { ... })
```

**Beneath Eidola.** Eidola calls `next` with the hand-off on `e.props.eidola` (`EidolaHandoff` in the contract):

| Field | What |
|---|---|
| `contract` | `1` |
| `engram` | The awake Engram's id. Not yours: return `next(e)`. |
| `where` | `pane` or `band` |
| `columns`, `rows` | The drawing area, in cells |
| `mood`, `moodBefore`, `moodAt` | The mood, the one before and when it changed |
| `ink`, `inkAt` | The error count and when it last rose |
| `epoch` | When the session's drawings started counting |

Answer one Box keyed `eidola:<id>`, `columns` wide and `rows` tall, holding your creature. Eidola places it inside its frame. The other props of the event are the engine's, unchanged: size to the hand-off, not to `bodyColumns`.

**Above Eidola.** There is no `e.props.eidola`. Call `next(e)` and look in the tree that comes back for a Box keyed `eidola-slot:<id>`. Replace that Box with yours (keyed `eidola:<id>`, sized to the slot's `width` and `height`) and return the tree, everything else in it as it came. No slot means Eidola isn't asking (another Engram is awake, the picker is open, the band is hidden): return the tree untouched. A Box keyed `eidola-fallback:<id>` means your Engram is marked not loading: leave it. Read the mood and the ink from Eidola's state here (below).

A tree is plain data: an element is `{ type, props, children }`, the key in `props.key`. The fixture's `fill` and `hasSlot` are a dozen lines each.

Eidola hands off only on the drawing of the awake Engram: not for the picker, an Engram page, the Surfaces screen or a test, and never while nothing is awake. On a terminal it hands off too, with no frame or corner: draw with Box and Text there.

## The state it reads

Eidola's public state, read with `$.state.get` and a literal reference such as `{ plugin: 'eidola', key: 'mood' }`. Reading it while drawing redraws your drawing when it changes.

| Key | Type | What |
|---|---|---|
| `contract` | `1` | The contract this Eidola keeps. Draw only for the version you were written for. |
| `engram` | id or `null` | The awake Engram |
| `mood` | `idle`, `working` or `attention` | What to draw |
| `moodBefore` | mood | The mood before the last change, to ease from |
| `moodAt` | ms | When the mood last changed |
| `ink` | count | How many times something went wrong this session |
| `inkAt` | ms | When `ink` last rose |
| `epoch` | ms | When the session's drawings started counting, to keep several in step |

Every other key in Eidola's `PluginState` is marked Internal in the contract: Eidola's own screens and tests, free to change.

## What it must draw

The three moods, each distinct at a glance ([vessel-states.md](./vessel-states.md)):

| Mood | When | Draw |
|---|---|---|
| `idle` | Nothing is happening | At rest |
| `working` | From a prompt to the turn's end | Busy |
| `attention` | Claude is blocked on the person | Asking to be looked at |

Ease from `moodBefore` to `mood` over time from `moodAt` rather than cutting, where your creature can.

**The error effect.** When `ink` rises, play a one-off effect over the current mood, then carry on: the Kraken inks and flees, the Lich is scorched, the Wisp gutters. Error is never a mood, and a creature never stays in it. The fixture shows a broken face for two seconds after `inkAt`.

Eidola draws the HUD over your creature when it is on (`vessel.hud.show`, or `/eidola frame`): brackets at three corners and the state at the top left. Its corner triangle sits over the bottom-right 3 × 2 cells, pane and band. Keep what matters out from under them.

## The limits

| Limit | What happens past it |
|---|---|
| 700 blocks (elements) in one drawing: the hand-off's Box and all inside it, and each frame a Client module draws | The hand-off's drawing is refused and marked not loading |
| 10 ticks a second: a Client module's timer at `surface.every(100)` or slower | The engine's own bounds apply; Eidola's live creatures tick at 100 ms |
| 250 ms for the hand-off's answer, counted on your own hooks: the engine's trace gives each hook's time with its `next()` calls taken out, so another plugin in the chain doesn't count against you | Refused and marked not loading |
| 131,072 characters a thumbnail, with the thumbnail rules | The scene's still (or the sprite) is drawn instead |

And the engine's own: a hook has 10 seconds, a tree 20,000 nodes and 100,000 characters.

The 250 ms falls back to the whole chain's time beneath Eidola where Eidola can't find your hooks in the trace: when your `plugin.json` has no `name`, or the drawing came back from a plugin of another name. Keep the name, and answer the hand-off from your own plugin.

## When it fails

A broken Engram plugin never breaks the session or the pane. When your drawing throws, draws nothing Eidola can place, or runs over a limit, Eidola draws the Engram it was remixed from (or the resting sprite) in your place and marks it **not loading**. `/eidola` then says which file and line, and why. Eidola stops asking until your plugin announces again (it reloaded) or the person runs `/engrams`.

Say where it failed yourself: catch the error and call `$.eidola.fault`. It gives the file and the line (from `line`, or read off `stack`):

```tsx
try {
  return draw(...)
} catch (error) {
  await $.eidola.fault({ engram: ID, message: String(error), file: 'hooks/register.tsx', stack: error instanceof Error ? error.stack : undefined })
  return next(e)
}
```

A hook that throws without catching is still contained. Beneath Eidola, Eidola sees it skipped and marks it not loading, with your hooks module as the file and no line. Above Eidola, the engine skips your hook and draws Eidola's tree as it came, the fallback in its slot, but Eidola can't see that happen, so it isn't marked: catch your errors.

## What it must never do

- Write Eidola's state, or hook `state.set` to change it. Only Eidola writes `eidola.*`.
- Add prompt text: no Soul, persona or instructions, no `prompt.submit` or `prompt.compose` hook that adds anything, no CLAUDE.md, no `$.session.append`.
- Draw outside the hand-off: no pane of its own for the creature, nothing over Eidola's frame, HUD or corner, nothing changed in Eidola's tree but its own slot.
- Hold the session up: no work in a hook that waits on the network or a process; nothing that refuses a tool call, a prompt or another plugin.

## Starting Claude from a pane button

For Create, Edit, Fix and Remix with Claude, a Button's `onPress` in the pane starts Claude on a task with one of two calls, both from the engine's own API (the plugin-authoring types for this build):

- **`$.command.run({ command, args })`** runs a slash command as if the person typed `/command args`, queued and run once the session is idle, its lines in the transcript. Run on the Eidola skill's slash command, it loads the skill and starts a turn on it: the deterministic way in, and the one the buttons use.
- **`$.prompt.submit({ text })`** submits a prompt as the person would: a turn of its own, once the session is idle, read under the plugin's name (or as the person's own words with `asUser: true`). Its text can be the same slash command, or a free request ("Remix the Kraken into a jellyfish") that the model meets with the skill.

Don't await either in the press handler: both wait for the session to be idle, so call them with `void`. `$.command.run` rejects inside a hook a turn waits on, which a press is not. It rejects inside a `command.run` hook too ("it would wait on the turn this hook is holding"), so a slash command that starts the skill, such as `/eidola remix kraken`, answers first and makes the run from a timer: `$.clock.after(0, () => { void $.command.run({ command, args }) })`. Eidola's `/eidola new`, `remix <id>`, `edit <id>` and `publish <id>` do this (Sprint 2.5), running the skill's command, `/eidola:eidola-engram`, with the task as its arguments; where the run is refused they put the command in the prompt box with `$.prompt.fill`. `$.prompt.fill({ text })` is the gentler third: it puts the request in the prompt box for the person to edit and send.

Evidence: the API's declarations (`$.command.run`: "Runs a slash command as if the person typed `/command args` ... queued and run once the session is idle"; `$.prompt.submit`: "a turn of its own, once the session is idle"), and the 16 Oct probe, where a second plugin ran Eidola's `/engrams` with `$.command.run` and got its output. Seen in the test kit (Sprint 2.5, `hooks/skill-commands.test.ts`): `$.command.run` refused from a `command.run` hook, and accepted from a timer after it. Not yet seen: a press doing it in a desktop session, and the skill's command run this way in a real session; Sprint 2.5's manual task checks the commands by hand, and the pane buttons are still to be wired.

## The bundled three, as Engram plugins

The Kraken, the Lich and the Wisp follow this contract too. Each bundled package holds its drawing module beside its `engram.json` and thumbnails: `engrams/<id>/hooks/draw.tsx`, a function from the hand-off to the creature's Box (`Draw` in `hooks/drawing.ts`). Eidola draws the bundled three by calling it with the hand-off it would give their plugin, so what a bundled Engram draws and what its export draws are one function.

`node scripts/export-engram.mjs <id> <folder>` turns one into an Engram plugin of its own, under a new id (the folder's name, or `--id`): `plugin.json` depending on Eidola, `engram.json` with `vessel.scene` `"self"` and `remixOf` the bundled id, hooks that announce it and answer the hand-off from either seat, the drawing module and every file it draws with copied into `hooks/` (their import and surface-module paths pointed at the copies, nothing else changed), and the thumbnails. It runs the checker on what it wrote. `test/fixtures/exported-lich/` is the Lich exported this way; `hooks/export.test.ts` shows it draws as the bundled Lich does.

In the band, Eidola hands an Engram plugin the rows its `remixOf` scene draws in: twelve for a Lich (as many as the band allows, at least seven), nine for a Wisp, seven otherwise. A remix draws as tall as the Engram it came from.

## Checking one

- `node scripts/check-engram.mjs <folder>` (from Eidola's folder): the whole contract. `engram.json` through Eidola's validator (the one the loader and `announce` use), the plugin manifest and its dependency on Eidola, the announce call, the pane and band hooks `vessel.shows` asks for, the `eidola:<id>` key, every import and surface module inside the folder and there, the thumbnails against their limit, and nothing it must never do. It prints `ok` and what it found, or each problem with its file and its fix, then the warnings; it exits 1 on any error.
- `claude plugin validate <folder>`: the manifest and the hooks module as the engine reads them.
- `node scripts/engram-home.mjs draws <id|folder>` (from Eidola's folder): writes `test/draws.test.ts` into the plugin and runs it with `claude plugin test`, handing the drawing module the hand-off in the pane and the band (as `vessel.shows` lists them), on terminal and desktop, in each mood and with the error effect. It passes when each comes back as one Box keyed `eidola:<id>` within 700 blocks, the three moods differ, and the error effect changes each.
- Eidola's tests load the fixture's `register` as an inline plugin, above and beneath Eidola (`hooks/handoff.test.ts`), the way to test your own. An inline plugin is loaded from its `register`'s source alone, so a plugin whose hooks import other files is tested in its own folder (`claude plugin test <folder>`), mounting its pane with a hand-off on `props.eidola`.
- By hand: add the folder holding it as a local marketplace, install it, awaken it, and look at the pane and the band.
