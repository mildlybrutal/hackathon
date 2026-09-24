package search

import (
	"sync"
)

type PostingEntry struct {
	TimestampNano int64
	StreamID      uint64
	Offset        uint32
	Length        uint32
}

type MemoryIndex struct {
	mu    sync.RWMutex
	terms map[string][]PostingEntry
}

func NewMemoryIndex() *MemoryIndex {
	return &MemoryIndex{
		terms: make(map[string][]PostingEntry),
	}
}

func (m *MemoryIndex) Add(term string, entry PostingEntry) {
	m.mu.Lock()
	m.terms[term] = append(m.terms[term], entry)
	m.mu.Unlock()
}

func (m *MemoryIndex) Query(term string, startNano, endNano int64) []PostingEntry {
	m.mu.RLock()
	defer m.mu.RUnlock()

	entries, exists := m.terms[term]
	if !exists {
		return nil
	}

	// Slice binary search or fast bound scan over chronological posting array
	var matched []PostingEntry
	for _, e := range entries {
		if e.TimestampNano >= startNano && e.TimestampNano <= endNano {
			matched = append(matched, e)
		}
	}
	return matched
}
