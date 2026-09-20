# THE FORGE
## Complete Game Design Document

**Platform:** Roblox
**Perspective:** 2D top-down (fixed overhead camera, 8-direction movement)
**Genre:** Action RPG / Mining & Crafting Simulator
**Visual Style:** Detailed modern 16-bit-inspired pixel art
**Session Model:** Persistent multiplayer worlds, ~12 players per server, live-service with regular updates
**Core Experience:** Mine ore in dangerous caves, forge weapons and armour from ore combinations, fight, sell, enhance, and delve deeper.

> **Reference point:** This design targets the feel of the Roblox game *The Forge* (The Forge Community, lead dev FireAtacck, released November 2025), rendered in 2D top-down rather than 3D. Its three pillars are **Mining -> Forging -> Combat**, with mining as the economic foundation and forging as the skill ceiling. The sections below have been adjusted to match that shape.
>
> **Note on the 2D shift:** the reference game's combat depends on 3D spacing, animation commitment and dash i-frames. All of that survives in top-down 2D -- weapon range becomes a hit arc, and i-frames work identically. What you lose is vertical cave layering. Compensate with multi-floor caves connected by shafts and ladders, where each floor is a separate map with richer ore and worse enemies.

# 1. Game Overview

**The Forge** is a long-form fantasy RPG where the player becomes a travelling **Forger**. The player explores a large connected fantasy world, fights enemies, collects materials, completes quests, forges weapons and armour, applies spells and runes, and unlocks increasingly dangerous regions.

The game's main progression loop is:

> **Explore → Fight → Collect → Forge → Upgrade → Complete Quests → Explore Further → Defeat Boss → Unlock New Area**

The game is designed to take a significant amount of time to complete. Progression should feel earned rather than allowing players to skip directly to late-game equipment.

Combat, exploration and forging should all support one another:

> **Better combat → Better materials → Better forging → Better equipment → Harder areas → Better combat skills**

The forging system is one of the game's defining features. Instead of simply selecting an item and pressing "Craft", the player actually works the material through a series of timing-based forging stages. The quality of the player's work determines the final quality of the equipment.

---

# 2. Core Design Goals

The game should aim to achieve the following:

- Long-term progression
- Satisfying equipment upgrades
- Skill-based combat
- Skill-based forging
- Meaningful exploration
- Distinctive areas
- Interesting enemy combinations
- Multi-phase bosses
- A useful quest system
- A flexible spell and rune system
- A balanced economy
- Rare and exciting loot
- Strong visual identity
- Replayability after the main story

The player should almost always have a clear short-term and long-term objective.

For example:

**Short-term:** Collect enough materials for a new helmet.

**Medium-term:** Complete the area's armour set.

**Long-term:** Defeat the area's boss and unlock the next region.

---

# 3. Gameplay Loop

The session loop is mining-led, not combat-led. Combat exists to threaten mining and to consume the gear that mining produces.

## Step 1 - Prepare in the Hub

Buy or upgrade a pickaxe, stock potions and lanterns, check the quest board, choose a destination.

## Step 2 - Descend into the Mine

Each world has a cave system with multiple depth floors. Deeper floors mean:

- Rarer ore nodes
- Tougher rock, requiring higher Mine Power
- Dimmer light, requiring lanterns to see valuable nodes
- More and stronger hostile mobs

## Step 3 - Mine Ore

Every node has hidden health. Pickaxe Mine Power determines damage per swing. Mining drains stamina. The player constantly chooses between one more swing at a rich node and disengaging to fight.

## Step 4 - Survive

Mobs patrol mining routes and aggro onto players absorbed in their work. Combat is an *interruption* to gathering, and that tension is the core feel of the mine.

## Step 5 - Return and Forge

The player brings ore back to a forge and chooses an ore combination. What goes into the crucible determines the item's class, its stat multiplier and its traits.

## Step 6 - Sell or Equip

Most forged items are sold for Gold. A small number are kept. The sell loop is the main income source and should feel as good as equipping.

## Step 7 - Enhance and Rune

Gold and materials go into Enhancement levels and Rune slots on the items worth keeping.

## Step 8 - Quest and Level

Quest chains and XP gate access to the next world.

## Step 9 - Unlock the Next World

A new world means new ore tiers, new traits, new mobs, and the same loop at a higher scale.

> **Change from the original draft:** materials previously came from enemy drops. In the reference game they come from mining, and enemies drop runes, essence and Gold instead. This is the single largest structural change in this document, because it changes what the player is doing minute to minute.

# 4. Combat System

Combat is deliberate and committal. Attacks lock the character into their animation, so a missed swing is punished. Weapon weight, not player level, sets the rhythm.

## Controls

| Input | Action |
|---|---|
| M1 / Left click | Light attack |
| R or Right click | Heavy attack |
| Q | Dash (grants i-frames) |
| Shift | Sprint |
| F | Block |
| E | Interact / mine |
| T | Menu |

The reference game ships on PC, mobile and Xbox. On touch, give dash and block equally large on-screen buttons -- they are the two inputs that decide whether a player lives.

