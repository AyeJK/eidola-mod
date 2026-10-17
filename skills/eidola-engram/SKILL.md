---
name: eidola-engram
description: Make, remix, change, fix, check and publish Engrams for Eidola, the creatures that live in Claude's pane and band and react to what Claude is doing. Use this whenever someone wants a creature, mascot, familiar, avatar or "Engram" of their own in the Eidola pane; describes one ("a jellyfish that glows when you work"); wants to remix or recolour the Kraken, the Lich, the Wisp or another Engram; wants to change how their Engram looks or moves; has an Engram marked "not loading" or failing the checker; or wants to share or publish one to GitHub. Also runs for /eidola new, /eidola remix, /eidola edit, /eidola fix and /eidola publish, and for the picker's Create, Edit, Fix, Remix and Publish with Claude buttons.
argument-hint: "new [description] | remix <id> [what to change] | edit <id> [what to change] | fix <id or folder> | check <id> | publish <id>"
---

# Engrams, with you

An **Engram** is a creature that lives in Eidola's pane and the band above the prompt. It has three moods and an error effect, and Eidola tells it which to show from what Claude is doing. An Engram you make is code, so it is a small Claude Code plugin of its own: an **Engram plugin**. Eidola stays the host. It keeps the frame, the HUD, the corner, the picker and the Shrine, and hands the drawing of the creature to the Engram's plugin.

This skill makes them with the person: from nothing, or remixed from another Engram, then changed by talking, checked, seen live, and published for others to install and remix.

The task is in the arguments, when there are any: **$ARGUMENTS**. The first word says which guide to follow below (`new`, `remix`, `edit`, `fix`, `check`, `publish`), the next is the Engram's id, the rest is what the person wants. With no arguments, work out the task from what the person said, and ask only if it is really unclear.

## Where things are

**Eidola's folder** (call it `EIDOLA`): `${CLAUDE_PLUGIN_ROOT}`. If that reads as a literal `${...}` placeholder, use the folder two levels above this skill's base directory (the skill lives in `EIDOLA/skills/eidola-engram/`). Everything below runs from there with `node "EIDOLA/scripts/<script>"`, from any working directory.

**The contract** is `EIDOLA/docs/spec/engram-plugin.md`. It is the single source of truth for what an Engram plugin must provide and may rely on: the folder, `engram.json`, announcing, the hand-off from both seats, the state it reads, what it must draw, the limits, failure, and what it must never do. Read it before you write or change a drawing; this skill only summarizes it, and where they differ the contract wins. The fields of `engram.json` are in `EIDOLA/docs/spec/engram-format.md`; the moods in `EIDOLA/docs/spec/vessel-states.md`.

**The person's Engrams** live in their Engram home, `~/.claude/eidola/` (an eval or test may point it elsewhere with `EIDOLA_HOME` or `EVAL_EIDOLA_HOME`; the script honours both):

```
~/.claude/eidola/
  .claude-plugin/marketplace.json    the local marketplace "eidola-local", listing every Engram below
  engrams/<id>/                      one Engram plugin per id
```

`node "EIDOLA/scripts/engram-home.mjs" where` prints the real paths and which setting chose the home. When nothing chose it, the script says on stderr that it is using the default, the person's real `~/.claude/eidola`; inside an eval's workspace (a folder holding `.eidola-eval`) it refuses the default instead, so a test never writes the real home. Claude Code reads a plugin from a folder marketplace straight from the folder, so once an Engram is installed from `eidola-local`, a change to its files shows after `/reload-plugins`, with no reinstall.

**The tools**, all in `EIDOLA/scripts/`:

| Command | What it does |
|---|---|
| `engram-home.mjs new <id> [--name N] [--author A] [--description D]` | A new Engram from the starter, in the home, listed in the marketplace, checked |
| `engram-home.mjs remix <from> <id> [--name N] [--author A] [--description D]` | A remix: a bundled `<from>` (kraken, lich, wisp) is exported; any other is copied from the home, an installed Engram plugin, or a folder path, under the new id with `remixOf` set |
| `engram-home.mjs check <id>` | The checker on one of the person's Engrams |
| `engram-home.mjs draws <id>` | Writes `test/draws.test.ts` into the Engram and runs it: each mood, the error effect, both surfaces, pane and band |
| `engram-home.mjs list` / `sync` | Lists the home's Engrams / writes the marketplace again from `engrams/` |
| `engram-home.mjs publish-prep <id> --repo <owner>/<repo>` | Readies one for its own GitHub repo (no git, nothing sent) |
| `check-engram.mjs <folder>` | The checker on any Engram plugin folder |

