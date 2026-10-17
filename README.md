# Eidola (mod prototype)

An Engram's scene in a pane or the band above the prompt that reacts to what Claude is doing. Eidola adds nothing to the prompt.

- States: idle, thinking, working, attention, success, responding, error, waiting (asleep when no Engram is awake: the pane and band show the Wisp's scene, dimmed)
- Commands: `/eidola` (open the pane and print diagnostics), `/eidola place [pane|band|hide|status on|off]` (open the Surfaces screen on the desktop, print the switches elsewhere, or set one), `/eidola frame` (toggle the awake Engram's HUD), `/eidola mood idle|working|attention` (set the mood by hand until the next prompt), `/eidola ink` (show a failure), `/eidola media` (toggle the media test), `/awaken <engram>`, `/sleep`, `/engrams [engram]` (open the picker, or one Engram's page, in the pane on the desktop; print the list elsewhere)
- Make your own: `/eidola new`, `/eidola remix <engram>`, `/eidola edit <engram>`, `/eidola publish <engram>` start the Eidola skill (`skills/eidola-engram/`, also `/eidola:eidola-engram`) on that task: Claude makes the Engram plugin with you in `~/.claude/eidola/engrams/<id>/`, lists it in the local marketplace `eidola-local`, checks it, installs it with your yes, and publishes it to a GitHub repo of yours only with your yes. `edit` and `publish` take your own Engrams; a bundled one is remixed first.
- The Engram picker: click the triangle in the bottom-right corner of the pane, or of the band for a band-only Engram, to list the bundled Engrams, filter them by where they draw, and awaken one

## Options

All are in `/config` once the mod is installed.

| Option | Default | What it does |
|---|---|---|
| `pane` | on | The awake Engram draws in the pane, when it shows there, and the pane opens by itself. Off: the pane opens only when you run `/eidola`. |
| `band` | on | The awake Engram draws in the band above the prompt, when it shows there. |
| `hideBandWhilePaneOpen` | on | The band steps aside while the pane is open, for an Engram that shows in the pane. A band-only Engram, like the Wisp, keeps its band. |
| `statusLine` | on | The Engram's name and state, such as "Wisp · idle", in the status line. |

One setting for every Engram: an Engram draws on a surface only if its switch is on and its `shows` lists it. One that shows only in the band never opens the pane by itself; `/eidola` still opens it, and it draws its band view there.
- Bundled Engrams: `wisp` (default), a will-o'-the-wisp in a night fen that draws in the band, `kraken` and `lich`. Spirit, Skull, Moon, Sigil and Starfield were removed in 0.7.0: one that was awake is cleared at session start, and `/eidola` says so once.
- `kraken`, something vast in deep water, and `lich`, a crowned skull of alchemical glyphs with soul-fire in its sockets. On desktop each is drawn live over a still backdrop and moves through three moods (idle, working, attention) without a cut; something going wrong makes the Kraken ink and scorches the Lich (`/eidola ink` to see it). Elsewhere each draws as a field scene, one per state.

## Diagnostics

`/eidola` prints the attached surfaces, whether the pane is placed, whether the band is showing, and network probes run from wherever the session runs: `eidola.app` (a future hosted relay), `example.com` (control), `api.github.com` and a Shrine on `127.0.0.1:9743`. In a cloud session that host is the cloud machine, not your computer.

`/eidola media` swaps the pane to three tiny clips (a GIF in an SVG drawn in a sandboxed frame, the same GIF drawn as a plain image, and a WebM in an SVG `foreignObject`) to see which ones animate on each surface. Run it again to go back.

Known limits: `session.compact` hooks don't run where an organization manages Claude Code unless the org lists the plugin. The bundled Engrams are packages in `engrams/<id>/` (an `engram.json` and its `vessel/` thumbnails, [docs/spec/engram-format.md](docs/spec/engram-format.md)), loaded at session start and on `/engrams`; one that fails validation is skipped, and `/eidola` says why.

## Install

At the prompt of a terminal session:

```
/plugin install eidola --marketplace AyeJK/eidola-mod
```

From a shell:

```
claude plugin install eidola --marketplace AyeJK/eidola-mod
```

In the desktop app, where `/plugin` does not run: click + next to the prompt box, then Plugins, Add marketplace with `AyeJK/eidola-mod`, then Add plugin.

Answer `y` to add the marketplace, then pick a scope (user scope loads it in every session).

## Develop

Run these from this folder before pushing:

```
claude plugin validate .
npx -p typescript tsc -p .
claude plugin test .
node scripts/bake-thumbs.mjs --check
node scripts/export-engram.mjs --check
```

Each bundled Engram draws through its own drawing module, `engrams/<id>/hooks/draw.tsx`, given the hand-off an Engram plugin is given ([docs/spec/engram-plugin.md](docs/spec/engram-plugin.md)). `node scripts/export-engram.mjs <id> <folder>` turns one into a standalone Engram plugin under a new id, and `node scripts/check-engram.mjs <folder>` checks any Engram plugin against the contract, printing each problem with its file and fix. The tests read a committed export (`test/fixtures/exported-lich/`) and the checker's view of the exported three (`hooks/exports.data.ts`); after changing how a bundled Engram draws, write both again: `node scripts/export-engram.mjs lich test/fixtures/exported-lich --fixture --force && node scripts/export-engram.mjs --data` (`--fixture` is the only way an export lands inside the mod, and only under `test/`). `--check` fails when either has drifted.

The Eidola skill (`skills/eidola-engram/SKILL.md`) runs from wherever the mod is installed and never writes inside it. It works through `scripts/engram-home.mjs` (`where`, `list`, `new`, `remix`, `check`, `draws`, `sync`, `publish-prep`), which keeps your Engrams in `~/.claude/eidola/` (`EIDOLA_HOME` moves it) and refuses an id that is taken. "Create from nothing" copies the starter, `skills/eidola-engram/starter/` (tested by `hooks/starter.test.ts`; keep tests out of the starter's folder). The skill's evals are in `evals/eidola-engram/`: `claude plugin eval . --case "eidola-*" --runs 1 --ablation none --no-publish --scaffold --allow-tools Write Edit "Bash(node:*)" "Bash(git:*)" "Bash(ls:*)" "Bash(cat:*)" "Bash(mkdir:*)" "Bash(cd:*)" "Bash(pwd:*)" "Bash(find:*)"` (from a terminal where `claude auth status` says logged in; `--scaffold` runs the cases' own setup scripts, which stage a broken Engram and a local bare git repo standing in for GitHub).

The Kraken's and the Lich's picker thumbnails are stills of their live drawings, baked into `engrams/<id>/vessel/thumb-*.svg`, the files each `engram.json` names. After changing how one of them draws, bake them again with `node scripts/bake-thumbs.mjs`: it runs each drawing in the test runner, keeps its best-composed frame, and writes the stills. `--check` only checks that every thumbnail an Engram names exists and fits a desktop Svg, that no per-state frame is left in a package's `vessel/`, and that the tests' copy of each manifest (`hooks/packages.data.ts`) matches it.

`tsc` needs the engine's types at `.claude-plugin/types/claude-code/index.d.ts` (git-ignored). The engine writes them there when it loads the mod from this folder (`claude --plugin-dir .`). The render tests mount the pane and the band on terminal and desktop. A mount fails when a surface refuses the tree (an element it lacks, a prop it doesn't take), which is how an empty desktop pane shows up in a test.
