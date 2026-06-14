# Last Light: A June Solstice Survival Arena

**Last Light** is an intense, top-down survival arena shooter built for the June Solstice Game Jam. It features dynamic mechanics inspired by *Alice in Borderland*, where the arena itself evolves to become your greatest enemy as the hours pass. 

## The Theme: Light, Darkness, and the Solstice
As the June Solstice arrives, the game explores the balance between light and darkness. You must constantly seek the golden "Light Zones" to recharge your solar weapon while fending off creatures of the dark. As the 12-hour cycle progresses, the darkness encroaches, and the arena becomes progressively more hostile.

## The Mechanics
* **Solar Weaponry:** Your weapon drains Solar Energy instead of ammo. You must stand in golden light zones to recharge.
* **Map Evolution:** Over the course of 12 hours (waves), the arena evolves:
  * **09:00:** Massive neon walls rise from the ground, creating an impenetrable maze.
  * **12:00:** Lethal rotating lasers activate.
  * **15:00:** Safe light zones begin moving erratically around the maze.
* **Alan Turing Decryption (Bonus Prize):** In honor of Alan Turing, certain pivotal waves will trigger a Spades minigame. Time freezes, and you must decrypt an 8-bit binary tape into a decimal number to break the code and survive.

## Technologies Used
* **React:** UI Shell, HUD, state management, and Turing minigame overlays.
* **HTML5 Canvas:** Pure `requestAnimationFrame` game loop for rendering geometry, particles, lasers, and collisions.
* **Vite:** High-performance build tool and dev server.
* **Vanilla CSS:** Premium glassmorphism UI, CRT scanlines, and glowing typography.
* **Google AI Image Generation:** Generated the hyper-realistic, top-down futuristic neon Tokyo street used as the arena background.

## How to Play Locally

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Reet24-del/last-light.git
   cd last-light
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:5173`.

## Controls
* **WASD / Arrow Keys:** Move
* **Mouse:** Aim
* **Left Click / Spacebar:** Shoot
