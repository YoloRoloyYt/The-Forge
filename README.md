# The Forge II
### *"As a child, I yearned for the mines."*

A complete reimagining of [The Forge](forge1/) — still 2D, still a browser game with no build
step, but rebuilt from the renderer up. Every sprite is generated in code, lit by a real
deferred lighting pass with normal maps and ray-marched shadows, and graded through a
filmic post chain. Open `index.html` and it runs.

```
mine the rock  →  melt what you found  →  forge it badly or brilliantly  →  go deeper
```

---

## Play

Open `index.html` in Chrome, Edge or Firefox. No install, no server, no dependencies.

**Online:** `.github/workflows/pages.yml` publishes the repository to GitHub Pages, which
serves it at **https://yoloroloyyt.github.io/The-Forge/**. Two things have to be true first:

1. the repository is public — a Pages site is only reachable by everyone if it is, and on a
   free plan Pages needs a public repository at all;
2. Pages is switched on under *Settings → Pages → Build and deployment →
   Source: GitHub Actions*.

Then run **Pages** once from the Actions tab (it deploys whichever branch you pick), and
after that every push to `main` redeploys on its own.

**Requires WebGL2.** Every browser since 2021 has it.

### Controls

| Input | Action |
|---|---|
| **WASD** / arrows | Move |
| **Shift** | Sprint (costs stamina) |
| **Left click** | Attack, or swing the pick at rock — aims at the cursor |
| **Right click** / **R** | Heavy attack — slower, rooted, roughly double, and it shatters ore |
| **Q** | Dash — real invulnerability frames |
| **F** | Parry — guards a cone toward the cursor for a moment |
| **1** / **2** / wheel | Hold the pickaxe or the weapon |
| **3**–**8** | Drink the potion in that slot |
| **E** | Use, talk, take, descend |
| **T** / **Tab** | The bag · **J** jobs · **K** deeds · **M** map · **Esc** pause |

On a phone or tablet the stick and buttons appear on first touch and never before.

---

## The loop

**Emberhold** is the hub: a stronghold cut out of rock around a forge that has never gone
out. Six rooms open off the central hall — the Drill Works for pickaxes and lamps, the Rune
Hall for runes, enchantments and enhancement, the Apothecary, the Storehouse, the Ancestor
Shrine, and the Notice Board. North is the shaft. East is the Deep Gate.

**Eight depths.** Each one is a 64 × 52 cavern — the same footprint The Forge 1 used, cut by
the same cellular-automata pass with the same parameters. What is *inside* it is rolled
fresh every descent: which ore each node carries, where the rich seams sit, which elite is
standing over them, and where the sealed cavern is hidden.

| | Depth | Introduces |
|---|---|---|
| I | The Greenwood Cut | Stone, Coal, Copper, Iron |
| II | The Copper Hollows | Silver, Aurite |
| III | The Drowned Gallery | Platinum, Glassite |
| IV | The Magma Vents | Titanium, Magmite, Volatite |
| V | The Crystal Cathedral | Cobalt, Rimeite |
| VI | The Bone Quarry | Mithral, Soul Quartz, Demonite |
| VII | The Voidshear Rift | Adamant, Voidstone |
| VIII | The Heart of the Forge | Starsteel, Emberheart |

**Seven bosses**, each gating the depth below it, each a four-phase fight on one framework
with its own move table: the Ancient Grove Guardian, the Tidewrought Leviathan, the Infernal
King, the Prism Warden, the Bone Sovereign, the Void Sovereign, and the First Forger.

---

## The forge

Four stages, and the only part of the game where your hands decide the outcome.

1. **The Crucible** — choose the melt. How *much* ore decides the class: 3 ore is a dagger,
   53 is a titan maul. *Which* ore decides the stats, the colours and the traits. A trait ore
   at about a fifth of the melt brings its passive with it; two traits at most.
2. **The Bellows** — hold to pump, keep the heat inside a band that wanders and narrows.
3. **The Pour** — stop the stream inside the green. Overpour and you get slag.
4. **The Hammering** — strike as the ring crosses the mark. The last strikes come faster.

The three timed stages become one number from 0 to 100. A Masterwork at 99 carries about
2.5× the stats of a Botched one and sells for far more than that. Forging ore is worth
roughly twice selling it raw at every depth — which is the whole point of the game.

---

## How it is drawn

There are no image files. Every sprite is a function.

**The art pipeline** (`src/engine/art.js`). A generator paints into three layers at once —
albedo, a height field, and an emissive mask — through one painter object. At load time the
height field is run through a Sobel pass to produce normals, and all three are packed into
2048² atlases. Write a rock once, get a rock that lights correctly from any direction.

**The renderer** (`src/engine/render.js`) is a deferred 2D pipeline:

```
geometry   → G-buffer   albedo | normal + height + specular | emissive
lights     → instanced quads, normal-mapped, with ray-marched tile shadows
composite  → linear-light:  albedo × (ambient × AO + light) + emissive
              plus volumetric haze: light ADDED on top, not multiplied in
bloom      → progressive down/up sample, stopped before the mips go blocky
present    → heat shimmer, ACES tonemap, per-biome grade, vignette,
             chromatic aberration, grain, sharp-bilinear upscale
```

Some details that matter more than they sound:

- **Everything is lit in linear space** and encoded back to sRGB after the tonemap.
  Doing it the other way around is why most 2D games with "lighting" look muddy.
