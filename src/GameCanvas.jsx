import React, { useEffect, useRef } from 'react';
import { GAME_CONSTANTS, ENEMY_TYPES, WAVES, getLightZones, getObstacles, getLasers, rectCircleCollision, lineCircleCollision, distance, checkCollision, spawnEnemy, getSkyColor } from './engine';

export default function GameCanvas({ 
  waveIndex, 
  onWaveComplete, 
  onGameOver, 
  onVictory,
  setHudState,
  isTuringActive
}) {
  const canvasRef = useRef(null);
  const bgImageRef = useRef(null);
  
  useEffect(() => {
    const img = new Image();
    img.src = '/arena_bg.png';
    img.onload = () => { bgImageRef.current = img; };
  }, []);

  const stateRef = useRef({
    player: { x: GAME_CONSTANTS.CANVAS_WIDTH / 2, y: GAME_CONSTANTS.CANVAS_HEIGHT / 2, hp: 5, r: GAME_CONSTANTS.PLAYER_RADIUS, iframes: 0, solar: 100, trails: [] },
    bullets: [],
    enemies: [],
    particles: [],
    embers: [], // ambient floating embers
    shockwaves: [], // ring shockwaves on kills
    lightZones: getLightZones(waveIndex),
    obstacles: getObstacles(waveIndex),
    lasers: getLasers(waveIndex),
    score: 0,
    timeInWave: 0,
    announcing: true,
    lastFireTime: 0,
    spawnTimer: 0,
    waveData: WAVES[waveIndex],
    enemiesSpawned: 0,
    screenShake: 0,
    hitFlash: 0, // white flash overlay on damage
    muzzleFlashes: [], // muzzle flash effects
  });

  const keysRef = useRef({});
  const mouseRef = useRef({ x: 0, y: 0, isDown: false });

  // Update map features when wave changes
  useEffect(() => {
    const wave = WAVES[waveIndex];
    stateRef.current.waveData = wave;
    stateRef.current.lightZones = getLightZones(waveIndex);
    stateRef.current.obstacles = getObstacles(waveIndex);
    stateRef.current.lasers = getLasers(waveIndex);
    stateRef.current.timeInWave = 0;
    stateRef.current.announcing = true;
    stateRef.current.enemiesSpawned = 0;
    stateRef.current.bullets = [];
    stateRef.current.particles = [];
    stateRef.current.embers = [];
    stateRef.current.shockwaves = [];
    stateRef.current.muzzleFlashes = [];
    stateRef.current.player.hp = Math.min(5, stateRef.current.player.hp + 1);
    stateRef.current.player.trails = [];
    
    const tid = setTimeout(() => {
      stateRef.current.announcing = false;
    }, 3000);
    return () => clearTimeout(tid);
  }, [waveIndex]);

  // Main game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: false });
    let animationFrameId;
    let lastTime = performance.now();

    // --- ENHANCED DRAWING HELPERS ---

    const drawPolygon = (ctx, x, y, radius, sides, angleOffset, color, time) => {
      // Outer glow layer
      ctx.beginPath();
      for (let i = 0; i < sides; i++) {
        const a = angleOffset + (i * 2 * Math.PI) / sides;
        const px = x + (radius + 3) * Math.cos(a);
        const py = y + (radius + 3) * Math.sin(a);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.shadowColor = color;
      ctx.shadowBlur = 20;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Main body
      ctx.beginPath();
      for (let i = 0; i < sides; i++) {
        const a = angleOffset + (i * 2 * Math.PI) / sides;
        const px = x + radius * Math.cos(a);
        const py = y + radius * Math.sin(a);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      
      // Dark fill with inner gradient
      const innerGrad = ctx.createRadialGradient(x, y, 0, x, y, radius);
      innerGrad.addColorStop(0, color);
      innerGrad.addColorStop(0.3, 'rgba(0,0,0,0.7)');
      innerGrad.addColorStop(1, 'rgba(0,0,0,0.9)');
      ctx.fillStyle = innerGrad;
      ctx.fill();
      
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = color;
      ctx.shadowBlur = 15;
      ctx.stroke();
      ctx.shadowBlur = 0;
    };

    const drawShockwave = (ctx, sw) => {
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.strokeStyle = sw.color;
      ctx.lineWidth = Math.max(0.5, 3 * sw.life);
      ctx.globalAlpha = sw.life * 0.6;
      ctx.shadowColor = sw.color;
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    };

    const drawMuzzleFlash = (ctx, mf) => {
      const grad = ctx.createRadialGradient(mf.x, mf.y, 0, mf.x, mf.y, mf.size * mf.life);
      grad.addColorStop(0, `rgba(255, 255, 255, ${mf.life})`);
      grad.addColorStop(0.3, `rgba(255, 207, 51, ${mf.life * 0.8})`);
      grad.addColorStop(1, `rgba(255, 115, 0, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(mf.x, mf.y, mf.size * mf.life, 0, Math.PI * 2);
      ctx.fill();
    };

    const drawPlayer = (ctx, player, time, mouseRef) => {
      const angle = Math.atan2(mouseRef.current.y - player.y, mouseRef.current.x - player.x);
      const pulse = Math.sin(time / 300) * 2;
      
      // Outer energy aura
      const auraGrad = ctx.createRadialGradient(player.x, player.y, player.r - 2, player.x, player.y, player.r + 12 + pulse);
      auraGrad.addColorStop(0, 'rgba(255, 207, 51, 0.3)');
      auraGrad.addColorStop(0.5, 'rgba(255, 207, 51, 0.1)');
      auraGrad.addColorStop(1, 'rgba(255, 207, 51, 0)');
      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.r + 12 + pulse, 0, Math.PI * 2);
      ctx.fill();

      // Rotating ring
      ctx.strokeStyle = 'rgba(255, 207, 51, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.r + 6, time / 500, Math.PI * 1.5 + time / 500);
      ctx.stroke();
      ctx.setLineDash([]);

      // Main body glow
      ctx.shadowColor = '#ffcf33';
      ctx.shadowBlur = 20;
      
      // Player body - bright core
      const bodyGrad = ctx.createRadialGradient(player.x - 2, player.y - 2, 0, player.x, player.y, player.r);
      bodyGrad.addColorStop(0, '#ffffff');
      bodyGrad.addColorStop(0.4, '#ffe066');
      bodyGrad.addColorStop(0.8, '#ffcf33');
      bodyGrad.addColorStop(1, 'rgba(255, 207, 51, 0.6)');
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Gun barrel with glow
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.shadowColor = '#ffcf33';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(player.x + Math.cos(angle) * 6, player.y + Math.sin(angle) * 6);
      ctx.lineTo(player.x + Math.cos(angle) * 22, player.y + Math.sin(angle) * 22);
      ctx.stroke();
      
      // Gun tip glow
      const tipX = player.x + Math.cos(angle) * 22;
      const tipY = player.y + Math.sin(angle) * 22;
      const tipGrad = ctx.createRadialGradient(tipX, tipY, 0, tipX, tipY, 5);
      tipGrad.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
      tipGrad.addColorStop(1, 'rgba(255, 207, 51, 0)');
      ctx.fillStyle = tipGrad;
      ctx.beginPath();
      ctx.arc(tipX, tipY, 5, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.shadowBlur = 0;
    };

    const drawEnhancedLightZone = (ctx, zone, time) => {
      const pulse = Math.sin(time / 400) * 8;
      const r = zone.r + pulse;
      
      // Multiple layered glows
      for (let layer = 3; layer >= 0; layer--) {
        const layerR = r + layer * 15;
        const alpha = 0.15 - layer * 0.03;
        const zoneGrad = ctx.createRadialGradient(zone.x, zone.y, 0, zone.x, zone.y, layerR);
        zoneGrad.addColorStop(0, `rgba(255, 207, 51, ${alpha + 0.1})`);
        zoneGrad.addColorStop(0.4, `rgba(255, 207, 51, ${alpha})`);
        zoneGrad.addColorStop(1, 'rgba(255, 207, 51, 0)');
        ctx.fillStyle = zoneGrad;
        ctx.beginPath();
        ctx.arc(zone.x, zone.y, layerR, 0, Math.PI * 2);
        ctx.fill();
      }

      // Animated rotating rays
      ctx.save();
      ctx.translate(zone.x, zone.y);
      ctx.rotate(time / 2000);
      const rayCount = 8;
      for (let i = 0; i < rayCount; i++) {
        const rayAngle = (i / rayCount) * Math.PI * 2;
        const rayLength = r * 0.8;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(rayAngle) * rayLength, Math.sin(rayAngle) * rayLength);
        ctx.strokeStyle = `rgba(255, 207, 51, ${0.15 + Math.sin(time / 300 + i) * 0.1})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.restore();

      // Dashed border ring
      ctx.strokeStyle = 'rgba(255, 207, 51, 0.9)';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 4]);
      ctx.shadowColor = '#ffcf33';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(zone.x, zone.y, zone.r, time / 800, Math.PI * 2 + time / 800);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;

      // Floating light particles inside zone
      for (let i = 0; i < 5; i++) {
        const px = zone.x + Math.cos(time / 1000 + i * 1.3) * (zone.r * 0.6);
        const py = zone.y + Math.sin(time / 800 + i * 1.7) * (zone.r * 0.6);
        const pSize = 1.5 + Math.sin(time / 500 + i) * 0.8;
        ctx.fillStyle = `rgba(255, 240, 150, ${0.5 + Math.sin(time / 400 + i) * 0.3})`;
        ctx.beginPath();
        ctx.arc(px, py, pSize, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const drawEnhancedObstacle = (ctx, obs, time) => {
      // Dark fill
      ctx.fillStyle = 'rgba(0, 30, 60, 0.9)';
      ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
      
      // Inner grid pattern
      ctx.strokeStyle = 'rgba(0, 255, 255, 0.08)';
      ctx.lineWidth = 0.5;
      const gridSize = 10;
      for (let gx = obs.x; gx < obs.x + obs.w; gx += gridSize) {
        ctx.beginPath();
        ctx.moveTo(gx, obs.y);
        ctx.lineTo(gx, obs.y + obs.h);
        ctx.stroke();
      }
      for (let gy = obs.y; gy < obs.y + obs.h; gy += gridSize) {
        ctx.beginPath();
        ctx.moveTo(obs.x, gy);
        ctx.lineTo(obs.x + obs.w, gy);
        ctx.stroke();
      }

      // Animated neon border with electric pulse
      const pulseOffset = (time / 200) % (obs.w * 2 + obs.h * 2);
      ctx.strokeStyle = 'rgba(0, 255, 255, 0.9)';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#00ffff';
      ctx.shadowBlur = 15;
      ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
      
      // Corner glow points
      const corners = [
        [obs.x, obs.y], [obs.x + obs.w, obs.y],
        [obs.x, obs.y + obs.h], [obs.x + obs.w, obs.y + obs.h]
      ];
      for (let [cx, cy] of corners) {
        const cGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 8);
        cGrad.addColorStop(0, 'rgba(0, 255, 255, 0.8)');
        cGrad.addColorStop(1, 'rgba(0, 255, 255, 0)');
        ctx.fillStyle = cGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, 8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
    };

    const drawEnhancedLaser = (ctx, l, time) => {
      const endX = l.x + Math.cos(l.angle) * l.length;
      const endY = l.y + Math.sin(l.angle) * l.length;
      
      // Wide outer glow
      ctx.beginPath();
      ctx.moveTo(l.x, l.y);
      ctx.lineTo(endX, endY);
      ctx.strokeStyle = l.color;
      ctx.lineWidth = 12;
      ctx.globalAlpha = 0.15;
      ctx.shadowColor = l.color;
      ctx.shadowBlur = 30;
      ctx.stroke();
      ctx.globalAlpha = 1;
      
      // Medium glow
      ctx.beginPath();
      ctx.moveTo(l.x, l.y);
      ctx.lineTo(endX, endY);
      ctx.strokeStyle = l.color;
      ctx.lineWidth = 6;
      ctx.globalAlpha = 0.4;
      ctx.shadowBlur = 20;
      ctx.stroke();
      ctx.globalAlpha = 1;
      
      // Core beam
      ctx.beginPath();
      ctx.moveTo(l.x, l.y);
      ctx.lineTo(endX, endY);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.shadowColor = l.color;
      ctx.shadowBlur = 15;
      ctx.stroke();
      ctx.shadowBlur = 0;
      
      // Animated dash overlay
      ctx.setLineDash([8, 12]);
      ctx.lineDashOffset = -time / 50;
      ctx.beginPath();
      ctx.moveTo(l.x, l.y);
      ctx.lineTo(endX, endY);
      ctx.strokeStyle = l.color;
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.7;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;
      
      // Laser base with rotating ring
      const baseGrad = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, 12);
      baseGrad.addColorStop(0, '#fff');
      baseGrad.addColorStop(0.5, l.color);
      baseGrad.addColorStop(1, 'rgba(255,0,85,0)');
      ctx.fillStyle = baseGrad;
      ctx.beginPath();
      ctx.arc(l.x, l.y, 12, 0, Math.PI * 2);
      ctx.fill();
      
      // Spinning ring around base
      ctx.strokeStyle = l.color;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.arc(l.x, l.y, 16, time / 300, Math.PI + time / 300);
      ctx.stroke();
      ctx.setLineDash([]);
    };

    const drawEnhancedBullet = (ctx, b, time) => {
      // Comet tail
      const tailLength = 15;
      const tailGrad = ctx.createLinearGradient(
        b.x - Math.cos(b.angle) * tailLength, b.y - Math.sin(b.angle) * tailLength,
        b.x, b.y
      );
      tailGrad.addColorStop(0, 'rgba(255, 207, 51, 0)');
      tailGrad.addColorStop(0.5, 'rgba(255, 207, 51, 0.4)');
      tailGrad.addColorStop(1, 'rgba(255, 255, 255, 0.9)');
      
      ctx.beginPath();
      ctx.moveTo(b.x - Math.cos(b.angle) * tailLength, b.y - Math.sin(b.angle) * tailLength);
      ctx.lineTo(b.x + Math.cos(b.angle) * 4, b.y + Math.sin(b.angle) * 4);
      ctx.strokeStyle = tailGrad;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.stroke();
      
      // Bright core
      ctx.shadowColor = '#fff';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      
      // Outer glow
      const bGrad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, 8);
      bGrad.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
      bGrad.addColorStop(1, 'rgba(255, 207, 51, 0)');
      ctx.fillStyle = bGrad;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 8, 0, Math.PI * 2);
      ctx.fill();
    };

    const render = (time) => {
      const dt = time - lastTime;
      lastTime = time;

      if (isTuringActive) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      const state = stateRef.current;
      const { player, bullets, enemies, particles, lightZones, obstacles, lasers, waveData, embers, shockwaves, muzzleFlashes } = state;

      if (!state.announcing) {
        state.timeInWave += dt;
        
        // Update Light Zones (Moving)
        for (let zone of lightZones) {
           zone.x += zone.vx;
           zone.y += zone.vy;
           if (zone.x < zone.r || zone.x > GAME_CONSTANTS.CANVAS_WIDTH - zone.r) zone.vx *= -1;
           if (zone.y < zone.r || zone.y > GAME_CONSTANTS.CANVAS_HEIGHT - zone.r) zone.vy *= -1;
        }

        // Update Lasers
        for (let l of lasers) {
           l.angle += l.angularVelocity;
           if (player.iframes <= 0 && lineCircleCollision(player, l.x, l.y, l.length, l.angle)) {
              player.hp -= 1;
              player.iframes = GAME_CONSTANTS.IFRAMES;
              state.screenShake = 15;
              state.hitFlash = 1;
              if (player.hp <= 0) {
                 onGameOver(state.score, waveData.hour);
                 return;
              }
           }
        }
        
        // Movement
        let dx = 0; let dy = 0;
        if (keysRef.current['w'] || keysRef.current['ArrowUp']) dy -= 1;
        if (keysRef.current['s'] || keysRef.current['ArrowDown']) dy += 1;
        if (keysRef.current['a'] || keysRef.current['ArrowLeft']) dx -= 1;
        if (keysRef.current['d'] || keysRef.current['ArrowRight']) dx += 1;
        
        if (dx !== 0 || dy !== 0) {
          const length = Math.sqrt(dx * dx + dy * dy);
          dx /= length;
          dy /= length;
        }
        
        const prevX = player.x;
        const prevY = player.y;
        player.x += dx * 3.5;
        player.y += dy * 3.5;
        player.x = Math.max(player.r, Math.min(GAME_CONSTANTS.CANVAS_WIDTH - player.r, player.x));
        player.y = Math.max(player.r, Math.min(GAME_CONSTANTS.CANVAS_HEIGHT - player.r, player.y));

        for (let obs of obstacles) {
           if (rectCircleCollision(player, obs)) {
              player.x = prevX; player.y = prevY; break;
           }
        }

        // Player trail logic - enhanced with energy particles
        if (dx !== 0 || dy !== 0) {
          player.trails.push({ x: player.x, y: player.y, life: 1 });
          // Spawn energy trail particles
          if (Math.random() > 0.6) {
            particles.push({
              x: player.x + (Math.random() - 0.5) * 8,
              y: player.y + (Math.random() - 0.5) * 8,
              vx: -dx * 0.5 + (Math.random() - 0.5) * 0.5,
              vy: -dy * 0.5 + (Math.random() - 0.5) * 0.5,
              life: 0.6, color: '#ffcf33', size: 1 + Math.random()
            });
          }
        }
        for (let i = player.trails.length - 1; i >= 0; i--) {
          player.trails[i].life -= 0.08;
          if (player.trails[i].life <= 0) player.trails.splice(i, 1);
        }

        // Light & Solar
        let inLight = false;
        for (let zone of lightZones) {
          if (distance(player.x, player.y, zone.x, zone.y) < zone.r) {
            inLight = true; break;
          }
        }
        
        if (inLight) {
          player.solar = Math.min(100, player.solar + GAME_CONSTANTS.SOLAR_RECHARGE_RATE);
        } else {
          player.solar = Math.max(0, player.solar - GAME_CONSTANTS.SOLAR_DRAIN_RATE);
        }

        // Shooting
        if ((mouseRef.current.isDown || keysRef.current[' ']) && time - state.lastFireTime > 150) {
           const shotCost = GAME_CONSTANTS.SHOT_COST_BASE + (waveIndex * 0.5);
           if (player.solar >= shotCost) {
             player.solar -= shotCost;
             state.lastFireTime = time;
             const baseAngle = Math.atan2(mouseRef.current.y - player.y, mouseRef.current.x - player.x);
             
             const spawnX = player.x + Math.cos(baseAngle) * 22;
             const spawnY = player.y + Math.sin(baseAngle) * 22;
             
             bullets.push({
               x: spawnX, 
               y: spawnY,
               vx: Math.cos(baseAngle) * GAME_CONSTANTS.BULLET_SPEED,
               vy: Math.sin(baseAngle) * GAME_CONSTANTS.BULLET_SPEED,
               r: GAME_CONSTANTS.BULLET_RADIUS,
               angle: baseAngle
             });
             
             // Muzzle flash
             muzzleFlashes.push({
               x: spawnX, y: spawnY, life: 1, size: 15
             });
             
             state.screenShake = 2;
           }
        }

        // Bullets
        for (let i = bullets.length - 1; i >= 0; i--) {
          let b = bullets[i];
          b.x += b.vx; b.y += b.vy;
          
          let outOfBounds = (b.x < 0 || b.x > GAME_CONSTANTS.CANVAS_WIDTH || b.y < 0 || b.y > GAME_CONSTANTS.CANVAS_HEIGHT);
          
          let hitObstacle = false;
          for (let obs of obstacles) {
             if (rectCircleCollision(b, obs)) { hitObstacle = true; break; }
          }
          
          if (outOfBounds || hitObstacle) {
             // Impact sparks
             if (hitObstacle) {
               for (let p = 0; p < 6; p++) {
                 particles.push({
                   x: b.x, y: b.y,
                   vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6,
                   life: 0.8, color: '#00ffff', size: 1.5 + Math.random()
                 });
               }
             }
             bullets.splice(i, 1);
             continue;
          }

          // Bullet trail particles
          if (Math.random() > 0.4) {
            particles.push({
              x: b.x + (Math.random() - 0.5) * 3, 
              y: b.y + (Math.random() - 0.5) * 3,
              vx: -b.vx * 0.05 + (Math.random()-0.5) * 0.5, 
              vy: -b.vy * 0.05 + (Math.random()-0.5) * 0.5,
              life: 0.6, color: '#ffcf33', size: 1 + Math.random()
            });
          }
        }

        // Spawn
        state.spawnTimer += dt;
        const spawnInterval = waveData.count > 0 ? waveData.duration / waveData.count : 1000;
        if (state.spawnTimer > spawnInterval && state.enemiesSpawned < waveData.count) {
          const newEnemy = spawnEnemy(waveIndex);
          newEnemy.spawnTime = time; // for spawn animation
          enemies.push(newEnemy);
          state.spawnTimer = 0;
          state.enemiesSpawned++;
        }

        // Enemies
        for (let i = enemies.length - 1; i >= 0; i--) {
          let e = enemies[i];
          const angle = Math.atan2(player.y - e.y, player.x - e.x);
          
          const pEx = e.x; const pEy = e.y;
          e.x += Math.cos(angle) * e.speed;
          e.y += Math.sin(angle) * e.speed;
          e.angle = angle;
          
          for (let obs of obstacles) {
             if (rectCircleCollision(e, obs)) {
                e.x = pEx; e.y = pEy; break;
             }
          }

          let hit = false;
          for (let j = bullets.length - 1; j >= 0; j--) {
            let b = bullets[j];
            if (checkCollision({x: e.x, y: e.y, r: e.r}, {x: b.x, y: b.y, r: b.r})) {
              e.hp -= 1;
              e.hitTime = time; // for damage flash
              bullets.splice(j, 1);
              hit = true;
              
              // Enhanced hit particles
              for (let p = 0; p < 12; p++) {
                const pAngle = (p / 12) * Math.PI * 2;
                const speed = 3 + Math.random() * 5;
                particles.push({
                  x: e.x, y: e.y,
                  vx: Math.cos(pAngle) * speed + b.vx * 0.15, 
                  vy: Math.sin(pAngle) * speed + b.vy * 0.15,
                  life: 1, color: e.color, size: 2 + Math.random() * 2
                });
              }
              break;
            }
          }

          if (e.hp <= 0) {
            state.score += e.score;
            state.screenShake = e.type === 'BOSS' ? 25 : 8; 
            
            // Death explosion particles
            for (let p = 0; p < 30; p++) {
              const pAngle = (p / 30) * Math.PI * 2;
              const speed = 2 + Math.random() * 10;
              particles.push({
                x: e.x, y: e.y,
                vx: Math.cos(pAngle) * speed, 
                vy: Math.sin(pAngle) * speed,
                life: 1.5 + Math.random() * 0.5, color: e.color, size: 2 + Math.random() * 4
              });
            }
            // White core burst
            for (let p = 0; p < 8; p++) {
              particles.push({
                x: e.x + (Math.random() - 0.5) * 10, 
                y: e.y + (Math.random() - 0.5) * 10,
                vx: (Math.random() - 0.5) * 6, 
                vy: (Math.random() - 0.5) * 6,
                life: 0.8, color: '#ffffff', size: 3 + Math.random() * 2
              });
            }
            
            // Shockwave ring
            shockwaves.push({
              x: e.x, y: e.y, radius: 5, maxRadius: e.r * 4, life: 1, color: e.color
            });

            if (e.type === 'SPLITTER') {
               enemies.push({...ENEMY_TYPES['RUNNER'], x: e.x-15, y: e.y-15, hp: 1, r: 8, id: Math.random(), spawnTime: time});
               enemies.push({...ENEMY_TYPES['RUNNER'], x: e.x+15, y: e.y+15, hp: 1, r: 8, id: Math.random(), spawnTime: time});
            }
            if (e.type === 'BOSS') {
               // Massive boss death effect
               for (let p = 0; p < 60; p++) {
                 const pAngle = (p / 60) * Math.PI * 2;
                 const speed = 5 + Math.random() * 15;
                 particles.push({
                   x: e.x, y: e.y,
                   vx: Math.cos(pAngle) * speed, vy: Math.sin(pAngle) * speed,
                   life: 2 + Math.random(), color: p % 2 === 0 ? '#ff0055' : '#ffffff', size: 3 + Math.random() * 5
                 });
               }
               shockwaves.push({ x: e.x, y: e.y, radius: 10, maxRadius: 200, life: 1, color: '#ff0055' });
               shockwaves.push({ x: e.x, y: e.y, radius: 10, maxRadius: 150, life: 1, color: '#ffffff' });
               onVictory(state.score);
               return;
            }
            enemies.splice(i, 1);
            continue;
          }

          if (player.iframes <= 0 && checkCollision({x: player.x, y: player.y, r: player.r}, {x: e.x, y: e.y, r: e.r})) {
             player.hp -= 1;
             player.iframes = GAME_CONSTANTS.IFRAMES;
             state.screenShake = 15;
             state.hitFlash = 1;
             if (player.hp <= 0) {
                onGameOver(state.score, waveData.hour);
                return;
             }
          }
        }
        
        if (player.iframes > 0) player.iframes--;

        // Particles update
        for (let i = particles.length - 1; i >= 0; i--) {
          let p = particles[i];
          p.x += p.vx; p.y += p.vy;
          p.vx *= 0.96; p.vy *= 0.96; // friction
          p.life -= 0.03;
          if (p.life <= 0) particles.splice(i, 1);
        }

        // Shockwaves update
        for (let i = shockwaves.length - 1; i >= 0; i--) {
          let sw = shockwaves[i];
          sw.radius += (sw.maxRadius - sw.radius) * 0.1;
          sw.life -= 0.04;
          if (sw.life <= 0) shockwaves.splice(i, 1);
        }

        // Muzzle flashes update
        for (let i = muzzleFlashes.length - 1; i >= 0; i--) {
          muzzleFlashes[i].life -= 0.15;
          if (muzzleFlashes[i].life <= 0) muzzleFlashes.splice(i, 1);
        }

        // Hit flash decay
        if (state.hitFlash > 0) {
          state.hitFlash -= 0.08;
          if (state.hitFlash < 0) state.hitFlash = 0;
        }

        // Ambient embers
        if (Math.random() > 0.95) {
          embers.push({
            x: Math.random() * GAME_CONSTANTS.CANVAS_WIDTH,
            y: GAME_CONSTANTS.CANVAS_HEIGHT + 5,
            vx: (Math.random() - 0.5) * 0.5,
            vy: -(0.3 + Math.random() * 0.7),
            life: 2 + Math.random() * 2,
            size: 1 + Math.random() * 1.5,
            color: Math.random() > 0.5 ? '#ffcf33' : '#ff7300'
          });
        }
        for (let i = embers.length - 1; i >= 0; i--) {
          let e = embers[i];
          e.x += e.vx + Math.sin(time / 1000 + i) * 0.2;
          e.y += e.vy;
          e.life -= 0.01;
          if (e.life <= 0 || e.y < -10) embers.splice(i, 1);
        }

        // Screen Shake decay
        if (state.screenShake > 0) {
          state.screenShake *= 0.8;
          if (state.screenShake < 0.5) state.screenShake = 0;
        }

        // Wave End Check
        if (state.timeInWave >= waveData.duration && state.enemiesSpawned >= waveData.count && enemies.length === 0 && waveData.type !== 'BOSS') {
           onWaveComplete(state.score);
        }
      }

      // -- DRAW --

      // Apply screen shake
      ctx.save();
      if (state.screenShake > 0) {
        const sx = (Math.random() - 0.5) * state.screenShake;
        const sy = (Math.random() - 0.5) * state.screenShake;
        ctx.translate(sx, sy);
      }

      // Sky Background Image
      if (bgImageRef.current) {
        ctx.drawImage(bgImageRef.current, 0, 0, GAME_CONSTANTS.CANVAS_WIDTH, GAME_CONSTANTS.CANVAS_HEIGHT);
      } else {
        ctx.fillStyle = '#050608';
        ctx.fillRect(0, 0, GAME_CONSTANTS.CANVAS_WIDTH, GAME_CONSTANTS.CANVAS_HEIGHT);
      }

      // Solstice Color Overlay
      ctx.fillStyle = getSkyColor(waveIndex);
      ctx.fillRect(0, 0, GAME_CONSTANTS.CANVAS_WIDTH, GAME_CONSTANTS.CANVAS_HEIGHT);

      // Enhanced Darkness Vignette
      const darkness = Math.min(0.95, waveIndex * 0.08);
      const grad = ctx.createRadialGradient(
        player.x, player.y, GAME_CONSTANTS.CANVAS_HEIGHT / 6,
        GAME_CONSTANTS.CANVAS_WIDTH / 2, GAME_CONSTANTS.CANVAS_HEIGHT / 2, GAME_CONSTANTS.CANVAS_HEIGHT * 0.9
      );
      grad.addColorStop(0, `rgba(5, 6, 8, ${darkness * 0.2})`);
      grad.addColorStop(0.5, `rgba(5, 6, 8, ${darkness * 0.5})`);
      grad.addColorStop(1, `rgba(5, 6, 8, ${Math.min(0.98, darkness + 0.1)})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, GAME_CONSTANTS.CANVAS_WIDTH, GAME_CONSTANTS.CANVAS_HEIGHT);

      // Ambient embers (behind everything)
      for (let e of embers) {
        ctx.globalAlpha = Math.min(1, e.life * 0.5);
        ctx.fillStyle = e.color;
        ctx.shadowColor = e.color;
        ctx.shadowBlur = 5;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      // Light Zones (Enhanced Glowing Orbs)
      for (let zone of lightZones) {
        drawEnhancedLightZone(ctx, zone, time);
      }
      
      // Draw Obstacles (Enhanced Walls)
      for (let obs of obstacles) {
        drawEnhancedObstacle(ctx, obs, time);
      }
      
      // Draw Lasers (Enhanced)
      for (let l of lasers) {
        drawEnhancedLaser(ctx, l, time);
      }

      // Shockwaves
      for (let sw of shockwaves) {
        drawShockwave(ctx, sw);
      }

      // Particles (additive blending for glow)
      ctx.globalCompositeOperation = 'lighter';
      for (let p of particles) {
        ctx.globalAlpha = Math.min(1, p.life);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * Math.min(1, p.life + 0.3), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      ctx.globalCompositeOperation = 'source-over';

      // Muzzle Flashes
      ctx.globalCompositeOperation = 'lighter';
      for (let mf of muzzleFlashes) {
        drawMuzzleFlash(ctx, mf);
      }
      ctx.globalCompositeOperation = 'source-over';

      // Enhanced Bullets
      for (let b of bullets) {
        drawEnhancedBullet(ctx, b, time);
      }

      // Enemies (Enhanced)
      for (let e of enemies) {
        // Spawn animation
        const spawnAge = e.spawnTime ? (time - e.spawnTime) / 500 : 1;
        const spawnScale = Math.min(1, spawnAge);
        
        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.scale(spawnScale, spawnScale);
        ctx.translate(-e.x, -e.y);
        
        // Damage flash
        const isHit = e.hitTime && (time - e.hitTime) < 100;
        
        if (e.type === 'BOSS') {
          const pulse = Math.sin(time / 200) * 10;
          drawPolygon(ctx, e.x, e.y, e.r + pulse, 8, time / 1000, e.color, time);
          
          // Boss health bar with glow
          const hpPercent = e.hp / 80;
          ctx.fillStyle = 'rgba(0,0,0,0.7)';
          ctx.fillRect(e.x - e.r, e.y - e.r - 18, e.r * 2, 8);
          const hpGrad = ctx.createLinearGradient(e.x - e.r, 0, e.x - e.r + (e.r * 2) * hpPercent, 0);
          hpGrad.addColorStop(0, '#ff0055');
          hpGrad.addColorStop(1, '#ff4488');
          ctx.fillStyle = hpGrad;
          ctx.shadowColor = '#ff0055';
          ctx.shadowBlur = 8;
          ctx.fillRect(e.x - e.r, e.y - e.r - 18, (e.r * 2) * hpPercent, 8);
          ctx.shadowBlur = 0;
          ctx.strokeStyle = 'rgba(255,0,85,0.6)';
          ctx.lineWidth = 1;
          ctx.strokeRect(e.x - e.r, e.y - e.r - 18, e.r * 2, 8);
        } else {
          const sides = e.type === 'CRAWLER' ? 4 : e.type === 'RUNNER' ? 3 : e.type === 'HUNTER' ? 5 : 6;
          drawPolygon(ctx, e.x, e.y, e.r, sides, e.angle || 0, isHit ? '#ffffff' : e.color, time);
        }

        // Enemy core glow
        const coreGrad = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r * 0.5);
        coreGrad.addColorStop(0, isHit ? 'rgba(255,255,255,0.8)' : `rgba(255,255,255,0.4)`);
        coreGrad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r * 0.5, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
      }

      // Player Trail (enhanced golden energy)
      ctx.globalCompositeOperation = 'lighter';
      for (let t of player.trails) {
        const trailGrad = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, player.r * t.life);
        trailGrad.addColorStop(0, `rgba(255, 207, 51, ${t.life * 0.4})`);
        trailGrad.addColorStop(1, 'rgba(255, 207, 51, 0)');
        ctx.fillStyle = trailGrad;
        ctx.beginPath();
        ctx.arc(t.x, t.y, player.r * t.life * 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';

      // Player (enhanced)
      if (player.iframes === 0 || Math.floor(time / 80) % 2 === 0) {
        drawPlayer(ctx, player, time, mouseRef);
      }

      // Hit flash overlay
      if (state.hitFlash > 0) {
        ctx.fillStyle = `rgba(255, 50, 50, ${state.hitFlash * 0.3})`;
        ctx.fillRect(0, 0, GAME_CONSTANTS.CANVAS_WIDTH, GAME_CONSTANTS.CANVAS_HEIGHT);
      }

      ctx.restore();

      if (state.announcing) {
         setHudState({ hp: player.hp, solar: player.solar, score: state.score, time: 0, maxTime: waveData.duration, announcing: true });
      } else {
         setHudState({ hp: player.hp, solar: player.solar, score: state.score, time: state.timeInWave, maxTime: waveData.duration, announcing: false });
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    const handleKeyDown = (e) => { keysRef.current[e.key] = true; };
    const handleKeyUp = (e) => { keysRef.current[e.key] = false; };
    const handleMouseMove = (e) => {
       const rect = canvas.getBoundingClientRect();
       mouseRef.current.x = e.clientX - rect.left;
       mouseRef.current.y = e.clientY - rect.top;
    };
    const handleMouseDown = () => { mouseRef.current.isDown = true; };
    const handleMouseUp = () => { mouseRef.current.isDown = false; };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [waveIndex, onWaveComplete, onGameOver, onVictory, setHudState, isTuringActive]);

  return (
    <canvas 
      ref={canvasRef} 
      width={GAME_CONSTANTS.CANVAS_WIDTH} 
      height={GAME_CONSTANTS.CANVAS_HEIGHT} 
      className="canvas-layer"
    />
  );
}
