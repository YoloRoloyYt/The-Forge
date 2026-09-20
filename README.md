# The Forge

A 2D top-down pixel-art mining / forging / combat game that runs in the browser. Design: `The_Forge_Game_Design_Document_v2.md`. Roadmap and progress: `DEVELOPMENT_PLAN.md`.

## Play
Open `index.html` in a browser (Chrome / Edge / Firefox). No install or build step. To share it as a link, upload this folder to any static host (itch.io HTML5, GitHub Pages, Netlify).

## Controls
| Input | Action |
|---|---|
| WASD / arrows | Move |
| Shift | Sprint (stamina) |
| Left click | Light attack (aims at the cursor) |
| Right click / R | Heavy attack |
| Q | Dash (i-frames) |
| F | Parry (only while holding your weapon): a 1 second window guarding a 100 degree cone aimed exactly where the mouse points when you press F (the aim is locked for the whole window). An enemy that hits you from that side deals no damage and is stunned for 2 seconds (and takes +50% damage). Hits from other sides still hurt. 10 second cooldown |
| 1 / 2 | Hold pickaxe / hold weapon (or scroll wheel, or click the hotbar). Mining needs the pickaxe out; attacking needs the weapon out |
| 3-7 | Use the potion assigned to that hotbar slot (assign in Inventory > Potions) |
| E | Interact; hold near a rock to mine (pickaxe held) |
| T / Tab | Inventory |
| J / K / H | Quest log / Achievements / Controls list |
| Esc | Pause |

## Adding your own art
Every sprite is currently drawn procedurally. Art loading goes through `Art.get(key, ...)` in `js/core.js`; a file at `assets/<key>.png` overrides the placeholder for that key (list of probed keys is in `js/main.js`). Item icons use keys like `item_<class>`.

## Tests
Open `tests.html` — it runs logic tests plus a scripted smoke playthrough (forge, mine, fight, death, menus) and prints `ALL OK` or the failures. `shot.html#hub|cave|cave2|forge|hammer|bag|enchant|title` renders a single scene for screenshots.

## Code map
`js/core.js` canvas/input/audio/save · `js/data.js` all content tables · `js/forgelogic.js` ore-combo + quality maths · `js/ui.js` UI, particles, procedural item art · `js/entities.js` stats/player/enemy · `js/world.js` level gen, combat, mining, AI, lighting, HUD · `js/forge.js` 4-stage forging · `js/menus.js` shops, quests, inventory, title · `js/main.js` loop.

## The hub
The Greenwood hub is a dwarven stronghold cut out of solid rock, laid out around the **Central Forge**
— a stone drum with a molten heart, standing on a scorched apron of red brick. A round flagstone hall
surrounds it, and galleries run out to five colour-coded workshop rooms:

```
                      Mine Entrance  (N)
   Drill Workshop (NW)                    (NE) Accessory Workshop
     [ Pickaxe Smith ]                        [ Enchanter ]
  Race Shrine (W) ====   CENTRAL FORGE   ==== (E) Grove Gate
     [ Alchemist ]                            [ Quest Board ]
      Enchants (SW)                       (SE) Commissions
                        Storage  (S)
                       [ Merchant ]
```

Each workshop is a walled room you see the inside of: a tiled floor in the trade's colour, workbenches
along the far wall, trade fittings (anvil and quench trough, rune pedestal, cauldron and bottle shelves,
notice boards, crates and barrels), lamps flanking the doorway and a plaque over it. Lava seams bleed
through the surrounding rock, and plank bridges carry you east and west to the gate and the shrine.

The shopkeepers are dwarves — stocky, heavily bearded, each kitted out for their trade (the smith's
leather apron and shoulder hammer, the enchanter's deep hood and staff, the alchemist's bottle
bandolier, the merchant's ledger and purse).

The layout lives in `genHub()` in `js/world.js`. Rooms come from one `ROOMS` table (position, colour,
sign, which wall the door is in), and their interiors are drawn in `renderLayer`'s workshop pass, so
adding or recolouring a shop is a small, local change.
## Systems at a glance
- **Boss:** the Grove Gate (east side of the hub) leads to the Ancient Grove Guardian, a 4-phase fight (slams and thorn lines, then sapling summons, an overgrown arena, and an enrage). The gate shows the recommended power and yours; you can always try anyway.
- **Races:** the Race Shrine in the hub rerolls a permanent race bonus with spins (from level-ups, achievements, bosses). Seven rarity tiers with soft pity; some races are economy-focused (mining and forge bonuses).
- **Spells:** the Enchanter's Spells tab puts an effect on your weapon or armour (Flame, Storm, Frost, Void, Wind, Fortify, Vitality, Inferno, Ice Shield).
- **Powerups:** enemies occasionally drop orbs (Health, Berserk, Barrier, Inferno, Gold Rush, Forge Frenzy). Walk over them.
- **Hidden caverns:** look for a cracked, glowing rock in the mine. Mine it open to reach crystals and a chest.
- **Touch:** on a phone or tablet the on-screen joystick and buttons appear on first touch; aiming is automatic.
## Art and presentation
All art is drawn in code — there are no image files yet. The look is built from a few shared pieces:

- **`PAL` in `js/ui.js`** is the palette every screen uses (dark plum panels, bronze frames, gold accents). Change a colour there and it changes everywhere.
- **`js/font.js` is a 5x7 bitmap font.** The browser's monospace face goes soft when rasterised at 7px and then scaled up with the rest of the canvas, so every glyph is drawn from our own bitmaps instead and stays crisp at any zoom. Glyphs are 7 rows of base-32 digits, 5 bits wide; `UI.text` and `UI.width` route through it, and pixel sizes snap to whole-number scales (1x–4x) so letters never land on half pixels. Note it is wider than the old font, so list columns are laid out around ~6px per character.
- **UI components** live in `js/ui.js`: `UI.panel`, `UI.btn`, `UI.bar`, `UI.slot`, `UI.row`, `UI.chip`, `UI.tabs`, `UI.tip`, `UI.header`. Menus are built from these, so new screens match automatically.
- **`Art.outline()` / `Art.getOutlined()` in `js/core.js`** trace a dark edge around a finished sprite and cache the result. Almost every sprite goes through it, which is what makes things readable against any background.
- **Item art is generated from the ore you used** (`ItemArt` in `js/ui.js`). Weapon classes have distinct blade profiles, and traits, spells and Masterwork add overlays.
- **The player is drawn once per frame in five passes** (four dark offsets, then the real body) in `drawPlayer`, so equipment can be layered and still get a clean outline.
- **Tiles are pre-rendered per level** in `renderLayer` (`js/world.js`) in two passes: ground first, then structures like trees and wall faces, so they can overhang upward.

To replace any of it with real pixel art, drop a PNG into `assets/` named after the sprite key and it takes over — see "Adding your own art" above.