## Stamina

Stamina is the central defensive resource and ties combat to mining:

- Blocking drains stamina; at zero the guard breaks and the player is stunned
- Dashing costs stamina
- Sprinting drains stamina
- Mining drains stamina

One shared meter across gathering and fighting is what makes a deep mining run feel risky.

## No Parry

The reference game deliberately has **no parry**. Defence is spacing, dash timing and stamina management. Leaving parry out keeps heavy-armour and light-armour builds genuinely distinct instead of collapsing every playstyle into "parry everything".

> **Change from the original draft:** the F-parry / Space-dodge scheme is replaced. Dash moves to Q, block stays on F, and there is no parry reward.

## Build Identity

A light-armour player should beat above-level content through dash timing and spacing. A heavy-armour player should beat it by absorbing hits. Both paths must be viable, or the armour weight system is decorative.

# 5. Enemy Types

Enemies should have different combat roles instead of only having different health values.

## Grunt

The basic enemy type.

- Average health
- Average damage
- Straightforward attacks

## Tank

A slow, heavily armoured enemy.

- High health
- High defence
- Slow movement
- Powerful attacks

## Assassin

A fast enemy.

- Low health
- High mobility
- Strong attacks
- Can quickly close the distance

## Archer

A ranged enemy.

- Attacks from a distance
- Low health
- Forces players to move

## Mage

A magical enemy.

- Uses elemental attacks
- Can create area-of-effect hazards
- Can force players out of safe positions

## Healer

Supports other enemies.

- Restores health to nearby enemies
- Should often be prioritised by players

## Elite

A stronger enemy variant.

- Higher stats
- Unique abilities
- Better material drops
- Increased chance of rare items

Enemy groups should combine different roles.

Example:

> 2 Tanks + 3 Archers + 1 Healer

This creates a tactical encounter rather than simply fighting six enemies with different statistics.

---

# 6. Forging System

Forging is the defining mechanic. It runs in four stages, and critically, **stage one is a strategic choice rather than a timing test**.

---

## 6.1 The Crucible - Ore Selection

The player throws ore into the melting pot. This is the single most important decision in the game.

**Ore quantity determines item class.** Total ore weight pushes the result toward a category:

| Ore Count | Likely Result |
|---|---|
| 3-9 | Dagger / Light Armour |
| 10-25 | Straight Sword / Medium Armour |
| 26-39 | Great Sword / Heavy Armour |
| 40+ | Colossal Sword / Heaviest Armour |

**Ore identity determines multiplier and traits.** Three broad ore roles:

- **Filler ores** (Stone, Copper, Iron, Gold): cheap weight, low multiplier in the region of 0.2x to 0.8x. They exist to get the craft into the right class.
- **Multiplier ores** (Platinum, Titanium, Cobalt): raise raw stats with no special effect.
- **Trait ores**: grant passives. The reference game includes a volcanic ore giving large armour defence, a demonic ore that reflects burn damage onto attackers, a glass-cannon ore trading max health for damage, and an explosive ore with a chance of AoE on hit. Build your own equivalents around the same axes.

The result is thousands of valid combinations, each producing its own generated appearance and trait set. **Every forged item should look different depending on what went into it.** This is the reference game's signature feature and the original draft did not include it.

> **Change from the original draft:** fixed recipes such as "Molten Sword" are replaced by combinatorial forging. Keep a handful of named legendary recipes as hidden discoveries, but the default should be player-composed.

---

## 6.2 The Bellows - Heating

A rhythmic minigame. The player pumps the bellows to hold a heat indicator inside a moving sweet spot. Pump too fast and it overheats; too slow and it cools. Time spent in the green zone fills the Quality bar.

This is a sustained input, not a single well-timed press.

---

## 6.3 The Pour

Molten metal pours into a mould. The player must stop the flow exactly as the mould fills. Overfilling or underfilling penalises durability and stat spread.

Short, tense, one decision.

---

## 6.4 The Hammering

The highest-skill stage. Circles appear on the cooling metal, each with a shrinking outer ring. The player clicks as the ring meets the circle.

- **Perfect:** large stat gain
- **Good:** small gain
- **Miss:** penalty

Higher-tier items get more circles, faster rings and tighter windows. A fully Perfect item is dramatically better than a Good one made from identical ore, so player skill acts as a stat multiplier. That is the entire point of the system.

> **Removed from the original draft:** the separate "Shaping" stage. Four stages matches the reference structure, and a fifth makes each forge too long for a game where players forge hundreds of items to sell.

# 7. Forge Quality

Every forged item receives a grade based on combined Bellows, Pour and Hammering performance.

| Grade | Rough Band | Effect |
|---|---|---|
| Poor | 0-39% | Noticeable stat penalty, low sell value |
| Good | 40-69% | Baseline |
| Great | 70-94% | Solid bonus, good sell value |
| Perfect | 95-100% | Large bonus, best sell value, visual flourish |

Four named grades rather than six. Fewer grades keeps the outcome legible at a glance, which matters when a player is forging in bulk to sell.

