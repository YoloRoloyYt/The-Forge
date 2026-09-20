# The Forge — Browser Game Development Plan

## Context
The design doc (`The_Forge_Game_Design_Document_v2.md`) describes a 2D top-down pixel-art Action RPG / Mining & Forging sim, originally framed for Roblox. **It is NOT a Roblox game**: it is built as a browser game, playable via a link / HTML file, with everything developed in this folder. The user supplies images and other assets; everything else is built here.

The GDD's Appendix C says steps 1-5 (movement, mining, forging, ore-combo logic, selling) are the vertical slice, and "if that loop is not fun on its own, no content will save it." This plan follows that: slice first, content later.

## Key decisions
- **Stack:** Vite + TypeScript + **Phaser 3** (tilemaps, scenes, input, camera, tweens, light/mask support). Builds to a static folder deployable to itch.io / GitHub Pages / Netlify = "a link". Can also be opened locally from the build folder.
- **Multiplayer scope:** GDD says ~12 players/server. **Ship single-player first**, with game state kept in a serialisable model separate from rendering so a server (Node + WebSocket, e.g. Colyseus) can be added later. Saves via localStorage/IndexedDB.
- **Art:** All game objects reference sprites by key through one asset manifest. Until the user supplies images, use **procedurally generated placeholder pixel art** so everything is playable from day one. Dropping a file in `public/assets/` and mapping it in the manifest replaces the placeholder. Ore-derived item appearance (GDD 6.1 / 9.3) is done by palette-tinting layered sprites at runtime.
- **Data-driven:** ores, traits, weapons, enemies, quests, runes live in `src/data/*.ts` (or JSON), so content phases are mostly data entry.
- **Resolution:** low internal resolution (e.g. 480x270), integer-scaled, pixel-perfect, `roundPixels`.

## Project structure
```
The Forge/
  index.html, package.json, vite.config.ts, tsconfig.json
  public/assets/         <- user drops images/audio here
  src/
    main.ts              Phaser config, scene registry
    core/                game state model, save/load, event bus, RNG, asset manifest
    scenes/              Boot, Hub, Cave, Forge, UI overlay, Boss arenas
    systems/             movement, mining, stamina, combat, ai, lighting, forging, economy, quests, runes, races
    data/                ores, traits, weapons, armour, enemies, potions, spells, quests, worlds
    ui/                  inventory, forge UI, shop, quest board, HUD (pixel-styled)
  tests/                 Vitest unit tests for pure logic (forge maths, ore combos, economy)
```

## Phases

### Phase 0 — Scaffold
Vite + TS + Phaser project, placeholder-art generator, asset manifest, scene flow (Boot → Hub → Cave), pixel-perfect scaling, save/load stub, Vitest.

### Phase 1 — Vertical slice (GDD App. C steps 1-5) — the make-or-break milestone
1. **Top-down movement + camera** — 8-direction, sprint, tilemap collision, one cave map.
2. **Mining** — nodes with hidden HP (pebble / rock / boulder / vein / crystal), pickaxe Mine Power, shared **stamina** meter, ore inventory, drops by rarity tier (GDD 31).
3. **Forging minigame (4 stages)** — Crucible ore selection, Bellows (sustained heat-zone hold), Pour (stop at fill), Hammering (shrinking-ring timing circles). Pure-logic scorer separate from UI; Poor / Good / Great / Perfect grade with 1.3-1.5x quality multiplier (GDD 7). Effects: heat colour ramp, sparks, steam quench (GDD 36).
4. **Ore-combination logic** — ore count → item class (3-9 / 10-25 / 26-39 / 40+), filler / multiplier / trait ore roles, stat generation, palette from dominant ore. Unit-tested.
5. **Sell + Gold loop** — vendor NPC, sell price = f(ore value, quality), first pickaxe upgrade as the Gold sink.

**Exit gate:** play the loop for 15+ minutes. If mine → forge → sell → upgrade isn't fun, tune here before continuing.

### Phase 2 — Combat and the mine as hazard (App. C 6-8)
- Light / heavy attack with committed animations and **hit arcs** per weapon class (dagger cone → colossal sweep), dash with i-frames (Q), block (F) draining stamina, guard break, no parry (GDD 4, 9.1).
- Armour weight classes affect speed / HP / damage reduction.
- Enemies: Grunt, Rogue, Bomber, then **Elite guarding a rich vein** (A6); simple state-machine AI (patrol → aggro → telegraph → attack).
- **Lantern radial-light darkness mask** (valuable nodes only visible in light) and **second cave floor** via shaft (A4). Hazards: magma, collapse.
- Death: respawn at checkpoint, lose small Gold, keep gear (GDD 28).

### Phase 3 — Progression systems (App. C 9-11)
- Levels / XP (pacing only, no direct stats), World 2 gate (Lv 10 + quest chain).
- Quest board with the GDD's quest types (combat, gather, forge-quality, exploration, boss, challenge, NPC).
- Enhancer NPC, Runemaker + runes (lifesteal, elemental, pickaxe runes), permanent installs.
- Potions and spells (GDD 10-11), powerups (27).
- Races (spin / reroll, 7 tiers, soft pity, economy race) (A2).
- Hub NPCs: pickaxe vendor, potion vendor, Runemaker, Enhancer, storage.

