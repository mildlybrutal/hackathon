package search

import (
	"os"
	"testing"
	"time"

	"engine/internal/storage"
)

func BenchmarkSearchTerm(b *testing.B) {
	tmpDir := "./test_data"
	_ = os.RemoveAll(tmpDir)
	defer os.RemoveAll(tmpDir)

	db, err := storage.OpenDB(tmpDir)
	if err != nil {
		b.Fatalf("Failed to open DB: %v", err)
	}
	defer db.Close()

	memIndex := NewMemoryIndex()
	engine := NewQueryEngine(db.Raw(), memIndex)

	// Pre-populate 5,000 index items in hot memory
	now := time.Now().UnixNano()
	for i := 0; i < 5000; i++ {
		memIndex.Add("timeout", PostingEntry{
			TimestampNano: now - int64(i*1000),
			StreamID:      1,
		})
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = engine.SearchTerm("timeout", now-int64(1*time.Hour), now, 50)
	}
}