Quality must be a **meaningful multiplier**, not a rounding error. The original draft's example of 100 damage becoming 115 at full quality is far too small. A Perfect item should land closer to 1.3x-1.5x a Good one made from the same ore.

Quality also drives **sell price**, so forging skill converts directly into income as well as power.

> **Note on Section 8:** Masterwork should be folded into the Perfect grade rather than existing as a seventh tier above it. Perfect already carries the visual flourish and the stat spike.

# 8. Masterwork Equipment

Equipment forged at **98–100% quality** becomes a **Masterwork** item.

Masterwork equipment can receive:

- Special visual effects
- Slightly improved stats
- Unique appearance
- An additional bonus

Possible bonuses:

- Increased damage
- Increased defence
- Increased attack speed
- Increased elemental effect
- Increased critical chance

Masterwork equipment should be desirable but not required for normal progression.

---

# 9. Equipment

Equipment is generated from ore combinations rather than picked from a fixed list, so categories matter more than individual item names.

Slots: Weapon, Helmet, Chest, Legs, Boots, Accessory.

Equipment must visibly change the character sprite, and the palette should be derived from the dominant ore used in the craft.

## 9.1 Weapon Classes

| Class | Speed | Range | Role |
|---|---|---|---|
| Dagger | Fastest (~0.35s) | Very short | High DPS, on-hit proc builds, must stay glued to the target |
| Straight Sword | Balanced | Medium | All-rounder, best for learning spacing |
| Great Sword | Slow | Wide arc | Crowd control, hyper-armour, burst damage |
| Colossal Sword | Slowest (~1.2s) | Longest | Endgame meta, hits before enemies can close |
| Gauntlets | Fast | Very short | Brawler niche, high stun values |

In top-down 2D, express range as a hit arc: a dagger gets a narrow short cone, a colossal sword a long wide sweep. The range advantage has to be visible on screen or the class distinction disappears.

## 9.2 Armour Weight Classes

| Class | Ore Cost | Trade-off |
|---|---|---|
| Light | 3-9 | No speed penalty, minimal HP bonus, dash-reliant |
| Medium | 10-25 | Balanced protection and mobility |
| Heavy | 30+ | Large HP and damage reduction, slight speed penalty |

Armour weight should pair naturally with weapon class to produce recognisable builds: light plus dagger, heavy plus colossal.

## 9.3 Example Equipment Appearance

Appearance is derived from ore, not hand-authored per item. A craft dominated by a volcanic ore produces dark metal with glowing cracks; an ice-tier ore produces frosted plating with drifting particles. Hand-author the *rules*, not the items.

# 10. Potions

Coins from quests and enemies can be spent on temporary potions.

## Strength Potion

Temporarily increases damage.

## Protection Potion

Temporarily increases defence.

## Fortune Potion

Increases material drop chances.

## Haste Potion

Improves forging speed.

## Forgemaster Potion

Slightly improves potential forging quality.

## Luck Potion

Increases the chance of rare drops.

Potions should be useful without replacing good equipment or making difficult content trivial.

---

# 11. Spells

Players can apply spells to weapons and armour.

## Weapon Spells

### Flame

Gives attacks a chance to burn enemies.

### Storm

Gives attacks a chance to trigger chain lightning.

### Frost

Slows enemies.

### Void

Deals additional damage to weakened enemies.

### Wind

Increases attack speed.

## Armour Spells

### Fortify

Increases defence.

### Vitality

Increases health.

### Inferno

Damages enemies near the player.

### Ice Shield

Occasionally blocks incoming damage.

Spells provide build variety and allow players to customise their equipment.

---

# 12. Runecrafting

Players can visit a dedicated **Rune Crafter**.

Rune Fragments can be obtained from:

- Normal enemies
- Elite enemies
- Bosses
- Hidden areas
- Quests

Example progression:

> 3 Ember Fragments → Fire Rune

> Fire Rune + 5 Ember Fragments → Greater Fire Rune

> Greater Fire Rune + Rare Boss Material → Infernal Rune

Runes provide another long-term progression system outside standard equipment.

---

# 13. Quest System

Quests should vary to prevent repetitive gameplay.

## Combat Quests

> Defeat 15 Dark Wolves.

## Gathering Quests

> Collect 30 Iron Ore.

## Forging Quests

> Forge a weapon with at least 80% quality.

## Exploration Quests

> Find a hidden cave.

## Boss Quests

> Defeat the Forest Guardian.

## Challenge Quests

> Defeat 10 enemies without taking damage.

## NPC Quests

> Deliver a forged sword to another blacksmith.

Quest rewards can include:

- Coins
- Materials
- Rune Fragments
- Potions
- Forge Tokens
- Equipment
- Cosmetics

---

# 14. Economy

**Gold is the primary currency.** The original draft's three currencies should be simplified -- the reference game runs almost entirely on Gold.

## Where Gold Comes From

The main income source is **selling forged items**. This matters: it makes the forging minigame the player's job rather than just a gear step. A player who forges Perfect items earns substantially more per ore than one who forges Good items.

