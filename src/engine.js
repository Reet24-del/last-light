// ============================================
// LAST LIGHT - SAMURAI VS DARK DEMONS ENGINE
// A June Solstice Survival Arena
// ============================================

export const GAME_CONSTANTS = {
  CANVAS_WIDTH: 700,
  CANVAS_HEIGHT: 500,
  FPS: 60,
  // Spirit energy (replaces solar)
  SPIRIT_DRAIN_RATE: 0.04,
  SPIRIT_RECHARGE_RATE: 0.35,
  // Katana slash cost
  SLASH_COST_BASE: 4,
  PLAYER_RADIUS: 12,
  BULLET_RADIUS: 5,
  BULLET_SPEED: 12,
  IFRAMES: 45,
  // Combo system
  COMBO_DECAY_TIME: 3000, // ms before combo resets
  COMBO_MULTIPLIER_MAX: 5,
  // Obstacle conquest
  OBSTACLE_CONQUER_TIME: 2500, // ms to conquer an obstacle
};

// Demon types - each with unique behavior
export const ENEMY_TYPES = {
  // Shade: basic demon, slow but relentless
  SHADE: { speed: 1.2, hp: 3, color: '#8b00ff', score: 15, r: 13, name: 'Shade', behavior: 'chase' },
  // Wraith: fast, flanks the player
  WRAITH: { speed: 2.5, hp: 2, color: '#00ccff', score: 20, r: 9, name: 'Wraith', behavior: 'flank' },
  // Oni: tanky, charges in bursts
  ONI: { speed: 1.0, hp: 6, color: '#ff3300', score: 35, r: 16, name: 'Oni', behavior: 'charge' },
  // Yurei: teleports near player periodically
  YUREI: { speed: 0.8, hp: 4, color: '#33ff99', score: 30, r: 11, name: 'Yurei', behavior: 'teleport' },
  // Jorogumo: splits into smaller demons on death
  JOROGUMO: { speed: 1.3, hp: 5, color: '#ff00aa', score: 25, r: 15, name: 'Jorogumo', behavior: 'split' },
  // Demon Lord: final boss
  DEMON_LORD: { speed: 0.7, hp: 120, color: '#ff0033', score: 1000, r: 45, name: 'Demon Lord', behavior: 'boss' },
};

// Wave progression - tells a story of the samurai's journey through the night
export const WAVES = [
  { hour: '18:00', title: 'Twilight Falls', text: 'The first shadows stir beyond the gate.', enemies: ['SHADE'], count: 4, duration: 28000 },
  { hour: '19:00', title: 'Gathering Dark', text: 'More demons sense your spirit energy.', enemies: ['SHADE'], count: 6, duration: 28000 },
  { hour: '20:00', title: 'Swift Shadows', text: 'Wraiths emerge from the void.', enemies: ['SHADE', 'WRAITH'], count: 7, duration: 30000 },
  { hour: '21:00', title: 'The Walls Rise', text: 'CURSED BARRIERS MATERIALIZE.', enemies: ['WRAITH'], count: 8, duration: 30000, hasObstacles: true },
  { hour: '22:00', title: 'Oni Awakening', text: 'The brutes charge through the maze.', enemies: ['WRAITH', 'ONI'], count: 9, duration: 30000, hasObstacles: true },
  { hour: '23:00', title: 'Witching Hour', text: 'Spirits phase through reality.', enemies: ['ONI', 'YUREI'], count: 9, duration: 30000, hasObstacles: true, isSpades: true },
  { hour: '00:00', title: 'Midnight', text: 'DEMONIC LASERS IGNITE.', enemies: ['YUREI', 'JOROGUMO'], count: 10, duration: 32000, hasObstacles: true, hasLasers: true },
  { hour: '01:00', title: 'Darkest Hour', text: 'They split and multiply.', enemies: ['WRAITH', 'JOROGUMO'], count: 10, duration: 32000, hasObstacles: true, hasLasers: true },
  { hour: '02:00', title: 'Blood Moon', text: 'All demons converge.', enemies: ['ONI', 'YUREI', 'JOROGUMO'], count: 11, duration: 32000, hasObstacles: true, hasLasers: true, isSpades: true },
  { hour: '03:00', title: 'Spirit Fading', text: 'SANCTUARIES BECOME UNSTABLE.', enemies: ['WRAITH', 'ONI', 'YUREI'], count: 12, duration: 35000, hasObstacles: true, hasLasers: true },
  { hour: '04:00', title: 'Final Trial', text: 'Survive until dawn breaks.', enemies: ['ONI', 'YUREI', 'JOROGUMO'], count: 13, duration: 35000, hasObstacles: true, hasLasers: true, isSpades: true },
  { hour: '05:00', title: 'The Demon Lord', text: 'THE LAST SHADOW DESCENDS.', enemies: ['DEMON_LORD'], count: 1, duration: 999999, hasLasers: true, isSpades: true },
];

