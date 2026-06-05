package main

import (
	"bufio"
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	_ "github.com/lib/pq"
)

type WordEntry struct {
	Word string `json:"word"`
	Clue string `json:"clue"`
}

type LeaderboardEntry struct {
	Name       string `json:"name"`
	Difficulty string `json:"difficulty"`
	Score      int    `json:"score"`
	TimeSpent  int    `json:"timeSpent"`
	CreatedAt  string `json:"createdAt"`
}

var db *sql.DB

// InitDB initializes the PostgreSQL database, seeds it from dataset.txt if empty, and sets up leaderboard.
func InitDB() error {
	var err error
	connStr := os.Getenv("DATABASE_URL")
	if connStr == "" {
		connStr = "postgres://postgres:secret@localhost:5432/postgres?sslmode=disable"
	}
	db, err = sql.Open("postgres", connStr)
	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}

	if err := db.Ping(); err != nil {
		return fmt.Errorf("failed to connect to PostgreSQL: %w. Make sure Postgres is running on port 5432 with password 'secret'", err)
	}

	// Create words table
	wordsQuery := `
	CREATE TABLE IF NOT EXISTS words (
		id SERIAL PRIMARY KEY,
		word VARCHAR(100) UNIQUE,
		clue TEXT
	);`
	if _, err := db.Exec(wordsQuery); err != nil {
		return fmt.Errorf("failed to create words table: %w", err)
	}

	// Create leaderboard table
	leaderboardQuery := `
	CREATE TABLE IF NOT EXISTS leaderboard (
		id SERIAL PRIMARY KEY,
		name VARCHAR(100) NOT NULL,
		difficulty VARCHAR(20) NOT NULL,
		score INTEGER NOT NULL,
		time_spent INTEGER NOT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);`
	if _, err := db.Exec(leaderboardQuery); err != nil {
		return fmt.Errorf("failed to create leaderboard table: %w", err)
	}

	// Check if words table is empty
	var count int
	err = db.QueryRow("SELECT COUNT(*) FROM words").Scan(&count)
	if err != nil {
		return fmt.Errorf("failed to check database count: %w", err)
	}

	if count == 0 {
		log.Println("Database is empty, seeding from dataset.txt...")
		if err := seedDatabase(); err != nil {
			return fmt.Errorf("failed to seed database: %w", err)
		}
		log.Println("Database seeding completed.")
	} else {
		log.Printf("Database already initialized with %d words.\n", count)
	}

	return nil
}

func seedDatabase() error {
	path := filepath.Join("..", "dataset.txt")
	file, err := os.Open(path)
	if err != nil {
		path = "dataset.txt"
		file, err = os.Open(path)
		if err != nil {
			return fmt.Errorf("could not open dataset.txt: %w", err)
		}
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare("INSERT INTO words (word, clue) VALUES ($1, $2) ON CONFLICT (word) DO NOTHING")
	if err != nil {
		return err
	}
	defer stmt.Close()

	isHeader := true
	lineCount := 0

	for scanner.Scan() {
		line := scanner.Text()
		if isHeader {
			isHeader = false
			continue
		}
		if strings.TrimSpace(line) == "" {
			continue
		}

		parts := strings.Split(line, "\t")
		if len(parts) < 3 {
			if len(parts) == 1 {
				parts = strings.FieldsFunc(line, func(r rune) bool {
					return r == '\t'
				})
			}
		}

		if len(parts) >= 3 {
			word := strings.ToUpper(strings.TrimSpace(parts[1]))
			clue := strings.TrimSpace(parts[2])
			word = cleanWord(word)

			if word != "" && clue != "" {
				_, err = stmt.Exec(word, clue)
				if err != nil {
					log.Printf("Failed to insert word %s: %v\n", word, err)
					continue
				}
				lineCount++
			}
		}
	}

	if err := scanner.Err(); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return err
	}

	log.Printf("Successfully seeded %d records.\n", lineCount)
	return nil
}

func cleanWord(w string) string {
	var sb strings.Builder
	for _, r := range w {
		if r >= 'A' && r <= 'Z' {
			sb.WriteRune(r)
		}
	}
	return sb.String()
}

// GetRandomWords fetches count random words from the database
func GetRandomWords(count int) ([]WordEntry, error) {
	rows, err := db.Query("SELECT word, clue FROM words ORDER BY RANDOM() LIMIT $1", count)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entries []WordEntry
	for rows.Next() {
		var entry WordEntry
		if err := rows.Scan(&entry.Word, &entry.Clue); err != nil {
			return nil, err
		}
		entries = append(entries, entry)
	}
	return entries, nil
}

// GetLeaderboard fetches top 10 scores
func GetLeaderboard() ([]LeaderboardEntry, error) {
	rows, err := db.Query("SELECT name, difficulty, score, time_spent, created_at FROM leaderboard ORDER BY score DESC, time_spent ASC LIMIT 10")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entries []LeaderboardEntry
	for rows.Next() {
		var entry LeaderboardEntry
		var createdAt time.Time
		if err := rows.Scan(&entry.Name, &entry.Difficulty, &entry.Score, &entry.TimeSpent, &createdAt); err != nil {
			return nil, err
		}
		entry.CreatedAt = createdAt.Format("2006-01-02 15:04:05")
		entries = append(entries, entry)
	}
	return entries, nil
}

// SubmitScore inserts a score record into database
func SubmitScore(name, difficulty string, score, timeSpent int) error {
	_, err := db.Exec("INSERT INTO leaderboard (name, difficulty, score, time_spent) VALUES ($1, $2, $3, $4)", name, difficulty, score, timeSpent)
	return err
}

// GetAllWords fetches all words from the words table
func GetAllWords() ([]WordEntry, error) {
	rows, err := db.Query("SELECT word, clue FROM words ORDER BY id DESC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entries []WordEntry
	for rows.Next() {
		var entry WordEntry
		if err := rows.Scan(&entry.Word, &entry.Clue); err != nil {
			return nil, err
		}
		entries = append(entries, entry)
	}
	return entries, nil
}

// AddWord inserts a word into database (capitalized word)
func AddWord(word, clue string) error {
	wordUpper := strings.ToUpper(strings.TrimSpace(word))
	wordClean := cleanWord(wordUpper)
	if wordClean == "" {
		return fmt.Errorf("invalid word")
	}
	_, err := db.Exec("INSERT INTO words (word, clue) VALUES ($1, $2) ON CONFLICT (word) DO UPDATE SET clue = EXCLUDED.clue", wordClean, clue)
	return err
}

// DeleteWord deletes a word from the database
func DeleteWord(word string) error {
	wordClean := cleanWord(strings.ToUpper(strings.TrimSpace(word)))
	_, err := db.Exec("DELETE FROM words WHERE word = $1", wordClean)
	return err
}

