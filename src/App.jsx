import React, { useState } from 'react';
import GameCanvas from './GameCanvas';
import { WAVES } from './engine';
import './index.css';

export default function App() {
  const [screen, setScreen] = useState('intro'); // intro, playing, gameover, victory
  const [waveIndex, setWaveIndex] = useState(0);
  const [finalScore, setFinalScore] = useState(0);
  const [finalHour, setFinalHour] = useState('');
  
  const [hudState, setHudState] = useState({
    hp: 5, solar: 100, score: 0, time: 0, maxTime: 30000, announcing: false
  });

  const [turingState, setTuringState] = useState({
    active: false,
    tape: [],
    target: 0,
    input: '',
    error: false
  });

  const startGame = () => {
    setWaveIndex(0);
    setScreen('playing');
  };

  const handleWaveComplete = (score) => {
    if (WAVES[waveIndex].isSpades) {
      const val = Math.floor(Math.random() * 256);
      const binaryStr = val.toString(2).padStart(8, '0');
      const tape = binaryStr.split('').map(b => b === '1');
      setTuringState({ active: true, tape, target: val, input: '', error: false });
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
    if (parseInt(turingState.input, 10) === turingState.target) {
      setTuringState({ active: false, tape: [], target: 0, input: '', error: false });
      advanceWave();
    } else {
      setTuringState(prev => ({ ...prev, error: true, input: '' }));
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
            <span className="solar-label font-display">SOLAR</span>
            <div className="solar-bar-bg">
              <div 
                className={`solar-bar-fill ${hudState.solar < 25 ? 'red' : hudState.solar < 50 ? 'orange' : ''}`} 
                style={{ width: `${hudState.solar}%` }}
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
                <h2 className="turing-title font-display">TURING DECRYPTION REQUIRED</h2>
                <p className="turing-subtitle">Decode the 8-bit binary tape to survive.</p>
                
                <div className="turing-tape">
                  {turingState.tape.map((bit, i) => (
                    <div key={i} className="turing-cell font-mono" style={{ background: bit ? '#0f0' : 'rgba(0,255,0,0.1)', color: bit ? '#000' : '#0f0' }}>
                      {bit ? '1' : '0'}
                    </div>
                  ))}
                </div>

                <form onSubmit={handleTuringSubmit} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px'}}>
                  <input 
                    type="number" 
                    className="turing-input" 
                    value={turingState.input}
                    onChange={(e) => setTuringState(prev => ({...prev, input: e.target.value}))}
                    placeholder="Decimal"
                    autoFocus
                  />
                  {turingState.error && <span style={{color: '#ff2a00', textShadow: '0 0 10px #ff2a00', fontFamily: 'Share Tech Mono'}}>INCORRECT DECRYPTION</span>}
                  <button type="submit" className="btn-primary" style={{marginTop: '10px', fontSize: '1.2rem', padding: '0.8rem 2rem', borderColor: '#0f0', color: '#0f0', boxShadow: '0 0 15px rgba(0,255,0,0.2)'}}>DECRYPT</button>
                </form>
              </div>
            </div>
          )}
        </>
      )}

      {screen === 'intro' && (
        <div className="overlay overlay-glass">
          <div className="sun-orb"></div>
          <h1 className="title font-display">LAST LIGHT</h1>
          <p className="subtitle">A June Solstice Survival Arena</p>
          
          <div className="controls-grid">
            <span className="control-key">WASD / ARROWS</span>
            <span className="control-action">Move</span>
            <span className="control-key">MOUSE</span>
            <span className="control-action">Aim</span>
            <span className="control-key">L-CLICK / SPACE</span>
            <span className="control-action">Shoot</span>
          </div>

          <button className="btn-primary" onClick={startGame}>ENTER THE ARENA</button>
        </div>
      )}

      {screen === 'gameover' && (
        <div className="overlay overlay-glass">
          <div className="moon-orb"></div>
          <h1 className="heading-consumed font-display">CONSUMED</h1>
          
          <div className="stats-card">
            <div className="stat-row">
              <span className="control-action">HOUR REACHED</span>
              <span className="control-key">{finalHour}</span>
            </div>
            <div className="stat-row">
              <span className="control-action">FINAL SCORE</span>
              <span className="control-key">{Math.floor(finalScore)}</span>
            </div>
          </div>

          <button className="btn-primary" onClick={startGame}>RESTART SIMULATION</button>
        </div>
      )}

      {screen === 'victory' && (
        <div className="overlay overlay-glass">
          <div className="sun-orb" style={{animation: 'none', transform: 'scale(1.2)', filter: 'brightness(1.5)'}}></div>
          <h1 className="heading-escaped font-display">ESCAPED</h1>
          
          <div className="stats-card">
            <div className="stat-row">
              <span className="control-action">ROUNDS SURVIVED</span>
              <span className="control-key">12 / 12</span>
            </div>
            <div className="stat-row">
              <span className="control-action">FINAL SCORE</span>
              <span className="control-key">{Math.floor(finalScore)}</span>
            </div>
          </div>

          <button className="btn-primary" onClick={startGame}>RESTART SIMULATION</button>
        </div>
      )}
    </div>
  );
}
