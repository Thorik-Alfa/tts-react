import React, { useState, useEffect, useRef } from 'react';
import { Icon } from '@iconify/react';
import './App.css';
import { generateCrossword } from './utils/crosswordGenerator';
import dataset from './data/dataset.json';

// Synthesized Sound Effects using Web Audio API
const playSound = (type) => {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    switch (type) {
      case 'click': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(350, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.08);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
        break;
      }
      case 'correct': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.07); // E5
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.18);
        osc.start();
        osc.stop(ctx.currentTime + 0.18);
        break;
      }
      case 'error': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(130, ctx.currentTime);
        gain.gain.setValueAtTime(0.06, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.25);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
        break;
      }
      case 'victory': {
        const now = ctx.currentTime;
        const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50]; // C4, E4, G4, C5, E5, G5, C6
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.setValueAtTime(freq, now + idx * 0.08);
          gain.gain.setValueAtTime(0.05, now + idx * 0.08);
          gain.gain.linearRampToValueAtTime(0, now + idx * 0.08 + 0.22);
          osc.start(now + idx * 0.08);
          osc.stop(now + idx * 0.08 + 0.22);
        });
        break;
      }
      case 'gameover': {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.linearRampToValueAtTime(40, now + 0.5);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
        break;
      }
    }
  } catch (e) {
    console.error('Audio Context Error', e);
  }
};

const API_BASE = import.meta.env.VITE_API_URL || '';

