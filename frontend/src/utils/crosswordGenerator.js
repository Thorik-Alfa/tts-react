import dataset from '../data/dataset.json';

/**
 * Returns a list of random entries from dataset.
 */
function getRandomWords(count, customWordList = null) {
  const source = customWordList && customWordList.length > 0 ? customWordList : dataset;
  const shuffled = [...source].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

/**
 * Calculates dynamic grid size based on target words
 */
function getGridSize(minWords) {
  if (minWords >= 50) return 25;
  if (minWords >= 30) return 21;
  if (minWords >= 20) return 18;
  if (minWords >= 15) return 16;
  return 15;
}

/**
 * Main function to generate a crossword puzzle.
 */
export function generateCrossword(minWords, customWordList = null) {
  const gridSize = getGridSize(minWords);

  let poolSize = minWords + 25;
  if (poolSize < 40) poolSize = 40;
  if (poolSize > 150) poolSize = 150;

  let bestPuzzle = null;
  let maxPlacedCount = 0;

  const attempts = minWords >= 30 ? 50 : 30;

  for (let attempt = 0; attempt < attempts; attempt++) {
    const candidates = getRandomWords(poolSize, customWordList);
    const puzzle = tryGenerate(candidates, gridSize, minWords);
    if (!puzzle) continue;
    const placedCount = puzzle.clues.across.length + puzzle.clues.down.length;

    if (placedCount === minWords) {
      return puzzle;
    }

    if (placedCount > maxPlacedCount) {
      maxPlacedCount = placedCount;
      bestPuzzle = puzzle;
    }
  }

  return bestPuzzle;
}

function tryGenerate(words, gridSize, targetWords) {
  // Sort words by length descending
  const sortedWords = [...words].sort((a, b) => b.word.length - a.word.length);

  // Initialize empty grid (gridSize x gridSize) filled with 0 character
  const grid = Array(gridSize).fill(null).map(() => Array(gridSize).fill(0));
  const placedWords = [];

  const placeWord = (pw) => {
    for (let i = 0; i < pw.word.length; i++) {
      if (pw.direction === 'H') {
        grid[pw.row][pw.col + i] = pw.word[i];
      } else {
        grid[pw.row + i][pw.col] = pw.word[i];
      }
    }
    placedWords.push(pw);
  };

  // Place first word in middle horizontally
  const firstWord = sortedWords[0];
  const firstWordLen = firstWord.word.length;
  if (firstWordLen <= gridSize) {
    const startCol = Math.floor((gridSize - firstWordLen) / 2);
    const startRow = Math.floor(gridSize / 2);
    placeWord({
      word: firstWord.word,
      clue: firstWord.clue,
      row: startRow,
      col: startCol,
      direction: 'H'
    });
  }

  // Place subsequent words
  for (let wIdx = 1; wIdx < sortedWords.length; wIdx++) {
    if (placedWords.length >= targetWords) {
      break;
    }

    const wordEntry = sortedWords[wIdx];
    const word = wordEntry.word;
    const wordLen = word.length;
    if (wordLen > gridSize) continue;

    const validPlacements = [];

    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        const gridChar = grid[r][c];
        if (gridChar === 0) continue;

        // Find matches in the word
        for (let i = 0; i < wordLen; i++) {
          if (word[i] !== gridChar) continue;

          const directions = ['H', 'V'];
          for (const dir of directions) {
            let startRow = r;
            let startCol = c;
            if (dir === 'H') {
              startCol = c - i;
            } else {
              startRow = r - i;
            }

            if (isValidPlacement(grid, word, startRow, startCol, dir, gridSize)) {
              const score = calculateScore(grid, word, startRow, startCol, dir, gridSize);
              validPlacements.push({
                row: startRow,
                col: startCol,
                direction: dir,
                score: score
              });
            }
          }
        }
      }
    }

    if (validPlacements.length > 0) {
      validPlacements.sort((a, b) => b.score - a.score);
      const best = validPlacements[0];
      placeWord({
        word: word,
        clue: wordEntry.clue,
        row: best.row,
        col: best.col,
        direction: best.direction
      });
    }
  }

  // Assign numbers in crossword style
  let clueNumber = 1;
  const acrossClues = [];
  const downClues = [];

  const wordMap = {};
  placedWords.forEach(pw => {
    const key = `${pw.row}-${pw.col}-${pw.direction}`;
    wordMap[key] = pw;
  });

  // Initialize response grid
  const resGrid = Array(gridSize).fill(null).map((_, r) => {
    return Array(gridSize).fill(null).map((_, c) => {
      const char = grid[r][c];
      return {
        letter: char !== 0 ? char : '',
        number: 0,
        isEmpty: char === 0,
        row: r,
        col: c
      };
    });
  });

  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      if (grid[r][c] === 0) continue;

      const hasAcross = !!wordMap[`${r}-${c}-H`];
      const hasDown = !!wordMap[`${r}-${c}-V`];

      if (hasAcross || hasDown) {
        resGrid[r][c].number = clueNumber;

        if (hasAcross) {
          const pw = wordMap[`${r}-${c}-H`];
          pw.number = clueNumber;
          acrossClues.push(pw);
        }
        if (hasDown) {
          const pw = wordMap[`${r}-${c}-V`];
          pw.number = clueNumber;
          downClues.push(pw);
        }
        clueNumber++;
      }
    }
  }

  return {
    gridSize: gridSize,
    grid: resGrid,
    clues: {
      across: acrossClues,
      down: downClues
    }
  };
}

