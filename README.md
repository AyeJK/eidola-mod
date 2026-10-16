# Eidola (mod prototype)

A pixel Vessel in a pane that reacts to what Claude is doing, plus the awake Engram's Soul in the system prompt.

- States: idle, thinking, working, attention, success, responding, error, waiting (asleep when no Engram is awake)
- Commands: `/eidola` (open the pane and print diagnostics), `/eidola place [setting]` (show or set where the Vessel appears), `/eidola media` (toggle the media test), `/awaken <engram>`, `/sleep`, `/engrams`

## Options

Both are in `/config` once the mod is installed.

| Option | Default | What it does |
|---|---|---|
| `placement` | `default` | Where the Vessel appears. `default` follows the awake Engram's suggestion (`auto` if it has none). `both`: pane and band. `pane`: pane only. `band`: band only, and the pane opens only when you run `/eidola`. `auto`: band only while no pane is placed. |
| `statusLine` | on | The Engram's name and state, such as "Wisp · idle", in the status line. |

An Engram suggests a placement in its Vessel (`placement`); your option always wins, and nothing an Engram sets stops you opening the pane.
- Bundled Engrams: `wisp` (default), `spirit`, `skull`, `moon`, `sigil`, `starfield`. All are visual only: their Souls add no voice. Each Vessel is baked in the Vessel Forge as one SVG per state under `vessels/<engram>/`; a file that can't be read falls back to the built-in pixel sprite.

## Diagnostics

`/eidola` prints the attached surfaces, whether the pane is placed, whether the band is showing, and network probes run from wherever the session runs: `eidola.app` (a future hosted relay), `example.com` (control), `api.github.com` and a Shrine on `127.0.0.1:9743`. In a cloud session that host is the cloud machine, not your computer.

`/eidola media` swaps the pane to three tiny clips (a GIF in an SVG drawn in a sandboxed frame, the same GIF drawn as a plain image, and a WebM in an SVG `foreignObject`) to see which ones animate on each surface. Run it again to go back.

Known limits: `prompt.compose` and `session.compact` hooks don't run where an organization manages Claude Code unless the org lists the plugin. Engrams are inlined in `hooks/engrams.ts` for now.

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
```

`tsc` needs the engine's types at `.claude-plugin/types/claude-code/index.d.ts` (git-ignored). The engine writes them there when it loads the mod from this folder (`claude --plugin-dir .`). The render tests mount the pane and the band on terminal and desktop. A mount fails when a surface refuses the tree (an element it lacks, a prop it doesn't take), which is how an empty desktop pane shows up in a test.
