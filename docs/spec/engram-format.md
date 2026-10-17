# Engram format, v2

An Engram is a creature for the Vessel: a name, a description, the scene it draws, where it draws and the colours of its HUD. It carries no prompt text of any kind and no code. Eidola adds nothing to the prompt.

This spec holds only what the mod reads. A field comes back only together with the code that reads it and a test. Everything here is checked by one validator, `hooks/validate.ts`, which the loader, the checker and `/eidola check` all use, so they can never disagree. `engram.schema.json` beside this file gives editors hints and is tested against the validator.

How the scenes behave (the nine states, the three moods, the error effect, the three views) is in [vessel-states.md](./vessel-states.md).

## The folder

A package is a folder named by its id:

```
<id>/
  engram.json        required: which creature it is and which scene it draws
  vessel/            optional
    thumb-pane.svg   optional picker stills; absent means the scene's own
    thumb-band.svg
```

That is the whole format. Every Engram draws a scene, so there are no per-state frame files, and there is no Soul file. A leftover file of either kind from v1 is ignored with a warning (see the rules below).

Bundled Engrams live in the mod at `engrams/<id>/`. Their ids are reserved: a package from anywhere else that takes one is not loaded, with a hint to rename it.

## An example: the bundled Lich

```json
{
  "spec": 2,
  "id": "lich",
  "name": "Lich",
  "version": "1.0.0",
  "author": "eidola",
  "description": "A crowned skull of alchemical signs, soul-fire in its sockets. It burns brighter while you work.",
  "rights": "original",
  "vessel": {
    "scene": "lich",
    "shows": ["pane", "band", "shrine"],
    "thumbnails": { "pane": "thumb-pane.svg", "band": "thumb-band.svg" },
    "hud": {
      "show": true,
      "meter": "sparks",
      "tag": "sigil",
      "label": "serif",
      "bracket": "#9a3c28",
      "colours": {
        "idle": { "label": "#e0603e", "detail": "#9a3c28" },
        "waiting": { "label": "#d0583a", "detail": "#8a3424" },
        "success": { "label": "#f08a5a", "detail": "#a85a38" },
        "sleeping": { "label": "#8a3424", "detail": "#5e2418" },
        "thinking": { "label": "#c08aff", "detail": "#7a4ab8" },
        "working": { "label": "#a860f0", "detail": "#6c34a8" },
        "responding": { "label": "#d4a8ff", "detail": "#8a5cc0" },
        "error": { "label": "#e0603e", "detail": "#9a3c28" },
        "attention": { "label": "#3ccf8a", "detail": "#22905e" }
      }
    }
  },
  "extensions": {}
}
```

## Fields

Every field is in `engram.json`. A field left out takes its default.

| Field | Required | Type | Default | Read by |
|---|---|---|---|---|
| `spec` | yes | the number `2` | | loader |
| `id` | yes | slug: `a`-`z`, `0`-`9` and `-`, 2 to 32 characters, equal to the folder's name (an Engram plugin's id stands alone: its folder is named by where it was installed) | | loader, `$.store`, `/awaken` |
| `name` | yes | string, 1 to 32 characters | | picker, HUD, status line |
| `version` | yes | semver, such as `1.0.0` | | `/eidola`, picker (yours) |
| `author` | yes | non-empty string | | picker (yours), checker |
| `description` | yes | string, 1 to 160 characters | | picker card, `/engrams` |
| `rights` | yes | `original` or `licensed`: the creator's word that they made it or may share it | | checker |
| `remixOf` | no | an Engram's id, not its own: the Engram this one was remixed from. Read for an Engram plugin's, whose drawing falls back to that Engram's scene | the resting sprite | fallback, picker still |
| `vessel` | yes | object | | |
| `vessel.scene` | yes | `kraken`, `lich` or `wisp`, a scene built into the mod; `self` in an Engram plugin, which draws its own creature ([engram-plugin.md](./engram-plugin.md)) | | renderer, hand-off, Shrine |
| `vessel.shows` | no | list of `pane`, `band`, `shrine`: at least one, each once | all three | `whereItDraws`, picker, Shrine |
| `vessel.thumbnails` | no | `{ pane?, band? }`, each a file name in `vessel/` ending `.svg` | the scene's bundled thumbnail | picker |
| `vessel.hud` | no | object | | HUD frame |
| `vessel.hud.show` | no | boolean: the HUD is on until the person toggles it (`/eidola frame`) | `false` | HUD frame |
| `vessel.hud.meter` | no | `bars`, `wave`, `sparks` or `none` | `bars` | HUD frame |
| `vessel.hud.tag` | no | `name`, `livecam`, `sigil` or `none` | `name` | HUD frame |
| `vessel.hud.camera` | no | string, the camera's name on a `livecam` tag | `CAM 01` | HUD frame |
| `vessel.hud.layout` | no | `top` or `bottom` | `top` | HUD frame |
| `vessel.hud.label` | no | `bold`, `serif` or `pixel` | `bold` | HUD frame |
| `vessel.hud.bracket` | no | hex colour, `#rgb` or `#rrggbb` | brass, `#b8913a` | HUD frame |
| `vessel.hud.colours` | no | state → `{ label, detail }`, both hex colours, for any of the nine states | the mod's own per state | HUD frame |
| `extensions` | no | object | `{}` | nothing: kept as it is |