### Phase 4 — First boss + World 1 polish (App. C 12)
- Multi-phase boss framework (4 phases per GDD 24), built once and reused. Ancient Grove Guardian first.
- Boss recommended-power system (GDD 25), zone boss in the hard sub-biome, secret area, achievements, tutorial / onboarding, audio, juice (screen shake, hit-stop), settings / keybinds, **touch controls** (large dash / block buttons per GDD 4).
- **Release 1:** one polished world, playable at a public URL.

### Phase 5 — World 2 and 3 (GDD 15 staging)
- World 2 (Ancient Kingdom + Molten Depths hard zone: heat / lava, elemental attacks) and World 3 (Frostpeak: slow, ranged, mythic ore). Each is mostly data + maps + one boss using the Phase 4 framework. Mob roles Tank / Assassin / Archer / Mage / Healer added here.

### Phase 6 — Meta and live-service features
Player forge (housing / customisation), hub growth, Masterwork (98-100%) bonuses, New Game+, seasonal events, promo codes, cloud saves.

### Phase 7 — Multiplayer (optional, last)
Authoritative Node / WebSocket server, ~12-player rooms, shared hub, synced mobs / nodes. Enabled by the Phase 0 decision to keep game state separate from rendering.

### Later updates
Remaining worlds (Whispering Woods, Scorched Wastes, Voidlands, Forge of Eternity).

## Critical files (Phase 0-1)
`src/core/gameState.ts`, `src/core/assets.ts` (manifest + placeholder generator), `src/systems/forging/{crucible,bellows,pour,hammer,quality}.ts`, `src/systems/mining.ts`, `src/systems/stamina.ts`, `src/data/ores.ts`, `src/scenes/{Boot,Hub,Cave,Forge}Scene.ts`.

## Verification
- `npm run dev` → play in browser; `npm run build` + `npm run preview` confirms the static deploy works.
- Vitest unit tests for forge scoring, ore-combo class / multiplier / trait resolution, price formula, stamina, save/load round-trip.
- Per-phase manual playtest checklist (Phase 1 gate above); run in Chromium and check a mobile viewport in devtools.
- Frame-rate check with 12+ entities and the lighting mask on.

## Open items
- Which assets the user will supply first (player, ore, tiles?) — placeholders cover the rest.
- Preferred hosting target (itch.io vs GitHub Pages vs other) at Release 1.

## Stack change (actual build)
Node.js is not installed on the dev machine, so the Vite/TypeScript/Phaser stack above was replaced by **dependency-free HTML5 Canvas + plain JavaScript** (classic scripts, no build step). It opens straight from `index.html` and deploys to any static host. The architecture (data tables, pure forge logic, scenes, procedural placeholder art with PNG override) is unchanged. Tests run in-browser via `tests.html` instead of Vitest. See `README.md`.

## Progress tracker
- [x] Phase 0 — Scaffold (canvas, input, audio, save, scene stack, placeholder art, tests)
- [x] Phase 1 — Vertical slice: movement, mining + stamina, 4-stage forging, ore-combo logic, sell loop, pickaxe/lantern upgrades. **Still needs the 15-minute human playtest / balance pass (exit gate).**
- [x] Phase 2 — Combat + mine hazards: light/heavy/dash/parry, Grunt/Rogue/Bomber, elites guarding veins, lantern darkness, 3 floors, magma, death rules, enemy levels
- [x] Phase 3 — Progression: levels/XP + floor gates, quest board with 8 quest types (gather, kill, forge, floor, challenge, exploration, NPC delivery, boss), Enhancer, Runemaker, potions + hotbar, **races** (spins, 7 tiers, soft pity, economy races), **spells** (5 weapon, 4 armour), **powerups** (6), hub NPCs. Not done: personal storage chest.
- [x] Phase 4 — (mostly) **Ancient Grove Guardian** 4-phase boss + arena + recommended-power gate, hidden caverns with sealed rock + chest, achievements (12), touch controls, settings (volume/mute/shake), tutorial hints. Not done: key rebinding, real audio/art (procedural placeholders remain), a hosted public URL. **Release 1 is waiting on a human playtest and balance pass.**
- [x] Art & UI polish pass — shared palette and component set (panels, beveled buttons, bars, slots, rows, chips, tooltips), outlined sprites throughout, redrawn characters/enemies/pickaxes/weapons/armour/NPCs, layered trees and cave wall faces, framed HUD with level medallion, rebuilt inventory/shops/quest board/race shrine/boss gate/forge screens, live item preview in the crucible
- [ ] Phase 5 — Worlds 2 and 3, Tank/Assassin/Archer/Mage/Healer enemies
- [ ] Phase 6 — Player forge, hub growth, Masterwork extras, New Game+, events
- [ ] Phase 7 — Multiplayer