function App() {
  // Navigation & Submenu Views
  // 'menu' | 'play' | 'leaderboard' | 'settings'
  const [view, setView] = useState('menu');

  // Game Settings Configurations
  const [wordCount, setWordCount] = useState(15); // 15 | 30 | 50 (Easy = 15, Medium = 30, Hard = 50)
  const [timerMode, setTimerMode] = useState('10'); // '10' | '30' | 'free' (minutes)
  const [difficulty, setDifficulty] = useState('easy'); // 'easy' | 'medium' | 'hard'

  // Crossword Grid Data
  const [gridData, setGridData] = useState(null);
  const [gridSize, setGridSize] = useState(15);
  const [clues, setClues] = useState({ across: [], down: [] });
  const [userGrid, setUserGrid] = useState([]);
  const [lockedCells, setLockedCells] = useState([]);

  // Selected Cell & Word States
  const [selectedCell, setSelectedCell] = useState(null);
  const [selectedDirection, setSelectedDirection] = useState('H');
  const [activeWordCells, setActiveWordCells] = useState([]);
  const [activeClue, setActiveClue] = useState(null);

  // Gameplay State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isChecked, setIsChecked] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [feedbackGrid, setFeedbackGrid] = useState([]);
  const [health, setHealth] = useState(null); // easy = null, medium = 5, hard = 3

  // Hint limit counters
  const [lettersRevealed, setLettersRevealed] = useState(0);
  const [wordsRevealed, setWordsRevealed] = useState(0);

  // Score & Leaderboard Submission
  const [finalScore, setFinalScore] = useState(0);
  const [timeSpent, setTimeSpent] = useState(0);
  const [username, setUsername] = useState('');
  const [submittingScore, setSubmittingScore] = useState(false);
  const [scoreSubmitted, setScoreSubmitted] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState([]);

  // Timer values
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const timerRef = useRef(null);

  // Theme (dark / light)
  const [theme, setTheme] = useState('light');

  // Custom DB Words
  const [dbWords, setDbWords] = useState([]);

  // Admin View States
  const [newWord, setNewWord] = useState('');
  const [newClue, setNewClue] = useState('');
  const [adminError, setAdminError] = useState('');
  const [adminSuccess, setAdminSuccess] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminLoginError, setAdminLoginError] = useState('');

  // Toast / Pop-up Progress Notification States
  const [toast, setToast] = useState(null);
  const toastTimeoutRef = useRef(null);
  const [milestones, setMilestones] = useState({ p25: false, p50: false, p75: false });

  // DOM Refs for cell inputs and lists
  const cellRefs = useRef({});
  const acrossClueRefs = useRef({});
  const downClueRefs = useRef({});

  // Fetch and apply theme setting on body
  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
  }, [theme]);

  // Timer logic
  useEffect(() => {
    if (timerActive) {
      timerRef.current = setInterval(() => {
        if (timerMode === 'free') {
          // Count up
          setTimerSeconds(prev => prev + 1);
        } else {
          // Count down
          setTimerSeconds(prev => {
            if (prev <= 1) {
              // Timer runs out! Trigger Game Over
              clearInterval(timerRef.current);
              setTimerActive(false);
              setGameOver(true);
              playSound('gameover');
              return 0;
            }
            return prev - 1;
          });
        }
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerActive, timerMode]);

  // Sync active word highlight
  useEffect(() => {
    if (!selectedCell || !gridData) {
      setActiveWordCells([]);
      setActiveClue(null);
      return;
    }

    const { row, col } = selectedCell;
    const cells = getWordCells(row, col, selectedDirection);
    setActiveWordCells(cells);

    let foundClue = null;
    const number = getWordNumber(row, col, selectedDirection);

    if (number) {
      const clueList = selectedDirection === 'H' ? clues.across : clues.down;
      foundClue = clueList.find(c => c.number === number);
    }
    setActiveClue(foundClue);
  }, [selectedCell, selectedDirection, gridData]);

  // Format timer as MM:SS
  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  // Sound triggering on menu buttons
  const menuNavigate = (targetView) => {
    playSound('click');
    setView(targetView);
  };

  // Initialize and load crossword game
  const fetchNewPuzzle = async () => {
    try {
      setLoading(true);
      setError(null);
      setIsChecked(false);
      setShowSuccess(false);
      setGameOver(false);
      setSelectedCell(null);
      setActiveWordCells([]);
      setActiveClue(null);
      setLettersRevealed(0);
      setWordsRevealed(0);
      setScoreSubmitted(false);
      setMilestones({ p25: false, p50: false, p75: false });

      // Determine vocabulary count based on difficulty
      let targetCount = 15;
      if (difficulty === 'medium') {
        targetCount = 30;
      } else if (difficulty === 'hard') {
        targetCount = 50;
      }
      setWordCount(targetCount);

      // Setup initial health bar based on difficulty - Disabled for now
      setHealth(null); // Infinite

      // Setup initial timer seconds
      if (timerMode === '10') {
        setTimerSeconds(600); // 10 minutes
      } else if (timerMode === '30') {
        setTimerSeconds(1800); // 30 minutes
      } else {
        setTimerSeconds(0); // Free play starting from 0
      }

      // Generate crossword puzzle locally using imported module
      const data = generateCrossword(targetCount, dbWords);
      if (!data) {
        throw new Error('Gagal menghasilkan teka-teki silang secara lokal.');
      }

      setGridData(data.grid);
      setGridSize(data.gridSize);
      setClues(data.clues);

      // Setup user input grid
      const initialUserGrid = Array(data.gridSize).fill(null).map(() => Array(data.gridSize).fill(''));
      const initialFeedbackGrid = Array(data.gridSize).fill(null).map(() => Array(data.gridSize).fill(null));

      // Select 1 word to pre-fill and lock at the start
      let firstClue = null;
      if (data.clues.across.length > 0) {
        firstClue = data.clues.across[0];
      } else if (data.clues.down.length > 0) {
        firstClue = data.clues.down[0];
      }

      const lockedList = [];
      if (firstClue) {
        const { row, col, word, direction } = firstClue;
        for (let i = 0; i < word.length; i++) {
          const r = direction === 'H' ? row : row + i;
          const c = direction === 'H' ? col + i : col;
          lockedList.push({ row: r, col: c, letter: word[i] });
          initialUserGrid[r][c] = word[i];
        }
      }
      setLockedCells(lockedList);

      setUserGrid(initialUserGrid);
      setFeedbackGrid(initialFeedbackGrid);
      setLoading(false);
      setView('play');

      // Start timer active
      setTimerActive(true);

      // Select first clue
      if (data.clues.across.length > 0) {
        const firstClue = data.clues.across[0];
        selectCell(firstClue.row, firstClue.col, 'H', data.grid, data.clues);
      } else if (data.clues.down.length > 0) {
        const firstClue = data.clues.down[0];
        selectCell(firstClue.row, firstClue.col, 'V', data.grid, data.clues);
      }
    } catch (err) {
      console.error(err);
      setError('Gagal memuat data dari database PostgreSQL.');
      setLoading(false);
    }
  };

  // Fetch leaderboard records from Go backend strictly
  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}/api/leaderboard`);
      if (res.ok) {
        const data = await res.json();
        setLeaderboardData(data || []);
      } else {
        throw new Error('Server sedang galat');
      }
    } catch (err) {
      console.error('Failed to fetch leaderboard:', err);
      setError('Server sedang galat');
      setLeaderboardData([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch words list from Go backend strictly
  const fetchWords = async () => {
    try {
      setError(null);
      const res = await fetch(`${API_BASE}/api/words`);
      if (res.ok) {
        const data = await res.json();
        setDbWords(data || []);
      } else {
        throw new Error('Server sedang galat');
      }
    } catch (err) {
      console.error('Failed to fetch words:', err);
      setError('Server sedang galat');
      setDbWords([]);
    }
  };

  // Submit a new word to database in Admin Panel strictly
  const handleAddWordSubmit = async (e) => {
    e.preventDefault();
    if (!newWord.trim() || !newClue.trim()) return;
    setActionLoading(true);
    setAdminError('');
    setAdminSuccess('');
    const wordUpper = newWord.trim().toUpperCase().replace(/[^A-Z]/g, '');
    if (!wordUpper) {
      setAdminError('Kata hanya boleh berisi huruf A-Z.');
      setActionLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/words`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: wordUpper, clue: newClue.trim() })
      });

      if (res.ok) {
        setAdminSuccess(`Kata "${wordUpper}" berhasil ditambahkan!`);
        setNewWord('');
        setNewClue('');
        fetchWords();
      } else {
        throw new Error('Server sedang galat');
      }
    } catch (err) {
      console.error(err);
      setAdminError('Gagal menambahkan kata. Server sedang galat.');
      setError('Server sedang galat');
    } finally {
      setActionLoading(false);
    }
  };

  // Delete a word from database in Admin Panel strictly
  const handleDeleteWord = async (wordToDelete) => {
    if (!window.confirm(`Hapus kata "${wordToDelete}"?`)) return;
    setActionLoading(true);
    setAdminError('');
    setAdminSuccess('');

    try {
      const res = await fetch(`${API_BASE}/api/words?word=${wordToDelete}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        setAdminSuccess(`Kata "${wordToDelete}" berhasil dihapus!`);
        fetchWords();
      } else {
        throw new Error('Server sedang galat');
      }
    } catch (err) {
      console.error(err);
      setAdminError('Gagal menghapus kata. Server sedang galat.');
      setError('Server sedang galat');
    } finally {
      setActionLoading(false);
    }
  };

  // Mount effect to load initial data
  useEffect(() => {
    fetchWords();
    fetchLeaderboard();
  }, []);

  // Check if the board is completely filled
  const isBoardFilled = (currentGrid) => {
    if (!gridData) return false;
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        if (gridData[r] && !gridData[r][c].isEmpty) {
          if (!currentGrid[r] || currentGrid[r][c] === '') {
            return false;
          }
        }
      }
    }
    return true;
  };

  // Calculate correctly solved words (across + down)
  const getCorrectWordsCount = (currentGrid = userGrid) => {
    if (!gridData) return 0;
    let correctCount = 0;
    const allClues = [...clues.across, ...clues.down];

    allClues.forEach(clue => {
      const { row, col, word, direction } = clue;
      let isWordCorrect = true;
      for (let i = 0; i < word.length; i++) {
        const r = direction === 'H' ? row : row + i;
        const c = direction === 'H' ? col + i : col;
        if (!currentGrid[r] || currentGrid[r][c] !== gridData[r][c].letter) {
          isWordCorrect = false;
          break;
        }
      }
      if (isWordCorrect) {
        correctCount++;
      }
    });

    return correctCount;
  };

  // Show temporary toast notification for progress/motivation
  const showToast = (message, type = 'info') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ message, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Check word correctness on input and give feedback immediately
  const checkWordOnInput = (row, col, currentGrid) => {
    if (!gridData) return;
    ['H', 'V'].forEach(dir => {
      const cells = getWordCells(row, col, dir);
      if (cells.length === 0) return;

      const isFilled = cells.every(c => currentGrid[c.row]?.[c.col] !== '');
      if (isFilled) {
        const isCorrect = cells.every(c => currentGrid[c.row]?.[c.col] === gridData[c.row]?.[c.col].letter);
        setFeedbackGrid(prev => {
          const next = [...prev.map(r => [...r])];
          cells.forEach(c => {
            next[c.row][c.col] = isCorrect ? 'correct' : 'error';
          });
          return next;
        });
        if (isCorrect) {
          playSound('correct');

          const totalWords = clues.across.length + clues.down.length;
          const correctWords = getCorrectWordsCount(currentGrid);
          const pct = totalWords > 0 ? Math.round((correctWords / totalWords) * 100) : 0;

          if (pct >= 75 && !milestones.p75) {
            showToast(`Luar biasa! Tinggal dikit lagi! 🌟`, "success");
            setMilestones(prev => ({ ...prev, p75: true }));
          } else if (pct >= 50 && !milestones.p50) {
            showToast(`Hebat! Kamu sudah menyelesaikan setengah jalan! Mantap! 👍`, "success");
            setMilestones(prev => ({ ...prev, p50: true }));
          } else if (pct >= 25 && !milestones.p25) {
            showToast(`Langkah awal yang bagus! Seperempat jalan terlewati, teruskan! ✨`, "success");
            setMilestones(prev => ({ ...prev, p25: true }));
          }
        } else {
          playSound('error');
        }
      } else {
        setFeedbackGrid(prev => {
          const next = [...prev.map(r => [...r])];
          cells.forEach(c => {
            next[c.row][c.col] = null;
          });
          return next;
        });
      }
    });
  };

  // Auto-submit score to Go backend database strictly
  const autoSubmitScore = async (scoreVal, timeVal) => {
    if (!username.trim()) return;
    try {
      setError(null);
      const res = await fetch(`${API_BASE}/api/leaderboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: username.trim(),
          difficulty: difficulty,
          score: scoreVal,
          timeSpent: timeVal
        })
      });
      if (res.ok) {
        setScoreSubmitted(true);
        fetchLeaderboard();
      } else {
        throw new Error('Server sedang galat');
      }
    } catch (err) {
      console.error('Failed to submit score:', err);
      setError('Server sedang galat');
    }
  };

  // Helper: Get word letters cells
  const getWordCells = (r, c, dir) => {
    if (!gridData || gridData[r][c].isEmpty) return [];

    const cells = [];
    if (dir === 'H') {
      let startCol = c;
      while (startCol >= 0 && !gridData[r][startCol].isEmpty) {
        startCol--;
      }
      startCol++;
      let currCol = startCol;
      while (currCol < gridSize && !gridData[r][currCol].isEmpty) {
        cells.push({ row: r, col: currCol });
        currCol++;
      }
    } else {
      let startRow = r;
      while (startRow >= 0 && !gridData[startRow][c].isEmpty) {
        startRow--;
      }
      startRow++;
      let currRow = startRow;
      while (currRow < gridSize && !gridData[currRow][c].isEmpty) {
        cells.push({ row: currRow, col: c });
        currRow++;
      }
    }
    return cells;
  };

  // Helper: Get Clue number
  const getWordNumber = (r, c, dir) => {
    const cells = getWordCells(r, c, dir);
    if (cells.length === 0) return null;
    const firstCell = cells[0];
    return gridData[firstCell.row][firstCell.col].number || null;
  };

  const selectCell = (row, col, direction = null, currentGrid = gridData, currentClues = clues) => {
    if (!currentGrid || currentGrid[row][col].isEmpty) return;

    let dir = direction || selectedDirection;
    if (!direction && selectedCell && selectedCell.row === row && selectedCell.col === col) {
      const hasHorizontal = (col > 0 && !currentGrid[row][col - 1].isEmpty) || (col < gridSize - 1 && !currentGrid[row][col + 1].isEmpty);
      const hasVertical = (row > 0 && !currentGrid[row - 1][col].isEmpty) || (row < gridSize - 1 && !currentGrid[row + 1][col].isEmpty);

      if (hasHorizontal && hasVertical) {
        dir = selectedDirection === 'H' ? 'V' : 'H';
        playSound('click');
      }
    } else if (!direction) {
      const hasHorizontal = (col > 0 && !currentGrid[row][col - 1].isEmpty) || (col < gridSize - 1 && !currentGrid[row][col + 1].isEmpty);
      const hasVertical = (row > 0 && !currentGrid[row - 1][col].isEmpty) || (row < gridSize - 1 && !currentGrid[row + 1][col].isEmpty);

      if (hasHorizontal && !hasVertical) {
        dir = 'H';
      } else if (!hasHorizontal && hasVertical) {
        dir = 'V';
      }
    }

    setSelectedCell({ row, col });
    setSelectedDirection(dir);

    const refKey = `${row}-${col}`;
    if (cellRefs.current[refKey]) {
      cellRefs.current[refKey].focus();
    }
  };

  const handleCellClick = (row, col) => {
    playSound('click');
    selectCell(row, col);
  };

  const handleClueClick = (clue, direction) => {
    playSound('click');
    selectCell(clue.row, clue.col, direction);
  };

  // Keyboard navigation & typing
  const handleKeyDown = (e, row, col) => {
    const key = e.key;

    if (isChecked) {
      setIsChecked(false);
      setFeedbackGrid(Array(gridSize).fill(null).map(() => Array(gridSize).fill(null)));
    }

    if (key === 'ArrowRight') {
      e.preventDefault();
      moveToNextCell(row, col, 0, 1);
    } else if (key === 'ArrowLeft') {
      e.preventDefault();
      moveToNextCell(row, col, 0, -1);
    } else if (key === 'ArrowUp') {
      e.preventDefault();
      moveToNextCell(row, col, -1, 0);
    } else if (key === 'ArrowDown') {
      e.preventDefault();
      moveToNextCell(row, col, 1, 0);
    } else if (key === ' ') {
      e.preventDefault();
      const hasHorizontal = (col > 0 && !gridData[row][col - 1].isEmpty) || (col < gridSize - 1 && !gridData[row][col + 1].isEmpty);
      const hasVertical = (row > 0 && !gridData[row - 1][col].isEmpty) || (row < gridSize - 1 && !gridData[row + 1][col].isEmpty);
      if (hasHorizontal && hasVertical) {
        setSelectedDirection(prev => prev === 'H' ? 'V' : 'H');
        playSound('click');
      }
    } else if (key === 'Backspace') {
      e.preventDefault();

      const newGrid = [...userGrid.map(r => [...r])];
      const isCurrentLocked = lockedCells.some(cell => cell.row === row && cell.col === col);

      if (userGrid[row][col] !== '') {
        if (!isCurrentLocked) {
          newGrid[row][col] = '';
          setUserGrid(newGrid);
          checkWordOnInput(row, col, newGrid);
        } else {
          // If locked, just move focus to previous cell without deleting
          const prev = getPrevCellInWord(row, col, selectedDirection);
          if (prev) {
            setSelectedCell({ row: prev.row, col: prev.col });
            const refKey = `${prev.row}-${prev.col}`;
            if (cellRefs.current[refKey]) cellRefs.current[refKey].focus();
          }
        }
      } else {
        const prev = getPrevCellInWord(row, col, selectedDirection);
        if (prev) {
          const isPrevLocked = lockedCells.some(cell => cell.row === prev.row && cell.col === prev.col);
          if (!isPrevLocked) {
            newGrid[prev.row][prev.col] = '';
            setUserGrid(newGrid);
            checkWordOnInput(prev.row, prev.col, newGrid);
          }
          setSelectedCell({ row: prev.row, col: prev.col });
          const refKey = `${prev.row}-${prev.col}`;
          if (cellRefs.current[refKey]) cellRefs.current[refKey].focus();
        }
      }
    }
  };

  const handleInputChange = (e, row, col) => {
    const isLocked = lockedCells.some(cell => cell.row === row && cell.col === col);
    if (isLocked) return;

    const raw = e.target.value.toUpperCase();
    // Take the last character typed so overwriting works without Backspace
    const value = raw.slice(-1);
    if (value !== '' && !/^[A-Z]$/.test(value)) {
      return;
    }

    const newGrid = [...userGrid.map(r => [...r])];
    newGrid[row][col] = value;
    setUserGrid(newGrid);

    if (isChecked) {
      setIsChecked(false);
      setFeedbackGrid(Array(gridSize).fill(null).map(() => Array(gridSize).fill(null)));
    }

    // Check if the current word is fully filled and check correctness
    checkWordOnInput(row, col, newGrid);

    // If the entire board is filled, automatically trigger checkAnswers
    if (isBoardFilled(newGrid)) {
      checkAnswers(newGrid);
    }

    if (value !== '') {
      playSound('click');
      const next = getNextCellInWord(row, col, selectedDirection);
      if (next) {
        setSelectedCell({ row: next.row, col: next.col });
        const refKey = `${next.row}-${next.col}`;
        if (cellRefs.current[refKey]) cellRefs.current[refKey].focus();
      }
    }
  };

  const getNextCellInWord = (row, col, dir) => {
    const cells = getWordCells(row, col, dir);
    const currIdx = cells.findIndex(c => c.row === row && c.col === col);
    if (currIdx === -1) return null;
    // Skip over cells that are already filled, find the next empty one
    for (let i = currIdx + 1; i < cells.length; i++) {
      const c = cells[i];
      if (!userGrid[c.row] || userGrid[c.row][c.col] === '') {
        return c;
      }
    }
    // If all remaining cells are filled, just go to the next cell (allows overwriting)
    if (currIdx < cells.length - 1) {
      return cells[currIdx + 1];
    }
    return null;
  };

  const getPrevCellInWord = (row, col, dir) => {
    const cells = getWordCells(row, col, dir);
    const currIdx = cells.findIndex(c => c.row === row && c.col === col);
    if (currIdx !== -1 && currIdx > 0) {
      return cells[currIdx - 1];
    }
    return null;
  };

  const moveToNextCell = (row, col, dr, dc) => {
    let r = row + dr;
    let c = col + dc;
    while (r >= 0 && r < gridSize && c >= 0 && c < gridSize) {
      if (gridData[r][c] && !gridData[r][c].isEmpty) {
        let newDir = selectedDirection;
        if (dr !== 0) newDir = 'V';
        if (dc !== 0) newDir = 'H';
        selectCell(r, c, newDir);
        return;
      }
      r += dr;
      c += dc;
    }
  };

  // Check answers & decrease health if wrong
  const checkAnswers = (gridToCheck = userGrid) => {
    if (!gridData) return;
    playSound('click');

    let allCorrect = true;
    let hasWrongAnswer = false;
    const newFeedback = Array(gridSize).fill(null).map(() => Array(gridSize).fill(null));

    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        if (!gridData[r][c].isEmpty) {
          const userVal = gridToCheck[r][c];
          const correctVal = gridData[r][c].letter;

          if (userVal === '') {
            newFeedback[r][c] = null;
            allCorrect = false;
          } else if (userVal !== correctVal) {
            newFeedback[r][c] = 'error';
            allCorrect = false;
            hasWrongAnswer = true;
          } else {
            newFeedback[r][c] = 'correct';
          }
        }
      }
    }

    setFeedbackGrid(newFeedback);
    setIsChecked(true);

    const totalWords = clues.across.length + clues.down.length;
    const correctWords = getCorrectWordsCount(gridToCheck);
    const isFilled = isBoardFilled(gridToCheck);

    if (allCorrect || isFilled) {
      // Calculate final score: 5 points per correct word
      const score = correctWords * 5;
      setFinalScore(score);

      let duration = 0;
      if (timerMode === 'free') {
        duration = timerSeconds;
      } else {
        const total = timerMode === '10' ? 600 : 1800;
        duration = total - timerSeconds;
      }
      setTimeSpent(duration);

      // Auto submit score
      autoSubmitScore(score, duration);

      setTimerActive(false);
      setShowSuccess(true);
      if (allCorrect) {
        playSound('victory');
      } else {
        playSound('error');
      }
    } else {
      // Show progress toast
      const pct = totalWords > 0 ? Math.round((correctWords / totalWords) * 100) : 0;
      let motivational = "Ayo semangat, terus cari kata lainnya! 💪";
      if (pct >= 75) {
        motivational = "Sedikit lagi! Kamu luar biasa! 🌟";
      } else if (pct >= 50) {
        motivational = "Setengah jalan terlewati, mantap! 👍";
      } else if (pct >= 25) {
        motivational = "Usaha yang bagus! Lanjutkan perjuanganmu! ✨";
      }
      showToast(`Progres: ${correctWords} dari ${totalWords} kata benar (${correctWords * 5} Poin). ${motivational}`, "info");

      // Wrong answers: decrease health - Disabled for now
      playSound('error');
    }
  };

  // Hint: Open letter of active cell
  const revealLetter = () => {
    // Check limits based on difficulty
    const limit = difficulty === 'easy' ? 5 : difficulty === 'medium' ? 3 : 1;
    if (lettersRevealed >= limit) return;

    if (!selectedCell || !gridData) return;
    playSound('click');
    const { row, col } = selectedCell;
    const correctLetter = gridData[row][col].letter;

    const newGrid = [...userGrid.map(r => [...r])];
    newGrid[row][col] = correctLetter;
    setUserGrid(newGrid);
    setLettersRevealed(prev => prev + 1);

    if (isChecked) {
      const newFeedback = [...feedbackGrid.map(r => [...r])];
      newFeedback[row][col] = 'correct';
      setFeedbackGrid(newFeedback);
    }
  };

  // Hint: Open active word
  const revealWord = () => {
    // Only easy difficulty allows word reveal (limit = 1)
    if (difficulty !== 'easy') return;
    if (wordsRevealed >= 1) return;

    if (activeWordCells.length === 0 || !gridData) return;
    playSound('click');

    const newGrid = [...userGrid.map(r => [...r])];
    const newFeedback = [...feedbackGrid.map(r => [...r])];

    activeWordCells.forEach(cell => {
      const correctVal = gridData[cell.row][cell.col].letter;
      newGrid[cell.row][cell.col] = correctVal;
      if (isChecked) {
        newFeedback[cell.row][cell.col] = 'correct';
      }
    });

    setUserGrid(newGrid);
    if (isChecked) setFeedbackGrid(newFeedback);
    setWordsRevealed(prev => prev + 1);
  };

  // Reset current game board
  const resetGrid = () => {
    playSound('click');
    const clearedUserGrid = Array(gridSize).fill(null).map(() => Array(gridSize).fill(''));
    // Restore locked cells
    lockedCells.forEach(cell => {
      clearedUserGrid[cell.row][cell.col] = cell.letter;
    });
    setUserGrid(clearedUserGrid);
    setIsChecked(false);
    setFeedbackGrid(Array(gridSize).fill(null).map(() => Array(gridSize).fill(null)));
  };

  // Exit from current game back to main menu
  const exitGame = () => {
    playSound('click');
    setTimerActive(false);
    setGridData(null);
    setSelectedCell(null);
    setShowSuccess(false);
    setGameOver(false);
    setView('menu');
  };

  const isClueSolved = (clue, dir) => {
    if (!gridData) return false;
    const cells = getWordCells(clue.row, clue.col, dir);
    if (cells.length === 0) return false;
    return cells.every(cell => userGrid[cell.row]?.[cell.col] === gridData[cell.row]?.[cell.col]?.letter);
  };

  // Calculate dynamic grid dimensions for font, padding, and gaps
  const gridGap = gridSize >= 25 ? '1px' : gridSize >= 20 ? '2px' : '3px';
  const cellFontSize = gridSize >= 25 ? '0.75rem' : gridSize >= 20 ? '0.9rem' : gridSize >= 16 ? '1.05rem' : '1.25rem';
  const numberFontSize = gridSize >= 25 ? '0.45rem' : gridSize >= 20 ? '0.55rem' : '0.65rem';
  const inputPaddingTop = gridSize >= 25 ? '2px' : gridSize >= 20 ? '4px' : '6px';

  if (error === 'Server sedang galat') {
    return (
      <div className="app-container">
        <div className="menu-wrapper">
          <div className="menu-card" style={{ borderColor: 'var(--color-error)' }}>
            <div className="menu-logo" style={{ color: 'var(--color-error)' }}>
              <Icon icon="solar:danger-bold-duotone" className="icon" style={{ fontSize: '3rem' }} />
              <h2>Server Sedang Galat</h2>
            </div>
            <p style={{ textAlign: 'center', margin: '1rem 0', color: 'var(--text-muted)' }}>
              Gagal menghubungkan ke server backend Go. Silakan periksa koneksi internet Anda atau pastikan server backend Anda sedang aktif.
            </p>
            <button
              className="btn btn-primary"
              onClick={async () => {
                setError(null);
                await fetchWords();
                await fetchLeaderboard();
              }}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              <Icon icon="solar:restart-bold" /> Hubungkan Kembali
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* 1. VIEW MAIN MENU */}
      {view === 'menu' && (
        <div className="menu-wrapper">
          <div className="menu-card">
            <div className="menu-logo">
              <Icon icon="solar:puzzle-bold-duotone" className="icon" />
              <h2>ZapWords ScB App</h2>
            </div>

            <div className="menu-options">
              <button className="menu-btn menu-btn-play" onClick={() => menuNavigate('settings')}>
                <Icon icon="solar:play-circle-bold" /> Main Game
              </button>
              <button className="menu-btn" onClick={() => { fetchLeaderboard(); menuNavigate('leaderboard'); }}>
                <Icon icon="solar:cup-first-bold-duotone" /> Papan Skor
              </button>
              {new URLSearchParams(window.location.search).has('admin') && (
                <button className="menu-btn" onClick={() => { setAdminPassword(''); setAdminLoginError(''); menuNavigate('admin-login'); }}>
                  <Icon icon="solar:shield-user-bold-duotone" /> Menu Admin
                </button>
              )}
              <button
                className="menu-btn"
                onClick={() => { playSound('click'); setTheme(prev => prev === 'dark' ? 'light' : 'dark'); }}
              >
                <Icon icon={theme === 'dark' ? 'solar:sun-2-bold-duotone' : 'solar:moon-bold-duotone'} /> Tema {theme === 'dark' ? 'Terang' : 'Gelap'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. VIEW SETTINGS */}
      {view === 'settings' && (
        <div className="settings-card">
          <div className="card-header">
            <Icon icon="solar:settings-bold-duotone" style={{ fontSize: '1.8rem', color: 'var(--accent-purple)' }} />
            <h2>Pengaturan Game</h2>
          </div>

          {/* Player Name Input */}
          <div className="settings-group">
            <label>Nama Pemain</label>
            <input
              type="text"
              placeholder="Masukkan nama Anda..."
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={15}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: '12px',
                border: '1px solid var(--glass-border)',
                background: 'var(--glass-bg)',
                color: 'var(--text-main)',
                fontSize: '1rem',
                outline: 'none',
                textAlign: 'center',
                fontWeight: '600'
              }}
            />
            {username.trim() === '' && (
              <span style={{ fontSize: '0.75rem', color: 'var(--color-error)', textAlign: 'center', marginTop: '0.25rem' }}>
                *Nama wajib diisi sebelum bermain
              </span>
            )}
          </div>

          {/* Timer Countdowns */}
          <div className="settings-group">
            <label>Batasan Waktu</label>
            <div className="settings-options">
              {[
                { label: '10 Menit', val: '10' },
                { label: '30 Menit', val: '30' },
                { label: 'Bebas', val: 'free' }
              ].map(opt => (
                <button
                  key={`tm-${opt.val}`}
                  className={`option-btn ${timerMode === opt.val ? 'active' : ''}`}
                  onClick={() => { playSound('click'); setTimerMode(opt.val); }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty Modes */}
          <div className="settings-group">
            <label>Tingkat Kesulitan</label>
            <div className="settings-options">
              {[
                { label: 'Easy (5 Buka Huruf, 1 Buka Kata)', val: 'easy' },
                { label: 'Medium (3 Buka Huruf)', val: 'medium' },
                { label: 'Hard (1 Buka Huruf)', val: 'hard' }
              ].map(opt => (
                <button
                  key={`diff-${opt.val}`}
                  className={`option-btn ${difficulty === opt.val ? 'active' : ''}`}
                  onClick={() => { playSound('click'); setDifficulty(opt.val); }}
                  style={{ gridColumn: 'span 2' }}
                >
                  {opt.label.split(' (')[0]}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', width: '100%' }}>
            <button
              className="btn btn-primary"
              onClick={fetchNewPuzzle}
              style={{ flex: 1, justifyContent: 'center' }}
              disabled={!username.trim()}
            >
              <Icon icon="solar:play-circle-bold" /> Mulai Bermain
            </button>
            <button className="btn btn-secondary" onClick={() => menuNavigate('menu')} style={{ flex: 1, justifyContent: 'center' }}>
              Kembali
            </button>
          </div>
        </div>
      )}

      {/* 3. VIEW LEADERBOARD */}
      {view === 'leaderboard' && (
        <div className="leaderboard-card">
          <div className="card-header">
            <Icon icon="solar:cup-first-bold-duotone" style={{ fontSize: '1.8rem', color: 'var(--accent-teal)' }} />
            <h2>Papan Skor Teratas</h2>
          </div>

          {loading ? (
            <div className="loading-container" style={{ minHeight: '150px' }}>
              <div className="spinner"></div>
            </div>
          ) : leaderboardData.length === 0 ? (
            <p className="no-records">Belum ada skor tercatat. Jadilah yang pertama!</p>
          ) : (
            <div className="leaderboard-table-container">
              <table className="leaderboard-table">
                <thead>
                  <tr>
                    <th>Peringkat</th>
                    <th>Nama</th>
                    <th>Kesulitan</th>
                    <th>Skor</th>
                    <th>Waktu</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboardData.map((item, idx) => (
                    <tr key={`lb-${idx}`}>
                      <td>
                        <span className={`rank-badge rank-${idx + 1}`}>
                          {idx + 1}
                        </span>
                      </td>
                      <td style={{ fontWeight: '700' }}>{item.name}</td>
                      <td>
                        <span className={`difficulty-badge difficulty-${item.difficulty}`}>
                          {item.difficulty}
                        </span>
                      </td>
                      <td style={{ fontWeight: '800', color: 'var(--accent-teal)' }}>{item.score}</td>
                      <td style={{ fontFamily: 'monospace' }}>{formatTime(item.timeSpent)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <button className="btn btn-primary" onClick={() => menuNavigate('menu')} style={{ marginTop: '1rem' }}>
            Kembali ke Menu
          </button>
        </div>
      )}

      {/* VIEW ADMIN LOGIN */}
      {view === 'admin-login' && (
        <div className="settings-card" style={{ maxWidth: '400px' }}>
          <div className="card-header">
            <Icon icon="solar:lock-keyhole-bold-duotone" style={{ fontSize: '1.8rem', color: 'var(--accent-purple)' }} />
            <h2>Login Admin</h2>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              playSound('click');
              if (adminPassword === 'admin123') {
                setAdminPassword('');
                setAdminLoginError('');
                fetchWords();
                setView('admin');
              } else {
                playSound('error');
                setAdminLoginError('Password salah!');
              }
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', marginTop: '1rem' }}
          >
            <div className="settings-group">
              <label>Password Admin</label>
              <input
                type="password"
                placeholder="Masukkan password..."
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  borderRadius: '12px',
                  border: '1px solid var(--glass-border)',
                  background: 'var(--glass-bg)',
                  color: 'var(--text-main)',
                  fontSize: '1rem',
                  outline: 'none',
                  textAlign: 'center',
                  fontWeight: '600'
                }}
                autoFocus
                required
              />
              {adminLoginError && (
                <span style={{ fontSize: '0.85rem', color: 'var(--color-error)', textAlign: 'center', marginTop: '0.5rem', display: 'block' }}>
                  {adminLoginError}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '1rem', width: '100%', marginTop: '0.5rem' }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                Masuk
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => menuNavigate('menu')} style={{ flex: 1, justifyContent: 'center' }}>
                Batal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* VIEW ADMIN PANEL */}
      {view === 'admin' && (
        <div className="settings-card" style={{ maxWidth: '650px' }}>
          <div className="card-header">
            <Icon icon="solar:shield-user-bold-duotone" style={{ fontSize: '1.8rem', color: 'var(--accent-purple)' }} />
            <h2>Menu Admin - Kelola Kata</h2>
          </div>

          {/* Form Tambah Kata */}
          <form onSubmit={handleAddWordSubmit} className="admin-form" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--accent-teal)' }}>Tambah Kata Baru</h3>
            <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
              <input
                type="text"
                placeholder="KATA (A-Z)"
                value={newWord}
                onChange={(e) => setNewWord(e.target.value)}
                style={{
                  flex: '1',
                  padding: '0.6rem 0.8rem',
                  borderRadius: '10px',
                  border: '1px solid var(--glass-border)',
                  background: 'var(--glass-bg)',
                  color: 'var(--text-main)',
                  fontSize: '0.85rem',
                  fontWeight: '600'
                }}
                required
              />
              <input
                type="text"
                placeholder="Petunjuk / Clue"
                value={newClue}
                onChange={(e) => setNewClue(e.target.value)}
                style={{
                  flex: '2',
                  padding: '0.6rem 0.8rem',
                  borderRadius: '10px',
                  border: '1px solid var(--glass-border)',
                  background: 'var(--glass-bg)',
                  color: 'var(--text-main)',
                  fontSize: '0.85rem',
                  fontWeight: '600'
                }}
                required
              />
              <button type="submit" className="btn btn-primary" style={{ padding: '0.6rem 1rem' }} disabled={actionLoading}>
                Tambah
              </button>
            </div>
            {adminError && <p style={{ color: 'var(--color-error)', fontSize: '0.8rem', textAlign: 'center' }}>{adminError}</p>}
            {adminSuccess && <p style={{ color: 'var(--color-success)', fontSize: '0.8rem', textAlign: 'center' }}>{adminSuccess}</p>}
          </form>

          <hr style={{ borderColor: 'var(--glass-border)', margin: '0.5rem 0' }} />

          {/* Daftar Kata */}
          <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--accent-purple)' }}>
            Database Kata ({dbWords.length} kata)
          </h3>

          <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '0.5rem' }}>
            {dbWords.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '1rem' }}>
                Belum ada kata tambahan di database.
              </p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                    <th style={{ padding: '0.5rem', color: 'var(--accent-teal)' }}>Kata</th>
                    <th style={{ padding: '0.5rem', color: 'var(--accent-teal)' }}>Petunjuk</th>
                    <th style={{ padding: '0.5rem', color: 'var(--accent-teal)', textAlign: 'right' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {dbWords.map((item, idx) => (
                    <tr key={`word-${idx}`} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                      <td style={{ padding: '0.5rem', fontWeight: '700', textTransform: 'uppercase' }}>{item.word}</td>
                      <td style={{ padding: '0.5rem', color: 'var(--text-muted)' }}>{item.clue}</td>
                      <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => handleDeleteWord(item.word)}
                          disabled={actionLoading}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--color-error)',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center'
                          }}
                        >
                          <Icon icon="solar:trash-bin-trash-bold" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <button className="btn btn-secondary" onClick={() => menuNavigate('menu')} style={{ alignSelf: 'center' }}>
            Kembali ke Menu Utama
          </button>
        </div>
      )}

      {/* 4. VIEW GAME PLAY */}
      {view === 'play' && gridData && (
        <>
          {/* Game Header Panel */}
          <header className="header">
            <div className="logo-section">
              <h1 onClick={exitGame} style={{ cursor: 'pointer' }}>
                <Icon icon="solar:puzzle-bold-duotone" /> ZapWords ScB App
              </h1>
            </div>
            <div className="stats-section">
              <button
                className="theme-toggle-btn"
                onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
                title={theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}
              >
                <Icon icon={theme === 'dark' ? 'solar:sun-2-bold-duotone' : 'solar:moon-bold-duotone'} />
              </button>
              <div
                className="timer"
                title={timerActive ? 'Jeda permainan' : 'Mulai permainan'}
                onClick={() => { playSound('click'); setTimerActive(!timerActive); }}
              >
                <Icon icon={timerActive ? 'solar:clock-circle-bold-duotone' : 'solar:pause-circle-bold-duotone'} />
                <span>{formatTime(timerSeconds)}</span>
              </div>
              <button className="btn btn-secondary" onClick={exitGame}>
                <Icon icon="solar:logout-bold" /> Keluar
              </button>
            </div>
          </header>

          <div className="game-wrapper-desktop">
            <aside className="game-sidebar-left">
              {/* Game HUD (Nyawa, Hint, dsb) */}
              <div className="hud-container">
                <div className="hud-item">
                  <span>Pemain: </span>
                  <span className="hint-badge" style={{ background: 'rgba(139, 92, 246, 0.15)', color: 'var(--accent-purple-hover)' }}>
                    {username}
                  </span>
                </div>

                <div className="hud-item">
                  <span>Progress Nilai: </span>
                  <span className="hint-badge" style={{ background: 'rgba(6, 182, 212, 0.15)', color: 'var(--accent-teal-hover)', borderColor: 'rgba(6, 182, 212, 0.25)', fontWeight: 'bold' }}>
                    {getCorrectWordsCount() * 5} of {(clues.across.length + clues.down.length) * 5} ({clues.across.length + clues.down.length > 0 ? Math.round((getCorrectWordsCount() / (clues.across.length + clues.down.length)) * 100) : 0}%)
                  </span>
                </div>

                {/* Health / Nyawa - Disabled for now */}

                <div className="hud-item">
                  <span>Hint Huruf: </span>
                  <span className="hint-badge">
                    {lettersRevealed} / {difficulty === 'easy' ? 5 : difficulty === 'medium' ? 3 : 1}
                  </span>
                </div>

                {difficulty === 'easy' && (
                  <div className="hud-item">
                    <span>Hint Kata: </span>
                    <span className="hint-badge">
                      {wordsRevealed} / 1
                    </span>
                  </div>
                )}
              </div>

              {/* Toolbar game actions */}
              <div className="controls-bar">
                <button className="btn btn-accent" onClick={checkAnswers} disabled={!timerActive}>
                  <Icon icon="solar:check-circle-bold" /> Cek Jawaban
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={revealLetter}
                  disabled={!selectedCell || !timerActive || lettersRevealed >= (difficulty === 'easy' ? 5 : difficulty === 'medium' ? 3 : 1)}
                  title="Buka huruf terpilh"
                >
                  <Icon icon="solar:eye-bold" /> Buka Huruf
                </button>
                {difficulty === 'easy' && (
                  <button
                    className="btn btn-secondary"
                    onClick={revealWord}
                    disabled={activeWordCells.length === 0 || !timerActive || wordsRevealed >= 1}
                    title="Buka seluruh kata"
                  >
                    <Icon icon="solar:book-2-bold" /> Buka Kata
                  </button>
                )}
                <button className="btn btn-secondary" onClick={resetGrid} disabled={!timerActive}>
                  <Icon icon="solar:eraser-bold" /> Reset Papan
                </button>
              </div>

              {/* Banner Petunjuk Terpilih */}
              {activeClue && (
                <div className="active-clue-banner animate-slide-in" style={{ width: '100%' }}>
                  <span className={`banner-badge ${selectedDirection === 'H' ? 'across' : 'down'}`}>
                    {selectedDirection === 'H' ? 'Mendatar' : 'Menurun'}
                  </span>
                  <span className="banner-num">{activeClue.number}</span>
                  <span className="banner-text">{activeClue.clue}</span>
                </div>
              )}
            </aside>

            <main className="game-main-content">
              {/* Grid Papan TTS */}
              <div className="game-layout">
                <div className="board-container">
                  <div
                    className="crossword-grid"
                    style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)`, gap: gridGap }}
                  >
                    {gridData.map((row, rIdx) =>
                      row.map((cell, cIdx) => {
                        const isPlayable = !cell.isEmpty;
                        const isLocked = lockedCells.some(lc => lc.row === rIdx && lc.col === cIdx);
                        const isActiveCell = selectedCell && selectedCell.row === rIdx && selectedCell.col === cIdx;
                        const isActiveWord = activeWordCells.some(c => c.row === rIdx && c.col === cIdx);

                        if (!isPlayable) {
                          return <div key={`cell-${rIdx}-${cIdx}`} className="grid-cell cell-empty" />;
                        }

                        let cellHighlightClass = 'cell-input';
                        if (isLocked) {
                          cellHighlightClass += ' cell-locked';
                        } else if (isActiveCell) {
                          cellHighlightClass += selectedDirection === 'H' ? ' cell-active-cell' : ' cell-active-cell-teal';
                        } else if (isActiveWord) {
                          cellHighlightClass += selectedDirection === 'H' ? ' cell-active-word' : ' cell-active-word-teal';
                        }

                        if (isChecked && feedbackGrid[rIdx] && feedbackGrid[rIdx][cIdx]) {
                          const feedback = feedbackGrid[rIdx][cIdx];
                          if (feedback === 'correct') cellHighlightClass += ' cell-correct';
                          if (feedback === 'error') cellHighlightClass += ' cell-error';
                        }

                        return (
                          <div
                            key={`cell-${rIdx}-${cIdx}`}
                            className={`grid-cell ${cellHighlightClass}`}
                            onClick={() => handleCellClick(rIdx, cIdx)}
                          >
                            {cell.number > 0 && <span className="cell-number" style={{ fontSize: numberFontSize }}>{cell.number}</span>}
                            <input
                              ref={el => cellRefs.current[`${rIdx}-${cIdx}`] = el}
                              type="text"
                              className="cell-input-field"
                              value={userGrid[rIdx]?.[cIdx] || ''}
                              onChange={(e) => handleInputChange(e, rIdx, cIdx)}
                              onKeyDown={(e) => handleKeyDown(e, rIdx, cIdx)}
                              maxLength={2}
                              disabled={!timerActive}
                              readOnly={isLocked}
                              style={{ fontSize: cellFontSize, paddingTop: inputPaddingTop }}
                            />
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Panel Clues */}
                <div className="clues-container">
                  <div className="clue-box clue-box-across">
                    <h3><Icon icon="solar:arrow-right-circle-bold-duotone" /> Mendatar</h3>
                    <ul className="clues-list">
                      {clues.across.map((clue) => {
                        const isActive = selectedDirection === 'H' && activeClue && activeClue.number === clue.number;
                        const isSolved = isClueSolved(clue, 'H');
                        return (
                          <li
                            key={`across-${clue.number}`}
                            ref={el => acrossClueRefs.current[clue.number] = el}
                            className={`clue-item ${isActive ? 'clue-active-across' : ''} ${isSolved ? 'clue-solved' : ''}`}
                            onClick={() => handleClueClick(clue, 'H')}
                          >
                            <span className="clue-num">{clue.number}</span>
                            <span className="clue-text">{clue.clue}</span>
                            <span className="clue-len">({clue.word.length})</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  <div className="clue-box clue-box-down">
                    <h3><Icon icon="solar:arrow-down-circle-bold-duotone" /> Menurun</h3>
                    <ul className="clues-list">
                      {clues.down.map((clue) => {
                        const isActive = selectedDirection === 'V' && activeClue && activeClue.number === clue.number;
                        const isSolved = isClueSolved(clue, 'V');
                        return (
                          <li
                            key={`down-${clue.number}`}
                            ref={el => downClueRefs.current[clue.number] = el}
                            className={`clue-item ${isActive ? 'clue-active-down' : ''} ${isSolved ? 'clue-solved' : ''}`}
                            onClick={() => handleClueClick(clue, 'V')}
                          >
                            <span className="clue-num">{clue.number}</span>
                            <span className="clue-text">{clue.clue}</span>
                            <span className="clue-len">({clue.word.length})</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              </div>
            </main>
          </div>

          <section className="instructions">
            <h4><Icon icon="solar:info-circle-bold-duotone" /> Navigasi</h4>
            <ul>
              <li>Klik sel/petunjuk untuk memilih.</li>
              <li><span className="key-cap">Space</span>: Ubah arah.</li>
              <li><span className="key-cap">←</span> <span className="key-cap">↑</span> <span className="key-cap">→</span> <span className="key-cap">↓</span>: Pindah sel.</li>
              <li><span className="key-cap">Backspace</span>: Hapus.</li>
            </ul>
          </section>
        </>
      )}
      {/* 5. OVERLAY MODAL: WINNING SUCCESS */}
      {showSuccess && (() => {
        const totalWords = clues.across.length + clues.down.length;
        const correctWords = getCorrectWordsCount();
        const pct = totalWords > 0 ? Math.round((correctWords / totalWords) * 100) : 0;

        let motivationalMessage = "";
        let winTitle = "Permainan Selesai!";
        let iconName = "solar:star-bold-duotone";
        let iconColor = "#06b6d4";

        if (pct === 100) {
          winTitle = "Selamat, Sempurna!";
          motivationalMessage = "Luar biasa! Kamu berhasil melahap semua kata dengan sempurna! 🏆";
          iconName = "solar:cup-first-bold-duotone";
          iconColor = "#eab308";
        } else if (pct >= 75) {
          motivationalMessage = "Keren banget! Sedikit lagi menuju sempurna. Pertahankan prestasimu! 💪";
        } else if (pct >= 50) {
          motivationalMessage = "Kerja bagus! Usaha yang hebat, kamu sudah menguasai sebagian besar kata! 👍";
        } else if (pct >= 25) {
          motivationalMessage = "Tetap semangat! Setiap kesalahan adalah langkah menuju pintar. Coba lagi yuk! ✨";
        } else {
          motivationalMessage = "Jangan menyerah! Awal yang baik untuk belajar. Mari coba lagi dan taklukkan kata-kata ini! 🔥";
          iconName = "solar:heart-broken-bold";
          iconColor = "#ef4444";
        }

        return (
          <div className="modal-overlay">
            <div className={`modal-content ${pct === 100 ? 'perfect-victory-modal' : ''}`}>
              {pct === 100 && (
                <div className="confetti-container">
                  <div className="confetti-piece"></div>
                  <div className="confetti-piece"></div>
                  <div className="confetti-piece"></div>
                  <div className="confetti-piece"></div>
                  <div className="confetti-piece"></div>
                  <div className="confetti-piece"></div>
                  <div className="confetti-piece"></div>
                  <div className="confetti-piece"></div>
                </div>
              )}
              <div className="modal-icon" style={{ color: iconColor }}>
                <Icon icon={iconName} className={pct === 100 ? 'animate-bounce' : ''} style={{ fontSize: '4.5rem' }} />
              </div>
              <h2>{winTitle}</h2>
              <p style={{ fontWeight: '700', fontSize: '1.05rem', color: 'var(--text-main)', margin: '0.5rem 0' }}>
                "{motivationalMessage}"
              </p>

              <div className="modal-stats">
                <div className="modal-stat-card">
                  <div className="stat-label">Progress Nilai</div>
                  <div className="stat-value" style={{ color: 'var(--accent-teal-hover)', fontSize: '1.2rem' }}>
                    {correctWords * 5} / {totalWords * 5} Pts
                  </div>
                </div>
                <div className="modal-stat-card">
                  <div className="stat-label">Persentase</div>
                  <div className="stat-value" style={{ color: 'var(--accent-purple-hover)', fontSize: '1.2rem' }}>
                    {pct}%
                  </div>
                </div>
                <div className="modal-stat-card" style={{ gridColumn: 'span 2' }}>
                  <div className="stat-label">Waktu Tempuh</div>
                  <div className="stat-value" style={{ fontSize: '1.2rem' }}>{formatTime(timeSpent)}</div>
                </div>
              </div>

              <div style={{ marginTop: '1rem', width: '100%' }}>
                <p style={{ color: 'var(--color-success)', fontWeight: '700', fontSize: '0.9rem', marginBottom: '1rem' }}>
                  Skor untuk <strong style={{ color: 'var(--accent-purple-hover)' }}>{username}</strong> berhasil dicatat otomatis! 🏆
                </p>
                <button className="btn btn-primary" onClick={exitGame} style={{ width: '100%', justifyContent: 'center' }}>
                  Kembali ke Menu Utama
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 6. OVERLAY MODAL: GAME OVER */}
      {gameOver && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ borderColor: 'var(--color-error)' }}>
            <div className="modal-icon" style={{ color: 'var(--color-error)' }}>
              <Icon icon="solar:heart-broken-bold" style={{ fontSize: '4.5rem' }} />
            </div>
            <h2>Game Over!</h2>
            <p>Anda kehabisan nyawa atau waktu habis.</p>

            <div className="modal-stats" style={{ gridTemplateColumns: '1fr' }}>
              <div className="modal-stat-card">
                <div className="stat-label">Tingkat Kesulitan</div>
                <div className="stat-value" style={{ textTransform: 'uppercase' }}>{difficulty}</div>
              </div>
            </div>

            <div className="menu-options" style={{ width: '100%' }}>
              <button className="btn btn-primary" onClick={fetchNewPuzzle} style={{ width: '100%', justifyContent: 'center' }}>
                <Icon icon="solar:restart-bold" /> Main Lagi
              </button>
              <button className="btn btn-secondary" onClick={exitGame} style={{ width: '100%', justifyContent: 'center' }}>
                <Icon icon="solar:logout-bold" /> Keluar ke Menu
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Toast Progress Pop-up */}
      {toast && (
        <div
          className="toast-progress"
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'var(--bg-secondary)',
            border: '2px solid var(--accent-purple)',
            borderRadius: '16px',
            padding: '1rem 1.5rem',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            zIndex: 1000,
            maxWidth: '380px',
            animation: 'toastPop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
          }}
        >
          <Icon
            icon={toast.type === 'success' ? 'solar:check-circle-bold-duotone' : 'solar:info-circle-bold-duotone'}
            style={{
              fontSize: '1.5rem',
              color: toast.type === 'success' ? 'var(--color-success)' : 'var(--accent-teal-hover)',
              flexShrink: 0
            }}
          />
          <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-main)', lineHeight: '1.4' }}>
            {toast.message}
          </span>
        </div>
      )}
    </div>
  );
}

export default App;
