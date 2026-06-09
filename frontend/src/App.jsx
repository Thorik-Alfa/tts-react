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
  const [customGridSizeSetting, setCustomGridSizeSetting] = useState('auto'); // 'auto' | '15' | '20' | '25'

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
  const [hasGivenUp, setHasGivenUp] = useState(false);
  const [showGiveUpConfirm, setShowGiveUpConfirm] = useState(false);
  const [savedGameToRestore, setSavedGameToRestore] = useState(null);

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
  const [adminTab, setAdminTab] = useState('words'); // 'words' | 'leaderboard'
  const [excelFile, setExcelFile] = useState(null);
  const [excelPreviewData, setExcelPreviewData] = useState([]);
  const [confirmDialog, setConfirmDialog] = useState({
    show: false,
    title: '',
    message: '',
    onConfirm: null
  });

  const triggerConfirm = (title, message, onConfirm) => {
    setConfirmDialog({
      show: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmDialog({ show: false, title: '', message: '', onConfirm: null });
      }
    });
  };

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
      setHasGivenUp(false);
      setShowGiveUpConfirm(false);
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
      const targetGridSize = customGridSizeSetting === 'auto' ? null : parseInt(customGridSizeSetting);
      const data = generateCrossword(targetCount, dbWords, targetGridSize);
      if (!data) {
        throw new Error('Failed to generate crossword puzzle locally.');
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
      setError('Failed to load data from PostgreSQL database.');
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
        throw new Error('Server error');
      }
    } catch (err) {
      console.error('Failed to fetch leaderboard:', err);
      setError('Server error');
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
        throw new Error('Server error');
      }
    } catch (err) {
      console.error('Failed to fetch words:', err);
      setError('Server error');
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
      setAdminError('Word must only contain letters A-Z.');
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
        setAdminSuccess(`Word "${wordUpper}" successfully added!`);
        setNewWord('');
        setNewClue('');
        fetchWords();
      } else {
        throw new Error('Server error');
      }
    } catch (err) {
      console.error(err);
      setAdminError('Failed to add word. Server error.');
      setError('Server error');
    } finally {
      setActionLoading(false);
    }
  };

  // Delete a word from database in Admin Panel strictly
  const handleDeleteWord = (wordToDelete) => {
    triggerConfirm(
      'Confirm Delete',
      `Are you sure you want to delete word "${wordToDelete}"?`,
      async () => {
        setActionLoading(true);
        setAdminError('');
        setAdminSuccess('');
        try {
          const res = await fetch(`${API_BASE}/api/words?word=${wordToDelete}`, {
            method: 'DELETE'
          });

          if (res.ok) {
            setAdminSuccess(`Word "${wordToDelete}" successfully deleted!`);
            fetchWords();
          } else {
            throw new Error('Server error');
          }
        } catch (err) {
          console.error(err);
          setAdminError('Failed to delete word. Server error.');
          setError('Server error');
        } finally {
          setActionLoading(false);
        }
      }
    );
  };

  const handleImportExcel = async (e) => {
    if (e) e.preventDefault();
    if (!excelFile) return;
    setActionLoading(true);
    setAdminError('');
    setAdminSuccess('');

    const formData = new FormData();
    formData.append('file', excelFile);

    try {
      const res = await fetch(`${API_BASE}/api/words/import`, {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        setAdminSuccess(`Successfully imported ${data.count} words from Excel!`);
        setExcelFile(null);
        setExcelPreviewData([]);
        const fileInput = document.getElementById('excel-file-input');
        if (fileInput) fileInput.value = '';
        fetchWords();
      } else {
        const txt = await res.text();
        throw new Error(txt || 'Server error');
      }
    } catch (err) {
      console.error(err);
      setAdminError(`Failed to import words: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePreviewExcel = async (e) => {
    e.preventDefault();
    if (!excelFile) return;
    setActionLoading(true);
    setAdminError('');
    setAdminSuccess('');
    setExcelPreviewData([]);

    const formData = new FormData();
    formData.append('file', excelFile);

    try {
      const res = await fetch(`${API_BASE}/api/words/import-preview`, {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        setExcelPreviewData(data.data || []);
      } else {
        const txt = await res.text();
        throw new Error(txt || 'Server error');
      }
    } catch (err) {
      console.error(err);
      setAdminError(`Failed to load preview: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteLeaderboard = (id) => {
    triggerConfirm(
      'Confirm Delete',
      'Are you sure you want to delete this leaderboard entry?',
      async () => {
        setActionLoading(true);
        setAdminError('');
        setAdminSuccess('');
        try {
          const res = await fetch(`${API_BASE}/api/leaderboard?id=${id}`, {
            method: 'DELETE'
          });

          if (res.ok) {
            setAdminSuccess('Leaderboard entry deleted successfully!');
            fetchLeaderboard();
          } else {
            throw new Error('Server error');
          }
        } catch (err) {
          console.error(err);
          setAdminError('Failed to delete leaderboard entry. Server error.');
        } finally {
          setActionLoading(false);
        }
      }
    );
  };

  const handleClearAllLeaderboard = () => {
    triggerConfirm(
      'Confirm Clear All',
      'Are you sure you want to delete ALL leaderboard entries? This action cannot be undone.',
      async () => {
        setActionLoading(true);
        setAdminError('');
        setAdminSuccess('');
        try {
          const res = await fetch(`${API_BASE}/api/leaderboard?all=true`, {
            method: 'DELETE'
          });

          if (res.ok) {
            setAdminSuccess('All leaderboard entries cleared successfully!');
            fetchLeaderboard();
          } else {
            throw new Error('Server error');
          }
        } catch (err) {
          console.error(err);
          setAdminError('Failed to clear leaderboard. Server error.');
        } finally {
          setActionLoading(false);
        }
      }
    );
  };

  // Mount effect to load initial data
  useEffect(() => {
    fetchWords();
    fetchLeaderboard();

    // Check for saved game session
    const saved = localStorage.getItem('tts_game_state');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.gridData) {
          setSavedGameToRestore(parsed);
        }
      } catch (e) {
        console.error("Failed to parse saved game:", e);
      }
    }
  }, []);

  // Save game state automatically whenever relevant states change
  useEffect(() => {
    if (view === 'play' && gridData) {
      const state = {
        gridData,
        userGrid,
        lockedCells,
        username,
        difficulty,
        wordCount,
        timerMode,
        timerSeconds,
        hasGivenUp,
        lettersRevealed,
        wordsRevealed,
        milestones,
        clues,
        gridSize
      };
      localStorage.setItem('tts_game_state', JSON.stringify(state));
    }
  }, [view, gridData, userGrid, lockedCells, username, difficulty, wordCount, timerMode, timerSeconds, hasGivenUp, lettersRevealed, wordsRevealed, milestones, clues, gridSize]);

  // Restore game state
  const restoreSavedGame = () => {
    if (!savedGameToRestore) return;
    const data = savedGameToRestore;
    setGridData(data.gridData);
    setUserGrid(data.userGrid);
    setLockedCells(data.lockedCells);
    setUsername(data.username);
    setDifficulty(data.difficulty);
    setWordCount(data.wordCount);
    setTimerMode(data.timerMode);
    setTimerSeconds(data.timerSeconds);
    setHasGivenUp(data.hasGivenUp);
    setLettersRevealed(data.lettersRevealed);
    setWordsRevealed(data.wordsRevealed);
    setMilestones(data.milestones);
    setClues(data.clues);
    setGridSize(data.gridSize);

    setView('play');
    setTimerActive(true);
    setSavedGameToRestore(null);
    playSound('click');
  };

  // Discard saved game session
  const discardSavedGame = () => {
    localStorage.removeItem('tts_game_state');
    setSavedGameToRestore(null);
    playSound('click');
  };

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
            showToast(`Amazing! Just a little bit left! 🌟`, "success");
            setMilestones(prev => ({ ...prev, p75: true }));
          } else if (pct >= 50 && !milestones.p50) {
            showToast(`Great! You are halfway there! Keep it up! 👍`, "success");
            setMilestones(prev => ({ ...prev, p50: true }));
          } else if (pct >= 25 && !milestones.p25) {
            showToast(`Good start! A quarter of the way done, keep going! ✨`, "success");
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
        throw new Error('Server error');
      }
    } catch (err) {
      console.error('Failed to submit score:', err);
      setError('Server error');
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
      localStorage.removeItem('tts_game_state');
      if (allCorrect) {
        playSound('victory');
      } else {
        playSound('error');
      }
    } else {
      // Show progress toast
      const pct = totalWords > 0 ? Math.round((correctWords / totalWords) * 100) : 0;
      let motivational = "Keep it up, keep looking for other words! 💪";
      if (pct >= 75) {
        motivational = "Almost there! You are amazing! 🌟";
      } else if (pct >= 50) {
        motivational = "Halfway done, great job! 👍";
      } else if (pct >= 25) {
        motivational = "Good effort! Keep going! ✨";
      }
      showToast(`Progress: ${correctWords} of ${totalWords} correct words (${correctWords * 5} Pts). ${motivational}`, "info");

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

  // Give up: open custom confirmation modal
  const handleGiveUp = () => {
    if (!gridData) return;
    playSound('click');
    setShowGiveUpConfirm(true);
  };

  // Reveal all answers (available after giving up)
  const revealAllAnswers = () => {
    if (!gridData) return;
    playSound('click');

    const newGrid = Array(gridSize).fill(null).map(() => Array(gridSize).fill(''));
    const newFeedback = Array(gridSize).fill(null).map(() => Array(gridSize).fill(null));

    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        if (!gridData[r][c].isEmpty) {
          newGrid[r][c] = gridData[r][c].letter;
          newFeedback[r][c] = 'correct'; // Show correct feedback for all revealed cells
        }
      }
    }

    setUserGrid(newGrid);
    setFeedbackGrid(newFeedback);
    setIsChecked(true);
    showToast("All answers have been revealed.", "info");
  };

  // Exit from current game back to main menu
  const exitGame = () => {
    playSound('click');
    setTimerActive(false);
    setGridData(null);
    setSelectedCell(null);
    setShowSuccess(false);
    setGameOver(false);
    setHasGivenUp(false);
    setShowGiveUpConfirm(false);
    localStorage.removeItem('tts_game_state');
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

  if (error === 'Server error') {
    return (
      <div className="app-container">
        <div className="menu-wrapper">
          <div className="menu-card" style={{ borderColor: 'var(--color-error)' }}>
            <div className="menu-logo" style={{ color: 'var(--color-error)' }}>
              <Icon icon="solar:danger-bold-duotone" className="icon" style={{ fontSize: '3rem' }} />
              <h2>Server Error</h2>
            </div>
            <p style={{ textAlign: 'center', margin: '1rem 0', color: 'var(--text-muted)' }}>
              Failed to connect to the backend Go server. Please check your network connection or make sure your server is active.
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
              <Icon icon="solar:restart-bold" /> Reconnect
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* 0. OVERLAY MODAL: RESTORE SAVED GAME */}
      {savedGameToRestore && (
        <div className="modal-overlay">
          <div className="modal-content animate-slide-in" style={{ maxWidth: '420px' }}>
            <div className="modal-icon" style={{ color: 'var(--accent-purple)' }}>
              <Icon icon="solar:history-bold-duotone" style={{ fontSize: '4.5rem' }} />
            </div>
            <h2>Resume Game?</h2>
            <p style={{ margin: '10px 0', color: 'var(--text-muted)', lineHeight: '1.5' }}>
              We found an unfinished game session belonging to <strong>{savedGameToRestore.username}</strong> ({savedGameToRestore.difficulty.toUpperCase()} mode).
            </p>
            <div style={{ display: 'flex', gap: '1rem', width: '100%', marginTop: '1rem' }}>
              <button
                className="btn btn-primary"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={restoreSavedGame}
              >
                Resume
              </button>
              <button
                className="btn btn-secondary"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={discardSavedGame}
              >
                Start New
              </button>
            </div>
          </div>
        </div>
      )}

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
                <Icon icon="solar:play-circle-bold" /> Play Game
              </button>
              <button className="menu-btn" onClick={() => { fetchLeaderboard(); menuNavigate('leaderboard'); }}>
                <Icon icon="solar:cup-first-bold-duotone" /> Leaderboard
              </button>
              {new URLSearchParams(window.location.search).has('admin') && (
                <button className="menu-btn" onClick={() => { setAdminPassword(''); setAdminLoginError(''); menuNavigate('admin-login'); }}>
                  <Icon icon="solar:shield-user-bold-duotone" /> Admin Panel
                </button>
              )}
              <button
                className="menu-btn"
                onClick={() => { playSound('click'); setTheme(prev => prev === 'dark' ? 'light' : 'dark'); }}
              >
                <Icon icon={theme === 'dark' ? 'solar:sun-2-bold-duotone' : 'solar:moon-bold-duotone'} /> {theme === 'dark' ? 'Light Theme' : 'Dark Theme'}
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
            <h2>Game Settings</h2>
          </div>

          {/* Player Name Input */}
          <div className="settings-group">
            <label>Player Name</label>
            <input
              type="text"
              placeholder="Enter your name..."
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
                *Name is required to play
              </span>
            )}
          </div>

          {/* Timer Countdowns */}
          <div className="settings-group">
            <label>Time Limit</label>
            <div className="settings-options">
              {[
                { label: '10 Minutes', val: '10' },
                { label: '30 Minutes', val: '30' },
                { label: 'No Limit', val: 'free' }
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
            <label>Difficulty</label>
            <div className="settings-options">
              {[
                { label: 'Easy (5 Reveal Letter, 1 Reveal Word)', val: 'easy' },
                { label: 'Medium (3 Reveal Letter)', val: 'medium' },
                { label: 'Hard (1 Reveal Letter)', val: 'hard' }
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

          {/* Custom Grid Size Option */}
          <div className="settings-group">
            <label>Board Grid Size</label>
            <div className="settings-options">
              {[
                { label: 'Auto', val: 'auto' },
                { label: '15 x 15', val: '15' },
                { label: '20 x 20', val: '20' },
                { label: '25 x 25', val: '25' }
              ].map(opt => (
                <button
                  key={`gs-${opt.val}`}
                  className={`option-btn ${customGridSizeSetting === opt.val ? 'active' : ''}`}
                  onClick={() => { playSound('click'); setCustomGridSizeSetting(opt.val); }}
                >
                  {opt.label}
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
              <Icon icon="solar:play-circle-bold" /> Start Playing
            </button>
            <button className="btn btn-secondary" onClick={() => menuNavigate('menu')} style={{ flex: 1, justifyContent: 'center' }}>
              Back
            </button>
          </div>
        </div>
      )}

      {/* 3. VIEW LEADERBOARD */}
      {view === 'leaderboard' && (
        <div className="leaderboard-card">
          <div className="card-header">
            <Icon icon="solar:cup-first-bold-duotone" style={{ fontSize: '1.8rem', color: 'var(--accent-teal)' }} />
            <h2>Top Leaderboard</h2>
          </div>

          {loading ? (
            <div className="loading-container" style={{ minHeight: '150px' }}>
              <div className="spinner"></div>
            </div>
          ) : leaderboardData.length === 0 ? (
            <p className="no-records">No scores recorded yet. Be the first!</p>
          ) : (
            <div className="leaderboard-table-container">
              <table className="leaderboard-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Name</th>
                    <th>Difficulty</th>
                    <th>Score</th>
                    <th>Time</th>
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
            Back to Menu
          </button>
        </div>
      )}

      {/* VIEW ADMIN LOGIN */}
      {view === 'admin-login' && (
        <div className="settings-card" style={{ maxWidth: '400px' }}>
          <div className="card-header">
            <Icon icon="solar:lock-keyhole-bold-duotone" style={{ fontSize: '1.8rem', color: 'var(--accent-purple)' }} />
            <h2>Admin Login</h2>
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
                setAdminLoginError('Incorrect password!');
              }
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', marginTop: '1rem' }}
          >
            <div className="settings-group">
              <label>Admin Password</label>
              <input
                type="password"
                placeholder="Enter password..."
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
                Login
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => menuNavigate('menu')} style={{ flex: 1, justifyContent: 'center' }}>
                Cancel
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
            <h2>Admin Panel</h2>
          </div>

          {/* Admin Tabs */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem', width: '100%' }}>
            <button
              className={`btn ${adminTab === 'words' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', flex: 1, justifyContent: 'center' }}
              onClick={() => { setAdminTab('words'); setAdminError(''); setAdminSuccess(''); }}
            >
              <Icon icon="solar:letter-bold" /> Manage Words
            </button>
            <button
              className={`btn ${adminTab === 'leaderboard' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', flex: 1, justifyContent: 'center' }}
              onClick={() => { setAdminTab('leaderboard'); setAdminError(''); setAdminSuccess(''); }}
            >
              <Icon icon="solar:cup-first-bold-duotone" /> Manage Leaderboard
            </button>
          </div>

          {adminError && <p style={{ color: 'var(--color-error)', fontSize: '0.85rem', textAlign: 'center', margin: '0.5rem 0' }}>{adminError}</p>}
          {adminSuccess && <p style={{ color: 'var(--color-success)', fontSize: '0.85rem', textAlign: 'center', margin: '0.5rem 0' }}>{adminSuccess}</p>}

          {adminTab === 'words' && (
            <>
              {/* Form Tambah Kata */}
              <form onSubmit={handleAddWordSubmit} className="admin-form" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--accent-teal)' }}>Add New Word</h3>
                <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                  <input
                    type="text"
                    placeholder="WORD (A-Z)"
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
                    placeholder="Clue"
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
                    Add
                  </button>
                </div>
              </form>

              {/* Form Import Excel */}
              <form onSubmit={handlePreviewExcel} className="admin-form" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem', padding: '1rem', border: '1px dashed var(--glass-border)', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', width: '100%' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--accent-purple)' }}>Import Words from Excel</h3>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                  <strong>Excel File Format:</strong>
                  <ul style={{ margin: '0.35rem 0 0.5rem 1.25rem', padding: 0 }}>
                    <li>File extension must be <strong>.xlsx</strong></li>
                    <li>First row must be the header row (ignored during upload)</li>
                    <li><strong>Column A</strong>: Word / Kata (e.g. <code>KERTAS</code>)</li>
                    <li><strong>Column B</strong>: Clue / Petunjuk (e.g. <code>Alat untuk menulis</code>)</li>
                  </ul>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', width: '100%', alignItems: 'center' }}>
                  <input
                    id="excel-file-input"
                    type="file"
                    accept=".xlsx"
                    onChange={(e) => {
                      setExcelFile(e.target.files[0]);
                      setExcelPreviewData([]);
                    }}
                    style={{
                      flex: '1',
                      padding: '0.4rem',
                      borderRadius: '8px',
                      border: '1px solid var(--glass-border)',
                      background: 'var(--glass-bg)',
                      color: 'var(--text-main)',
                      fontSize: '0.8rem'
                    }}
                    required
                  />
                  <button type="submit" className="btn btn-primary" style={{ padding: '0.6rem 1rem' }} disabled={actionLoading || !excelFile}>
                    Preview
                  </button>
                </div>
              </form>

              {/* Excel Preview Table */}
              {excelPreviewData.length > 0 && (
                <div className="admin-form" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem', padding: '1rem', border: '1px solid var(--glass-border)', borderRadius: '12px', background: 'rgba(255,255,255,0.01)', width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--accent-teal)', margin: 0 }}>Excel Import Preview ({excelPreviewData.length} words found)</h3>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setExcelPreviewData([])}
                      style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                    >
                      Clear Preview
                    </button>
                  </div>
                  <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '0.25rem' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                          <th style={{ padding: '0.4rem', color: 'var(--accent-teal)' }}>Word</th>
                          <th style={{ padding: '0.4rem', color: 'var(--accent-teal)' }}>Clue</th>
                          <th style={{ padding: '0.4rem', color: 'var(--accent-teal)', textAlign: 'right' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {excelPreviewData.map((item, idx) => (
                          <tr key={`prev-${idx}`} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                            <td style={{ padding: '0.4rem', fontWeight: '700', textTransform: 'uppercase' }}>{item.word}</td>
                            <td style={{ padding: '0.4rem', color: 'var(--text-muted)' }}>{item.clue}</td>
                            <td style={{ padding: '0.4rem', textAlign: 'right', fontWeight: '600' }}>
                              {item.exists ? (
                                <span style={{ color: 'var(--color-error)', fontSize: '0.75rem' }}>Exists (Skip)</span>
                              ) : (
                                <span style={{ color: 'var(--color-success)', fontSize: '0.75rem' }}>New</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleImportExcel}
                    style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }}
                    disabled={actionLoading}
                  >
                    <Icon icon="solar:import-bold" /> Confirm & Import {excelPreviewData.filter(x => !x.exists).length} New Words
                  </button>
                </div>
              )}

              <hr style={{ borderColor: 'var(--glass-border)', margin: '1rem 0', width: '100%' }} />

              {/* Daftar Kata */}
              <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--accent-purple)', width: '100%' }}>
                Word Database ({dbWords.length} words)
              </h3>

              <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '0.5rem', width: '100%' }}>
                {dbWords.length === 0 ? (
                  <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '1rem' }}>
                    No custom words in the database yet.
                  </p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                        <th style={{ padding: '0.5rem', color: 'var(--accent-teal)' }}>Word</th>
                        <th style={{ padding: '0.5rem', color: 'var(--accent-teal)' }}>Clue</th>
                        <th style={{ padding: '0.5rem', color: 'var(--accent-teal)', textAlign: 'right' }}>Action</th>
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
            </>
          )}

          {adminTab === 'leaderboard' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '0.75rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--accent-purple)', margin: 0 }}>
                  Manage Leaderboard Entries
                </h3>
                {leaderboardData.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleClearAllLeaderboard}
                    disabled={actionLoading}
                    style={{
                      borderColor: 'var(--color-error)',
                      color: 'var(--color-error)',
                      padding: '0.4rem 0.8rem',
                      fontSize: '0.8rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}
                  >
                    <Icon icon="solar:trash-bin-trash-bold" /> Clear All
                  </button>
                )}
              </div>

              <div style={{ maxHeight: '350px', overflowY: 'auto', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '0.5rem', width: '100%' }}>
                {leaderboardData.length === 0 ? (
                  <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '1rem' }}>
                    No leaderboard entries yet.
                  </p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                        <th style={{ padding: '0.5rem', color: 'var(--accent-teal)' }}>Rank</th>
                        <th style={{ padding: '0.5rem', color: 'var(--accent-teal)' }}>Name</th>
                        <th style={{ padding: '0.5rem', color: 'var(--accent-teal)' }}>Difficulty</th>
                        <th style={{ padding: '0.5rem', color: 'var(--accent-teal)' }}>Score</th>
                        <th style={{ padding: '0.5rem', color: 'var(--accent-teal)' }}>Time</th>
                        <th style={{ padding: '0.5rem', color: 'var(--accent-teal)', textAlign: 'right' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboardData.map((item, idx) => (
                        <tr key={`admin-lb-${idx}`} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                          <td style={{ padding: '0.5rem' }}>{idx + 1}</td>
                          <td style={{ padding: '0.5rem', fontWeight: '700' }}>{item.name}</td>
                          <td style={{ padding: '0.5rem' }}>
                            <span className={`difficulty-badge difficulty-${item.difficulty}`}>
                              {item.difficulty}
                            </span>
                          </td>
                          <td style={{ padding: '0.5rem', fontWeight: '800', color: 'var(--accent-teal)' }}>{item.score}</td>
                          <td style={{ padding: '0.5rem', fontFamily: 'monospace' }}>{formatTime(item.timeSpent)}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                            <button
                              type="button"
                              onClick={() => handleDeleteLeaderboard(item.id)}
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
            </>
          )}

          <button className="btn btn-secondary" onClick={() => menuNavigate('menu')} style={{ alignSelf: 'center', marginTop: '1rem' }}>
            Back to Main Menu
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
                title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
              >
                <Icon icon={theme === 'dark' ? 'solar:sun-2-bold-duotone' : 'solar:moon-bold-duotone'} />
              </button>
              <div
                className="timer"
                title={timerActive ? 'Pause game' : 'Resume game'}
                onClick={() => { playSound('click'); setTimerActive(!timerActive); }}
              >
                <Icon icon={timerActive ? 'solar:clock-circle-bold-duotone' : 'solar:pause-circle-bold-duotone'} />
                <span>{formatTime(timerSeconds)}</span>
              </div>
            </div>
          </header>

          <div className="game-wrapper-desktop">
            <aside className="game-sidebar-left">
              {/* Game HUD (Nyawa, Hint, dsb) */}
              <div className="hud-container">
                <div className="hud-item">
                  <span>Player: </span>
                  <span className="hint-badge" style={{ background: 'rgba(139, 92, 246, 0.15)', color: 'var(--accent-purple-hover)' }}>
                    {username}
                  </span>
                </div>

                <div className="hud-item">
                  <span>Progress Pts: </span>
                  <span className="hint-badge" style={{ background: 'rgba(6, 182, 212, 0.15)', color: 'var(--accent-teal-hover)', borderColor: 'rgba(6, 182, 212, 0.25)', fontWeight: 'bold' }}>
                    {getCorrectWordsCount() * 5} of {(clues.across.length + clues.down.length) * 5} ({clues.across.length + clues.down.length > 0 ? Math.round((getCorrectWordsCount() / (clues.across.length + clues.down.length)) * 100) : 0}%)
                  </span>
                </div>

                {/* Health / Nyawa - Disabled for now */}

                <div className="hud-item">
                  <span>Letter Hint: </span>
                  <span className="hint-badge">
                    {lettersRevealed} / {difficulty === 'easy' ? 5 : difficulty === 'medium' ? 3 : 1}
                  </span>
                </div>

                {difficulty === 'easy' && (
                  <div className="hud-item">
                    <span>Word Hint: </span>
                    <span className="hint-badge">
                      {wordsRevealed} / 1
                    </span>
                  </div>
                )}
              </div>

              {/* Toolbar game actions */}
              <div className="controls-bar">
                <button className="btn btn-accent" onClick={checkAnswers} disabled={!timerActive}>
                  <Icon icon="solar:check-circle-bold" /> Check Answers
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={revealLetter}
                  disabled={!selectedCell || !timerActive || lettersRevealed >= (difficulty === 'easy' ? 5 : difficulty === 'medium' ? 3 : 1)}
                  title="Reveal selected letter"
                >
                  <Icon icon="solar:eye-bold" /> Reveal Letter
                </button>
                {difficulty === 'easy' && (
                  <button
                    className="btn btn-secondary"
                    onClick={revealWord}
                    disabled={activeWordCells.length === 0 || !timerActive || wordsRevealed >= 1}
                    title="Reveal selected word"
                  >
                    <Icon icon="solar:book-2-bold" /> Reveal Word
                  </button>
                )}
                <button className="btn btn-secondary" onClick={resetGrid} disabled={!timerActive || hasGivenUp}>
                  <Icon icon="solar:eraser-bold" /> Reset Board
                </button>
                {!hasGivenUp ? (
                  <button
                    className="btn btn-secondary"
                    style={{ borderColor: 'var(--color-error)', color: 'var(--color-error)' }}
                    onClick={handleGiveUp}
                    disabled={!timerActive}
                    title="Surrender"
                  >
                    <Icon icon="solar:danger-bold" /> Surrender
                  </button>
                ) : (
                  <>
                    <button
                      className="btn btn-accent"
                      onClick={revealAllAnswers}
                      title="Reveal all answers"
                    >
                      <Icon icon="solar:eye-bold" /> Reveal Answers
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={exitGame}
                      title="Exit to main menu"
                    >
                      <Icon icon="solar:logout-bold" /> Exit
                    </button>
                  </>
                )}
              </div>

              {/* Banner Petunjuk Terpilih */}
              {activeClue && (
                <div className="active-clue-banner animate-slide-in" style={{ width: '100%' }}>
                  <span className={`banner-badge ${selectedDirection === 'H' ? 'across' : 'down'}`}>
                    {selectedDirection === 'H' ? 'Across' : 'Down'}
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
                    <h3><Icon icon="solar:arrow-right-circle-bold-duotone" /> Across</h3>
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
                    <h3><Icon icon="solar:arrow-down-circle-bold-duotone" /> Down</h3>
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
            <h4><Icon icon="solar:info-circle-bold-duotone" /> Navigation</h4>
            <ul>
              <li>Click cell/clue to select.</li>
              <li><span className="key-cap">Space</span>: Toggle direction.</li>
              <li><span className="key-cap">←</span> <span className="key-cap">↑</span> <span className="key-cap">→</span> <span className="key-cap">↓</span>: Move focus.</li>
              <li><span className="key-cap">Backspace</span>: Delete.</li>
            </ul>
          </section>
        </>
      )}
      {/* 4.5 OVERLAY MODAL: CONFIRM GIVE UP */}
      {showGiveUpConfirm && (
        <div className="modal-overlay">
          <div className="modal-content animate-slide-in" style={{ maxWidth: '400px' }}>
            <div className="modal-icon" style={{ color: 'var(--color-error)' }}>
              <Icon icon="solar:danger-bold-duotone" style={{ fontSize: '4.5rem' }} />
            </div>
            <h2>Confirm Surrender</h2>
            <p style={{ margin: '10px 0', color: 'var(--text-muted)', lineHeight: '1.5' }}>
              Are you sure you want to surrender? The timer will stop and you can reveal all answers.
            </p>
            <div style={{ display: 'flex', gap: '1rem', width: '100%', marginTop: '1rem' }}>
              <button
                className="btn btn-primary"
                style={{ background: 'var(--color-error)', color: '#fff', flex: 1, justifyContent: 'center', boxShadow: 'none' }}
                onClick={() => {
                  setShowGiveUpConfirm(false);
                  playSound('click');
                  setTimerActive(false);
                  setHasGivenUp(true);
                  showToast("You have surrendered. 'Reveal Answers' button is now available in the sidebar.", "info");
                }}
              >
                Yes, Surrender
              </button>
              <button
                className="btn btn-secondary"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => {
                  playSound('click');
                  setShowGiveUpConfirm(false);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. OVERLAY MODAL: WINNING SUCCESS */}
      {showSuccess && (() => {
        const totalWords = clues.across.length + clues.down.length;
        const correctWords = getCorrectWordsCount();
        const pct = totalWords > 0 ? Math.round((correctWords / totalWords) * 100) : 0;

        let motivationalMessage = "";
        let winTitle = "Game Completed!";
        let iconName = "solar:star-bold-duotone";
        let iconColor = "#06b6d4";

        if (pct === 100) {
          winTitle = "Perfect Victory!";
          motivationalMessage = "Awesome! You solved all words perfectly! 🏆";
          iconName = "solar:cup-first-bold-duotone";
          iconColor = "#eab308";
        } else if (pct >= 75) {
          motivationalMessage = "Great job! Just a little bit left to perfection. Keep it up! 💪";
        } else if (pct >= 50) {
          motivationalMessage = "Good effort! You solved most of the words! 👍";
        } else if (pct >= 25) {
          motivationalMessage = "Keep going! Every mistake is a step to learning. Try again! ✨";
        } else {
          motivationalMessage = "Don't give up! A good start to learn. Try again and conquer the board! 🔥";
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
                  <div className="stat-label">Progress Pts</div>
                  <div className="stat-value" style={{ color: 'var(--accent-teal-hover)', fontSize: '1.2rem' }}>
                    {correctWords * 5} / {totalWords * 5} Pts
                  </div>
                </div>
                <div className="modal-stat-card">
                  <div className="stat-label">Percentage</div>
                  <div className="stat-value" style={{ color: 'var(--accent-purple-hover)', fontSize: '1.2rem' }}>
                    {pct}%
                  </div>
                </div>
                <div className="modal-stat-card" style={{ gridColumn: 'span 2' }}>
                  <div className="stat-label">Time Spent</div>
                  <div className="stat-value" style={{ fontSize: '1.2rem' }}>{formatTime(timeSpent)}</div>
                </div>
              </div>

              <div style={{ marginTop: '1rem', width: '100%' }}>
                <p style={{ color: 'var(--color-success)', fontWeight: '700', fontSize: '0.9rem', marginBottom: '1rem' }}>
                  Score for <strong style={{ color: 'var(--accent-purple-hover)' }}>{username}</strong> has been recorded automatically! 🏆
                </p>
                <button className="btn btn-primary" onClick={exitGame} style={{ width: '100%', justifyContent: 'center' }}>
                  Back to Main Menu
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
            <p>You ran out of time or lives.</p>

            <div className="modal-stats" style={{ gridTemplateColumns: '1fr' }}>
              <div className="modal-stat-card">
                <div className="stat-label">Difficulty</div>
                <div className="stat-value" style={{ textTransform: 'uppercase' }}>{difficulty}</div>
              </div>
            </div>

            <div className="menu-options" style={{ width: '100%' }}>
              <button className="btn btn-primary" onClick={fetchNewPuzzle} style={{ width: '100%', justifyContent: 'center' }}>
                <Icon icon="solar:restart-bold" /> Play Again
              </button>
              <button className="btn btn-secondary" onClick={exitGame} style={{ width: '100%', justifyContent: 'center' }}>
                <Icon icon="solar:logout-bold" /> Exit to Menu
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Custom Confirm Dialog Modal */}
      {confirmDialog.show && (
        <div className="modal-overlay">
          <div className="modal-content animate-slide-in" style={{ maxWidth: '400px' }}>
            <div className="modal-icon" style={{ color: 'var(--accent-purple)' }}>
              <Icon icon="solar:question-square-bold-duotone" style={{ fontSize: '4.5rem' }} />
            </div>
            <h2>{confirmDialog.title}</h2>
            <p style={{ margin: '10px 0', color: 'var(--text-muted)', lineHeight: '1.5' }}>
              {confirmDialog.message}
            </p>
            <div style={{ display: 'flex', gap: '1rem', width: '100%', marginTop: '1rem' }}>
              <button
                className="btn btn-primary"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => {
                  playSound('click');
                  confirmDialog.onConfirm();
                }}
              >
                Confirm
              </button>
              <button
                className="btn btn-secondary"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => {
                  playSound('click');
                  setConfirmDialog({ show: false, title: '', message: '', onConfirm: null });
                }}
              >
                Cancel
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
            top: '20px',
            right: '20px',
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