Secondary income comes from enemy drops and quest rewards.

## Where Gold Goes

- Pickaxe upgrades, the single most important early purchase
- Potions and lanterns
- Enhancement, raising a kept item's stats
- Rune installation fees
- Quest gates -- a major questline should demand escalating Gold plus rare gems as a deliberate mid-game wall

## Gems

Rare gem drops from mining (topaz, diamond, emerald, ruby equivalents) replace the draft's Forge Tokens and Crystals. They gate quest chains and high-end crafting, which keeps every currency tied back to the mine.

## Premium Layer

Keep it convenience and cosmetic: luck totems, extra storage, race rerolls, cosmetic pickaxes. Nothing that sells raw combat stats.

# 15. World Design

The reference game is built from **discrete worlds, each with its own cave**, reached through a portal tool and gated by player **level** rather than purely by boss kills.

## Structure of a World

Every world contains:

- A surface hub with NPCs: quest-giver, pickaxe vendor, potion vendor, Runemaker, Enhancer
- A main cave with multiple depth floors
- A hostile sub-biome deeper in, the "hard zone" of that world
- At least one secret area behind a key or a quest chain
- A boss arena

## Gating

Use **level plus quest chain** as the primary gate, with the boss as the narrative capstone:

| World | Gate |
|---|---|
| World 1 | Start |
| World 2 | Level 10 and main quest chain complete |
| World 3 | Level 70 and portal access |
| Later worlds | Escalating level and gem or Gold walls |

Level gating is what makes the mine matter. Boss-only gating lets a skilled player skip the economic loop entirely, which hollows out the game.

## Mapping the Draft's Eight Areas

Eight areas is more than the reference game shipped with and more than a small team can build well. Recommended approach: **ship three worlds polished, then add the rest as live updates** -- which is exactly how the reference game grew.

- **World 1 - The Greenwood.** Safe hub, tutorial mine, early ore tiers.
- **World 2 - The Ancient Kingdom, with the Molten Depths as its deep sub-biome.** Merging these gives a ruined gothic surface with a volcanic hard zone below, matching the reference structure.
- **World 3 - Frostpeak Mountains.** An ice cave plus a high-altitude peak zone carrying the mythic ore nodes.
- **Later updates** - Whispering Woods, Scorched Wastes, Voidlands, Forge of Eternity.

Whispering Woods and Greenwood are too similar to justify two separate worlds. Merge them, or defer Whispering Woods to an update.

> **Change from the original draft:** the strictly linear eight-area chain becomes a hub-and-portal world model with level gates and a staged release plan. Sections 16-23 remain valid as *content* designs; only their ordering and gating change.

# 16. Area 1 — The Greenwood

The starting region should feel like a traditional fantasy wilderness.

## Environment

- Dense forests
- Open grassy fields
- Rivers and streams
- Waterfalls
- Dirt paths
- Wooden bridges
- Small caves
- Wooden watchtowers
- Farming villages
- Abandoned campsites
- Ancient stone ruins

## Main Landmark

### The Old Blacksmith's Village

The player's first major settlement and introduction to forging.

## Boss

### The Ancient Grove Guardian

The boss arena is a massive ancient tree with roots forming a natural battlefield.

## Main Materials

- Iron Ore
- Greenwood Timber
- Wolf Hide
- Ancient Bark

---

# 17. Area 2 — The Whispering Woods

A deeper and more dangerous forest.

## Environment

- Giant trees
- Massive roots
- Fog-covered paths
- Deep ravines
- Rope bridges
- Abandoned cabins
- Underground tunnels
- Overgrown ruins
- Giant mushrooms
- Underground lakes
- Ancient stone statues

## Main Landmark

### The Abandoned Village

A settlement once inhabited by legendary blacksmiths.

## Boss

### The Rootbound Guardian

A giant creature that controls the roots around the battlefield.

## New Difficulty Mechanics

- Enemy blocking
- Ambushes
- More coordinated enemy groups

---

# 18. Area 3 — The Molten Depths

A massive underground volcanic region.

## Environment

- Giant underground caverns
- Lava rivers
- Lava waterfalls
- Volcanoes
- Crumbling bridges
- Mining tunnels
- Massive mines
- Magma pits
- Ancient dwarven structures
- Giant crystals
- Collapsed mineshafts
- Forging stations built into the rock

## Main Landmark

### The Great Mine

A huge mining complex containing rare resources.

## Boss

### The Infernal King

A multi-phase boss fought inside a giant volcanic chamber.

## New Difficulty Mechanics

- Heat hazards
- Lava hazards
- Elemental enemy attacks

---

# 19. Area 4 — Frostpeak Mountains

A massive snowy mountain range.

## Environment

- Huge mountains
- Snow-covered forests
- Ice caves
- Glaciers
- Frozen waterfalls
- Frozen lakes
- Mountain villages
- Abandoned mines
- Rope bridges
- Ice tunnels
- Ancient mountain temples
- Snow-covered cliffs

