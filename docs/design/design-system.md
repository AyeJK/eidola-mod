# Eidola mod — design system

The look for every screen the mod draws in the desktop pane: the picker, an Engram's page, Surfaces and the Yours views. It follows the live eidola.app (the "The Engram / The Soul / The Vessel" section of the home page), translated to what the pane can draw.

- Design canvas: https://claude.ai/artifact/AssREDA6jEXZRnR5JzgELj (artboards: Picker, Engram page, Surfaces, Yours, Yours empty)
- Source of the tokens: eidola.app as served on 16 Oct 2026, and `eidola-platform/apps/web/app/globals.css`

The canvas is the target. Where this file and the canvas disagree, this file wins, because it accounts for the pane's limits.

---

## What the pane can and can't do

The pane draws with the engine's elements: `Box`, `Text`, `Button`, `Svg`, `Client` (desktop), and `Raster`/`Image` (terminal). A cell is 8 × 19 px. That changes how the canvas translates:

| Canvas | In the pane |
|--------|-------------|
| Manrope, Inter, JetBrains Mono, Press Start 2P | `Text` uses the app's own font. Hierarchy comes from **bold**, colour and UPPERCASE, not from typefaces. |
| The pixel "Eidola" wordmark | One baked `Svg` with the letters as paths (no web fonts inside an `Svg`). Desktop only; the terminal shows `EIDOLA` in bold gold. |
| Alpha colours (`rgba(...)`) | Solid hex, already blended over the void background. Use the hex column below. |
| Pixel sizes and gaps | Cells. 1 cell across ≈ 8 px, 1 row ≈ 19 px. Gaps are 1 cell or 1 row. |
| Rounded 8–12 px corners | `borderStyle="round"` on a `Box`. |
| Gradients (gold button, ember rule) | No gold button: every button is `Button variant="secondary"` (the engine's primary is a white fill, louder than the cards). Ember rule: a row of 3 to 5 short `Box`es stepping ember → amber → gold, or an `Svg` line. |
| Glow and shadows | Leave out. Use a brighter border instead. |
| Hover states | `Box` `hover` with a keyed `Box`; keep to borders and text colour. |

Terminal and mobile get the same structure in plain text: no `Svg`, no `Client`, and no thumbnails beyond what `Raster`/`Image` can show.

---

## Colours

Hex values are blended over the void background `#06060a`.

| Token | Canvas value | Pane hex | Use |
|-------|--------------|----------|-----|
| void | `#06060a` | `#06060a` | Pane background |
| card | `#1f1f1f` | `#1f1f1f` | Engram cards, code and path wells |
| panel | `rgba(255,255,255,0.02)` | `#0b0b0f` | Panels: awake strip, Where it draws, Surfaces rows, folder panel |
| line | `rgba(230,225,211,0.12)` | `#212022` | Panel and chip borders |
| line-soft | `rgba(230,225,211,0.08)` | `#18171a` | Dividers inside panels and cards |
| white | `#ffffff` | `#ffffff` | Headings, Engram names |
| frost | `#e8e4dc` | `#e8e4dc` | Default text, secondary button text |
| body | `rgba(230,225,211,0.85)` | `#c4c0b5` | Lead text under a heading |
| muted | `rgba(230,225,211,0.6)` | `#8c8983` | Descriptions, helper text |
| faint | `rgba(230,225,211,0.5)` | `#76746e` | Unselected chips, captions |
| gold | `#c9a84c` | `#c9a84c` | Labels, sub-headings, links, the Yours badge |
| gold-line | `rgba(201,168,76,0.2)` | `#2d2617` | Secondary button border |
| amber | `#e09030` | `#e09030` | **Selected and on**: active filter or mood, surface icons that are on, switches, the awake badge, the HUD state |
| amber-fill | `rgba(224,144,48,0.08)` | `#17110d` | Background of a selected chip |
| amber-line | `rgba(224,144,48,0.4)` | `#5d3d19` | Border of a selected chip or the awake card |
| ember | `#c55238` | `#c55238` | Start of the accent rule; skipped-package panel border |
| error-text | `#d9705a` | `#d9705a` | "2 skipped", the Error button |
| ok | `#3a8a4a` | `#3a8a4a` | "Shrine running" dot |

Gold is for labels and brand; amber means "selected" or "on". Don't swap them.

---

## Type

| Role | Canvas | Pane `Text` |
|------|--------|-------------|
| Screen title ("Engrams", "Surfaces") | Manrope 700, 30 px, white, −0.02em | bold, white, then the accent rule on the next row |
| Engram name on its page | Manrope 700, 38 px, white | bold, white; same row height as other text |
| Card name, row title | Manrope 700, 16–17 px, white | bold, white |
| Label ("AWAKE", "WHERE IT DRAWS", counts) | JetBrains Mono 500, 10–11 px, UPPERCASE, 0.18em, gold | UPPERCASE, gold, with a space between words |
| Chip and button text | JetBrains Mono 500–600, 10.5–12 px | UPPERCASE for chips and the primary button; normal case for secondary buttons |
| Body | Inter 400, 13–17 px | frost or body colour |
| Description | Inter 400, 12.5 px, 2 lines max | muted; `wrap="truncate-end"` after 2 rows |
| Note | JetBrains Mono 12 px, faint, gold bar on the left | faint, with a 1-cell gold `Box` on its left |

---

## Components

Each matches an element on the canvas.

**Header.** A back button (1 cell `‹`, secondary style), then the wordmark. Nothing on the right. The pane's title is always "Eidola", whichever Engram is awake.

**Title and rule** (Surfaces screen only; the picker has none). The screen title, then the count label on the same row at the right ("1 OF 2 ON"). Below them, the accent rule: about 15 cells wide, ember → amber → gold, fading out.

**Awake strip.** A panel holding a small thumbnail, then the "AWAKE" label, the name and "Idle · drawing in Pane and Band". Details and Sleep buttons on the right. The picker says "awake" here and nowhere else.

**Filter chips.** One row of chips with counts: All, Pane, Band, Shrine, Yours. Unselected: `line` border, faint text. Selected: `amber-line` border, `amber-fill` background, amber text.

**Engram card.** `card` background, rounded border:
- the thumbnail at 16:9 (the Wisp's band strip is shown letterboxed)
- name, plus a "YOURS" badge (gold text, `line` border) for yours
- the description, wrapped in full, never clipped; every card in a row stretches to the tallest, its footer at the bottom
- a footer, above a `line-soft` divider: the three surface icons (amber if the Engram can draw there, `#2e2d2e` if not), the short "pane + band" text, and Awaken
- the awake card's border is `amber-line`; it has no badge and no button (the awake strip has Sleep)

Clicking the card opens the Engram page; the button does not.

**Panel.** `panel` background, `line` border, rounded. A label at the top left, an optional link at the top right, and rows split by `line-soft`.

**Surface row.** An icon, the name in bold white, a muted one-line description, and a switch on the right.

**Switch.** Off: `line` border, faint knob on the left. On: `amber-line` border, `amber-fill` track, amber knob on the right. The row's border turns `amber-line` while on.

**Check.** An 18 × 18 px box (1 cell) instead of a native checkbox. Off: `line` border. On: `amber-line` border, `amber-fill`, an amber tick. The label sits to its right in frost.

**Buttons.**
- **One style** for every button (Awaken, Sleep, Details, Create with Claude, Copy, Remix with Claude, Fix with Claude, Publish): `Button variant="secondary"`, normal case. No primary fill.
- **Icon** (Edit with Claude on a card): a square secondary button with one icon and an accessible label. Use it when a card footer would otherwise hold three buttons.
- A card footer holds at most two buttons, and button text never wraps.
- **Error** (Engram page only): an `ember` border, error-text colour.

**HUD preview** (Engram page). The live scene in a `#020308` frame with a 1-cell gold corner mark in each corner. At the top left, "EIDOLA · LICH" small, the mood in bold amber UPPERCASE, and a short line under it. At the top right, "PREVIEW · NOT AWAKE". Under the preview, one row: three mood chips (Idle, Working, Attention), then the Error button set apart from them.

**New Engram tile.** The first tile in the Yours grid, the same size as a card: a dashed `line` border, centred, a round amber "+" mark, "New Engram" in bold white, one muted line, Create with Claude and an "or remix one" link back to the picker.

**Your Engram card.** As an Engram card, with "Remix of …" in faint mono under the name, and a footer of an Edit with Claude icon button and Awaken.

**Not-loading card.** As an Engram card, with an `ember` outline, the thumbnail dimmed, a "NOT LOADING" badge in error-text, the file and line in the description, and Fix with Claude as the only button. No separate error panel.

**Empty state.** A dashed `line` border, centred: the round amber "+", "Make your own Engram", one muted line, Create with Claude and "or remix one". Keep it to that: no instructions or steps on the screen.

---

## Screens

| Screen | Artboard | How you get there |
|--------|----------|-------------------|
| Picker | Picker · All | The corner triangle on the pane or any band; `/engrams` |
| Engram page | Engram page · Lich | Click a card; Details on the awake strip; `/engrams <id>` |
| Surfaces | Surfaces | The Surfaces link on an Engram page's Where it draws panel; `/eidola place` with no arguments |
| Yours | Yours, Yours · empty | The Yours filter |

The back button always returns to the screen before, and it is the only way back: a screen draws no corner triangle. From the picker it closes the picker and shows the awake Engram again. A screen is as tall as it needs; the pane scrolls it.

---

## Words

- Say "Engram", "scene", "mood", "pane", "band", "Shrine", "surfaces". Never "Soul", "Vessel state" or "frames".
- Buttons are verbs: Awaken, Sleep, Reload, Copy.
- Every error message names the file, says what's wrong, and says how to fix it.
