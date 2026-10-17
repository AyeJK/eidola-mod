# Phase 3 — Retire v1 and Release 0.7.0

Make the mod's repo the only place the format is described, clear out the prototype's leftovers, point the old spec at the new one, and ship 0.7.0.

Plan: `docs/Plan-EngramSpecV2-2026-10-16.html` (decision 12; Overview scope).

---

# Sprint 3.1 — Docs and Leftovers

### Goal

The README reads as a product, the prototype's test switches are gone, and the v1 spec points to v2.

### Tasks

| Status | # | Task | Module | Reference |
|--------|---|------|--------|-----------|
| — | 1 | Rewrite the README: drop "(mod prototype)" and "Engrams are inlined", list the three Engrams (the Kraken, the Lich, the Wisp), note that Spirit, Skull, Moon, Sigil and Starfield were removed in 0.7.0, describe the surfaces setting, say plainly that Eidola is a visual companion only and adds nothing to the prompt (the Wisp's voice and every Soul are gone as of 0.7.0), and add a section for making your own: the Eidola skill (create, remix, publish), Engram plugins, `/eidola new` and how to install someone else's from their repo. No mention of frames, per-state SVGs or Souls | README.md |
| — | 2 | Remove the prototype's test switches and their files: `/eidola media`, `/eidola blend`, `/eidola live`, `media-test.ts`, `blend-test.ts`, `live-test.tsx`, and the eidola.app probe. Keep the probe of `127.0.0.1:9743` for Phase 4 | hooks/ |
| — | 3 | Add a one-line pointer to the mod's `docs/spec/` at the top of each file in eidola-runtime's `docs/spec/` | eidola-runtime/docs/spec/ |
| — | 4 | Set `plugin.json` to 0.7.0, change its description from "plus an Engram Soul injected into every session" to "a live companion that reacts to what Claude is doing", and run every check | .claude-plugin/plugin.json |

### Acceptance Criteria

- No command, file or README line refers to the removed test switches
- The README lists exactly three Engrams and treats no frames Engram or Soul as current
- Every v1 spec file names where v2 lives
- All checks pass at 0.7.0

### Dependencies

- Phase 2

### Verification

- cli: claude plugin validate . && npx -p typescript tsc -p . && claude plugin test . && node scripts/bake-thumbs.mjs --check && node scripts/check-engram.mjs skills/eidola-engram/starter
- skip-ui: true
- assert: All checks pass; `grep -r "media-test\|blend-test\|live-test" hooks` finds nothing

---

# Sprint 3.2 — Release 0.7.0

### Goal

0.7.0 is reviewed in the desktop app, then committed, pushed and installed, the same way 0.6.0 was.

### Tasks

| Status | # | Task | Module | Reference |
|--------|---|------|--------|-----------|
| MANUAL | 1 | Try 0.7.0 in the desktop app: awaken the Kraken, the Lich and the Wisp, flip the Pane and Band switches, create one Engram with the skill and remix another, run `/eidola`, check that no Eidola text reaches the prompt, and approve the release |
| — | 2 | Commit, push `forge-vessels`, fast-forward `main`, and update the installed mod from GitHub | .claude-plugin/ |

### Acceptance Criteria

- The installed mod reports 0.7.0
- `main` and `forge-vessels` are on the release commit

### Dependencies

- Sprint 3.1

### Verification

- cli: claude plugin validate . && claude plugin test .
- skip-ui: true
- assert: `claude plugin list` shows eidola 0.7.0

---

## Scope Guard

Archiving `eidola-runtime` and `eidola-platform`, deprecating the npm packages and turning eidola.app into a landing page are separate work, not part of this plan. Engram plugins and the Eidola skill are Phase 2.