## Main Landmark

### The Summit Fortress

A giant fortress built into the mountain.

## Boss

### The Frostbound Warlord

The battle takes place at the mountain summit during a powerful snowstorm.

## New Difficulty Mechanics

- Freezing hazards
- Slowing attacks
- Ranged enemies

---

# 20. Area 5 — The Scorched Wastes

A huge desert containing the remains of an ancient civilisation.

## Environment

- Massive sand dunes
- Rocky canyons
- Oases
- Desert villages
- Ancient pyramids
- Buried temples
- Sandstone ruins
- Underground tombs
- Giant statues
- Desert caves
- Buried cities
- Ancient underground libraries

## Main Landmark

### The Lost City

A massive buried civilisation that players gradually uncover.

## Boss

### The Sand Emperor

Fought inside an enormous underground temple.

## New Difficulty Mechanics

- Buried locations
- Hidden entrances
- Underground exploration
- Shielded enemies

---

# 21. Area 6 — The Ancient Kingdom

The remains of a once-great civilisation.

## Environment

- Ruined castles
- Destroyed cities
- Ancient roads
- Giant statues
- Collapsed towers
- Cathedrals
- Crypts
- Royal gardens
- Castle walls
- Underground passages
- Abandoned royal buildings

## Main Landmark

### The Fallen Capital

The largest ruined city encountered so far.

## Boss

### The Fallen King

Fought inside the ruined castle's throne room.

## New Difficulty Mechanics

- Powerful magical enemies
- Stronger enemy abilities
- More complex enemy groups

---

# 22. Area 7 — The Voidlands

Reality begins to break apart.

## Environment

- Floating islands
- Floating mountains
- Giant portals
- Magical bridges
- Floating ruins
- Void cracks
- Strange forests
- Floating waterfalls
- Floating castles
- Giant crystals
- Broken pieces of the previous world

## Main Landmark

### The Rift

A gigantic portal leading deeper into the Void.

## Boss

### The Void Sovereign

Fought on a floating island surrounded by endless darkness.

## New Difficulty Mechanics

- Teleportation
- Gravity changes
- Reality-changing environmental mechanics

---

# 23. Area 8 — The Forge of Eternity

The final main area.

Instead of being another natural environment, this region is a gigantic ancient forge built inside a mountain.

## Environment

- Massive underground forge
- Giant furnaces
- Rivers of molten metal
- Huge anvils
- Ancient workshops
- Blacksmith quarters
- Giant machines
- Mechanical structures
- Massive chains and gears
- Ancient weapon vaults
- Giant forging chambers
- Bridges over molten metal

Ancient weapons and armour can be seen being forged throughout the environment.

## Main Landmark

# The Eternal Forge

The legendary forge created by the first Forger.

## Final Boss

# The First Forger

The legendary being responsible for creating the world's most powerful weapons.

The final battle should use multiple phases and combine mechanics learned throughout the game.

---

# 24. Boss System

Every major area ends with a major boss.

Bosses should have multiple phases instead of simply having enormous health bars.

A typical boss might have:

## Phase 1
Basic attack pattern.

## Phase 2
New attacks and summoned enemies.

## Phase 3
The arena changes.

## Phase 4
The boss becomes enraged and gains its strongest attacks.

Bosses should test player skill, equipment and knowledge of combat mechanics.

---

# 25. Boss Power Requirements

The best equipment from an area should make its boss realistically manageable, but the game should not literally prevent under-equipped players from trying.

Example:

> Recommended Power: 1,000

A player with 1,000 power is properly equipped.

A player with 900 power can potentially win through excellent combat skills.

A player with 700 power is heavily disadvantaged.

This preserves intended progression while allowing skilled players to challenge themselves.

---

# 26. Difficulty Progression

Difficulty should increase through new mechanics rather than simply multiplying enemy health.

## Area 1
Basic enemies.

## Area 2
Blocking and ambushes.

## Area 3
Elemental attacks and environmental hazards.

## Area 4
Ranged attacks and slowing effects.

## Area 5
Shields and special enemy abilities.

## Area 6
Magical enemies and coordinated groups.

## Area 7
Teleportation, gravity and unusual mechanics.

## Area 8
Enemies combining several mechanics.

Enemy health and damage should still increase, but new mechanics should be the main source of increasing difficulty.

---

# 27. Powerups

Powerups can occasionally appear during combat and exploration.

## Health

Restores health.

## Berserk

Temporarily increases damage.

## Barrier

Absorbs several attacks.

## Inferno

The player's next attacks deal additional elemental damage.

## Gold Rush

Enemies temporarily drop additional coins.

## Forge Frenzy

The next forging attempt receives larger Perfect zones.

Powerups should be uncommon so that they support gameplay without trivialising difficult encounters.

---

# 28. Death System

Death should matter without making players lose hours of progress.

When the player dies:

- They respawn at the nearest checkpoint.
- Temporary buffs are removed.
- A small amount of coins is lost.
- Equipment is kept.
- Materials are kept.
- Quest progress is kept.