`vessel.hud.colours` is keyed by the resolver's nine states (`idle`, `thinking`, `working`, `waiting`, `responding`, `success`, `error`, `attention`, `sleeping`), because the HUD names the state in text. The scene itself draws three moods, not nine pictures: see [vessel-states.md](./vessel-states.md).

`extensions` is a free namespace. The mod keeps it and never reads it, so a creator or a tool can store anything there, such as clips for some other player, without a warning.

## Validation rules

`hooks/validate.ts` takes a package's files (the folder's name and each file's path and text) and returns its errors and warnings, each with the file, the problem and the fix. A package with an error is not loaded; the loader skips it and says why. A warning loads.

| Rule | What it checks | Level |
|---|---|---|
| `manifest` | `engram.json` exists and parses, `spec` is `2`, the required fields are present, and every field present has the right type (slug, semver, lengths, enums, hex colours, file names) | error |
| `id` | `id` equals the folder's name and, for a package that isn't bundled, isn't a bundled id | error |
| `scene` | `vessel.scene` is set and names a scene the mod has; in an Engram plugin's `engram.json`, it is `self` | error |
| `thumb-size` | Each thumbnail is at most 131,072 characters and starts with `<svg` (after any leading whitespace) | error |
| `thumb-safe` | No `<script>`, no `on*=` attribute and no `href` to `http:` or `https:` in a thumbnail. The host strips scripts anyway; this rejects them so the creator knows | error |
| `thumb-exists` | Each file named in `vessel.thumbnails` exists in `vessel/` | error |
| `frame` | A v1 per-state frame file in `vessel/`: "v2 has no frames; this file is ignored" | warning |
| `shows` | `vessel.shows`, when given, is a list of known places with at least one, each once | error |
| `soul` | A v1 Soul file at the package's root: "Eidola adds nothing to the prompt; this file is ignored" | warning |
| `unknown-key` | A key the format doesn't have, anywhere outside `extensions`, v1 keys included: it is ignored. Move it under `extensions` to keep it quietly | warning |
| `camera` | `vessel.hud.camera` is set without `tag: "livecam"`, so nothing shows it | warning |
| `v1` | A v1 package: its v1 manifest and no `engram.json`. "v1 Engram: its clips can't draw in Claude" | error |

The loader reads every `engram.json` at session start and on `/engrams`, and reads a thumbnail only the first time the picker shows it; it applies the thumbnail rules then, and draws the scene's bundled thumbnail in place of one that fails. The checker reads every file at once.

## The schema

`engram.schema.json` (JSON Schema, draft 2020-12) is for editor hints only: point an `engram.json` at it with a top-level `"$schema"` key (the one key outside the fields above that draws no warning; the mod ignores it) or through your editor's settings. The validator is the authority. The schema is written from `hooks/engram-schema.ts` by `node scripts/schema.mjs` (`--check` to compare), and a test holds its required fields, enums and limits to the validator's, so adding one to either side alone fails the tests.
