package main

import (
	"fmt"
	"log"
	"time"

	"engine/internal/search"
	"engine/internal/storage"
)

func main() {
	// Ensure cmd/server is stopped before opening LevelDB directly
	db, err := storage.OpenDB("./data/leveldb")
	if err != nil {
		log.Fatalf("Failed to open DB: %v (is cmd/server still running?)", err)
	}
	defer db.Close()

	// Direct CLI query does not have a live in-memory buffer, so pass nil
	engine := search.NewQueryEngine(db.Raw(), nil)

	term := "connection"
	now := time.Now().UnixNano()
	startWindow := now - int64(24*time.Hour)

	start := time.Now()
	logs, err := engine.SearchTerm(term, startWindow, now, 20)
	duration := time.Since(start)

	if err != nil {
		log.Fatalf("Search failed: %v", err)
	}

	fmt.Printf("Search for '%s' returned %d logs in %s (%d µs)\n",
		term, len(logs), duration, duration.Microseconds())

	for i, l := range logs {
		fmt.Printf(" [%d] %s\n", i+1, string(l))
	}
}