This gives death consequences while avoiding excessive frustration.

---

# 29. Player Forge

Eventually, players can unlock their own personal forge.

Players can customise:

- Forge appearance
- Furnace
- Anvil
- Weapon displays
- Decorations
- Storage
- Blacksmith NPCs

Higher-level forges can unlock additional crafting functionality.

The player forge should primarily be a progression and customisation feature rather than a mandatory source of power.

---

# 30. Exploration System

Exploration should be a major part of the game.

Every area should contain hidden locations.

Examples:

### Greenwood
Hidden treehouse

### Whispering Woods
Forgotten shrine

### Molten Depths
Secret crystal cavern

### Frostpeak
Hidden mountain monastery

### Scorched Wastes
Buried tomb

### Ancient Kingdom
Lost royal library

### Voidlands
Unstable dimension

Hidden locations can contain:

- Rare materials
- Secret quests
- Unique enemies
- Hidden bosses
- Rare recipes
- Runes
- Lore
- Cosmetics
- Treasure

The player should have reasons to explore rather than simply following the main path.

---

# 31. Rare Drops

Rarity tiers apply to **ore and gem drops from mining nodes** first, and to enemy drops second. Enemies should drop runes, essence, gems and Gold -- not crafting ore. See Appendix A6.

Ore and enemy drops both use these tiers.

## Common

- Iron Ore
- Leather

## Uncommon

- Steel Fragment

## Rare

- Ancient Core

## Epic

- Boss Crystal

## Legendary

- Mythic Material

The rarest materials should sometimes be used to create unique equipment rather than simply creating a stronger version of existing gear.

---

# 32. Achievements

Achievements provide optional goals and titles.

Examples:

### First Forge
Forge your first item.

### Blacksmith
Forge 100 items.

### Master Forger
Forge a 100% quality item.

### Kingslayer
Defeat your first area boss.

### Collector
Obtain every material in an area.

### Untouchable
Defeat a boss without taking damage.

Achievement rewards can include:

- Titles
- Cosmetics
- Small amounts of currency
- Visual effects

Achievements should not be required for progression.

---

# 33. Hub World

The central hub acts as the player's home between adventures.

It contains:

- Blacksmith
- Alchemist
- Rune Crafter
- Enchanter
- Merchant
- Quest Board
- Storage
- Area Gates
- Player Forge

The hub should visually grow as the player progresses.

New buildings, NPCs and services can become available after completing areas.

---

# 34. Visual Direction

The game's art should consistently follow a **detailed 16-bit fantasy pixel-art style**.

It should not be overly simplistic.

## Characters

Players and enemies should use relatively small but detailed sprites.

Equipment should visibly change the player's appearance.

Characters should have:

- Walking animations
- Attack animations
- Dodge animations
- Hit reactions
- Equipment-specific visuals
- Pixelated shadows

## Weapons

Weapons should be recognisable by their silhouettes.

Each major weapon should have its own:

- Shape
- Materials
- Animation
- Effects
- Colour palette
- Visual identity

## Environments

Every area should contain detailed environmental objects rather than being a flat landscape.

Examples include:

- Trees
- Rocks
- Rivers
- Caves
- Mountains
- Ruins
- Bridges
- Buildings
- Statues
- Waterfalls
- Lava
- Snow
- Ancient structures
- Hidden paths

---

# 35. Pixel-Art Effects

The game should use animated pixel effects for:

- Fire
- Smoke
- Water
- Lava
- Lightning
- Snow
- Sparks
- Magic
- Weapon trails
- Enemy attacks
- Boss abilities

The effects should remain visually consistent with the pixel-art style.

---

# 36. Forge Visual Effects

The forging system should be one of the most visually impressive parts of the game.

During heating:

> The metal changes from dark grey → red → orange → yellow.

During hammering:

> Sparks fly from every strike.

A Perfect Hit produces a larger burst of sparks and a stronger impact effect.

During the pour:

> Molten metal streams into the mould, glowing brightly and casting light on the surrounding scene.

On completion:

> The item is quenched and produces a large pixelated burst of steam. Quenching is now a cinematic payoff rather than a scored stage.

After forging:

> The completed weapon appears on the anvil.

A high-quality item receives a stronger visual presentation.

A Masterwork item receives a special glow or effect.

---

# 37. Lighting

Lighting should use pixel-art-inspired dynamic lighting.

Examples:

- Torches illuminate nearby areas.
- Lava illuminates underground caverns.
- Fire weapons cast warm light.
- Magical weapons illuminate their surroundings.
- Dark areas become more atmospheric.

This is especially useful in caves, ruins and the Voidlands.

---

# 38. User Interface

The UI should match the game's 16-bit fantasy aesthetic.

Use:

- Pixel-art borders
- Pixel-style fonts
- Dark panels
- Clear icons
- Item rarity indicators
- Simple animations
- Clean menus

The UI should be readable and functional without covering too much of the game world.

Major systems should include:

- Inventory
- Equipment
- Forge
- Quests
- Map
- Spells
- Runes
- Achievements
- Player statistics

