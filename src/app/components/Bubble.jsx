"use client";
import ParticlesBackground from './ParticlesBackground';
import { useState, useEffect, useRef, useCallback } from 'react';
import styles from './BubbleGame.module.css';

const BubbleGame = () => {
  // --- Game State ---
  const [gameState, setGameState] = useState('idle'); 
  const [isPaused, setIsPaused] = useState(false);
  
  const [numbers, setNumbers] = useState([]);
  const [positions, setPositions] = useState([]);
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(1);
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState(false);
  const [clickedNumbers, setClickedNumbers] = useState([]);
  const [correctNumbers, setCorrectNumbers] = useState([]);
  
  // UI States
  const [countdown, setCountdown] = useState(3);
  const [roundTimer, setRoundTimer] = useState(10);
  const [showPerfectRound, setShowPerfectRound] = useState(false);
  const [showRoundScreen, setShowRoundScreen] = useState(false);
  const [won, setWon] = useState(false);
  const [highScore, setHighScore] = useState(0);

  // --- Settings State ---
  const [showMenu, setShowMenu] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [settings, setSettings] = useState({ music: true, sfx: true, vibration: true });

  // --- Refs ---
  const roundTimerRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const hideTimerRef = useRef(null);
  const remainingTimeRef = useRef(10000); 
  
  // Anti-double-click ref
  const processingClickRef = useRef(new Set());

  // Audio Refs
  const audioRef = useRef(null);
  const correctAudioRef = useRef(null);
  const wrongAudioRef = useRef(null);
  const gameOverAudioRef = useRef(null);
  const winAudioRef = useRef(null);
  const startSoundRef = useRef(null);
  const returnSoundRef = useRef(null); 
  const tickAudioRef = useRef(null);

  const maxRound = 20;

  // --- 1. Init & Cleanup ---
  useEffect(() => {
    const savedHighScore = parseInt(localStorage.getItem('highScore')) || 0;
    const tutorialSeen = localStorage.getItem('tutorialSeen') === 'true';

    setHighScore(savedHighScore);
    if (!tutorialSeen) setShowTutorial(true);

    return () => clearAllTimers();
  }, []);

  // --- 2. AUDIO: Visibility Logic ---
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // 🛑 PAUSE EVERYTHING
        audioRef.current?.pause();
        tickAudioRef.current?.pause();
        
        // Soft pause logic if hidden
        if (gameState === 'playing' && !isPaused) {
           clearInterval(roundTimerRef.current);
        }
      } else {
        // ▶️ RESUME
        if (!isPaused && (gameState === 'playing' || gameState === 'showing')) {
          if (settings.music) audioRef.current?.play().catch(() => {});
          
          // Resume timer if playing
          if (gameState === 'playing') {
             startTimer(remainingTimeRef.current);
          }
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [gameState, isPaused, settings.music]);

  const clearAllTimers = useCallback(() => {
    if (roundTimerRef.current) clearInterval(roundTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    
    if (tickAudioRef.current) {
      tickAudioRef.current.pause();
      tickAudioRef.current.currentTime = 0;
    }
  }, []);

  const vibrate = (pattern = 200) => {
    if (settings.vibration && typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(pattern);
    }
  };

  // --- 3. Generators ---
  const generatePositions = useCallback((count) => {
    const newPositions = [];
    for (let i = 0; i < count; i++) {
      let position, attempts = 0, overlaps = true;
      while (overlaps && attempts < 200) {
        attempts++;
        const left = 10 + Math.random() * 80; 
        const top = 15 + Math.random() * 70;
        const hasCollision = newPositions.some(pos => {
          const dx = pos.left - left;
          const dy = (pos.top - top) * 1.5; 
          return Math.sqrt(dx*dx + dy*dy) < 22; 
        });
        if (!hasCollision) { position = { left, top }; overlaps = false; }
      }
      if (!position) position = { left: 50, top: 50 };
      newPositions.push(position);
    }
    return newPositions;
  }, []);

  const generateNumbers = useCallback((count) => {
    const nums = new Set();
    while (nums.size < count) nums.add(Math.floor(Math.random() * 20) + 1);
    return Array.from(nums);
  }, []);

  // --- 4. Timer Logic ---
  const startTimer = (durationMs) => {
    if (roundTimerRef.current) clearInterval(roundTimerRef.current);
    
    const startTime = Date.now();
    const endTime = startTime + durationMs;
    const roundTotalDuration = Math.max(10000 - ((round - 1) * 500), 2000);

    roundTimerRef.current = setInterval(() => {
        if (document.hidden) return;

        const now = Date.now();
        const msLeft = endTime - now;
        remainingTimeRef.current = msLeft; 

        const progress = (roundTotalDuration - msLeft) / roundTotalDuration;
        const visualRemaining = 10 * (1 - progress); 

        if (msLeft <= 0) {
            handleGameOver();
        } else {
            setRoundTimer(Math.max(0, Math.ceil(visualRemaining)));
            if (visualRemaining <= 3.5 && settings.sfx) { 
               if (!document.hidden && tickAudioRef.current?.paused) {
                 tickAudioRef.current.play().catch(()=>{});
               }
            }
        }
    }, 100);
  };

  const handleGameOver = () => {
    setRoundTimer(0);
    clearAllTimers(); 
    setError(true);
    setGameState('gameover');
    
    if (settings.sfx && !document.hidden) {
        gameOverAudioRef.current?.play().catch(()=>{});
    }
  };

  const shareScore = () => {
    const text = `🧠 I scored ${score} on BrainBuffer! High Score: ${highScore}. Can you beat me?`;
    if (navigator.share) {
      navigator.share({
        title: 'BrainBuffer',
        text: text,
        url: window.location.href,
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(text);
      alert("Score copied to clipboard!");
    }
  };

  // --- 5. Core Game Flow ---
  const startRound = useCallback((roundNum) => {
    clearAllTimers(); 
    setRoundTimer(10); 
    processingClickRef.current.clear();

    setShowRoundScreen(true);
    setCountdown(3);
    
    let counter = 3;
    countdownIntervalRef.current = setInterval(() => {
      counter -= 1;
      if (counter > 0) {
        setCountdown(counter);
      } else {
        clearInterval(countdownIntervalRef.current);
        setShowRoundScreen(false);

        const count = Math.min(3 + Math.floor((roundNum - 1) / 2), 8); 
        setNumbers(generateNumbers(count));
        setPositions(generatePositions(count));
        setCurrentStep(0);
        setError(false);
        setClickedNumbers([]);
        setCorrectNumbers([]);
        
        setGameState('showing'); 
      }
    }, 1000);
  }, [generateNumbers, generatePositions, clearAllTimers]);

  useEffect(() => {
    if (gameState === 'showing' && !isPaused) {
      const revealTime = Math.max(3000 - (round - 1) * 300, 1000);
      
      hideTimerRef.current = setTimeout(() => {
        setGameState('playing');
        const realDuration = Math.max(10000 - ((round - 1) * 500), 2000); 
        startTimer(realDuration);
      }, revealTime);

      return () => clearTimeout(hideTimerRef.current);
    }
  }, [gameState, round, isPaused]); 

  const startGame = useCallback(() => {
    if (showTutorial) return; 
    clearAllTimers();
    setScore(0);
    setRound(1);
    setWon(false);
    setRoundTimer(10); 
    setIsPaused(false);
    startRound(1);
    
    if (settings.music && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.volume = 0.5;
      audioRef.current.play().catch(() => {});
    }
  }, [startRound, clearAllTimers, showTutorial, settings.music]);

  // --- 6. Menus ---
  const togglePause = () => {
    if (gameState === 'idle' || gameState === 'gameover') return;

    if (!isPaused) {
        setIsPaused(true);
        setShowMenu(true);
        clearAllTimers(); 
        if (audioRef.current) audioRef.current.pause();
    } else {
        setIsPaused(false);
        setShowMenu(false);
        if (gameState === 'playing') startTimer(remainingTimeRef.current); 
        if (settings.music && audioRef.current) audioRef.current.play().catch(()=>{});
    }
  };

  const resetGameData = () => {
    if (confirm("Reset high score?")) {
        localStorage.clear();
        setHighScore(0);
        setShowMenu(false);
        setIsPaused(false);
        setGameState('idle');
        location.reload(); 
    }
  };

  // --- 7. Interaction ---
  const handleClick = (num) => {
    if (gameState !== 'playing' || isPaused) return;

    if (processingClickRef.current.has(num)) return;
    processingClickRef.current.add(num);

    const sorted = [...numbers].sort((a, b) => a - b);
    setClickedNumbers(prev => [...prev, num]);

    if (num === sorted[currentStep]) {
      setCorrectNumbers(prev => [...prev, num]);
      vibrate(50);
      
      if(settings.sfx) {
         const sound = correctAudioRef.current?.cloneNode();
         if(sound) { sound.volume = 0.6; sound.play().catch(()=>{}); }
      }

      if (currentStep + 1 === sorted.length) {
        clearAllTimers(); 
        setRoundTimer(10); 

        // Score: 1 pt per bubble + time bonus
        const basePoints = numbers.length; 
        const timeBonus = Math.floor(roundTimer); 
        const roundScore = basePoints + timeBonus;
        const newScore = score + roundScore;

        if (newScore > highScore) {
          localStorage.setItem('highScore', newScore);
          setHighScore(newScore);
        }
        setScore(newScore);

        if (!error) {
          setShowPerfectRound(true);
          setTimeout(() => setShowPerfectRound(false), 1200);
        }

        if (round + 1 > maxRound) {
          setWon(true);
          handleGameOver();
          if(settings.sfx) winAudioRef.current?.play();
        } else {
          setRound(r => r + 1);
          setTimeout(() => startRound(round + 1), 1000);
        }
      } else {
        setCurrentStep(prev => prev + 1);
      }
    } else {
      clearAllTimers(); 
      setError(true);
      vibrate([200, 100, 200]);
      if(settings.sfx) wrongAudioRef.current?.play();
      setTimeout(() => {
        setGameState('gameover');
        if(settings.sfx && !document.hidden) gameOverAudioRef.current?.play();
      }, 500);
    }
  };

  return (
    <div className={styles.container}>
      <ParticlesBackground />
      
      <audio ref={audioRef} src="/bgmusic.mp3" loop preload="auto" />
      <audio ref={tickAudioRef} src="/gametimer.mp3" preload="auto" />
      <audio ref={correctAudioRef} src="/tap.wav" preload="auto" />
      <audio ref={wrongAudioRef} src="/error.mp3" preload="auto" />
      <audio ref={gameOverAudioRef} src="/over.wav" preload="auto" />
      <audio ref={winAudioRef} src="/win.wav" preload="auto" />
      <audio ref={startSoundRef} src="/start.wav" />
      <audio ref={returnSoundRef} src="/return.wav" />

      {/* --- HUD --- */}
      <div className={styles.header}>
        {/* Adjusted for Mobile: Smaller Gap, No Wrapping, Shortened Label */}
        <div style={{display: 'flex', gap: '6px', alignItems: 'center'}}>
            <div className={styles.statBadge} style={{whiteSpace: 'nowrap'}}>
                <span className={styles.currencyIcon}>🏆</span> {highScore}
            </div>
            {gameState !== 'idle' && (
               <div className={styles.statBadge} style={{color: '#3b82f6', whiteSpace: 'nowrap'}}>
                  {/* Changed "Score:" to "Sc:" to fix mobile overlap */}
                  <span style={{opacity: 0.7, marginRight: '4px'}}>Score:</span>{score}
               </div>
            )}
        </div>
        
        <div className={styles.timerWrapper}>
            <div className={`${styles.roundTimer} ${roundTimer <= 3 ? styles.timerWarning : ''}`}>
            {roundTimer}
            </div>
        </div>

        <button className={styles.hamburger} onClick={togglePause}>
            <div className={styles.bar}></div>
            <div className={styles.bar}></div>
        </button>
      </div>

      {/* --- Bubbles --- */}
      <div className={styles.bubblesContainer}>
        {numbers.map((num, i) => (
          <button
            key={`${round}-${i}`}
            className={`
              ${styles.bubble} 
              ${error ? styles.error : ''} 
              ${clickedNumbers.includes(num) ? styles.clicked : ''} 
              ${correctNumbers.includes(num) ? styles.correct : ''}
              ${gameState === 'showing' ? styles.visible : ''}
            `}
            style={{
              left: `${positions[i]?.left}%`,
              top: `${positions[i]?.top}%`
            }}
            onClick={() => handleClick(num)}
            disabled={gameState !== 'playing' || isPaused}
          >
            <span className={styles.number}>
              {(gameState === 'showing' || gameState === 'gameover' || clickedNumbers.includes(num)) ? num : ''}
            </span>
            {correctNumbers.includes(num) && <span className={styles.checkmark}>✓</span>}
          </button>
        ))}
      </div>

      {/* --- PAUSE MENU --- */}
      {showMenu && (
        <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
                <h2>Paused</h2>
                <div className={styles.settingRow}>
                    <span>Music</span>
                    <button className={`${styles.toggleBtn} ${settings.music ? styles.active : ''}`} 
                        onClick={() => setSettings({...settings, music: !settings.music})}>
                        {settings.music ? 'ON' : 'OFF'}
                    </button>
                </div>
                <div className={styles.settingRow}>
                    <span>Sound FX</span>
                    <button className={`${styles.toggleBtn} ${settings.sfx ? styles.active : ''}`}
                        onClick={() => setSettings({...settings, sfx: !settings.sfx})}>
                        {settings.sfx ? 'ON' : 'OFF'}
                    </button>
                </div>
                <div className={styles.settingRow}>
                    <span>Haptics</span>
                    <button className={`${styles.toggleBtn} ${settings.vibration ? styles.active : ''}`}
                        onClick={() => setSettings({...settings, vibration: !settings.vibration})}>
                        {settings.vibration ? 'ON' : 'OFF'}
                    </button>
                </div>

                <div style={{marginTop: '20px', marginBottom: '20px', fontSize: '0.8rem', color: '#6b7280', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center'}}>
                   <a href="https://doc-hosting.flycricket.io/brainbuffer-privacy-policy/d39bde6f-7aa1-492b-b647-030966c55a88/privacy" target="_blank" rel="noopener noreferrer" style={{textDecoration: 'underline', color: '#3b82f6'}}>
                      Privacy Policy
                   </a>
                   <span>v1.0 • Made with ❤️ by yaseir.png</span>
                </div>

                <div className={styles.menuActions}>
                    <button className={styles.primaryBtn} onClick={togglePause}>Resume</button>
                    <button className={styles.secondaryBtn} style={{background: '#ffe4e6', color: '#e11d48'}} onClick={resetGameData}>Reset High Score</button>
                    <button className={styles.dangerBtn} onClick={() => { togglePause(); setGameState('idle'); clearAllTimers(); }}>Quit Game</button>
                </div>
            </div>
        </div>
      )}

      {/* --- TUTORIAL --- */}
      {showTutorial && (
        <div className={styles.tutorialOverlay}>
            <div className={styles.tutorialCard}>
                <h2>How to Play 🧠</h2>
                <div className={styles.tutorialStep}>1. Memorize numbers.</div>
                <div className={styles.tutorialStep}>2. Tap in order (1, 2, 3...) after they hide.</div>
                <button className={styles.tutorialBtn} onClick={() => { setShowTutorial(false); localStorage.setItem('tutorialSeen', 'true'); }}>Got it!</button>
            </div>
        </div>
      )}

      {/* --- SCREENS --- */}
      {gameState === 'idle' && !showTutorial && (
        <div className={styles.startScreen}>
          {/* ✅ Branded Logo Style */}
          <h1 style={{ letterSpacing: '-1px' }}>
             <span style={{ color: '#1e293b' }}>Brain</span>
             <span style={{ color: '#3b82f6' }}>Buffer</span>
          </h1>
          <div className={styles.statBadge} style={{marginBottom:'20px'}}>🏆 High Score: {highScore}</div>
          <button onClick={() => { startSoundRef.current?.play(); startGame(); }}>
            Start Game
          </button>
        </div>
      )}

      {gameState === 'gameover' && (
        <div className={styles.gameOverScreen}>
          <h2>{won ? "You Won! 🎉" : "Game Over"}</h2>
          <p>Final Score: {score}</p>
          
          <button onClick={() => { returnSoundRef.current?.play(); startGame(); }}>
            Try Again
          </button>
          
          <button className={styles.secondaryBtn} style={{marginTop: '10px', width: 'auto', padding: '12px 30px'}} onClick={shareScore}>
             Share Score 📤
          </button>
          
          <button 
             className={styles.secondaryBtn} 
             style={{ marginTop: '10px', width: 'auto', padding: '12px 30px' }} 
             onClick={() => setGameState('idle')}
          >
             Home
          </button>
        </div>
      )}

      {showRoundScreen && (
        <div className={styles.roundTransition}>
          <h2>Round {round}</h2>
          <div className={styles.countdown}>{countdown}</div>
        </div>
      )}

      {showPerfectRound && (
        <div className={styles.perfectRoundCelebration}>
          Perfect!
        </div>
      )}
    </div>
  );
};

export default BubbleGame;