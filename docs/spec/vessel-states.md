# Vessel states

The Vessel reacts to what Claude is doing. One pure resolver, `hooks/resolver.ts`, turns the engine's events into two things: a **state**, one of nine, which the HUD and the status line name in text; and a **mood**, one of three, which the scenes draw. Something going wrong is neither: it is a one-off **error effect** drawn on top of the mood.

Ported from v1's `vessel-reactivity.md` (eidola-runtime), which mapped Cursor's and Claude Code's shell hooks to the same states. The mod reads the engine's own events instead, so the editor column is gone.

## The nine states

A state is text only: the HUD's label and the status line, such as "Lich · thinking". Each has a short detail line under it. No Engram draws a picture per state.

| State | What's happening | Engine event | Detail | Holds, then |
|---|---|---|---|---|
| `idle` | Nothing is happening: the session started, a turn was cancelled, or a hold ran out | `session.start`; `turn.complete` aborted | | |
| `thinking` | A prompt was sent, or Claude is reasoning between tool calls | `prompt.submit`, `turn.start`; after `waiting` or `error` holds | | |
| `working` | A tool is running: a shell command, an MCP tool, a read, a search, an edit or a subagent | `tool.call` starts | the tool, and how many run at once | |
| `waiting` | A tool just finished and nothing else is running | `tool.call` ends | `<tool> done` | 900 ms, then `thinking` |
| `attention` | Claude needs the person: a permission dialog, or the conversation is being compacted | `classic.PermissionRequest`; `session.compact` | `<tool> needs your OK`, or `Compacting` | |
| `success` | The turn finished and used at least one tool | `turn.complete` | `<n> tool calls` | 3 s, then `idle` |
| `responding` | The turn finished with a plain reply and no tools | `turn.complete` | `Replied` | 3 s, then `idle` |
| `error` | A tool failed, or the turn ended in an error or a refusal | `tool.call` ends in error; `turn.complete` error or refusal | `<tool> failed`, or `Turn ended in an error` | 1.8 s, then `thinking` (a tool); 4 s, then `idle` (the turn) |
| `sleeping` | No Engram is awake | `/sleep`, or nothing awake at start | | |

`working` is one state for all tool activity: the Vessel doesn't tell searching from writing from running a shell command.

**Parallel tools.** While several tools run at once, the state stays `working` (`<tool> · <n> running`) until the last one finishes. It never flickers back to `thinking` because one finished early.

**Subagents.** A subagent's own turns don't end the main turn: only the main turn's `turn.complete` counts.

## The three moods

Scenes follow a mood, not a state. The mood is set by the turn rather than by each tool, so a turn changes the drawing two or three times, not dozens.

| Mood | When |
|---|---|
| `working` | From a prompt to the turn's end, through every tool and every gap between them, and while the conversation is compacted |
| `attention` | While Claude is blocked on the person: a permission dialog, or a tool that waits on their answer (`AskUserQuestion`, `ExitPlanMode`) |
| `idle` | Otherwise |

Every scene draws every mood; there is no fallback table. When the mood changes, the scene blends from the old mood to the new one over time rather than cutting: the mod keeps the mood, the mood before it and when it changed, and each drawing eases between them.

With nothing awake, the pane and the band draw the resting Wisp's scene, dimmed.

## The error effect

Something going wrong (a failed tool, a turn that ended in an error or a refusal, or `/eidola ink` by hand) raises a count. A scene that sees the count rise plays a one-off effect over its current mood, then carries on: the Kraken inks and flees, the Lich is scorched, the Wisp gutters, smokes and sinks. The `error` state shows in text meanwhile. Error is never a mood, and a scene never stays in it.

## The three views

Each scene is one simulation drawn three ways. An Engram's `vessel.shows` (see [engram-format.md](./engram-format.md)) lists which of them it draws in, and the person's surfaces setting switches each on or off.

| View | Where | Notes |
|---|---|---|
| `pane` | The Eidola pane, docked tall beside the transcript | Opens by itself only for an Engram that shows in the pane; the person can always open it with `/eidola`, and a band-only Engram draws its band view there |
| `band` | The band above the prompt, and a pane seated short or inline | |
| `shrine` | The local Shrine on `127.0.0.1:9743`, a canvas page for a second screen | Arrives with the Shrine; with its switch off, the mod starts no server and posts nothing |

On desktop a scene draws live and moves continuously between moods. Where a surface can't run the live drawing, the terminal for one, it draws the same scene as a still for the current state.
