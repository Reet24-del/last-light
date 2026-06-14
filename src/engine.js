export const GAME_CONSTANTS = {
  CANVAS_WIDTH: 700,
  CANVAS_HEIGHT: 500,
  FPS: 60,
  SOLAR_DRAIN_RATE: 0.05,
  SOLAR_RECHARGE_RATE: 0.3,
  SHOT_COST_BASE: 3,
  PLAYER_RADIUS: 10,
  BULLET_RADIUS: 4,
  BULLET_SPEED: 10,
  IFRAMES: 60,
};

export const ENEMY_TYPES = {
  CRAWLER: { speed: 1.0, hp: 2, color: 'purple', score: 10, r: 12 },
  RUNNER: { speed: 2.2, hp: 1, color: '#00d0ff', score: 15, r: 8 },
  HUNTER: { speed: 1.6, hp: 4, color: '#00ff33', score: 25, r: 10 },
  SPLITTER: { speed: 1.3, hp: 3, color: '#ff2a00', score: 20, r: 14 },
  BOSS: { speed: 0.9, hp: 80, color: '#ff0055', score: 500, r: 40 },
};

export const WAVES = [
  { hour: '06:00', title: 'Dawn', text: 'They stir. The arena is calm.', enemies: ['CRAWLER'], count: 3, duration: 30000 },
  { hour: '07:00', title: 'Morning', text: 'More arrive.', enemies: ['CRAWLER'], count: 5, duration: 30000 },
  { hour: '08:00', title: 'Early Light', text: 'Faster ones emerge.', enemies: ['CRAWLER', 'RUNNER'], count: 6, duration: 30000 },
  { hour: '09:00', title: 'Morning Sun', text: 'THE WALLS RISE.', enemies: ['RUNNER'], count: 7, duration: 30000 },
  { hour: '10:00', title: 'Mid-Morning', text: 'Hunters navigate the maze.', enemies: ['RUNNER', 'HUNTER'], count: 8, duration: 30000 },
  { hour: '11:00', title: 'Late Morning', text: 'The light is fading.', enemies: ['HUNTER'], count: 9, duration: 30000 },
  { hour: '12:00', title: 'Noon', text: 'LETHAL LASERS ONLINE.', enemies: ['HUNTER', 'SPLITTER'], count: 10, duration: 30000, isSpades: true },
  { hour: '13:00', title: 'Afternoon', text: 'Split when shot.', enemies: ['RUNNER', 'SPLITTER'], count: 10, duration: 30000 },
  { hour: '14:00', title: 'Mid-Afternoon', text: 'Lasers spinning faster.', enemies: ['HUNTER', 'SPLITTER'], count: 11, duration: 30000 },
  { hour: '15:00', title: 'Late Afternoon', text: 'LIGHT ZONES UNSTABLE.', enemies: ['RUNNER', 'HUNTER', 'SPLITTER'], count: 12, duration: 30000 },
  { hour: '16:00', title: 'Dusk', text: 'Chase the light to survive.', enemies: ['HUNTER', 'SPLITTER'], count: 13, duration: 30000, isSpades: true },
  { hour: '17:00', title: 'Sundown', text: 'THE FINAL SHADOW.', enemies: ['BOSS'], count: 1, duration: 999999, isSpades: true },
];

export function getObstacles(waveIndex) {
  if (waveIndex < 3 || waveIndex === 11) return []; // Walls rise at 09:00, retract at Boss
  return [
    { x: 150, y: 150, w: 20, h: 200, color: 'rgba(0, 255, 255, 0.4)' },
    { x: 530, y: 150, w: 20, h: 200, color: 'rgba(0, 255, 255, 0.4)' },
    { x: 250, y: 100, w: 200, h: 20, color: 'rgba(0, 255, 255, 0.4)' },
    { x: 250, y: 380, w: 200, h: 20, color: 'rgba(0, 255, 255, 0.4)' }
  ];
}