// Obstacles that can be conquered by standing near them
export function getObstacles(waveIndex) {
  const wave = WAVES[waveIndex];
  if (!wave.hasObstacles) return [];
  
  // Obstacles are cursed barriers - samurai can conquer them by standing near
  const baseObstacles = [
    { x: 130, y: 130, w: 20, h: 180, color: 'rgba(139, 0, 255, 0.5)', conquered: false, conquerProgress: 0, id: 'obs1' },
    { x: 550, y: 190, w: 20, h: 180, color: 'rgba(139, 0, 255, 0.5)', conquered: false, conquerProgress: 0, id: 'obs2' },
    { x: 230, y: 90, w: 180, h: 18, color: 'rgba(139, 0, 255, 0.5)', conquered: false, conquerProgress: 0, id: 'obs3' },
    { x: 290, y: 390, w: 180, h: 18, color: 'rgba(139, 0, 255, 0.5)', conquered: false, conquerProgress: 0, id: 'obs4' },
  ];
  
  // Later waves add more obstacles
  if (waveIndex >= 7) {
    baseObstacles.push(
      { x: 340, y: 220, w: 20, h: 80, color: 'rgba(139, 0, 255, 0.5)', conquered: false, conquerProgress: 0, id: 'obs5' }
    );
  }
  
  return baseObstacles;
}

export function getLasers(waveIndex) {
  const wave = WAVES[waveIndex];
  if (!wave.hasLasers) return [];
  
  const speed = waveIndex >= 8 ? 0.018 : 0.012;
  const isBoss = waveIndex === 11;
  
  if (isBoss) {
    return [
      { x: GAME_CONSTANTS.CANVAS_WIDTH/2, y: GAME_CONSTANTS.CANVAS_HEIGHT/2, length: 500, angle: 0, angularVelocity: 0.008, color: '#ff0033' },
      { x: GAME_CONSTANTS.CANVAS_WIDTH/2, y: GAME_CONSTANTS.CANVAS_HEIGHT/2, length: 500, angle: Math.PI/2, angularVelocity: -0.008, color: '#ff0033' },
      { x: GAME_CONSTANTS.CANVAS_WIDTH/2, y: GAME_CONSTANTS.CANVAS_HEIGHT/2, length: 500, angle: Math.PI, angularVelocity: 0.012, color: '#8b00ff' },
      { x: GAME_CONSTANTS.CANVAS_WIDTH/2, y: GAME_CONSTANTS.CANVAS_HEIGHT/2, length: 500, angle: Math.PI*1.5, angularVelocity: -0.012, color: '#8b00ff' }
    ];
  }
  
  return [
    { x: 60, y: 60, length: 280, angle: 0, angularVelocity: speed, color: '#ff0033' },
    { x: GAME_CONSTANTS.CANVAS_WIDTH - 60, y: GAME_CONSTANTS.CANVAS_HEIGHT - 60, length: 280, angle: Math.PI, angularVelocity: -speed, color: '#ff0033' }
  ];
}

// Spirit sanctuaries (safe zones where spirit recharges)
export function getSanctuaries(waveIndex) {
  const count = Math.max(1, 4 - Math.floor(waveIndex / 3));
  const radius = Math.max(30, 80 - waveIndex * 5);
  
  const zones = [];
  if (count === 1) {
    zones.push({ x: GAME_CONSTANTS.CANVAS_WIDTH / 2, y: GAME_CONSTANTS.CANVAS_HEIGHT / 2, r: radius, vx: 0, vy: 0 });
  } else {
    const pad = 140;
    const positions = [
      { x: pad, y: pad },
      { x: GAME_CONSTANTS.CANVAS_WIDTH - pad, y: pad },
      { x: pad, y: GAME_CONSTANTS.CANVAS_HEIGHT - pad },
      { x: GAME_CONSTANTS.CANVAS_WIDTH - pad, y: GAME_CONSTANTS.CANVAS_HEIGHT - pad },
    ];
    for (let i = 0; i < count; i++) {
      const move = waveIndex >= 9;
      zones.push({ 
        x: positions[i].x, 
        y: positions[i].y, 
        r: radius, 
        vx: move ? (Math.random() - 0.5) * 1.8 : 0, 
        vy: move ? (Math.random() - 0.5) * 1.8 : 0 
      });
    }
  }
  return zones;
}