---

# 39. Progression Philosophy

The game should avoid allowing players to immediately skip several progression tiers.

The intended path is:

> Area Gear → Area Exploration → Area Upgrades → Area Boss → Next Area

However, skilled players should have some flexibility.

For example, a player may fight a boss slightly below the recommended power level if they are very good at combat.

The game should reward skill without destroying the progression structure.

---

# 40. Replayability

After defeating the final boss, the game should continue through an endgame system.

## New Game+

The player can restart the progression with stronger enemies and new equipment tiers.

Example:

> Infernal Sword  
> ↓  
> Corrupted Infernal Sword  
> ↓  
> Ancient Infernal Sword  
> ↓  
> Celestial Infernal Sword

New Game+ can introduce:

- Stronger enemies
- New materials
- New recipes
- New runes
- Boss variations
- New Masterwork possibilities
- New challenges

---

# 41. Complete World Progression

```text
                         🏘️ HUB
                           │
                           ↓
                    🌳 GREENWOOD
                           │
                     AREA BOSS
                           ↓
                 🌲 WHISPERING WOODS
                           │
                     AREA BOSS
                           ↓
                  🌋 MOLTEN DEPTHS
                           │
                     AREA BOSS
                           ↓
                  ❄️ FROSTPEAK
                           │
                     AREA BOSS
                           ↓
                  🏜️ SCORCHED WASTES
                           │
                     AREA BOSS
                           ↓
                  🏛️ ANCIENT KINGDOM
                           │
                     AREA BOSS
                           ↓
                    🌌 VOIDLANDS
                           │
                     AREA BOSS
                           ↓
                ⚒️ FORGE OF ETERNITY
                           │
                     FINAL BOSS
                           ↓
                       ENDGAME
                    /            \
               NEW GAME+     MASTERWORKS
```

---

# 42. The Intended Player Experience

The game should constantly create short-term goals that contribute to larger goals.

The player should experience a progression like:

> "I need one more material."

Then:

> "I finally have enough materials."

Then:

> "Now I need to forge the weapon."

Then:

> "I got 91% quality."

Then:

> "I want to try again and get Masterwork."

Then:

> "Now I have the equipment I need."

Then:

> "I can finally challenge the boss."

Then:

> "I defeated the boss."

Then:

> "What's waiting in the next area?"

This loop should continue throughout the entire game.

---

# 43. Core Identity

The Forge should revolve around three interconnected skills:

## ⚔️ COMBAT

Learn enemy attacks, dodge, block, parry and use abilities effectively.

## 🔨 FORGING

Collect materials and use skill-based timing mechanics to create powerful equipment.

## 🧭 EXPLORATION

Search areas for hidden locations, rare materials, quests, lore and secrets.

These systems continuously feed into one another:

> **Combat → Materials → Forging → Equipment → Exploration → Harder Combat**

The result should be a Roblox RPG where the player is not simply grinding enemies for bigger numbers. The player is becoming a better **warrior, explorer and forger**.

---

# 44. Final Game Structure

The complete game is built around:

### COMBAT
Skill-based battles with different enemy roles.

### EXPLORATION
Large, detailed regions containing landmarks, secrets and hidden areas.

### FORGING
A multi-stage timing minigame that determines equipment quality.

### EQUIPMENT
Weapons and armour that visibly change the player and become stronger throughout progression.

### QUESTS
A variety of objectives that reward coins, materials and progression items.

### POTIONS
Temporary buffs that support different playstyles.

### SPELLS
Equipment customisation through elemental and magical effects.

### RUNES
A secondary progression system built around Rune Fragments and crafted runes.

### BOSSES
Multi-phase battles that mark the end of each major area.

### PROGRESSION
A long journey through eight increasingly dangerous regions.

### ENDGAME
Masterwork hunting, rare equipment and New Game+.

---

# 45. Core Gameplay Formula

The final formula for **The Forge** is:

> **FIGHT** enemies to obtain materials  
> ↓  
> **EXPLORE** the world to discover rare resources and secrets  
> ↓  
> **QUEST** for coins and additional rewards  
> ↓  
> **FORGE** weapons and armour through skill-based minigames  
> ↓  
> **CUSTOMISE** equipment with spells and runes  
> ↓  
> **UPGRADE** your character  
> ↓  
> **CHALLENGE** stronger enemies  
> ↓  
> **DEFEAT** the area's boss  
> ↓  
> **UNLOCK** the next region  
> ↓  
> **REPEAT** until reaching the Eternal Forge  
> ↓  
> **DEFEAT THE FIRST FORGER**  
> ↓  
> **ENTER THE ENDGAME**

---

# Appendix A - Systems Added to Match *The Forge*

These systems are absent from the original draft but load-bearing in the reference game.

## A1. Levels and XP

There is no level system anywhere in the original document, yet the reference game gates worlds on level (10 for World 2, 70 for World 3).

- XP comes from mining nodes, killing mobs, completing quests and forging
- Level gates world access and some vendor stock
- Level should **not** directly grant combat stats. Gear and race do that. Level is a pacing tool

