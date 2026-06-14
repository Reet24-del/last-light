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

    const drawPolygon = (ctx, x, y, radius, sides, angleOffset, color) => {
      ctx.beginPath();
      for (let i = 0; i < sides; i++) {
        const a = angleOffset + (i * 2 * Math.PI) / sides;
        const px = x + radius * Math.cos(a);
        const py = y + radius * Math.sin(a);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;
    };

    const render = (time) => {
      const dt = time - lastTime;
      lastTime = time;

      if (isTuringActive) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      const state = stateRef.current;
      const { player, bullets, enemies, particles, lightZones, obstacles, lasers, waveData } = state;

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

        // Player trail logic
        if (dx !== 0 || dy !== 0) {
          player.trails.push({ x: player.x, y: player.y, life: 1 });
        }
        for (let i = player.trails.length - 1; i >= 0; i--) {
          player.trails[i].life -= 0.1;
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
             
             bullets.push({
               x: player.x + Math.cos(baseAngle)*15, 
               y: player.y + Math.sin(baseAngle)*15,
               vx: Math.cos(baseAngle) * GAME_CONSTANTS.BULLET_SPEED,
               vy: Math.sin(baseAngle) * GAME_CONSTANTS.BULLET_SPEED,
               r: GAME_CONSTANTS.BULLET_RADIUS,
               angle: baseAngle
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
             bullets.splice(i, 1);
             continue;
          }

          if (Math.random() > 0.5) {
            particles.push({
              x: b.x, y: b.y,
              vx: -b.vx * 0.1 + (Math.random()-0.5), vy: -b.vy * 0.1 + (Math.random()-0.5),
              life: 1, color: '#fff', size: 1.5
            });
          }
        }

        // Spawn
        state.spawnTimer += dt;
        const spawnInterval = waveData.count > 0 ? waveData.duration / waveData.count : 1000;
        if (state.spawnTimer > spawnInterval && state.enemiesSpawned < waveData.count) {
          enemies.push(spawnEnemy(waveIndex));
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
                e.x = pEx; e.y = pEy; break; // simplistic pathing, gets stuck on walls
             }
          }

          let hit = false;
          for (let j = bullets.length - 1; j >= 0; j--) {
            let b = bullets[j];
            if (checkCollision({x: e.x, y: e.y, r: e.r}, {x: b.x, y: b.y, r: b.r})) {
              e.hp -= 1;
              bullets.splice(j, 1);
              hit = true;
              
              for (let p=0; p<8; p++) {
                particles.push({
                  x: e.x, y: e.y,
                  vx: (Math.random() - 0.5) * 8 + b.vx * 0.2, vy: (Math.random() - 0.5) * 8 + b.vy * 0.2,
                  life: 1, color: e.color, size: 2 + Math.random()*2
                });
              }
              break;
            }
          }

          if (e.hp <= 0) {
            state.score += e.score;
            state.screenShake = e.type === 'BOSS' ? 20 : 5; 
            
            for (let p=0; p<20; p++) {
                particles.push({
                  x: e.x, y: e.y,
                  vx: (Math.random() - 0.5) * 12, vy: (Math.random() - 0.5) * 12,
                  life: 1.5, color: e.color, size: 3 + Math.random()*3
                });
            }

            if (e.type === 'SPLITTER') {
               enemies.push({...ENEMY_TYPES['RUNNER'], x: e.x-15, y: e.y-15, hp: 1, r: 8, id: Math.random()});
               enemies.push({...ENEMY_TYPES['RUNNER'], x: e.x+15, y: e.y+15, hp: 1, r: 8, id: Math.random()});
            }
            if (e.type === 'BOSS') {
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
             if (player.hp <= 0) {
                onGameOver(state.score, waveData.hour);
                return;
             }
          }
        }
        
        if (player.iframes > 0) player.iframes--;

        // Particles
        for (let i = particles.length - 1; i >= 0; i--) {
          let p = particles[i];
          p.x += p.vx; p.y += p.vy;
          p.life -= 0.04;
          if (p.life <= 0) particles.splice(i, 1);
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

      // Darkness Vignette
      const darkness = Math.min(0.95, waveIndex * 0.08);
      const grad = ctx.createRadialGradient(
        GAME_CONSTANTS.CANVAS_WIDTH/2, GAME_CONSTANTS.CANVAS_HEIGHT/2, GAME_CONSTANTS.CANVAS_HEIGHT/5,
        GAME_CONSTANTS.CANVAS_WIDTH/2, GAME_CONSTANTS.CANVAS_HEIGHT/2, GAME_CONSTANTS.CANVAS_HEIGHT
      );
      grad.addColorStop(0, `rgba(5, 6, 8, ${darkness * 0.3})`);
      grad.addColorStop(1, `rgba(5, 6, 8, ${darkness})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, GAME_CONSTANTS.CANVAS_WIDTH, GAME_CONSTANTS.CANVAS_HEIGHT);

      // Light Zones (Glowing Orbs)
      for (let zone of lightZones) {
        const pulse = Math.sin(time / 500) * 5;
        const zoneGrad = ctx.createRadialGradient(zone.x, zone.y, 0, zone.x, zone.y, zone.r + pulse);
        zoneGrad.addColorStop(0, 'rgba(255, 207, 51, 0.4)');
        zoneGrad.addColorStop(0.5, 'rgba(255, 207, 51, 0.1)');
        zoneGrad.addColorStop(1, 'rgba(255, 207, 51, 0)');
        ctx.fillStyle = zoneGrad;
        ctx.beginPath(); ctx.arc(zone.x, zone.y, zone.r + pulse, 0, Math.PI * 2); ctx.fill();
        
        ctx.strokeStyle = 'rgba(255, 207, 51, 0.8)';
        ctx.lineWidth = 2; 
        ctx.setLineDash([5, 5]);
        ctx.beginPath(); ctx.arc(zone.x, zone.y, zone.r, time/1000, Math.PI * 2 + time/1000); ctx.stroke();
        ctx.setLineDash([]);
      }
      
      // Draw Obstacles (Walls)
      for (let obs of obstacles) {
         ctx.fillStyle = 'rgba(0, 50, 100, 0.8)';
         ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
         ctx.strokeStyle = obs.color;
         ctx.lineWidth = 2;
         ctx.shadowColor = obs.color;
         ctx.shadowBlur = 10;
         ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
         ctx.shadowBlur = 0;
      }
      
      // Draw Lasers
      for (let l of lasers) {
         ctx.beginPath();
         ctx.moveTo(l.x, l.y);
         ctx.lineTo(l.x + Math.cos(l.angle)*l.length, l.y + Math.sin(l.angle)*l.length);
         ctx.strokeStyle = l.color;
         ctx.lineWidth = 4;
         ctx.shadowColor = l.color;
         ctx.shadowBlur = 15;
         ctx.stroke();
         ctx.shadowBlur = 0;
         
         // Laser base
         ctx.fillStyle = '#fff';
         ctx.beginPath(); ctx.arc(l.x, l.y, 8, 0, Math.PI*2); ctx.fill();
      }

      // Particles
      ctx.globalCompositeOperation = 'lighter';
      for (let p of particles) {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';

      // Laser Bullets
      ctx.shadowBlur = 15; 
      ctx.shadowColor = '#fff';
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      for (let b of bullets) {
        ctx.beginPath(); 
        ctx.moveTo(b.x - Math.cos(b.angle)*10, b.y - Math.sin(b.angle)*10);
        ctx.lineTo(b.x + Math.cos(b.angle)*5, b.y + Math.sin(b.angle)*5);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;

      // Enemies
      for (let e of enemies) {
        if (e.type === 'CRAWLER') drawPolygon(ctx, e.x, e.y, e.r, 4, e.angle, e.color);
        else if (e.type === 'RUNNER') drawPolygon(ctx, e.x, e.y, e.r, 3, e.angle, e.color);
        else if (e.type === 'HUNTER') drawPolygon(ctx, e.x, e.y, e.r, 5, e.angle, e.color);
        else if (e.type === 'SPLITTER') drawPolygon(ctx, e.x, e.y, e.r, 6, e.angle, e.color);
        else if (e.type === 'BOSS') {
          const pulse = Math.sin(time / 200) * 10;
          drawPolygon(ctx, e.x, e.y, e.r + pulse, 8, time/1000, e.color);
          
          ctx.fillStyle = 'red';
          ctx.shadowColor = 'red'; ctx.shadowBlur = 10;
          ctx.fillRect(e.x - e.r, e.y - e.r - 15, (e.r * 2) * (e.hp / 80), 5);
          ctx.shadowBlur = 0;
        }

        ctx.fillStyle = '#fff';
        ctx.shadowColor = '#fff'; ctx.shadowBlur = 5;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r/4, 0, Math.PI*2); ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Player Trail
      ctx.globalAlpha = 0.5;
      for (let t of player.trails) {
        ctx.fillStyle = '#ffcf33';
        ctx.globalAlpha = t.life * 0.3;
        ctx.beginPath(); ctx.arc(t.x, t.y, player.r * t.life, 0, Math.PI*2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      if (player.iframes === 0 || Math.floor(time / 100) % 2 === 0) {
        ctx.shadowColor = '#e2e8f0'; ctx.shadowBlur = 15;
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.beginPath(); ctx.arc(player.x, player.y, player.r, 0, Math.PI*2); ctx.fill();
        
        const angle = Math.atan2(mouseRef.current.y - player.y, mouseRef.current.x - player.x);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(player.x, player.y);
        ctx.lineTo(player.x + Math.cos(angle) * 25, player.y + Math.sin(angle) * 25);
        ctx.stroke();
        
        ctx.shadowBlur = 0;
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