// --- REWARD / PENALTY SYSTEM ---
export const REWARD_PENALTIES = {
  // Rewards
  KILL_BASE: 10,
  COMBO_BONUS: 5, // per combo level
  CONQUER_OBSTACLE: 50,
  WAVE_CLEAR_BONUS: 100,
  NO_DAMAGE_BONUS: 200,
  SANCTUARY_TIME_BONUS: 0.5, // score per frame in sanctuary
  PERFECT_DECRYPT: 75,
  
  // Penalties
  DAMAGE_TAKEN: -30,
  MISSED_SHOT_PENALTY: -2,
  SPIRIT_EMPTY_PENALTY: -5, // per second at 0 spirit
  DECRYPT_FAIL_PENALTY: -50,
  DECRYPT_FAIL_HP: 1, // lose 1 HP on failed decryption
};

export function calculateKillReward(enemyScore, comboLevel) {
  const comboMultiplier = 1 + (comboLevel * 0.3);
  return Math.floor(enemyScore * comboMultiplier);
}

// --- UTILITY FUNCTIONS ---

export function distance(x1, y1, x2, y2) {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

export function checkCollision(circle1, circle2) {
  return distance(circle1.x, circle1.y, circle2.x, circle2.y) < (circle1.r + circle2.r);
}

export function rectCircleCollision(circle, rect) {
  let testX = circle.x;
  let testY = circle.y;
  
  if (circle.x < rect.x) testX = rect.x;
  else if (circle.x > rect.x + rect.w) testX = rect.x + rect.w;
  
  if (circle.y < rect.y) testY = rect.y;
  else if (circle.y > rect.y + rect.h) testY = rect.y + rect.h;
  
  const distX = circle.x - testX;
  const distY = circle.y - testY;
  const distanceSq = (distX*distX) + (distY*distY);
  
  return distanceSq <= circle.r * circle.r;
}

export function lineCircleCollision(circle, lineX, lineY, length, angle) {
  const x2 = lineX + Math.cos(angle) * length;
  const y2 = lineY + Math.sin(angle) * length;
  
  const lineLen = distance(lineX, lineY, x2, y2);
  if (lineLen === 0) return distance(circle.x, circle.y, lineX, lineY) <= circle.r;
  
  const dot = ( ((circle.x-lineX)*(x2-lineX)) + ((circle.y-lineY)*(y2-lineY)) ) / Math.pow(lineLen,2);
  const closestX = lineX + (dot * (x2-lineX));
  const closestY = lineY + (dot * (y2-lineY));
  
  if (dot < 0 || dot > 1) return false;
  
  return distance(closestX, closestY, circle.x, circle.y) <= circle.r;
}

export function spawnEnemy(waveIndex) {
  const wave = WAVES[waveIndex];
  const typeKey = wave.enemies[Math.floor(Math.random() * wave.enemies.length)];
  const type = ENEMY_TYPES[typeKey];
  
  const edge = Math.floor(Math.random() * 4);
  let x, y;
  if (edge === 0) { x = Math.random() * GAME_CONSTANTS.CANVAS_WIDTH; y = -type.r - 20; }
  else if (edge === 1) { x = GAME_CONSTANTS.CANVAS_WIDTH + type.r + 20; y = Math.random() * GAME_CONSTANTS.CANVAS_HEIGHT; }
  else if (edge === 2) { x = Math.random() * GAME_CONSTANTS.CANVAS_WIDTH; y = GAME_CONSTANTS.CANVAS_HEIGHT + type.r + 20; }
  else { x = -type.r - 20; y = Math.random() * GAME_CONSTANTS.CANVAS_HEIGHT; }
  
  return {
    ...type,
    x, y,
    id: Math.random().toString(36).substr(2, 9),
    type: typeKey,
    // Behavior state
    chargeTimer: 0,
    isCharging: false,
    chargeAngle: 0,
    teleportCooldown: 0,
    flankOffset: (Math.random() - 0.5) * Math.PI,
  };
}

// Sky darkening as night progresses
export function getSkyColor(waveIndex) {
  const colors = [
    'rgba(80, 20, 40, 0.2)',   // 18:00 - Twilight
    'rgba(60, 15, 35, 0.25)',  // 19:00
    'rgba(40, 10, 30, 0.3)',   // 20:00
    'rgba(30, 5, 25, 0.35)',   // 21:00
    'rgba(20, 0, 20, 0.4)',    // 22:00
    'rgba(15, 0, 15, 0.45)',   // 23:00
    'rgba(10, 0, 10, 0.5)',    // 00:00 Midnight
    'rgba(5, 0, 8, 0.55)',     // 01:00
    'rgba(60, 0, 0, 0.5)',     // 02:00 Blood Moon
    'rgba(5, 0, 5, 0.6)',      // 03:00
    'rgba(10, 0, 15, 0.55)',   // 04:00
    'rgba(80, 0, 20, 0.6)',    // 05:00 Demon Lord
  ];
  return colors[Math.min(11, waveIndex)] || 'rgba(10, 0, 10, 0.5)';
}