## A2. Races

Race is the reference game's headline meta-progression: a permanent stat modifier obtained by RNG reroll, not a cosmetic choice.

- All players start as the baseline common race
- Rerolls come from Spins, earned through progression, promo codes or purchase
- Seven rarity tiers, Common through Relic, with the power gap widening sharply at the top
- Passives should span distinct axes: luck, mining damage, forge quality, move speed, attack speed, lifesteal, max HP, damage reduction
- Deliberately include an **economy race** with mining and forge-quality bonuses, so non-combat players have something to chase

Design warning: the reference game has no pity system, so some players reroll badly for a very long time. Either add soft pity, or make Epic-tier races comfortably sufficient for all content so the top tiers are aspirational rather than required.

## A3. Pickaxes and Mine Power

The pickaxe is the player's most important tool and the primary early Gold sink.

- Every rock has hidden health; Mine Power is damage per swing
- An under-powered pickaxe wastes enormous time, which is the intended pressure to upgrade
- Pickaxe tiers track world progression and are sold by a dedicated vendor
- Pickaxes accept their own rune type, affecting mining speed or ore yield
- Rare pickaxes exist as secret rewards behind multi-step quest chains

## A4. Mine Design for Top-Down 2D

- **Node types:** pebbles, rocks, boulders, veins, crystals, with rising health and drop rarity
- **Lighting:** caves are dark and lanterns reveal valuable nodes. In 2D this is a radial light mask, with valuable nodes only rendering inside it. This is one of the strongest atmosphere tools available in top-down pixel art and should be a centrepiece, not an afterthought
- **Depth floors:** each floor is a separate map connected by shafts, with better ore and worse enemies
- **Hazards:** magma floors that damage on contact, collapsing ground, dead ends
- **Density:** deeper and secret caves should have visibly higher node density. Density is the reward for surviving down there

## A5. Enhancement and Runes

Two separate upgrade paths for items worth keeping.

- **Enhancement:** a Gold and material cost to raise a specific item's stats incrementally, handled by a dedicated Enhancer NPC
- **Runes:** slotted modifiers dropped by enemies, installed by a Runemaker NPC for a fee. Once installed, removal should be impossible or expensive -- that commitment is what makes a rune drop exciting
- Include a lifesteal rune as the most desirable drop, because it solves potion dependency in the hard zones; plus elemental damage runes and pickaxe-only runes

## A6. Enemies as Mine Hazards

Rework the draft's enemy roster around the mine rather than around open-field battles.

- **Grunt:** slow and heavily telegraphed, teaches spacing
- **Rogue:** fast lunging enemy the player cannot outrun, forcing a dash-through or a stand-and-fight
- **Bomber:** carries explosives and must not be fought in melee. Hit and retreat, or let it detonate
- **Elite variants:** roughly 3x health and 2x damage with an armoured silhouette, and crucially they **guard rich ore veins**. Elites standing between the player and the good nodes is the key design idea the original draft is missing
- **Splitters and regenerators:** resistant to physical damage, weak to a specific element, creating real demand for elemental trait ores
- **Zone boss:** a high-damage elite in the deepest sub-biome that can kill a light-armour player in two hits, dropping rare runes and essence

The draft's Healer role is worth keeping -- it is a good idea the reference game doesn't use.

## A7. Live Service

The reference game is still in beta and grew through constant updates. Plan for that from the start.

- Seasonal events with event NPCs and event currency
- Promo codes granting Spins and Luck Potions
- Public update logs and a community server
- Twelve-player servers: small enough to feel social, large enough not to feel empty
- Ship one world polished rather than eight worlds thin

---

# Appendix B - What Was Deliberately Kept

These parts of the original draft diverge from the reference game but are worth keeping.

- **The 2D top-down pixel-art direction.** This differentiates the project instead of competing head-on with a 3D game that already has the audience
- **Multi-phase bosses.** The reference game is comparatively light on boss design; yours is a genuine improvement
- **The quest variety list**, particularly forging quests, challenge quests and no-damage quests
- **The player forge customisation system**
- **Achievements and New Game+**
- **The Healer enemy role**

Everything in Appendix A is table stakes for matching the reference game. Everything in Appendix B is upside on top of it.

---

# Appendix C - Build Order

A realistic order of implementation for a small team.

1. Top-down movement, camera, and a single cave map
2. Mining: nodes with health, pickaxe Mine Power, stamina, ore inventory
3. The four-stage forging minigame with two ore types
4. Ore-combination logic: class by weight, multiplier and traits by identity
5. Selling and the Gold loop
6. Combat: light, heavy, dash with i-frames, block with stamina
7. Two enemy types, one of them guarding a rich vein
8. Lantern lighting and a second, deeper cave floor
9. Levels, XP, and a quest chain gating World 2
10. Runes and Enhancement
11. Races
12. First boss

Steps 1 through 5 are the vertical slice. If that loop is not fun on its own, no amount of content in Sections 16-23 will save it.
