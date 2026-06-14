import React, { useState } from 'react';
import GameCanvas from './GameCanvas';
import { WAVES, REWARD_PENALTIES } from './engine';
import './index.css';

export default function App() {
  const [screen, setScreen] = useState('intro');
  const [waveIndex, setWaveIndex] = useState(0);
  const [finalScore, setFinalScore] = useState(0);
  const [finalHour, setFinalHour] = useState('');
  
  const [hudState, setHudState] = useState({
    hp: 5, spirit: 100, score: 0, time: 0, maxTime: 30000, announcing: false, combo: 0
  });

  const [turingState, setTuringState] = useState({
    active: false,
    tape: [],
    target: 0,
    input: '',
    error: false,
    attempts: 0,
    maxAttempts: 3,
    hint: '',
  });

  const startGame = () => {
    setWaveIndex(0);
    setScreen('playing');
  };

  const handleWaveComplete = (score) => {
    if (WAVES[waveIndex].isSpades) {
      // Demon Seal Decryption challenge
      const val = Math.floor(Math.random() * 256);
      const binaryStr = val.toString(2).padStart(8, '0');
      const tape = binaryStr.split('').map(b => b === '1');
      const hint = `Hint: The value is between ${Math.max(0, val - 20)} and ${Math.min(255, val + 20)}`;
      setTuringState({ active: true, tape, target: val, input: '', error: false, attempts: 0, maxAttempts: 3, hint });
    } else {
      advanceWave();
    }
  };

  const advanceWave = () => {
    if (waveIndex < WAVES.length - 1) {
      setWaveIndex(prev => prev + 1);
    } else {
      setScreen('victory');
    }
  };

  const handleTuringSubmit = (e) => {
    e.preventDefault();
    const guess = parseInt(turingState.input, 10);
    
    if (guess === turingState.target) {
      // Perfect decryption bonus
      const bonus = REWARD_PENALTIES.PERFECT_DECRYPT * (turingState.maxAttempts - turingState.attempts);
      setTuringState({ active: false, tape: [], target: 0, input: '', error: false, attempts: 0, maxAttempts: 3, hint: '' });
      advanceWave();
    } else {
      const newAttempts = turingState.attempts + 1;
      
      if (newAttempts >= turingState.maxAttempts) {
        // Failed all attempts - lose HP and advance anyway (penalty)
        setTuringState({ active: false, tape: [], target: 0, input: '', error: false, attempts: 0, maxAttempts: 3, hint: '' });
        // The penalty is applied through the HUD state - player loses 1 HP
        setHudState(prev => ({ ...prev, hp: Math.max(1, prev.hp - REWARD_PENALTIES.DECRYPT_FAIL_HP) }));
        advanceWave();
      } else {
        // Give directional hint
        const direction = guess < turingState.target ? 'Too low!' : 'Too high!';
        setTuringState(prev => ({ 
          ...prev, 
          error: true, 
          input: '', 
          attempts: newAttempts,
          hint: `${direction} ${prev.maxAttempts - newAttempts} attempts remaining.`
        }));
      }
    }
  };

  const handleGameOver = (score, hour) => {
    setFinalScore(score);
    setFinalHour(hour);
    setScreen('gameover');
  };

  const handleVictory = (score) => {
    setFinalScore(score);
    setScreen('victory');
  };

  return (
    <div className="game-container">
      {screen === 'playing' && (
        <>
          <div className="hud-container">
            <div className="hud-left">
              <div className="heart-container">
                {Array.from({length: 5}).map((_, i) => (
                  <span key={i} className="heart-icon font-display" style={{opacity: i < Math.floor(hudState.hp) ? 1 : 0.2}}>♥</span>
                ))}
              </div>
              {hudState.combo > 1 && (
                <div className="combo-display font-display">
                  <span className="combo-number">{hudState.combo}x</span>
                  <span className="combo-label">COMBO</span>
                </div>
              )}
            </div>
            
            <div className="hud-center">
              <div className="hour-clock font-display">{WAVES[waveIndex].hour}</div>
              {!hudState.announcing && WAVES[waveIndex].duration !== 999999 && (
                <div className="hour-bar-container">
                  <div className="hour-bar-fill" style={{ width: `${Math.max(0, 100 - (hudState.time / hudState.maxTime) * 100)}%` }}></div>
                </div>
              )}
            </div>
            
            <div className="hud-right">
              <div className="score-text font-display">SCORE {Math.floor(hudState.score)}</div>
            </div>
          </div>

          <div className="solar-container">
            <span className="solar-label font-display">SPIRIT</span>
            <div className="solar-bar-bg">
              <div 
                className={`solar-bar-fill ${hudState.spirit < 25 ? 'red' : hudState.spirit < 50 ? 'orange' : ''}`} 
                style={{ width: `${hudState.spirit}%` }}
              ></div>
            </div>
          </div>

          <GameCanvas 
            waveIndex={waveIndex}
            onWaveComplete={handleWaveComplete}
            onGameOver={handleGameOver}
            onVictory={handleVictory}
            setHudState={setHudState}
            isTuringActive={turingState.active}
          />

          {hudState.announcing && (
            <div className="overlay overlay-announcement" style={{animation: 'fadeInOut 3s forwards'}}>
              <h1 className="wave-hour-label font-display">{WAVES[waveIndex].hour}</h1>
              <h2 className="wave-title font-display">{WAVES[waveIndex].title}</h2>
              <p className="wave-flavour">{WAVES[waveIndex].text}</p>
            </div>
          )}

          {turingState.active && (
            <div className="overlay">
              <div className="turing-overlay">
                <h2 className="turing-title font-display">DEMON SEAL DECRYPTION</h2>
                <p className="turing-subtitle">Break the 8-bit demon seal to advance. Convert the binary to decimal.</p>
                
                <div className="turing-tape">
                  {turingState.tape.map((bit, i) => (
                    <div key={i} className="turing-cell font-mono" style={{ background: bit ? '#ff0033' : 'rgba(255,0,50,0.1)', color: bit ? '#fff' : '#ff0033' }}>
                      {bit ? '1' : '0'}
                    </div>
                  ))}
                </div>

                <div className="turing-attempts">
                  {Array.from({length: turingState.maxAttempts}).map((_, i) => (
                    <span key={i} className={`attempt-dot ${i < turingState.attempts ? 'used' : ''}`}></span>
                  ))}
                </div>

                <form onSubmit={handleTuringSubmit} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px'}}>
                  <input 
                    type="number" 
                    className="turing-input" 
                    value={turingState.input}
                    onChange={(e) => setTuringState(prev => ({...prev, input: e.target.value, error: false}))}
                    placeholder="Enter decimal value"
                    autoFocus
                  />
                  {turingState.error && <span className="turing-error">{turingState.hint}</span>}
                  {!turingState.error && turingState.attempts === 0 && <span className="turing-hint">Failure costs 1 HP. Success grants bonus score.</span>}
                  <button type="submit" className="btn-primary btn-decrypt">BREAK SEAL</button>
                </form>
              </div>
            </div>
          )}
        </>
      )}

      {screen === 'intro' && (
        <div className="overlay overlay-glass">
          <div className="sun-orb samurai-orb"></div>
          <h1 className="title font-display">LAST LIGHT</h1>
          <p className="subtitle">A Samurai's Stand Against the Dark</p>
          
          <div className="lore-text">
            <p>The demons rise as the sun falls. Only your spirit blade holds them back.</p>
          </div>
          
          <div className="controls-grid">
            <span className="control-key">WASD / ARROWS</span>
            <span className="control-action">Move</span>
            <span className="control-key">MOUSE</span>
            <span className="control-action">Aim Katana</span>
            <span className="control-key">L-CLICK / SPACE</span>
            <span className="control-action">Spirit Slash</span>
          </div>

          <div className="mechanics-info">
            <div className="mechanic-item">
              <span className="mechanic-icon">⛩</span>
              <span className="mechanic-text">Stand in Spirit Sanctuaries to recharge</span>
            </div>
            <div className="mechanic-item">
              <span className="mechanic-icon">🔮</span>
              <span className="mechanic-text">Conquer cursed barriers by standing near them</span>
            </div>
            <div className="mechanic-item">
              <span className="mechanic-icon">⚔</span>
              <span className="mechanic-text">Chain kills for combo multipliers</span>
            </div>
          </div>

          <button className="btn-primary" onClick={startGame}>DRAW YOUR BLADE</button>
        </div>
      )}

      {screen === 'gameover' && (
        <div className="overlay overlay-glass">
          <div className="moon-orb demon-orb"></div>
          <h1 className="heading-consumed font-display">FALLEN</h1>
          <p className="death-subtitle">The darkness has claimed another warrior.</p>
          
          <div className="stats-card">
            <div className="stat-row">
              <span className="control-action">HOUR REACHED</span>
              <span className="control-key">{finalHour}</span>
            </div>
            <div className="stat-row">
              <span className="control-action">DEMONS SLAIN</span>
              <span className="control-key">{Math.floor(finalScore / 15)}</span>
            </div>
            <div className="stat-row">
              <span className="control-action">FINAL SCORE</span>
              <span className="control-key">{Math.floor(finalScore)}</span>
            </div>
          </div>

          <button className="btn-primary" onClick={startGame}>RISE AGAIN</button>
        </div>
      )}

      {screen === 'victory' && (
        <div className="overlay overlay-glass">
          <div className="sun-orb victory-orb"></div>
          <h1 className="heading-escaped font-display">DAWN BREAKS</h1>
          <p className="victory-subtitle">The Demon Lord falls. Light returns to the land.</p>
          
          <div className="stats-card">
            <div className="stat-row">
              <span className="control-action">WAVES SURVIVED</span>
              <span className="control-key">12 / 12</span>
            </div>
            <div className="stat-row">
              <span className="control-action">FINAL SCORE</span>
              <span className="control-key">{Math.floor(finalScore)}</span>
            </div>
          </div>

          <button className="btn-primary" onClick={startGame}>FIGHT AGAIN</button>
        </div>
      )}
    </div>
  );
}
