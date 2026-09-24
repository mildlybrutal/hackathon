package search

import (
	"bytes"

	"engine/internal/storage"

	"github.com/syndtr/goleveldb/leveldb"
	"github.com/syndtr/goleveldb/leveldb/util"
)

type logRecordID struct {
	streamID uint64
	ts       int64
}

type QueryEngine struct {
	db       *leveldb.DB
	memIndex *MemoryIndex
}

func NewQueryEngine(db *leveldb.DB, memIndex *MemoryIndex) *QueryEngine {
	return &QueryEngine{
		db:       db,
		memIndex: memIndex,
	}
}

func (q *QueryEngine) SearchTerm(term string, startNano, endNano int64, limit int) ([][]byte, error) {
	if limit <= 0 {
		limit = 50
	}

	// 1. Pre-allocate results with exact capacity (zero reallocation overhead)
	results := make([][]byte, 0, limit)

	// 2. Struct-based deduplication map: zero string allocations
	seen := make(map[logRecordID]struct{}, limit)

	// Stack-allocated scratch buffer for encoding keys (avoids heap allocs from make([]byte, 17))
	var keyBuf [17]byte

	// Helper to point-lookup a raw log line without heap allocations
	fetchLog := func(streamID uint64, ts int64) bool {
		id := logRecordID{streamID: streamID, ts: ts}
		if _, exists := seen[id]; exists {
			return false
		}
		seen[id] = struct{}{}

		// Fill stack buffer manually: 0x01 | streamID (8B) | ts (8B)
		storage.EncodeLogKeyToBuf(keyBuf[:], streamID, ts)

		logData, err := q.db.Get(keyBuf[:], nil)
		if err == nil {
			results = append(results, bytes.Clone(logData))
			return true
		}
		return false
	}

	// 1. Check in-memory hot tier
	if q.memIndex != nil {
		memMatches := q.memIndex.Query(term, startNano, endNano)
		for _, m := range memMatches {
			if fetchLog(m.StreamID, m.TimestampNano) {
				if len(results) >= limit {
					return results, nil
				}
			}
		}
	}

	// 2. Scan LevelDB persistent index
	prefix := make([]byte, 1+len(term)+1)
	prefix[0] = storage.PrefixIndexTerm
	copy(prefix[1:], []byte(term))
	prefix[1+len(term)] = 0x00

	iter := q.db.NewIterator(util.BytesPrefix(prefix), nil)
	defer iter.Release()

	for iter.Next() {
		key := iter.Key()
		_, ts, streamID, ok := storage.DecodeIndexKey(key)
		if !ok || ts < startNano {
			continue
		}
		if ts > endNano {
			break
		}

		if fetchLog(streamID, ts) {
			if len(results) >= limit {
				break
			}
		}
	}

	return results, iter.Error()
}
