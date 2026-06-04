package main

import (
	"math"
	"math/rand"
	"sort"
	"time"
)

type PlacedWord struct {
	Word      string `json:"word"`
	Clue      string `json:"clue"`
	Row       int    `json:"row"`
	Col       int    `json:"col"`
	Direction string `json:"direction"` // "H" or "V"
	Number    int    `json:"number"`
}

type CrosswordCell struct {
	Letter  string `json:"letter"`
	Number  int    `json:"number"`
	IsEmpty bool   `json:"isEmpty"`
	Row     int    `json:"row"`
	Col     int    `json:"col"`
}

type CrosswordPuzzle struct {
	GridSize int                 `json:"gridSize"`
	Grid     [][]CrosswordCell   `json:"grid"`
	Clues    CrosswordClues      `json:"clues"`
}

type CrosswordClues struct {
	Across []PlacedWord `json:"across"`
	Down   []PlacedWord `json:"down"`
}

// GenerateCrossword attempts to create a high-quality crossword puzzle.
// It will dynamically size the grid and retry multiple times to hit the requested minWords.
func GenerateCrossword(minWords int) (*CrosswordPuzzle, error) {
	rand.Seed(time.Now().UnixNano())

	// Dynamically scale grid size based on target vocabulary size
	gridSize := 15
	if minWords >= 50 {
		gridSize = 25
	} else if minWords >= 30 {
		gridSize = 21
	} else if minWords >= 20 {
		gridSize = 18
	} else if minWords >= 15 {
		gridSize = 16
	}

	// Fetch a larger candidate pool to ensure the placement algorithm has options
	poolSize := minWords + 25
	if poolSize < 40 {
		poolSize = 40
	}
	// Limit candidate pool size to the maximum seeded dataset items (200 total)
	if poolSize > 150 {
		poolSize = 150
	}

	var bestPuzzle *CrosswordPuzzle
	maxPlacedCount := 0

	// Increase attempts for larger boards to guarantee high placement count
	attempts := 30
	if minWords >= 30 {
		attempts = 50
	}

	for attempt := 0; attempt < attempts; attempt++ {
		candidates, err := GetRandomWords(poolSize)
		if err != nil {
			return nil, err
		}

		puzzle := tryGenerate(candidates, gridSize, minWords)
		placedCount := len(puzzle.Clues.Across) + len(puzzle.Clues.Down)

		// If we successfully placed enough words, return immediately
		if placedCount == minWords {
			return puzzle, nil
		}

		if placedCount > maxPlacedCount {
			maxPlacedCount = placedCount
			bestPuzzle = puzzle
		}
	}

	return bestPuzzle, nil
}

func tryGenerate(words []WordEntry, gridSize int, targetWords int) *CrosswordPuzzle {
	// Sort words by length descending
	sort.Slice(words, func(i, j int) bool {
		return len(words[i].Word) > len(words[j].Word)
	})

	// Initialize empty grid of dynamic size
	grid := make([][]rune, gridSize)
	for i := range grid {
		grid[i] = make([]rune, gridSize)
	}

	var placedWords []PlacedWord

	// Helper to write to grid
	placeWord := func(pw PlacedWord) {
		for i, r := range pw.Word {
			if pw.Direction == "H" {
				grid[pw.Row][pw.Col+i] = r
			} else {
				grid[pw.Row+i][pw.Col] = r
			}
		}
		placedWords = append(placedWords, pw)
	}

	// 1. Place the first word in the middle horizontally
	firstWord := words[0]
	firstWordLen := len(firstWord.Word)
	if firstWordLen <= gridSize {
		startCol := (gridSize - firstWordLen) / 2
		startRow := gridSize / 2
		placeWord(PlacedWord{
			Word:      firstWord.Word,
			Clue:      firstWord.Clue,
			Row:       startRow,
			Col:       startCol,
			Direction: "H",
		})
	}

	// 2. Place subsequent words
	for _, entry := range words[1:] {
		if len(placedWords) >= targetWords {
			break
		}
		word := entry.Word
		wordLen := len(word)
		if wordLen > gridSize {
			continue
		}

		type CandidatePlacement struct {
			Row       int
			Col       int
			Direction string
			Score     int
		}

		var validPlacements []CandidatePlacement

		// Scan grid for potential intersections
		for r := 0; r < gridSize; r++ {
			for c := 0; c < gridSize; c++ {
				gridChar := grid[r][c]
				if gridChar == 0 {
					continue
				}

				// Find if the word contains this character
				for i, char := range word {
					if char != gridChar {
						continue
					}

					// We found a letter match, try both directions
					directions := []string{"H", "V"}
					for _, dir := range directions {
						var startRow, startCol int
						if dir == "H" {
							startRow = r
							startCol = c - i
						} else {
							startRow = r - i
							startCol = c
						}

						if isValidPlacement(grid, word, startRow, startCol, dir, gridSize) {
							score := calculateScore(grid, word, startRow, startCol, dir, gridSize)
							validPlacements = append(validPlacements, CandidatePlacement{
								Row:       startRow,
								Col:       startCol,
								Direction: dir,
								Score:     score,
							})
						}
					}
				}
			}
		}

		if len(validPlacements) > 0 {
			// Sort placements by score descending
			sort.Slice(validPlacements, func(i, j int) bool {
				return validPlacements[i].Score > validPlacements[j].Score
			})

			// Choose the best placement
			best := validPlacements[0]
			placeWord(PlacedWord{
				Word:      word,
				Clue:      entry.Clue,
				Row:       best.Row,
				Col:       best.Col,
				Direction: best.Direction,
			})
		}
	}

	// 3. Assign Numbers in crossword style
	clueNumber := 1
	var acrossClues []PlacedWord
	var downClues []PlacedWord

	// Map to look up placed words by starting cell
	type startKey struct {
		row int
		col int
		dir string
	}
	wordMap := make(map[startKey]*PlacedWord)
	for i := range placedWords {
		pw := &placedWords[i]
		wordMap[startKey{pw.Row, pw.Col, pw.Direction}] = pw
	}

	// Initialize the response grid of dynamic size
	resGrid := make([][]CrosswordCell, gridSize)
	for r := 0; r < gridSize; r++ {
		resGrid[r] = make([]CrosswordCell, gridSize)
		for c := 0; c < gridSize; c++ {
			resGrid[r][c] = CrosswordCell{
				Letter:  "",
				Number:  0,
				IsEmpty: true,
				Row:     r,
				Col:     c,
			}
			if grid[r][c] != 0 {
				resGrid[r][c].Letter = string(grid[r][c])
				resGrid[r][c].IsEmpty = false
			}
		}
	}

	for r := 0; r < gridSize; r++ {
		for c := 0; c < gridSize; c++ {
			if grid[r][c] == 0 {
				continue
			}

			hasAcross := wordMap[startKey{r, c, "H"}] != nil
			hasDown := wordMap[startKey{r, c, "V"}] != nil

			if hasAcross || hasDown {
				resGrid[r][c].Number = clueNumber

				if hasAcross {
					pw := wordMap[startKey{r, c, "H"}]
					pw.Number = clueNumber
					acrossClues = append(acrossClues, *pw)
				}
				if hasDown {
					pw := wordMap[startKey{r, c, "V"}]
					pw.Number = clueNumber
					downClues = append(downClues, *pw)
				}
				clueNumber++
			}
		}
	}

	return &CrosswordPuzzle{
		GridSize: gridSize,
		Grid:     resGrid,
		Clues: CrosswordClues{
			Across: acrossClues,
			Down:   downClues,
		},
	}
}