The checker prints `<id>: ok` and what it found, or `N problems`, each line `file: problem. Fix`, then warnings. It exits 1 on any error.

## Ground rules

These keep the person's work and their machine safe, so hold to them even when it would be quicker not to.

- **Never write inside `EIDOLA`.** It is the installed mod, and an update replaces it: anything written there is lost, or worse, changes Eidola for everyone on the machine. New Engrams, exports and remixes all go in the home. The scripts refuse a home inside `EIDOLA`; don't work around that. Read Eidola's files freely, to learn from the bundled drawings.
- **Never overwrite an Engram.** An id that is taken (bundled, already in the home, or an installed Engram plugin's) is refused. Pick another with the person; never delete or replace a folder to free an id.
- **No prompt text in an Engram.** No Soul, persona, instructions or CLAUDE.md; no `prompt.submit`, `prompt.compose` or `prompt.context` hook; no `$.session.append`. An Engram is something to look at, never something that changes what Claude says. If the person asks for a personality, say that a persona belongs in their own CLAUDE.md or an output style, and draw the character's look instead.
- **Never write Eidola's state** (`eidola.*`); read it.
- **Publish only on the creator's yes**, given for this Engram and this repo, after they have seen what will be pushed. A request to "publish" is not yet that yes. See Publish.
- **Install only with the person's yes.** Installing adds the `eidola-local` marketplace to their Claude Code setup (once) and enables a plugin. Say what the commands do and ask before running them; if they'd rather, give them the commands to run.

## Surfaces and limits, in short

Eidola hands the drawing a room, `columns` × `rows` cells, and the state: `mood` (`idle`, `working`, `attention`), `moodBefore`, `moodAt`, `ink` and `inkAt` (the error count and when it last rose), `epoch`. The drawing answers one Box keyed `eidola:<id>`, exactly that size.

| | Desktop | Terminal |
|---|---|---|
| Draws with | Box, Text, Svg; a `Client` module for a creature that moves (its own file in `hooks/`, ticking at most every 100 ms) | Box and Text only |
| The pane | a large room (around 48 × 39 cells) inside Eidola's frame | the same hand-off, no frame or corner |
| The band | 7 rows (9 for a Wisp remix, 12 for a Lich remix), full width | the same |

- **700 blocks** in one drawing (the Box and everything in it, and each frame a Client draws). Over it, the drawing is refused and marked not loading.
- **250 ms** for the hand-off's answer; a hook has 10 s and a tree 20,000 nodes and 100,000 characters.
- **Thumbnails**: SVG in `vessel/`, at most 131,072 characters, no `<script>`, no `on*=`, no `http(s):` href.
- Eidola's HUD brackets sit in three corners and its corner triangle over the bottom-right 3 × 2 cells. Keep the creature's face away from them.
- Everything an Engram imports must be inside its own folder; the only package is `claude-code`.
- The three moods must each be distinct at a glance; the error effect plays once over the mood (the starter shows it for 2 seconds after `inkAt`) and never becomes a mood.

The bundled drawings in `EIDOLA/engrams/<id>/hooks/draw.tsx` (and the files they import from `EIDOLA/hooks/`) are worked examples of a live desktop creature. The starter, `EIDOLA/skills/eidola-engram/starter/hooks/register.tsx`, is the plainest whole Engram plugin: read it first.

## Create from nothing

1. Agree on an id (2 to 32 of a-z, 0-9, -) and a name, from the person's description. Ask their name for `--author` if you don't know it; "you" is the fallback.
2. `node "EIDOLA/scripts/engram-home.mjs" new <id> --name "<Name>" --author "<author>" --description "<one line>"`. This copies the starter into `~/.claude/eidola/engrams/<id>/`, sets its id everywhere, lists it in the marketplace and runs the checker.
3. Make it the creature they described. In `hooks/register.tsx`, change `LOOKS` (colour, body lines of equal width, caption, one look per mood and one for the error effect) and `draw()` (how a look is laid out). Keep the hand-off code below the "contract" line as it is. Update `engram.json`'s `description`, `vessel.hud` colours (`bracket`), and redraw `vessel/thumb-pane.svg` as a still of the creature.
4. For a creature that moves on the desktop, add a Client module beside the hooks module and draw it from `draw()` on the desktop only, keeping the Text drawing for the terminal. Read how `EIDOLA/engrams/kraken/hooks/draw.tsx` does it, and the contract's limits, first. Build in small steps and check after each.
5. Check (below) until it is ok and draws, then offer to install it and see it live.

## Remix

From a **bundled** Engram (`kraken`, `lich`, `wisp`):

`node "EIDOLA/scripts/engram-home.mjs" remix <bundled> <new-id> --name "<Name>" --author "<author>"`

This runs `EIDOLA/scripts/export-engram.mjs`, which copies the bundled drawing module and every file it draws with into the new plugin's `hooks/`, sets `remixOf` to the bundled id and `rights` to `licensed` (the bundled Engrams are MIT), and runs the checker. The export draws exactly as the bundled one does until you change it.

From **another Engram** (one of the person's, an installed Engram plugin, or a folder): the same command with its id or folder path as `<from>`. It is copied under the new id with `remixOf` set to its id; its `const ID`, `eidola:<id>` and `eidola-slot:<id>` are pointed at the new id. The checker then warns that `remixOf` isn't bundled (the fallback while the drawing can't draw is the resting sprite); that is expected for a remix of a remix. A remix of someone else's work is `licensed`: before publishing it, the creator must be sure its licence lets them share it.

Then change what the person asked for:

- **Colour**: the palette is in the drawing's own files. Search the new plugin's `hooks/` for hex colours (`#[0-9a-fA-F]{6}`) and for names like `palette`, `colour`, `color`, `tint`; change them consistently for every mood, and keep the moods distinct. Change `engram.json`'s `vessel.hud.bracket` and `vessel.hud.colours` to match, and the thumbnails if they show the old colours (they are SVG text).
- **Motion**: live creatures move in their Client module (`*-live.tsx`): look for the tick (`every(`), speeds, amplitudes, periods and easing, and for per-mood tables. Keep a tick of 100 ms or slower.
- Touch only the new plugin's files. Never edit the bundled Engram in `EIDOLA`.

Check (below) until it is ok and draws.

## Change (edit)

1. Find the Engram: `node "EIDOLA/scripts/engram-home.mjs" list`. Its folder is `~/.claude/eidola/engrams/<id>/`. An Engram that isn't in the home (installed from somewhere else) can't be changed in place, since an update would undo the change: offer to remix it into the home instead.
2. Read its `engram.json` and its hooks module, and whatever the drawing imports, before changing anything.
3. Make the change the person asked for, in small steps. Keep the id, the keys and the hand-off code as they are.
4. Check (below). If it is installed, the person sees the change after `/reload-plugins`.

## Fix

An Engram is broken when the checker reports errors, `/eidola` lists it as "not loading" (with a file and line), or it draws the wrong thing.

`fix` may name a folder instead of an id: the picker's Fix with Claude does that for an Engram plugin whose `engram.json` didn't load, since Eidola has no id for it. Run `check-engram.mjs <folder>` on that folder, and fix it there or, if it is an installed copy, in the home folder it came from.

1. Run the checker on it. Each error line says the file, the problem and the fix: do what it says, one error at a time.
2. If the person has a "not loading" line from `/eidola`, read that file at that line: the drawing threw, drew nothing Eidola could place, ran past 700 blocks or past 250 ms.
3. Run the draw check (`draws <id>`). Its failures name the place, surface and mood that went wrong.
4. If the person has the Engram installed, `claude plugin validate <folder>` reads it as the engine will, and after one session load `npx -p typescript tsc -p <folder>` type-checks it.
5. Repeat until the checker says ok and it draws. Tell the person what was wrong, in a sentence.

A fixture-style break you will meet: `engram.json`'s `id` and the hooks module's `const ID` disagree (fix the module to match), `vessel.scene` not `"self"`, a missing `"dependencies": ["eidola"]`, an import from outside the folder, a hook that adds prompt text.

## Check

Every create, remix, change and fix ends here, and so does publish before it sends anything.

1. `node "EIDOLA/scripts/engram-home.mjs" check <id>` (or `check-engram.mjs <folder>` for a folder outside the home). It must print `<id>: ok`. Fix every error; read the warnings and fix what you can.
2. `node "EIDOLA/scripts/engram-home.mjs" draws <id>`. It must end `<id>: draws`. It needs the `claude` command on the PATH; if it can't run, say so rather than skipping it silently.
3. Tell the person the result plainly: ok and draws, or what is still wrong.

## Install and see it live

Ask first (Ground rules). With their yes:

1. `claude plugin marketplace list`. If `eidola-local` isn't listed: `claude plugin marketplace add "<home>"` (the home from `where`).
2. `claude plugin install <id>@eidola-local`.
3. Ask the person to run, in the session: `/reload-plugins`, then `/awaken <id>`. To see each mood and the error effect: `/eidola mood working`, `/eidola mood attention`, `/eidola mood idle`, `/eidola ink`.

From then on, each change shows after `/reload-plugins`, and `/engrams` reads the Engrams afresh. A new Engram in the home needs its own `claude plugin install`; the marketplace lists it already. Known limit: an Engram plugin's page preview in the picker still shows its `remixOf` scene, not its own drawing.

## Publish

Publishing puts the Engram in a GitHub repo of the creator's, with a `marketplace.json`, so anyone can install it with two commands. There is no Directory or upload: the repo is the publication.

1. **Check** it (above). Don't publish anything that isn't ok and drawing.
2. **Agree on the repo**: the GitHub owner and the repo name (default: the Engram's id), and public or private (public: anyone can install it; private: only people the creator invites). Create nothing until they answer. For a remix of someone else's Engram, ask them to confirm its licence lets them share it.
3. **Prepare**: `node "EIDOLA/scripts/engram-home.mjs" publish-prep <id> --repo <owner>/<repo> --author "<author>"`. This writes the Engram's `.claude-plugin/marketplace.json`, an install section in its README and a `.gitignore`, and prints the two install commands. It sends nothing.
4. **Stage, and show**: in the Engram's folder, if it isn't a git repo yet, `git init` and `git branch -M main`; then `git add .` and `git diff --cached --name-only`. Read every staged file for anything that shouldn't travel (a key or token, a private hostname, someone else's data or code); ask about anything you find. Then show the creator: the files, the repo it will go to (public or private), and the two install commands.
5. **Ask for the yes, and stop.** "Push <id> to github.com/<owner>/<repo> (<public/private>)? This makes it installable by others." End your turn there. Go on only when the creator says yes to that. A yes given earlier in the same message, naming this Engram and this repo, counts, but only after you have done steps 1 to 4, and you still show them what was pushed afterwards.
6. **Push**, with the yes: commit (`git commit -m "Publish <Name>"`, asking for a git name and email if git has none, set for this repo only), then:
   - a new GitHub repo: `gh repo create <owner>/<repo> --public|--private --source . --push`. If `gh` isn't installed or signed in, don't install or sign in for them: give the steps by hand (create an empty repo on github.com, then `git remote add origin <url>` and `git push -u origin main`).
   - a remote the creator gave (an existing repo, or a local test remote): `git remote add origin <url>` if it isn't set, then `git push -u origin main`.
7. **Print the two commands** others run to install it, exactly as `publish-prep` printed them:

   ```
   claude plugin marketplace add <owner>/<repo>
   claude plugin install <plugin>@<marketplace>
   ```

   and say that Eidola must be installed too. A later change is published the same way: check, show, ask, then commit and push.

## When it goes wrong

- A script refuses (a taken id, a home inside `EIDOLA`): read its message to the person and pick another way with them; never force it.
- `node` older than 22.18 can't run the scripts (they read TypeScript as it is): say so and ask the person to update Node.
- The Engram draws in tests but not in the pane: ask the person for `/eidola`'s output; it lists Engram plugins that didn't load and drawings marked not loading, with why.
