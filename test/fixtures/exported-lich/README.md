# Exported Lich

An Engram for [Eidola](https://github.com/AyeJK/eidola-mod), made from the bundled Lich: an Engram plugin (contract 1). Eidola keeps the frame, the HUD, the corner and the picker; this plugin draws the creature.

- `engram.json`: the Engram (`id` exported-lich, `vessel.scene` "self", `remixOf` "lich": while the drawing can't draw, Eidola draws the Lich in its place).
- `hooks/register.tsx`: announces the Engram to Eidola and hands each drawing Eidola asks for to `hooks/draw.tsx`.
- `hooks/draw.tsx` and the files beside it: the Lich's drawing, copied whole. Change the creature here.
- `vessel/`: the picker's stills.

Before you share it, from the Eidola mod's folder:

```
node scripts/check-engram.mjs <this folder>
claude plugin validate <this folder>
```

To try it by hand, add the folder holding this one as a local marketplace, install it beside Eidola, and `/awaken exported-lich`.