func isValidPlacement(grid [][]rune, word string, startRow, startCol int, dir string, gridSize int) bool {
	wordLen := len(word)

	// Check grid bounds
	if dir == "H" {
		if startRow < 0 || startRow >= gridSize || startCol < 0 || startCol+wordLen > gridSize {
			return false
		}
	} else {
		if startRow < 0 || startRow+wordLen > gridSize || startCol < 0 || startCol >= gridSize {
			return false
		}
	}

	// Check cell immediately before the start of the word
	if dir == "H" && startCol > 0 && grid[startRow][startCol-1] != 0 {
		return false
	}
	if dir == "V" && startRow > 0 && grid[startRow-1][startCol] != 0 {
		return false
	}

	// Check cell immediately after the end of the word
	if dir == "H" && startCol+wordLen < gridSize && grid[startRow][startCol+wordLen] != 0 {
		return false
	}
	if dir == "V" && startRow+wordLen < gridSize && grid[startRow+wordLen][startCol] != 0 {
		return false
	}

	intersectionCount := 0

	// Check each cell along the word path
	for i := 0; i < wordLen; i++ {
		var r, c int
		if dir == "H" {
			r = startRow
			c = startCol + i
		} else {
			r = startRow + i
			c = startCol
		}

		gridChar := grid[r][c]
		wordChar := rune(word[i])

		if gridChar != 0 {
			// There's already a letter. It must match.
			if gridChar != wordChar {
				return false
			}
			intersectionCount++
		} else {
			// Cell is empty. Neighbors perpendicular to the word direction must be empty.
			if dir == "H" {
				if r > 0 && grid[r-1][c] != 0 {
					return false
				}
				if r < gridSize-1 && grid[r+1][c] != 0 {
					return false
				}
			} else {
				if c > 0 && grid[r][c-1] != 0 {
					return false
				}
				if c < gridSize-1 && grid[r][c+1] != 0 {
					return false
				}
			}
		}
	}

	// Placements (except the very first word) must have at least one intersection
	return intersectionCount > 0
}

func calculateScore(grid [][]rune, word string, startRow, startCol int, dir string, gridSize int) int {
	score := 0
	wordLen := len(word)

	// Reward intersections
	for i := 0; i < wordLen; i++ {
		var r, c int
		if dir == "H" {
			r = startRow
			c = startCol + i
		} else {
			r = startRow + i
			c = startCol
		}

		if grid[r][c] != 0 {
			score += 15
		}
	}

	// Reward compactness (distance to center)
	center := float64(gridSize) / 2.0
	for i := 0; i < wordLen; i++ {
		var r, c int
		if dir == "H" {
			r = startRow
			c = startCol + i
		} else {
			r = startRow + i
			c = startCol
		}

		dist := math.Sqrt(math.Pow(float64(r)-center, 2) + math.Pow(float64(c)-center, 2))
		score -= int(dist)
	}

	return score
}
