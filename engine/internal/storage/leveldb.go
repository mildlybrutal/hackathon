package storage

import (
	"github.com/syndtr/goleveldb/leveldb"
	"github.com/syndtr/goleveldb/leveldb/opt"
)

type DB struct {
	db *leveldb.DB
}

func OpenDB(path string) (*DB, error) {
	opts := &opt.Options{
		BlockCacheCapacity:  64 * 1024 * 1024, // 64 MB Block Cache
		WriteBuffer:         32 * 1024 * 1024, // 32 MB MemTable size before flush
		CompactionTableSize: 8 * 1024 * 1024,  // 8 MB SSTable file target
	}

	rawDB, err := leveldb.OpenFile(path, opts)

	if err != nil {
		return nil, err
	}
	return &DB{db: rawDB}, nil
}

func (d *DB) WriteBatch(batch *leveldb.Batch) error {
	// Sync: false ensures writes hit the WAL immediately without waiting for fsync
	return d.db.Write(batch, &opt.WriteOptions{Sync: false})
}

func (d *DB) Raw() *leveldb.DB {
	return d.db
}

func (d *DB) Close() error {
	return d.db.Close()
}