- **Tile grids are killed three ways at once**: eight variants per floor, a random flip on
  each tile, and a world-space macro-variation noise multiplied over the albedo in the
  composite pass. All three are necessary; the third does the most work.
- **Every tile variant shares one base colour.** Varying the base per variant is what makes
  a tiled floor read as a checkerboard no matter how good the detail is.
- **The bloom chain stops at ~20px.** A 4×4 mip turns every bright pixel into a screen-wide
  axis-aligned cross when it is tented back up.
- **A fraction of the light is added rather than multiplied.** That is what light scattering
  off dust in the air actually looks like, and it is the difference between a lit floor and
  a lit room. Each biome sets its own thickness.
- **The UI is a separate Canvas2D layer at the display's real resolution.** The world can be
  chunky and lamplit while the text stays razor sharp.
- **Quality scales itself.** The pipeline is cheap on a GPU and expensive on a software
  rasteriser, and a browser game does not get to know which it is running on — so it measures
  frame time and steps shadows, haze, bloom and grain down or back up. Settings shows what it
  picked and lets you lock it.

**Characters are cut-out skeletons** (`src/engine/rig.js`), not sprite sheets. Bones carry
sprites; animations are functions that write bone angles for a phase. That buys blendable
motion, per-frame aiming, equipment that layers onto the same skeleton, and hit reactions
that can bend a pose already playing. Bosses wear the same skeleton with its joints moved
out and a body sprite four times the size.

**Equipment is tinted, not redrawn.** Armour and weapons are painted as neutral greys with
real relief baked into the height channel, then tinted per draw — which is how a chestplate
forged out of magmite comes out orange and a mithral one comes out pale green without a
second sprite existing anywhere.

---

## Balance

`node tools/balance.js` loads the real tables and the real ore-roll function, simulates
clearing each depth, and prints what a player actually earns, how many runs each upgrade
costs, and where the level curve meets the depth gates. The numbers in `src/game/data.js`
were fitted against it rather than guessed:

- The best ore available roughly **doubles in value every depth** (13 → 4,400).
- Each pickaxe costs between **half a run and five runs** at the depth it is meant for.
- The XP curve was solved numerically so the depth gates land at roughly runs
  4 / 11 / 21 / 31 / 40 / 49 / 56, with the level cap a little past that. The cubic term in
  `xpNeeded` is what stops the last five levels falling out of a single deep run.

`node tools/forgecurve.js` does the same job for the forge minigame. It drives the real
ForgeScene at a fixed timestep with rendering off, through an autoplayer that reacts *late*
by a set number of milliseconds — which is how people actually miss, and what a
jitter-on-the-value model gets wrong. The windows were tuned against it until the curve read:

| Timing error | Quality | Grade |
|---|---|---|
| ±20ms | ~94 | Flawless |
| ±50ms | ~87 | Superb |
| ±90ms | ~66 | Fair |
| ±160ms | ~54 | Poor |
| flailing | ~22 | Botched |

Skill is worth about **1.9× damage and 3.8× gold on identical ore**, and Masterwork needs
near-perfect play *plus* a Forgemaster Dram or the right bloodline.

---

## Code map

```
index.html            loads everything, in order, as plain scripts
src/main.js           boot and the frame loop
src/engine/
  gl.js               WebGL2 context, shaders, textures, framebuffers
  art.js              the three-layer painter, the atlas, the Sobel normal pass
  batch.js            the geometry pass — one buffer, one atlas, three MRT outputs
  render.js           lights, composite, bloom, the present pass
  rig.js              cut-out skeletal animation
  particles.js        one flat pool, no allocation during play
  util.js             maths, seeded RNG, colour
  input.js  audio.js  save.js
src/art/
  palette.js          every colour in the game; BIOMES drives tiles, light and grade together
  tiles.js  props.js  chars.js  hubart.js  bossart.js
src/game/
  data.js             all content tables
  forge.js            pure ore-combination and quality maths (unit-tested)
  level.js  gen.js    map data, collision, terrain pass, mine generation
  actor.js  player.js  enemy.js  boss.js
  world.js            the playable scene: mines, hub and arenas are all this class
  hub.js  scenes.js  quests.js  achieve.js  game.js  draw.js
src/ui/
  ui.js               the widget set every screen is built from
  hud.js  menus.js  shops.js  forgescene.js  icons.js  touch.js
tools/
  balance.js          the economy dry run
  forgecurve.js       quality against milliseconds of timing error
  shot.js             headless screenshot helper
  mineview.html  charview.html  rtest.html     isolated art viewers
tests.html            52 logic tests — open it, it prints ALL OK
forge1/               The Forge 1, untouched, for reference
```

## Tests

Open `tests.html`. It runs 52 tests over the content tables, the ore-combination maths, the
quality curve, trait thresholds, item generation, the economy and the progression curve, and
prints **ALL OK** or the failures. No canvas, no WebGL — just the maths the game hangs off.

## Adding real art

Every sprite is registered by key through `Art.define(key, w, h, draw, opts)`. To hand-draw
one, replace its generator; to hand-draw all of them, swap the atlas build in `main.js` for
loaded images. The three layers a sprite needs are albedo, height and emissive — a normal map
is derived, not authored.

## Design

`The_Forge_Game_Design_Document_v2.md` is the original design document. `DEVELOPMENT_PLAN.md`
tracks what is built and what is not.
