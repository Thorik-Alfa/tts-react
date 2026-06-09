package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"

	"github.com/xuri/excelize/v2"
)

func enableCors(w http.ResponseWriter) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS, DELETE")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
}

func handleGenerate(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	minWords := 8
	minWordsStr := r.URL.Query().Get("min")
	if minWordsStr != "" {
		if val, err := strconv.Atoi(minWordsStr); err == nil && val > 0 {
			minWords = val
		}
	}

	puzzle, err := GenerateCrossword(minWords)
	if err != nil {
		log.Printf("Error generating crossword: %v\n", err)
		http.Error(w, "Failed to generate crossword puzzle", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(puzzle); err != nil {
		log.Printf("Error encoding puzzle: %v\n", err)
	}
}

type SubmitScoreRequest struct {
	Name       string `json:"name"`
	Difficulty string `json:"difficulty"`
	Score      int    `json:"score"`
	TimeSpent  int    `json:"timeSpent"`
}

func handleLeaderboard(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method == "GET" {
		entries, err := GetLeaderboard()
		if err != nil {
			log.Printf("Error getting leaderboard: %v\n", err)
			http.Error(w, "Failed to get leaderboard", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(entries)
		return
	}

	if r.Method == "POST" {
		var req SubmitScoreRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		if req.Name == "" {
			http.Error(w, "Name is required", http.StatusBadRequest)
			return
		}

		err := SubmitScore(req.Name, req.Difficulty, req.Score, req.TimeSpent)
		if err != nil {
			log.Printf("Error submitting score: %v\n", err)
			http.Error(w, "Failed to submit score", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "success"})
		return
	}

	if r.Method == "DELETE" {
		allParam := r.URL.Query().Get("all")
		if allParam == "true" {
			err := ClearAllLeaderboard()
			if err != nil {
				log.Printf("Error clearing leaderboard: %v\n", err)
				http.Error(w, "Failed to clear leaderboard", http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]string{"status": "success"})
			return
		}

		idStr := r.URL.Query().Get("id")
		if idStr == "" {
			http.Error(w, "ID parameter is required", http.StatusBadRequest)
			return
		}
		id, err := strconv.Atoi(idStr)
		if err != nil {
			http.Error(w, "Invalid ID parameter", http.StatusBadRequest)
			return
		}

		err = DeleteLeaderboardEntry(id)
		if err != nil {
			log.Printf("Error deleting leaderboard entry: %v\n", err)
			http.Error(w, "Failed to delete leaderboard entry", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "success"})
		return
	}

	http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
}

func handleWords(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method == "GET" {
		entries, err := GetAllWords()
		if err != nil {
			log.Printf("Error getting words: %v\n", err)
			http.Error(w, "Failed to get words", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(entries)
		return
	}

	if r.Method == "POST" {
		var req WordEntry
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		if req.Word == "" || req.Clue == "" {
			http.Error(w, "Word and clue are required", http.StatusBadRequest)
			return
		}

		err := AddWord(req.Word, req.Clue)
		if err != nil {
			log.Printf("Error adding word: %v\n", err)
			http.Error(w, "Failed to add word", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "success"})
		return
	}

	if r.Method == "DELETE" {
		word := r.URL.Query().Get("word")
		if word == "" {
			http.Error(w, "Word parameter is required", http.StatusBadRequest)
			return
		}

		err := DeleteWord(word)
		if err != nil {
			log.Printf("Error deleting word: %v\n", err)
			http.Error(w, "Failed to delete word", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "success"})
		return
	}

	http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
}

func handleImportWords(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse multipart form (10 MB limit)
	err := r.ParseMultipartForm(10 << 20)
	if err != nil {
		http.Error(w, "Unable to parse form", http.StatusBadRequest)
		return
	}

	file, _, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "File is required", http.StatusBadRequest)
		return
	}
	defer file.Close()

	f, err := excelize.OpenReader(file)
	if err != nil {
		log.Printf("Error opening excel file: %v\n", err)
		http.Error(w, "Invalid excel file format", http.StatusBadRequest)
		return
	}
	defer f.Close()

	sheets := f.GetSheetList()
	if len(sheets) == 0 {
		http.Error(w, "No sheets found in Excel file", http.StatusBadRequest)
		return
	}

	rows, err := f.GetRows(sheets[0])
	if err != nil {
		log.Printf("Error reading rows: %v\n", err)
		http.Error(w, "Failed to read excel content", http.StatusInternalServerError)
		return
	}

	insertedCount := 0
	for i, row := range rows {
		// Skip header row
		if i == 0 {
			continue
		}
		if len(row) < 2 {
			continue
		}

		word := strings.TrimSpace(row[0])
		clue := strings.TrimSpace(row[1])

		if word != "" && clue != "" {
			err := AddWord(word, clue)
			if err != nil {
				log.Printf("Error importing word %s: %v\n", word, err)
				continue
			}
			insertedCount++
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "success",
		"count":  insertedCount,
	})
}

type PreviewWord struct {
	Word   string `json:"word"`
	Clue   string `json:"clue"`
	Exists bool   `json:"exists"`
}

func handlePreviewWords(w http.ResponseWriter, r *http.Request) {
	enableCors(w)
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse multipart form (10 MB limit)
	err := r.ParseMultipartForm(10 << 20)
	if err != nil {
		http.Error(w, "Unable to parse form", http.StatusBadRequest)
		return
	}

	file, _, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "File is required", http.StatusBadRequest)
		return
	}
	defer file.Close()

	f, err := excelize.OpenReader(file)
	if err != nil {
		log.Printf("Error opening excel file: %v\n", err)
		http.Error(w, "Invalid excel file format", http.StatusBadRequest)
		return
	}
	defer f.Close()

	sheets := f.GetSheetList()
	if len(sheets) == 0 {
		http.Error(w, "No sheets found in Excel file", http.StatusBadRequest)
		return
	}

	rows, err := f.GetRows(sheets[0])
	if err != nil {
		log.Printf("Error reading rows: %v\n", err)
		http.Error(w, "Failed to read excel content", http.StatusInternalServerError)
		return
	}

	var previewData []PreviewWord
	for i, row := range rows {
		// Skip header row
		if i == 0 {
			continue
		}
		if len(row) < 2 {
			continue
		}

		word := strings.TrimSpace(row[0])
		clue := strings.TrimSpace(row[1])

		if word != "" && clue != "" {
			exists, err := WordExists(word)
			if err != nil {
				log.Printf("Error checking word existence: %v\n", err)
			}
			previewData = append(previewData, PreviewWord{
				Word:   strings.ToUpper(word),
				Clue:   clue,
				Exists: exists,
			})
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "success",
		"data":   previewData,
	})
}

func main() {
	log.Println("Initializing database...")
	if err := InitDB(); err != nil {
		log.Fatalf("Database initialization failed: %v\n", err)
	}

	http.HandleFunc("/api/generate", handleGenerate)
	http.HandleFunc("/api/leaderboard", handleLeaderboard)
	http.HandleFunc("/api/words", handleWords)
	http.HandleFunc("/api/words/import", handleImportWords)
	http.HandleFunc("/api/words/import-preview", handlePreviewWords)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	if !strings.HasPrefix(port, ":") {
		port = ":" + port
	}
	log.Printf("Server starting on port %s...\n", port)
	if err := http.ListenAndServe(port, nil); err != nil {
		log.Fatalf("Server failed: %v\n", err)
	}
}

