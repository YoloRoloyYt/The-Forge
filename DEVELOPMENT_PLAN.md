# The Forge II — development plan

## What this is

A ground-up rebuild of The Forge. The original (`forge1/`) is a Canvas2D pixel-art game; it
is kept in the repository unchanged, because its game loop is the thing being built on.

The brief for the rebuild:

- stay 2D, but raise the graphics to a standard worth staring at
- keep the mines the same shape and size, and make where the ore spawns random
- more boss levels and more mining levels
- a full overhaul of the balancing
- subtitle: *"As a child, I yearned for the mines."*

## What changed from The Forge 1

| | Forge 1 | Forge II |
|---|---|---|
| Renderer | Canvas2D, 480×270 | WebGL2 deferred: normal-mapped lights, ray-marched shadows, bloom, ACES grade |
| Sprites | flat colour, drawn in code | albedo + height + emissive, drawn in code, normals derived |
| Characters | redrawn per pose | cut-out skeletons with blendable animation |
| Tiles | 16px, 1 variant | 32px, 8 variants + flips + world-space macro noise |
| UI | 5×7 bitmap font on the game canvas | separate Canvas2D layer at display resolution |
| Mine floors | 3 | 8, each its own biome, lighting and grade |
| Bosses | 1 | 7, four phases each, one framework |
| Ores | 11 | 20, on a value ladder that doubles every depth |
| Weapon classes | 4 | 6 · armour 4 → 6 |
| Balance | hand-set | fitted against `tools/balance.js` |

The mine generator is deliberately *unchanged*: 64 × 52, 46% initial wall fill, four
smoothing passes at the five-neighbour rule, largest region kept, entrance north-west, shaft
at the far point. The mines feel the size and shape they always did. Everything placed inside
them is rolled fresh every descent.

## Built

- [x] **Engine** — WebGL2 context, MRT sprite batcher, instanced normal-mapped lights with
      ray-marched tile shadows, linear-light composite, progressive bloom, ACES tonemap,
      per-biome colour grading, heat shimmer, vignette, grain, chromatic aberration,
      sharp-bilinear upscale
- [x] **Art pipeline** — three-layer painter (albedo / height / emissive), Sobel normal
      generation, explicit normal overrides for walls and water, runtime atlas packing with
      edge padding, CPU-side sheet kept for menu icons
- [x] **Animation** — cut-out skeleton, pose evaluation, silhouette outline pass, equipment
      layering, per-item grip angles
- [x] **Content** — 20 ores, 8 traits, 6 weapon and 6 armour classes, 10 pickaxes, 6 lamps,
      9 potions, 9 runes, 9 enchantments, 16 bloodlines over 7 rarity tiers, 10 enemy types,
      8 depths, 7 bosses, 24 deeds, 8 kinds of generated job
- [x] **Gameplay** — movement, sprint, stamina, mining, three attacks, dash i-frames, parry
      cone, potions, loot magnetism, elites guarding seams, sealed caverns, hazards, death
- [x] **The forge** — crucible with live preview, bellows, pour, hammering, quality reveal
- [x] **Hub** — Emberhold with six shops, the Great Forge, the shaft and the Deep Gate
- [x] **Bosses** — arena generation, four-phase framework, 17 move names over 10 implemented
      moves, telegraphs, adds, arena camera, reward screen, the gate
- [x] **UI** — HUD, minimap, inventory, jobs, deeds, settings, help, six shop screens,
      title, pause, death, map
- [x] **Touch** — stick, buttons, automatic aim, appears on first touch
- [x] **Balance** — economy simulation, numerically solved XP curve, forge windows fitted
      against a millisecond-error autoplayer, 52 logic tests
- [x] **Volumetric haze** — a fraction of the light added rather than multiplied, per biome
- [x] **Adaptive quality** — frame time measured, detail stepped to match the machine

## Not built

- [ ] A hand-authored soundtrack. Audio is synthesised; there is no music layer yet.
- [ ] Key rebinding.
- [ ] Player forge / housing, New Game+, seasonal events (GDD sections 29, 40, A7).
- [ ] Multiplayer. Game state is kept separate from rendering so it stays possible.
- [ ] A hosted public URL.

## Verification

- `tests.html` — 52 logic tests over tables, forge maths, economy and progression
- `node tools/balance.js` — the economy dry run
- `node tools/forgecurve.js` — forge quality against timing error (needs Playwright)
- `tools/mineview.html#<depth>`, `tools/charview.html`, `tools/rtest.html` — isolated art viewers
- `node tools/shot.js <page> <out.png>` — headless screenshots of any of the above

## Open questions

- Whether depth VIII should have a second, harder variant rather than ending at the First
  Forger — the level cap currently arrives a little before the content does.
- Whether the parry should have a shorter window and a shorter cooldown; it is generous now.
- The bellows rewards a bang-bang hold rather than anticipation. A player who reads the band's
  drift should beat one who only reacts to it, and right now they do not by much.
