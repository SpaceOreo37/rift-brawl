# Rift Brawl (v1)

2D pixel-art platform fighter for 2 local players (or vs CPU). Knock your opponent off the
floating island — the higher their damage %, the farther they fly. 3 stocks each.

**Play:** open `index.html` in a browser. No install or build step.

## Controls

|                     | Player 1 | Player 2          |
|---------------------|----------|-------------------|
| Move / Jump (x2)    | A D / W  | ← → / ↑           |
| Fast-fall / drop    | S        | ↓                 |
| Attack              | F        | K  (or Numpad 1)  |
| Skill 1             | G        | L  (or Numpad 2)  |
| Skill 2             | H        | ;  (or Numpad 3)  |
| Ultimate            | T        | O  (or Numpad 0)  |

Hold Up or Down while attacking for an up attack, a low sweep, or a downward air spike. Dash and
teleport skills aim with your movement keys. Esc pauses, M mutes.

## Fighters

| Fighter | Style | Skill 1 | Skill 2 | Ultimate |
|---|---|---|---|---|
| **Blaze** | fire brawler | Fireball (burn) | Blaze Rush (8-way dash) | Inferno Burst |
| **Volt** | lightning ninja, 3 jumps | Zap Dash (teleport strike) | Chain Bolt (stun beam) | Thunderstorm |
| **Frosta** | ice witch, floaty | Ice Shards (slow) | Glacier Wall (block + platform) | Absolute Zero (freeze) |
| **Bramble** | heavy golem | Vine Lash (pull / grapple) | Thorn Seed (trap) | Wildgrowth |
| **Nyx** | void trickster | Gravity Orb (pull + burst) | Shadow Step (warp behind) | Event Horizon (black hole) |

## Code map

- `js/characters.js` — all 5 fighters: palettes, stats, moves, abilities, AI hints, pixel "look"
- `js/fighter.js` — physics, combat state, procedural sprite renderer
- `js/entities.js` — projectiles, explosions, walls, black hole, particles
- `js/game.js` — fight rules, HUD, menus, main loop
- `js/stage.js` — arena collision + procedurally painted background

Dev URL hooks: `index.html?demo=blaze,nyx` (CPU vs CPU), `&ff=600` (fast-forward frames).
