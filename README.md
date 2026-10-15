# Eidola (mod prototype)

A pixel Vessel in a pane that reacts to what Claude is doing, plus the awake Engram's Soul in the system prompt.

- States: idle, thinking, working, attention, success, responding, error, waiting (asleep when no Engram is awake)
- Commands: `/eidola` (open the pane), `/awaken <engram>`, `/sleep`, `/engrams`
- Bundled Engrams: `wisp` (default, adds no voice of its own), `ember` (a demo Soul that changes the voice)

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