function isValidPlacement(grid, word, startRow, startCol, dir, gridSize) {
  const wordLen = word.length;

  // Check bounds
  if (dir === 'H') {
    if (startRow < 0 || startRow >= gridSize || startCol < 0 || startCol + wordLen > gridSize) {
      return false;
    }
  } else {
    if (startRow < 0 || startRow + wordLen > gridSize || startCol < 0 || startCol >= gridSize) {
      return false;
    }
  }

  // Check cell immediately before start
  if (dir === 'H' && startCol > 0 && grid[startRow][startCol - 1] !== 0) {
    return false;
  }
  if (dir === 'V' && startRow > 0 && grid[startRow - 1][startCol] !== 0) {
    return false;
  }

  // Check cell immediately after end
  if (dir === 'H' && startCol + wordLen < gridSize && grid[startRow][startCol + wordLen] !== 0) {
    return false;
  }
  if (dir === 'V' && startRow + wordLen < gridSize && grid[startRow + wordLen][startCol] !== 0) {
    return false;
  }

  let intersectionCount = 0;

  for (let i = 0; i < wordLen; i++) {
    let r = startRow;
    let c = startCol;
    if (dir === 'H') {
      c = startCol + i;
    } else {
      r = startRow + i;
    }

    const gridChar = grid[r][c];
    const wordChar = word[i];

    if (gridChar !== 0) {
      if (gridChar !== wordChar) {
        return false;
      }
      intersectionCount++;
    } else {
      // Cell is empty, check perpendicular neighbors
      if (dir === 'H') {
        if (r > 0 && grid[r - 1][c] !== 0) return false;
        if (r < gridSize - 1 && grid[r + 1][c] !== 0) return false;
      } else {
        if (c > 0 && grid[r][c - 1] !== 0) return false;
        if (c < gridSize - 1 && grid[r][c + 1] !== 0) return false;
      }
    }
  }

  return intersectionCount > 0;
}

function calculateScore(grid, word, startRow, startCol, dir, gridSize) {
  let score = 0;
  const wordLen = word.length;

  for (let i = 0; i < wordLen; i++) {
    let r = startRow;
    let c = startCol;
    if (dir === 'H') {
      c = startCol + i;
    } else {
      r = startRow + i;
    }

    if (grid[r][c] !== 0) {
      score += 15;
    }
  }

  const center = gridSize / 2.0;
  for (let i = 0; i < wordLen; i++) {
    let r = startRow;
    let c = startCol;
    if (dir === 'H') {
      c = startCol + i;
    } else {
      r = startRow + i;
    }

    const dist = Math.sqrt(Math.pow(r - center, 2) + Math.pow(c - center, 2));
    score -= Math.floor(dist);
  }

  return score;
}
