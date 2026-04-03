🔥 ICEBREAKER – BALLS OF FIRE
V1 DEVELOPMENT ROADMAP (EXECUTION READY)
🧭 0. PRODUCT SUMMARY (PIN THIS IN CURSOR)

Game Type: Grid-based puzzle (hybrid puzzle + execution)
Platform: Mobile web (portrait, ThreeJS)
Core Loop:

Drag → move fireball across grid
Ice melts after leaving tiles
Cannot revisit tiles
Must clear all ice and reach exit

Core Constraints:

Grid-locked movement
Cardinal directions only
Instant restart on fail
Puzzle-first, speed-second
🧱 1. TECH STACK DECISIONS
Rendering
ThreeJS
Orthographic camera (top-down)
Structure
Vanilla JS (keep it simple for V1)
Modules (ES6 imports)
Hosting
GitHub Pages
📁 2. PROJECT STRUCTURE (SET THIS UP FIRST)
/src
  /core
    Game.js
    GameState.js

  /grid
    GridManager.js
    Tile.js
    TileTypes.js

  /player
    PlayerController.js

  /input
    InputHandler.js

  /levels
    level1.json
    level2.json
    level3.json

  /rendering
    SceneManager.js

  /utils
    helpers.js

main.js
index.html
style.css
🟩 3. MILESTONE 1 — CORE PROTOTYPE
🎯 Goal:

Playable single level with full core loop

✅ Tasks
3.1 Grid System
Create 2D array grid
Load from JSON

Example:

[
  ["S", "I", "I"],
  ["W", "I", "E"]
]

Legend:

S = Start
I = Ice
W = Wall
E = Exit
3.2 Tile System

Each tile should track:

{
  type: "ICE",
  state: "solid" | "melting" | "gone"
}
3.3 Player Movement

Core Rules:

Moves tile → tile
Direction from drag
Snaps to N/E/S/W
Cannot move into:
walls
gone tiles
3.4 Input Handling
Track pointer/touch
Calculate drag vector
Determine dominant axis:
if (Math.abs(dx) > Math.abs(dy)) → horizontal
else → vertical
3.5 Ice Melting Logic

When player leaves tile:

Start delay (~250ms)
Then set tile → gone
3.6 Fail Condition

If player steps onto:

state === gone

→ instant restart

3.7 Win Condition

Check:

All ICE tiles visited
Player reaches EXIT
✅ Done When:
You can play 1 level start → finish → restart
🟨 4. MILESTONE 2 — MOVEMENT FEEL
🎯 Goal:

Make movement feel GOOD

Add:
4.1 Movement Interpolation
Smooth movement between tiles
Not instant teleport
4.2 Input Buffering
Queue next direction
Prevent missed turns
4.3 Visual Feedback
Slight squash/stretch on movement
Fire glow (emissive material)
✅ Done When:
Movement feels responsive and predictable
🟧 5. MILESTONE 3 — GAME STRUCTURE
🎯 Goal:

Multiple levels + basic UI

Add:
5.1 Level Loader
Load JSON levels dynamically
5.2 Game States
PLAYING
WIN
FAIL
5.3 UI (Minimal)
Restart button
Level complete overlay
✅ Done When:
Player can complete level → move to next
🟥 6. MILESTONE 4 — LEVEL DESIGN
🎯 Goal:

3 polished levels

Level Plan:
Level 1 — Tutorial
Small grid
Teaches:
movement
melting
Level 2 — Constraint
Introduce:
walls
forced routing
Level 3 — Real Puzzle
Tight path
Requires planning ahead
✅ Done When:
Players “get it” by Level 2
🟪 7. MILESTONE 5 — JUICE
🎯 Goal:

Make it satisfying

Add:
Visuals
Fire trail particles
Melt animation (shrink/fade tile)
Screen shake (fail)
Audio
Move tick
Ice crack
Success chime
✅ Done When:
Game feels alive, not static
🟦 8. MILESTONE 6 — SCORING + POLISH
🎯 Goal:

Retention layer

Add:
Timer
Starts on first move
Star Rating
Based on completion time
Level Select
Unlock next level on win
Mobile Polish
Touch responsiveness
Portrait layout
Prevent scroll/zoom
✅ Done When:
Game feels “complete”
🧠 9. CORE SYSTEM DESIGN (IMPORTANT)
🧩 GridManager (central system)

Responsibilities:

Store grid
Query tiles
Check win condition
🔥 PlayerController

Responsibilities:

Handle movement
Track current tile
Trigger tile effects
🧊 Tile Logic

Each tile:

Handles its own state transitions
Emits events:
onEnter
onLeave
🎮 Game Manager

Controls:

state transitions
restart
level progression
⚠️ 10. RISKS (READ THIS)
Biggest Risk:

❌ Movement feels “off”

Fix:

prioritize input smoothing early
Second Risk:

❌ Puzzles feel unfair

Fix:

playtest constantly (even 3 levels)
Third Risk:

❌ Mobile input jank

Fix:

lock scroll
test on real phone early
🚀 11. WHAT TO BUILD FIRST (VERY IMPORTANT)

DO THIS ORDER:

Grid rendering (no player)
Player snapping movement
Tile detection
Ice melting
Fail condition
Win condition

👉 DO NOT jump to UI early

🧪 12. DEFINITION OF V1 DONE
3 playable levels
Smooth grid movement
Ice melt mechanic feels good
Instant restart
Timer + stars
Mobile playable in browser
🔥 FINAL DEV NOTE (IMPORTANT)

Keep asking during dev:

“Is the player thinking, or just reacting?”

If they’re not thinking:
→ puzzle design is weak

If they’re only thinking:
→ add pressure later (V2)