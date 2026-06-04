package main

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
)

func enableCors(w http.ResponseWriter) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
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

	http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
}

func main() {
	log.Println("Initializing database...")
	if err := InitDB(); err != nil {
		log.Fatalf("Database initialization failed: %v\n", err)
	}

	http.HandleFunc("/api/generate", handleGenerate)
	http.HandleFunc("/api/leaderboard", handleLeaderboard)

	port := ":8080"
	log.Printf("Server starting on port %s...\n", port)
	if err := http.ListenAndServe(port, nil); err != nil {
		log.Fatalf("Server failed: %v\n", err)
	}
}
