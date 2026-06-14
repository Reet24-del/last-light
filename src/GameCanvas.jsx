import React, { useEffect, useRef } from 'react';
import { GAME_CONSTANTS, ENEMY_TYPES, WAVES, getSanctuaries, getObstacles, getLasers, rectCircleCollision, lineCircleCollision, distance, checkCollision, spawnEnemy, getSkyColor, REWARD_PENALTIES, calculateKillReward } from './engine';

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
    player: { 
      x: GAME_CONSTANTS.CANVAS_WIDTH / 2, 
      y: GAME_CONSTANTS.CANVAS_HEIGHT / 2, 
      hp: 5, 
      r: GAME_CONSTANTS.PLAYER_RADIUS, 
      iframes: 0, 
      spirit: 100, 
      trails: [],
      combo: 0,
      lastKillTime: 0,
      noDamageTaken: true,
      slashAngle: 0,
      isSlashing: false,
      slashTimer: 0,
    },
    bullets: [],
    enemies: [],
    particles: [],
    embers: [],
    shockwaves: [],
    sanctuaries: getSanctuaries(waveIndex),
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
    hitFlash: 0,
    muzzleFlashes: [],
    rewardPopups: [], // floating score popups
    conquestParticles: [], // particles around obstacles being conquered
  });

  const keysRef = useRef({});
  const mouseRef = useRef({ x: 0, y: 0, isDown: false });

  useEffect(() => {
    const wave = WAVES[waveIndex];
    stateRef.current.waveData = wave;
    stateRef.current.sanctuaries = getSanctuaries(waveIndex);
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
    stateRef.current.rewardPopups = [];
    stateRef.current.conquestParticles = [];
    stateRef.current.player.hp = Math.min(5, stateRef.current.player.hp + 1);
    stateRef.current.player.trails = [];
    stateRef.current.player.noDamageTaken = true;
    
    const tid = setTimeout(() => {
      stateRef.current.announcing = false;
    }, 3000);
    return () => clearTimeout(tid);
  }, [waveIndex]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: false });
    let animationFrameId;
    let lastTime = performance.now();

    // --- SAMURAI DRAWING HELPERS ---

    const drawSamurai = (ctx, player, time, mouseRef) => {
      const angle = Math.atan2(mouseRef.current.y - player.y, mouseRef.current.x - player.x);
      const pulse = Math.sin(time / 250) * 1.5;
      
      // Spirit aura - blue-white energy
      const auraGrad = ctx.createRadialGradient(player.x, player.y, player.r - 3, player.x, player.y, player.r + 18 + pulse);
      auraGrad.addColorStop(0, 'rgba(100, 180, 255, 0.35)');
      auraGrad.addColorStop(0.5, 'rgba(100, 180, 255, 0.12)');
      auraGrad.addColorStop(1, 'rgba(100, 180, 255, 0)');
      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.r + 18 + pulse, 0, Math.PI * 2);
      ctx.fill();

      // Samurai body - dark with spirit core
      ctx.shadowColor = '#4488ff';
      ctx.shadowBlur = 15;
      const bodyGrad = ctx.createRadialGradient(player.x - 2, player.y - 2, 0, player.x, player.y, player.r);
      bodyGrad.addColorStop(0, '#ffffff');
      bodyGrad.addColorStop(0.3, '#88bbff');
      bodyGrad.addColorStop(0.6, '#334466');
      bodyGrad.addColorStop(1, '#1a2233');
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
      ctx.fill();
      
      // Inner kanji mark
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(100, 180, 255, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(player.x - 3, player.y - 5);
      ctx.lineTo(player.x + 3, player.y - 5);
      ctx.moveTo(player.x, player.y - 6);
      ctx.lineTo(player.x, player.y + 4);
      ctx.moveTo(player.x - 4, player.y + 2);
      ctx.lineTo(player.x + 4, player.y + 2);
      ctx.stroke();

      // Katana blade
      ctx.shadowColor = '#88ccff';
      ctx.shadowBlur = 12;
      ctx.strokeStyle = '#ddeeff';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(player.x + Math.cos(angle) * 8, player.y + Math.sin(angle) * 8);
      ctx.lineTo(player.x + Math.cos(angle) * 28, player.y + Math.sin(angle) * 28);
      ctx.stroke();
      
      // Katana edge glow
      ctx.strokeStyle = 'rgba(136, 204, 255, 0.4)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(player.x + Math.cos(angle) * 12, player.y + Math.sin(angle) * 12);
      ctx.lineTo(player.x + Math.cos(angle) * 28, player.y + Math.sin(angle) * 28);
      ctx.stroke();
      
      // Katana tip spark
      const tipX = player.x + Math.cos(angle) * 28;
      const tipY = player.y + Math.sin(angle) * 28;
      const tipGrad = ctx.createRadialGradient(tipX, tipY, 0, tipX, tipY, 6);
      tipGrad.addColorStop(0, 'rgba(200, 230, 255, 0.9)');
      tipGrad.addColorStop(1, 'rgba(100, 180, 255, 0)');
      ctx.fillStyle = tipGrad;
      ctx.beginPath();
      ctx.arc(tipX, tipY, 6, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.shadowBlur = 0;

      // Slash arc effect when attacking
      if (player.isSlashing && player.slashTimer > 0) {
        const slashAlpha = player.slashTimer / 10;
        ctx.strokeStyle = `rgba(136, 204, 255, ${slashAlpha})`;
        ctx.lineWidth = 3;
        ctx.shadowColor = '#88ccff';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(player.x, player.y, 30, angle - 0.8, angle + 0.8);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    };

    const drawDemon = (ctx, e, time) => {
      const spawnAge = e.spawnTime ? (time - e.spawnTime) / 600 : 1;
      const spawnScale = Math.min(1, spawnAge);
      const isHit = e.hitTime && (time - e.hitTime) < 120;
      
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.scale(spawnScale, spawnScale);
      ctx.translate(-e.x, -e.y);

      if (e.type === 'DEMON_LORD') {
        drawDemonLord(ctx, e, time, isHit);
      } else {
        // Demon shadow beneath
        const shadowGrad = ctx.createRadialGradient(e.x, e.y + e.r * 0.3, 0, e.x, e.y + e.r * 0.3, e.r * 1.2);
        shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0.4)');
        shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = shadowGrad;
        ctx.beginPath();
        ctx.ellipse(e.x, e.y + e.r * 0.3, e.r * 1.2, e.r * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Dark smoke tendrils
        const smokeCount = 3;
        for (let s = 0; s < smokeCount; s++) {
          const sAngle = (time / 800 + s * 2.1);
          const sx = e.x + Math.cos(sAngle) * (e.r + 4);
          const sy = e.y + Math.sin(sAngle) * (e.r + 4);
          const smokeGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, 6);
          smokeGrad.addColorStop(0, `rgba(${isHit ? '255,255,255' : '80,0,120'}, 0.4)`);
          smokeGrad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = smokeGrad;
          ctx.beginPath();
          ctx.arc(sx, sy, 6, 0, Math.PI * 2);
          ctx.fill();
        }

        // Main demon body - organic shape
        const sides = e.type === 'SHADE' ? 5 : e.type === 'WRAITH' ? 3 : e.type === 'ONI' ? 6 : e.type === 'YUREI' ? 4 : 7;
        const wobble = Math.sin(time / 200 + e.x) * 2;
        
        ctx.beginPath();
        for (let i = 0; i < sides; i++) {
          const a = (e.angle || 0) + (i * 2 * Math.PI) / sides + time / 1500;
          const r = e.r + wobble + Math.sin(time / 300 + i * 1.5) * 2;
          const px = e.x + r * Math.cos(a);
          const py = e.y + r * Math.sin(a);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        
        // Dark gradient fill
        const demonGrad = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r + 3);
        demonGrad.addColorStop(0, isHit ? '#ffffff' : 'rgba(20, 0, 30, 0.95)');
        demonGrad.addColorStop(0.6, isHit ? e.color : 'rgba(10, 0, 15, 0.9)');
        demonGrad.addColorStop(1, e.color);
        ctx.fillStyle = demonGrad;
        ctx.fill();
        
        // Glowing outline
        ctx.strokeStyle = isHit ? '#ffffff' : e.color;
        ctx.lineWidth = 2;
        ctx.shadowColor = e.color;
        ctx.shadowBlur = 15;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Demon eyes (2 glowing dots)
        const eyeAngle = e.angle || 0;
        const eyeSpread = e.r * 0.3;
        for (let side = -1; side <= 1; side += 2) {
          const ex = e.x + Math.cos(eyeAngle) * e.r * 0.3 + Math.cos(eyeAngle + Math.PI/2) * side * eyeSpread;
          const ey = e.y + Math.sin(eyeAngle) * e.r * 0.3 + Math.sin(eyeAngle + Math.PI/2) * side * eyeSpread;
          const eyeGrad = ctx.createRadialGradient(ex, ey, 0, ex, ey, 3);
          eyeGrad.addColorStop(0, '#ff0000');
          eyeGrad.addColorStop(0.5, e.color);
          eyeGrad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = eyeGrad;
          ctx.beginPath();
          ctx.arc(ex, ey, 3, 0, Math.PI * 2);
          ctx.fill();
        }

        // Charging indicator for Oni
        if (e.type === 'ONI' && e.isCharging) {
          ctx.strokeStyle = '#ff3300';
          ctx.lineWidth = 3;
          ctx.shadowColor = '#ff3300';
          ctx.shadowBlur = 20;
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.r + 8, 0, Math.PI * 2);
          ctx.stroke();
          ctx.shadowBlur = 0;
        }

        // Teleport shimmer for Yurei
        if (e.type === 'YUREI') {
          ctx.globalAlpha = 0.3 + Math.sin(time / 200) * 0.2;
          const shimmerGrad = ctx.createRadialGradient(e.x, e.y, e.r * 0.5, e.x, e.y, e.r * 1.5);
          shimmerGrad.addColorStop(0, 'rgba(51, 255, 153, 0.3)');
          shimmerGrad.addColorStop(1, 'rgba(51, 255, 153, 0)');
          ctx.fillStyle = shimmerGrad;
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.r * 1.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
      
      ctx.restore();
    };

    const drawDemonLord = (ctx, e, time, isHit) => {
      const pulse = Math.sin(time / 150) * 8;
      
      // Massive dark aura
      const auraGrad = ctx.createRadialGradient(e.x, e.y, e.r, e.x, e.y, e.r * 2.5);
      auraGrad.addColorStop(0, 'rgba(255, 0, 50, 0.15)');
      auraGrad.addColorStop(0.5, 'rgba(139, 0, 255, 0.08)');
      auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r * 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Rotating demonic runes around boss
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(time / 2000);
      for (let i = 0; i < 8; i++) {
        const runeAngle = (i / 8) * Math.PI * 2;
        const runeR = e.r + 20 + pulse;
        const rx = Math.cos(runeAngle) * runeR;
        const ry = Math.sin(runeAngle) * runeR;
        ctx.fillStyle = `rgba(255, 0, 50, ${0.4 + Math.sin(time / 300 + i) * 0.3})`;
        ctx.font = '12px serif';
        ctx.fillText('鬼', rx - 6, ry + 4);
      }
      ctx.restore();

      // Main body - multi-layered
      const sides = 8;
      ctx.beginPath();
      for (let i = 0; i < sides; i++) {
        const a = time / 800 + (i * 2 * Math.PI) / sides;
        const r = e.r + pulse + Math.sin(time / 200 + i * 0.8) * 5;
        const px = e.x + r * Math.cos(a);
        const py = e.y + r * Math.sin(a);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      
      const bossGrad = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r + pulse);
      bossGrad.addColorStop(0, isHit ? '#ffffff' : '#330011');
      bossGrad.addColorStop(0.4, isHit ? '#ff6688' : '#1a0008');
      bossGrad.addColorStop(0.8, '#0a0004');
      bossGrad.addColorStop(1, e.color);
      ctx.fillStyle = bossGrad;
      ctx.fill();
      
      ctx.strokeStyle = isHit ? '#ffffff' : e.color;
      ctx.lineWidth = 3;
      ctx.shadowColor = e.color;
      ctx.shadowBlur = 25;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Boss HP bar
      const hpPercent = e.hp / 120;
      const barWidth = e.r * 2.5;
      ctx.fillStyle = 'rgba(0,0,0,0.8)';
      ctx.fillRect(e.x - barWidth/2, e.y - e.r - 25, barWidth, 10);
      const hpGrad = ctx.createLinearGradient(e.x - barWidth/2, 0, e.x - barWidth/2 + barWidth * hpPercent, 0);
      hpGrad.addColorStop(0, '#ff0033');
      hpGrad.addColorStop(1, '#ff4488');
      ctx.fillStyle = hpGrad;
      ctx.shadowColor = '#ff0033';
      ctx.shadowBlur = 8;
      ctx.fillRect(e.x - barWidth/2, e.y - e.r - 25, barWidth * hpPercent, 10);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,0,50,0.6)';
      ctx.lineWidth = 1;
      ctx.strokeRect(e.x - barWidth/2, e.y - e.r - 25, barWidth, 10);
    };

    const drawSanctuary = (ctx, zone, time) => {
      const pulse = Math.sin(time / 350) * 6;
      const r = zone.r + pulse;
      
      // Layered blue-white glow
      for (let layer = 3; layer >= 0; layer--) {
        const layerR = r + layer * 12;
        const alpha = 0.12 - layer * 0.025;
        const zoneGrad = ctx.createRadialGradient(zone.x, zone.y, 0, zone.x, zone.y, layerR);
        zoneGrad.addColorStop(0, `rgba(100, 180, 255, ${alpha + 0.08})`);
        zoneGrad.addColorStop(0.4, `rgba(100, 180, 255, ${alpha})`);
        zoneGrad.addColorStop(1, 'rgba(100, 180, 255, 0)');
        ctx.fillStyle = zoneGrad;
        ctx.beginPath();
        ctx.arc(zone.x, zone.y, layerR, 0, Math.PI * 2);
        ctx.fill();
      }

      // Rotating kanji protection circle
      ctx.save();
      ctx.translate(zone.x, zone.y);
      ctx.rotate(time / 3000);
      ctx.strokeStyle = 'rgba(100, 180, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, zone.r * 0.8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Border ring
      ctx.strokeStyle = 'rgba(100, 180, 255, 0.7)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.shadowColor = '#4488ff';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(zone.x, zone.y, zone.r, time / 700, Math.PI * 2 + time / 700);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;

      // Floating spirit particles
      for (let i = 0; i < 4; i++) {
        const px = zone.x + Math.cos(time / 900 + i * 1.6) * (zone.r * 0.5);
        const py = zone.y + Math.sin(time / 700 + i * 2.0) * (zone.r * 0.5);
        const pSize = 1.5 + Math.sin(time / 400 + i) * 0.7;
        ctx.fillStyle = `rgba(150, 200, 255, ${0.4 + Math.sin(time / 350 + i) * 0.3})`;
        ctx.beginPath();
        ctx.arc(px, py, pSize, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const drawObstacle = (ctx, obs, time) => {
      if (obs.conquered) return; // Don't draw conquered obstacles
      
      const conquerAlpha = 1 - (obs.conquerProgress / GAME_CONSTANTS.OBSTACLE_CONQUER_TIME);
      
      // Dark cursed barrier
      ctx.globalAlpha = conquerAlpha;
      ctx.fillStyle = 'rgba(20, 0, 40, 0.9)';
      ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
      
      // Demonic rune pattern inside
      ctx.strokeStyle = `rgba(139, 0, 255, ${0.15 * conquerAlpha})`;
      ctx.lineWidth = 0.5;
      const gridSize = 12;
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

      // Pulsing cursed border
      const borderPulse = Math.sin(time / 300) * 0.3 + 0.7;
      ctx.strokeStyle = `rgba(139, 0, 255, ${borderPulse * conquerAlpha})`;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#8b00ff';
      ctx.shadowBlur = 12;
      ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
      ctx.shadowBlur = 0;
      
      // Conquest progress bar (if being conquered)
      if (obs.conquerProgress > 0) {
        const progress = obs.conquerProgress / GAME_CONSTANTS.OBSTACLE_CONQUER_TIME;
        const barWidth = Math.max(obs.w, obs.h);
        const barX = obs.x + (obs.w > obs.h ? 0 : -10);
        const barY = obs.y - 12;
        
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(barX, barY, barWidth, 6);
        
        const progGrad = ctx.createLinearGradient(barX, 0, barX + barWidth * progress, 0);
        progGrad.addColorStop(0, '#4488ff');
        progGrad.addColorStop(1, '#88ccff');
        ctx.fillStyle = progGrad;
        ctx.shadowColor = '#4488ff';
        ctx.shadowBlur = 6;
        ctx.fillRect(barX, barY, barWidth * progress, 6);
        ctx.shadowBlur = 0;
      }
      
      ctx.globalAlpha = 1;
    };

    const drawLaser = (ctx, l, time) => {
      const endX = l.x + Math.cos(l.angle) * l.length;
      const endY = l.y + Math.sin(l.angle) * l.length;
      
      // Wide outer glow
      ctx.beginPath();
      ctx.moveTo(l.x, l.y);
      ctx.lineTo(endX, endY);
      ctx.strokeStyle = l.color;
      ctx.lineWidth = 14;
      ctx.globalAlpha = 0.12;
      ctx.shadowColor = l.color;
      ctx.shadowBlur = 30;
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
      
      // Animated dash
      ctx.setLineDash([6, 10]);
      ctx.lineDashOffset = -time / 40;
      ctx.beginPath();
      ctx.moveTo(l.x, l.y);
      ctx.lineTo(endX, endY);
      ctx.strokeStyle = l.color;
      ctx.lineWidth = 4;
      ctx.globalAlpha = 0.6;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;
      
      // Base glow
      const baseGrad = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, 14);
      baseGrad.addColorStop(0, '#fff');
      baseGrad.addColorStop(0.4, l.color);
      baseGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = baseGrad;
      ctx.beginPath();
      ctx.arc(l.x, l.y, 14, 0, Math.PI * 2);
      ctx.fill();
    };

    const drawBullet = (ctx, b) => {
      // Spirit energy projectile - blue-white
      const tailLength = 18;
      const tailGrad = ctx.createLinearGradient(
        b.x - Math.cos(b.angle) * tailLength, b.y - Math.sin(b.angle) * tailLength,
        b.x, b.y
      );
      tailGrad.addColorStop(0, 'rgba(100, 180, 255, 0)');
      tailGrad.addColorStop(0.5, 'rgba(100, 180, 255, 0.5)');
      tailGrad.addColorStop(1, 'rgba(220, 240, 255, 0.9)');
      
      ctx.beginPath();
      ctx.moveTo(b.x - Math.cos(b.angle) * tailLength, b.y - Math.sin(b.angle) * tailLength);
      ctx.lineTo(b.x + Math.cos(b.angle) * 3, b.y + Math.sin(b.angle) * 3);
      ctx.strokeStyle = tailGrad;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.stroke();
      
      // Bright core
      ctx.shadowColor = '#88ccff';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#ddeeff';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    };

    const drawRewardPopup = (ctx, popup) => {
      const alpha = popup.life;
      const yOffset = (1 - popup.life) * 30;
      ctx.globalAlpha = alpha;
      ctx.font = `bold ${popup.size || 14}px "Share Tech Mono", monospace`;
      ctx.textAlign = 'center';
      
      if (popup.value > 0) {
        ctx.fillStyle = '#88ff88';
        ctx.shadowColor = '#00ff00';
      } else {
        ctx.fillStyle = '#ff4444';
        ctx.shadowColor = '#ff0000';
      }
      ctx.shadowBlur = 8;
      ctx.fillText(`${popup.value > 0 ? '+' : ''}${popup.value}`, popup.x, popup.y - yOffset);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';
    };

    const drawShockwave = (ctx, sw) => {
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.strokeStyle = sw.color;
      ctx.lineWidth = Math.max(0.5, 3 * sw.life);
      ctx.globalAlpha = sw.life * 0.5;
      ctx.shadowColor = sw.color;
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    };

    // --- MAIN GAME LOOP ---
    const render = (time) => {
      const dt = time - lastTime;
      lastTime = time;

      if (isTuringActive) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      const state = stateRef.current;
      const { player, bullets, enemies, particles, embers, shockwaves, sanctuaries, obstacles, lasers, muzzleFlashes, rewardPopups, conquestParticles } = state;
      const { waveData } = state;

      // --- UPDATE ---
      if (!state.announcing) {
        state.timeInWave += dt;

        // Player Movement
        const speed = 3.5;
        let dx = 0, dy = 0;
        if (keysRef.current['w'] || keysRef.current['W'] || keysRef.current['ArrowUp']) dy -= 1;
        if (keysRef.current['s'] || keysRef.current['S'] || keysRef.current['ArrowDown']) dy += 1;
        if (keysRef.current['a'] || keysRef.current['A'] || keysRef.current['ArrowLeft']) dx -= 1;
        if (keysRef.current['d'] || keysRef.current['D'] || keysRef.current['ArrowRight']) dx += 1;
        
        if (dx !== 0 || dy !== 0) {
          const len = Math.sqrt(dx*dx + dy*dy);
          dx /= len; dy /= len;
          
          const newX = player.x + dx * speed;
          const newY = player.y + dy * speed;
          
          let blocked = false;
          for (let obs of obstacles) {
            if (!obs.conquered && rectCircleCollision({x: newX, y: newY, r: player.r}, obs)) {
              blocked = true; break;
            }
          }
          
          if (!blocked) {
            player.x = Math.max(player.r, Math.min(GAME_CONSTANTS.CANVAS_WIDTH - player.r, newX));
            player.y = Math.max(player.r, Math.min(GAME_CONSTANTS.CANVAS_HEIGHT - player.r, newY));
          }
          
          // Movement trail
          if (Math.random() > 0.5) {
            player.trails.push({
              x: player.x - dx * 5 + (Math.random()-0.5) * 4,
              y: player.y - dy * 5 + (Math.random()-0.5) * 4,
              life: 0.5
            });
          }
        }
        for (let i = player.trails.length - 1; i >= 0; i--) {
          player.trails[i].life -= 0.06;
          if (player.trails[i].life <= 0) player.trails.splice(i, 1);
        }

        // Combo decay
        if (player.combo > 0 && time - player.lastKillTime > GAME_CONSTANTS.COMBO_DECAY_TIME) {
          player.combo = 0;
        }

        // Slash timer decay
        if (player.slashTimer > 0) {
          player.slashTimer -= 1;
          if (player.slashTimer <= 0) player.isSlashing = false;
        }

        // Spirit & Sanctuaries
        let inSanctuary = false;
        for (let zone of sanctuaries) {
          if (distance(player.x, player.y, zone.x, zone.y) < zone.r) {
            inSanctuary = true; break;
          }
          // Move sanctuaries
          if (zone.vx || zone.vy) {
            zone.x += zone.vx;
            zone.y += zone.vy;
            if (zone.x < zone.r + 50 || zone.x > GAME_CONSTANTS.CANVAS_WIDTH - zone.r - 50) zone.vx *= -1;
            if (zone.y < zone.r + 50 || zone.y > GAME_CONSTANTS.CANVAS_HEIGHT - zone.r - 50) zone.vy *= -1;
          }
        }
        
        if (inSanctuary) {
          player.spirit = Math.min(100, player.spirit + GAME_CONSTANTS.SPIRIT_RECHARGE_RATE);
          state.score += REWARD_PENALTIES.SANCTUARY_TIME_BONUS;
        } else {
          player.spirit = Math.max(0, player.spirit - GAME_CONSTANTS.SPIRIT_DRAIN_RATE);
          // Penalty for empty spirit
          if (player.spirit <= 0) {
            state.score = Math.max(0, state.score + REWARD_PENALTIES.SPIRIT_EMPTY_PENALTY * (dt / 1000));
          }
        }

        // Obstacle Conquest - stand near unconquered obstacles to break them
        for (let obs of obstacles) {
          if (obs.conquered) continue;
          const obsCenter = { x: obs.x + obs.w/2, y: obs.y + obs.h/2 };
          const dist = distance(player.x, player.y, obsCenter.x, obsCenter.y);
          const conquerRange = Math.max(obs.w, obs.h) * 0.8 + player.r;
          
          if (dist < conquerRange) {
            obs.conquerProgress += dt;
            // Conquest particles
            if (Math.random() > 0.7) {
              conquestParticles.push({
                x: obs.x + Math.random() * obs.w,
                y: obs.y + Math.random() * obs.h,
                vx: (Math.random() - 0.5) * 2,
                vy: -Math.random() * 2,
                life: 1, color: '#8b00ff', size: 2
              });
            }
            
            if (obs.conquerProgress >= GAME_CONSTANTS.OBSTACLE_CONQUER_TIME) {
              obs.conquered = true;
              state.score += REWARD_PENALTIES.CONQUER_OBSTACLE;
              rewardPopups.push({ x: obsCenter.x, y: obsCenter.y, value: REWARD_PENALTIES.CONQUER_OBSTACLE, life: 1.5, size: 18 });
              // Explosion effect
              for (let p = 0; p < 20; p++) {
                const pAngle = (p / 20) * Math.PI * 2;
                particles.push({
                  x: obsCenter.x, y: obsCenter.y,
                  vx: Math.cos(pAngle) * (3 + Math.random() * 5),
                  vy: Math.sin(pAngle) * (3 + Math.random() * 5),
                  life: 1.2, color: '#8b00ff', size: 2 + Math.random() * 3
                });
              }
              shockwaves.push({ x: obsCenter.x, y: obsCenter.y, radius: 5, maxRadius: 60, life: 1, color: '#8b00ff' });
            }
          } else {
            // Slowly decay progress if player moves away
            obs.conquerProgress = Math.max(0, obs.conquerProgress - dt * 0.3);
          }
        }

        // Shooting (Spirit Slash projectile)
        if ((mouseRef.current.isDown || keysRef.current[' ']) && time - state.lastFireTime > 180) {
          const shotCost = GAME_CONSTANTS.SLASH_COST_BASE + (waveIndex * 0.4);
          if (player.spirit >= shotCost) {
            player.spirit -= shotCost;
            state.lastFireTime = time;
            const baseAngle = Math.atan2(mouseRef.current.y - player.y, mouseRef.current.x - player.x);
            
            const spawnX = player.x + Math.cos(baseAngle) * 28;
            const spawnY = player.y + Math.sin(baseAngle) * 28;
            
            bullets.push({
              x: spawnX, y: spawnY,
              vx: Math.cos(baseAngle) * GAME_CONSTANTS.BULLET_SPEED,
              vy: Math.sin(baseAngle) * GAME_CONSTANTS.BULLET_SPEED,
              r: GAME_CONSTANTS.BULLET_RADIUS,
              angle: baseAngle
            });
            
            // Slash effect
            player.isSlashing = true;
            player.slashTimer = 8;
            player.slashAngle = baseAngle;
            
            muzzleFlashes.push({ x: spawnX, y: spawnY, life: 1, size: 12 });
            state.screenShake = 2;
          }
        }

        // Bullets
        for (let i = bullets.length - 1; i >= 0; i--) {
          let b = bullets[i];
          b.x += b.vx; b.y += b.vy;
          
          let outOfBounds = (b.x < -10 || b.x > GAME_CONSTANTS.CANVAS_WIDTH + 10 || b.y < -10 || b.y > GAME_CONSTANTS.CANVAS_HEIGHT + 10);
          
          let hitObstacle = false;
          for (let obs of obstacles) {
            if (!obs.conquered && rectCircleCollision(b, obs)) { hitObstacle = true; break; }
          }
          
          if (outOfBounds || hitObstacle) {
            if (hitObstacle) {
              for (let p = 0; p < 5; p++) {
                particles.push({
                  x: b.x, y: b.y,
                  vx: (Math.random() - 0.5) * 5, vy: (Math.random() - 0.5) * 5,
                  life: 0.7, color: '#4488ff', size: 1.5 + Math.random()
                });
              }
            }
            if (outOfBounds) {
              // Missed shot penalty
              state.score = Math.max(0, state.score + REWARD_PENALTIES.MISSED_SHOT_PENALTY);
            }
            bullets.splice(i, 1);
            continue;
          }

          // Bullet trail
          if (Math.random() > 0.5) {
            particles.push({
              x: b.x + (Math.random()-0.5) * 3, y: b.y + (Math.random()-0.5) * 3,
              vx: -b.vx * 0.04 + (Math.random()-0.5) * 0.4,
              vy: -b.vy * 0.04 + (Math.random()-0.5) * 0.4,
              life: 0.5, color: '#88ccff', size: 1 + Math.random()
            });
          }
        }

        // Spawn enemies
        state.spawnTimer += dt;
        const spawnInterval = waveData.count > 0 ? waveData.duration / waveData.count : 1000;
        if (state.spawnTimer > spawnInterval && state.enemiesSpawned < waveData.count) {
          const newEnemy = spawnEnemy(waveIndex);
          newEnemy.spawnTime = time;
          enemies.push(newEnemy);
          state.spawnTimer = 0;
          state.enemiesSpawned++;
        }

        // Enemy AI & Movement
        for (let i = enemies.length - 1; i >= 0; i--) {
          let e = enemies[i];
          const angleToPlayer = Math.atan2(player.y - e.y, player.x - e.x);
          const pEx = e.x; const pEy = e.y;
          
          // Behavior-based movement
          switch(e.behavior) {
            case 'chase':
              e.x += Math.cos(angleToPlayer) * e.speed;
              e.y += Math.sin(angleToPlayer) * e.speed;
              break;
              
            case 'flank':
              const flankAngle = angleToPlayer + e.flankOffset;
              const distToPlayer = distance(e.x, e.y, player.x, player.y);
              if (distToPlayer > 80) {
                e.x += Math.cos(flankAngle) * e.speed;
                e.y += Math.sin(flankAngle) * e.speed;
              } else {
                e.x += Math.cos(angleToPlayer) * e.speed * 1.5;
                e.y += Math.sin(angleToPlayer) * e.speed * 1.5;
              }
              break;
              
            case 'charge':
              e.chargeTimer += dt;
              if (!e.isCharging && e.chargeTimer > 2000) {
                e.isCharging = true;
                e.chargeAngle = angleToPlayer;
                e.chargeTimer = 0;
              }
              if (e.isCharging) {
                e.x += Math.cos(e.chargeAngle) * e.speed * 4;
                e.y += Math.sin(e.chargeAngle) * e.speed * 4;
                e.chargeTimer += dt;
                if (e.chargeTimer > 600) {
                  e.isCharging = false;
                  e.chargeTimer = 0;
                }
              } else {
                e.x += Math.cos(angleToPlayer) * e.speed * 0.4;
                e.y += Math.sin(angleToPlayer) * e.speed * 0.4;
              }
              break;
              
            case 'teleport':
              e.teleportCooldown -= dt;
              if (e.teleportCooldown <= 0) {
                // Teleport near player
                const teleAngle = Math.random() * Math.PI * 2;
                const teleDist = 80 + Math.random() * 60;
                e.x = player.x + Math.cos(teleAngle) * teleDist;
                e.y = player.y + Math.sin(teleAngle) * teleDist;
                e.x = Math.max(e.r, Math.min(GAME_CONSTANTS.CANVAS_WIDTH - e.r, e.x));
                e.y = Math.max(e.r, Math.min(GAME_CONSTANTS.CANVAS_HEIGHT - e.r, e.y));
                e.teleportCooldown = 3000 + Math.random() * 2000;
                // Teleport particles
                for (let p = 0; p < 8; p++) {
                  particles.push({
                    x: e.x + (Math.random()-0.5) * 20, y: e.y + (Math.random()-0.5) * 20,
                    vx: (Math.random()-0.5) * 3, vy: (Math.random()-0.5) * 3,
                    life: 0.8, color: '#33ff99', size: 2 + Math.random()
                  });
                }
              } else {
                e.x += Math.cos(angleToPlayer) * e.speed;
                e.y += Math.sin(angleToPlayer) * e.speed;
              }
              break;
              
            case 'split':
              e.x += Math.cos(angleToPlayer) * e.speed;
              e.y += Math.sin(angleToPlayer) * e.speed;
              break;
              
            case 'boss':
              e.x += Math.cos(angleToPlayer) * e.speed;
              e.y += Math.sin(angleToPlayer) * e.speed;
              break;
              
            default:
              e.x += Math.cos(angleToPlayer) * e.speed;
              e.y += Math.sin(angleToPlayer) * e.speed;
          }
          
          e.angle = angleToPlayer;
          
          // Obstacle collision for enemies
          for (let obs of obstacles) {
            if (!obs.conquered && rectCircleCollision(e, obs)) {
              e.x = pEx; e.y = pEy; break;
            }
          }

          // Laser collision with enemies (lasers damage demons too!)
          for (let l of lasers) {
            if (lineCircleCollision({x: e.x, y: e.y, r: e.r}, l.x, l.y, l.length, l.angle)) {
              e.hp -= 0.02; // Slow laser damage to enemies
            }
          }

          // Bullet hit detection
          let hit = false;
          for (let j = bullets.length - 1; j >= 0; j--) {
            let b = bullets[j];
            if (checkCollision({x: e.x, y: e.y, r: e.r}, {x: b.x, y: b.y, r: b.r})) {
              e.hp -= 1;
              e.hitTime = time;
              bullets.splice(j, 1);
              hit = true;
              
              for (let p = 0; p < 10; p++) {
                const pAngle = (p / 10) * Math.PI * 2;
                const spd = 3 + Math.random() * 4;
                particles.push({
                  x: e.x, y: e.y,
                  vx: Math.cos(pAngle) * spd + b.vx * 0.1,
                  vy: Math.sin(pAngle) * spd + b.vy * 0.1,
                  life: 0.9, color: e.color, size: 2 + Math.random() * 2
                });
              }
              break;
            }
          }

          // Enemy death
          if (e.hp <= 0) {
            // Combo system
            player.combo = Math.min(GAME_CONSTANTS.COMBO_MULTIPLIER_MAX, player.combo + 1);
            player.lastKillTime = time;
            
            const reward = calculateKillReward(e.score, player.combo);
            state.score += reward;
            rewardPopups.push({ x: e.x, y: e.y - 10, value: reward, life: 1.2, size: player.combo > 2 ? 18 : 14 });
            
            // Combo popup
            if (player.combo > 1) {
              rewardPopups.push({ x: e.x, y: e.y - 25, value: `${player.combo}x COMBO`, life: 1.5, size: 12, isText: true });
            }
            
            state.screenShake = e.type === 'DEMON_LORD' ? 30 : 6;
            
            // Death particles
            for (let p = 0; p < 25; p++) {
              const pAngle = (p / 25) * Math.PI * 2;
              const spd = 2 + Math.random() * 8;
              particles.push({
                x: e.x, y: e.y,
                vx: Math.cos(pAngle) * spd, vy: Math.sin(pAngle) * spd,
                life: 1.2 + Math.random() * 0.5, color: e.color, size: 2 + Math.random() * 3
              });
            }
            shockwaves.push({ x: e.x, y: e.y, radius: 5, maxRadius: e.r * 3.5, life: 1, color: e.color });

            // Split behavior
            if (e.type === 'JOROGUMO') {
              for (let s = 0; s < 2; s++) {
                const splitAngle = Math.random() * Math.PI * 2;
                enemies.push({
                  ...ENEMY_TYPES['WRAITH'], 
                  x: e.x + Math.cos(splitAngle) * 15, 
                  y: e.y + Math.sin(splitAngle) * 15, 
                  hp: 1, r: 8, 
                  id: Math.random().toString(36).substr(2, 9), 
                  type: 'WRAITH',
                  spawnTime: time,
                  chargeTimer: 0, isCharging: false, chargeAngle: 0, teleportCooldown: 0, flankOffset: Math.random() * Math.PI
                });
              }
            }
            
            if (e.type === 'DEMON_LORD') {
              // Massive boss death
              for (let p = 0; p < 80; p++) {
                const pAngle = (p / 80) * Math.PI * 2;
                const spd = 5 + Math.random() * 15;
                particles.push({
                  x: e.x, y: e.y,
                  vx: Math.cos(pAngle) * spd, vy: Math.sin(pAngle) * spd,
                  life: 2 + Math.random(), color: p % 3 === 0 ? '#ff0033' : p % 3 === 1 ? '#8b00ff' : '#ffffff', size: 3 + Math.random() * 5
                });
              }
              shockwaves.push({ x: e.x, y: e.y, radius: 10, maxRadius: 250, life: 1, color: '#ff0033' });
              shockwaves.push({ x: e.x, y: e.y, radius: 10, maxRadius: 180, life: 1, color: '#ffffff' });
              
              // No damage bonus
              if (player.noDamageTaken) {
                state.score += REWARD_PENALTIES.NO_DAMAGE_BONUS;
                rewardPopups.push({ x: player.x, y: player.y - 30, value: REWARD_PENALTIES.NO_DAMAGE_BONUS, life: 2, size: 20 });
              }
              
              onVictory(state.score);
              return;
            }
            enemies.splice(i, 1);
            continue;
          }

          // Player collision
          if (player.iframes <= 0 && checkCollision({x: player.x, y: player.y, r: player.r}, {x: e.x, y: e.y, r: e.r})) {
            player.hp -= 1;
            player.iframes = GAME_CONSTANTS.IFRAMES;
            player.noDamageTaken = false;
            state.screenShake = 12;
            state.hitFlash = 1;
            state.score = Math.max(0, state.score + REWARD_PENALTIES.DAMAGE_TAKEN);
            rewardPopups.push({ x: player.x, y: player.y - 15, value: REWARD_PENALTIES.DAMAGE_TAKEN, life: 1.2, size: 16 });
            
            if (player.hp <= 0) {
              onGameOver(state.score, waveData.hour);
              return;
            }
          }
        }
        
        if (player.iframes > 0) player.iframes--;

        // Laser collision with player
        for (let l of lasers) {
          l.angle += l.angularVelocity;
          if (player.iframes <= 0 && lineCircleCollision({x: player.x, y: player.y, r: player.r}, l.x, l.y, l.length, l.angle)) {
            player.hp -= 1;
            player.iframes = GAME_CONSTANTS.IFRAMES;
            player.noDamageTaken = false;
            state.screenShake = 10;
            state.hitFlash = 1;
            state.score = Math.max(0, state.score + REWARD_PENALTIES.DAMAGE_TAKEN);
            rewardPopups.push({ x: player.x, y: player.y - 15, value: REWARD_PENALTIES.DAMAGE_TAKEN, life: 1.2, size: 16 });
            if (player.hp <= 0) {
              onGameOver(state.score, waveData.hour);
              return;
            }
          }
        }

        // Particles
        for (let i = particles.length - 1; i >= 0; i--) {
          let p = particles[i];
          p.x += p.vx; p.y += p.vy;
          p.vx *= 0.95; p.vy *= 0.95;
          p.life -= 0.025;
          if (p.life <= 0) particles.splice(i, 1);
        }

        // Conquest particles
        for (let i = conquestParticles.length - 1; i >= 0; i--) {
          let p = conquestParticles[i];
          p.x += p.vx; p.y += p.vy;
          p.life -= 0.03;
          if (p.life <= 0) conquestParticles.splice(i, 1);
        }

        // Shockwaves
        for (let i = shockwaves.length - 1; i >= 0; i--) {
          let sw = shockwaves[i];
          sw.radius += (sw.maxRadius - sw.radius) * 0.1;
          sw.life -= 0.035;
          if (sw.life <= 0) shockwaves.splice(i, 1);
        }

        // Muzzle flashes
        for (let i = muzzleFlashes.length - 1; i >= 0; i--) {
          muzzleFlashes[i].life -= 0.12;
          if (muzzleFlashes[i].life <= 0) muzzleFlashes.splice(i, 1);
        }

        // Reward popups
        for (let i = rewardPopups.length - 1; i >= 0; i--) {
          rewardPopups[i].life -= 0.02;
          if (rewardPopups[i].life <= 0) rewardPopups.splice(i, 1);
        }

        // Hit flash
        if (state.hitFlash > 0) {
          state.hitFlash -= 0.06;
          if (state.hitFlash < 0) state.hitFlash = 0;
        }

        // Ambient dark embers/spirits
        if (Math.random() > 0.93) {
          embers.push({
            x: Math.random() * GAME_CONSTANTS.CANVAS_WIDTH,
            y: GAME_CONSTANTS.CANVAS_HEIGHT + 5,
            vx: (Math.random() - 0.5) * 0.4,
            vy: -(0.2 + Math.random() * 0.6),
            life: 3 + Math.random() * 2,
            size: 1 + Math.random() * 1.5,
            color: Math.random() > 0.6 ? '#8b00ff' : Math.random() > 0.3 ? '#ff0033' : '#4488ff'
          });
        }
        for (let i = embers.length - 1; i >= 0; i--) {
          let e = embers[i];
          e.x += e.vx + Math.sin(time / 1200 + i) * 0.15;
          e.y += e.vy;
          e.life -= 0.008;
          if (e.life <= 0 || e.y < -10) embers.splice(i, 1);
        }

        // Screen shake decay
        if (state.screenShake > 0) {
          state.screenShake *= 0.82;
          if (state.screenShake < 0.5) state.screenShake = 0;
        }

        // Wave end check
        if (state.timeInWave >= waveData.duration && state.enemiesSpawned >= waveData.count && enemies.length === 0 && waveData.type !== 'DEMON_LORD') {
          // Wave clear bonus
          state.score += REWARD_PENALTIES.WAVE_CLEAR_BONUS;
          if (player.noDamageTaken) {
            state.score += REWARD_PENALTIES.NO_DAMAGE_BONUS;
          }
          onWaveComplete(state.score);
        }
      }

      // --- DRAW ---
      ctx.save();
      if (state.screenShake > 0) {
        const sx = (Math.random() - 0.5) * state.screenShake;
        const sy = (Math.random() - 0.5) * state.screenShake;
        ctx.translate(sx, sy);
      }

      // Background
      if (bgImageRef.current) {
        ctx.drawImage(bgImageRef.current, 0, 0, GAME_CONSTANTS.CANVAS_WIDTH, GAME_CONSTANTS.CANVAS_HEIGHT);
      } else {
        ctx.fillStyle = '#0a0008';
        ctx.fillRect(0, 0, GAME_CONSTANTS.CANVAS_WIDTH, GAME_CONSTANTS.CANVAS_HEIGHT);
      }

      // Darkness overlay
      ctx.fillStyle = getSkyColor(waveIndex);
      ctx.fillRect(0, 0, GAME_CONSTANTS.CANVAS_WIDTH, GAME_CONSTANTS.CANVAS_HEIGHT);

      // Dynamic vignette centered on player
      const darkness = Math.min(0.92, 0.3 + waveIndex * 0.055);
      const grad = ctx.createRadialGradient(
        player.x, player.y, GAME_CONSTANTS.CANVAS_HEIGHT / 5,
        GAME_CONSTANTS.CANVAS_WIDTH / 2, GAME_CONSTANTS.CANVAS_HEIGHT / 2, GAME_CONSTANTS.CANVAS_HEIGHT * 0.85
      );
      grad.addColorStop(0, `rgba(5, 0, 8, ${darkness * 0.15})`);
      grad.addColorStop(0.5, `rgba(5, 0, 8, ${darkness * 0.45})`);
      grad.addColorStop(1, `rgba(5, 0, 8, ${Math.min(0.97, darkness + 0.1)})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, GAME_CONSTANTS.CANVAS_WIDTH, GAME_CONSTANTS.CANVAS_HEIGHT);

      // Ambient embers
      for (let e of embers) {
        ctx.globalAlpha = Math.min(1, e.life * 0.4);
        ctx.fillStyle = e.color;
        ctx.shadowColor = e.color;
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      // Sanctuaries
      for (let zone of sanctuaries) {
        drawSanctuary(ctx, zone, time);
      }
      
      // Obstacles
      for (let obs of obstacles) {
        drawObstacle(ctx, obs, time);
      }
      
      // Conquest particles
      ctx.globalCompositeOperation = 'lighter';
      for (let p of conquestParticles) {
        ctx.globalAlpha = p.life * 0.6;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      
      // Lasers
      for (let l of lasers) {
        drawLaser(ctx, l, time);
      }

      // Shockwaves
      for (let sw of shockwaves) {
        drawShockwave(ctx, sw);
      }

      // Particles
      ctx.globalCompositeOperation = 'lighter';
      for (let p of particles) {
        ctx.globalAlpha = Math.min(1, p.life);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * Math.min(1, p.life + 0.3), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      ctx.globalCompositeOperation = 'source-over';

      // Muzzle flashes
      ctx.globalCompositeOperation = 'lighter';
      for (let mf of muzzleFlashes) {
        const mfGrad = ctx.createRadialGradient(mf.x, mf.y, 0, mf.x, mf.y, mf.size * mf.life);
        mfGrad.addColorStop(0, `rgba(200, 230, 255, ${mf.life})`);
        mfGrad.addColorStop(0.4, `rgba(100, 180, 255, ${mf.life * 0.7})`);
        mfGrad.addColorStop(1, 'rgba(100, 180, 255, 0)');
        ctx.fillStyle = mfGrad;
        ctx.beginPath();
        ctx.arc(mf.x, mf.y, mf.size * mf.life, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';

      // Bullets
      for (let b of bullets) {
        drawBullet(ctx, b);
      }

      // Enemies
      for (let e of enemies) {
        drawDemon(ctx, e, time);
      }

      // Player trail
      ctx.globalCompositeOperation = 'lighter';
      for (let t of player.trails) {
        const trailGrad = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, player.r * t.life);
        trailGrad.addColorStop(0, `rgba(100, 180, 255, ${t.life * 0.3})`);
        trailGrad.addColorStop(1, 'rgba(100, 180, 255, 0)');
        ctx.fillStyle = trailGrad;
        ctx.beginPath();
        ctx.arc(t.x, t.y, player.r * t.life * 1.3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';

      // Player (samurai)
      if (player.iframes === 0 || Math.floor(time / 80) % 2 === 0) {
        drawSamurai(ctx, player, time, mouseRef);
      }

      // Reward popups
      for (let popup of rewardPopups) {
        if (popup.isText) {
          ctx.globalAlpha = popup.life;
          ctx.font = `bold ${popup.size}px "Share Tech Mono", monospace`;
          ctx.textAlign = 'center';
          ctx.fillStyle = '#ffcc00';
          ctx.shadowColor = '#ffcc00';
          ctx.shadowBlur = 8;
          const yOff = (1 - popup.life) * 25;
          ctx.fillText(popup.value, popup.x, popup.y - yOff);
          ctx.shadowBlur = 0;
          ctx.globalAlpha = 1;
          ctx.textAlign = 'left';
        } else {
          drawRewardPopup(ctx, popup);
        }
      }

      // Hit flash overlay
      if (state.hitFlash > 0) {
        ctx.fillStyle = `rgba(180, 0, 30, ${state.hitFlash * 0.35})`;
        ctx.fillRect(0, 0, GAME_CONSTANTS.CANVAS_WIDTH, GAME_CONSTANTS.CANVAS_HEIGHT);
      }

      ctx.restore();

      // Update HUD
      if (state.announcing) {
        setHudState({ hp: player.hp, spirit: player.spirit, score: state.score, time: 0, maxTime: waveData.duration, announcing: true, combo: player.combo });
      } else {
        setHudState({ hp: player.hp, spirit: player.spirit, score: state.score, time: state.timeInWave, maxTime: waveData.duration, announcing: false, combo: player.combo });
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
