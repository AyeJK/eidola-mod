# Starter

An Engram for [Eidola](https://github.com/AyeJK/eidola-mod): a small mote of light, drawn by this plugin inside Eidola's pane and band (an Engram plugin, contract 1). Eidola keeps the frame, the HUD, the corner and the picker; this plugin draws the creature.

- `engram.json`: the Engram (`vessel.scene` "self").
- `hooks/register.tsx`: announces the Engram to Eidola and draws it in each mood, with an error effect. Change the creature in `LOOKS` and `draw()`.
- `vessel/thumb-pane.svg`: the picker's still.

Check it before you share it, from the Eidola mod's folder: `node scripts/check-engram.mjs <this folder>`.