export function getLasers(waveIndex) {
  if (waveIndex < 6) return []; // Lasers active at 12:00
  const speed = waveIndex >= 8 ? 0.02 : 0.01;
  const isBoss = waveIndex === 11;
  if (isBoss) {
    // Boss controls 4 slow sweeping lasers from center
    return [
      { x: GAME_CONSTANTS.CANVAS_WIDTH/2, y: GAME_CONSTANTS.CANVAS_HEIGHT/2, length: 500, angle: 0, angularVelocity: 0.01, color: '#ff0055' },
      { x: GAME_CONSTANTS.CANVAS_WIDTH/2, y: GAME_CONSTANTS.CANVAS_HEIGHT/2, length: 500, angle: Math.PI/2, angularVelocity: 0.01, color: '#ff0055' },
      { x: GAME_CONSTANTS.CANVAS_WIDTH/2, y: GAME_CONSTANTS.CANVAS_HEIGHT/2, length: 500, angle: Math.PI, angularVelocity: 0.01, color: '#ff0055' },
      { x: GAME_CONSTANTS.CANVAS_WIDTH/2, y: GAME_CONSTANTS.CANVAS_HEIGHT/2, length: 500, angle: Math.PI*1.5, angularVelocity: 0.01, color: '#ff0055' }
    ];
  }
  return [
    { x: 50, y: 50, length: 300, angle: 0, angularVelocity: speed, color: '#ff0055' },
    { x: GAME_CONSTANTS.CANVAS_WIDTH - 50, y: GAME_CONSTANTS.CANVAS_HEIGHT - 50, length: 300, angle: Math.PI, angularVelocity: speed, color: '#ff0055' }
  ];
}

export function getLightZones(waveIndex) {
  const count = Math.max(1, 4 - Math.floor(waveIndex / 4));
  const radius = Math.max(35, 90 - waveIndex * 6);
  
  const zones = [];
  if (count === 1) {
    zones.push({ x: GAME_CONSTANTS.CANVAS_WIDTH / 2, y: GAME_CONSTANTS.CANVAS_HEIGHT / 2, r: radius, vx: 0, vy: 0 });
  } else {
    const pad = 150;
    const positions = [
      { x: pad, y: pad },
      { x: GAME_CONSTANTS.CANVAS_WIDTH - pad, y: pad },
      { x: pad, y: GAME_CONSTANTS.CANVAS_HEIGHT - pad },
      { x: GAME_CONSTANTS.CANVAS_WIDTH - pad, y: GAME_CONSTANTS.CANVAS_HEIGHT - pad },
    ];
    for (let i = 0; i < count; i++) {
      // If wave >= 9 (15:00), zones move slowly
      const move = waveIndex >= 9;
      zones.push({ 
        x: positions[i].x, 
        y: positions[i].y, 
        r: radius, 
        vx: move ? (Math.random() - 0.5) * 2 : 0, 
        vy: move ? (Math.random() - 0.5) * 2 : 0 
      });
    }
  }
  return zones;
}

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
  if (edge === 0) { x = Math.random() * GAME_CONSTANTS.CANVAS_WIDTH; y = -type.r; }
  else if (edge === 1) { x = GAME_CONSTANTS.CANVAS_WIDTH + type.r; y = Math.random() * GAME_CONSTANTS.CANVAS_HEIGHT; }
  else if (edge === 2) { x = Math.random() * GAME_CONSTANTS.CANVAS_WIDTH; y = GAME_CONSTANTS.CANVAS_HEIGHT + type.r; }
  else { x = -type.r; y = Math.random() * GAME_CONSTANTS.CANVAS_HEIGHT; }
  
  return {
    ...type,
    x, y,
    id: Math.random().toString(36).substr(2, 9),
    type: typeKey
  };
}

export function getSkyColor(waveIndex) {
  const colors = [
    'rgba(232, 134, 39, 0.2)', 'rgba(240, 160, 48, 0.2)', 'rgba(245, 184, 56, 0.2)', 
    'rgba(248, 204, 64, 0.2)', 'rgba(245, 200, 66, 0.2)', 'rgba(245, 200, 66, 0.2)', 
    'rgba(232, 170, 53, 0.3)', 'rgba(219, 139, 40, 0.4)', 'rgba(207, 109, 27, 0.5)', 
    'rgba(194, 78, 14, 0.6)', 'rgba(181, 47, 0, 0.7)', 'rgba(128, 16, 0, 0.8)'
  ];
  return colors[Math.min(11, waveIndex)] || 'rgba(245, 200, 66, 0.2)';
}
