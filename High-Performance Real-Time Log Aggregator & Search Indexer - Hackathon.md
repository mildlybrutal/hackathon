Problem Statement : High-Performance Real-Time Log Aggregator & Search Indexer (Loki/ES Clone)
Architecture : Node.js / Go + LevelDB / SQLite + React. Ingest high-volume syslog streams over UDP/HTTP, index inverted tokens, and query logs with microsecond latency.

Key Decisions we took:
1. Go for heavy load such as ingestion, tokenization, database writes
2. Node.js for Backend to Frontend - Controllers, Orchestrating User sessions and queries the db read replicas using fast IPC
3. Chose LevelDB because:
	- **Writes:** Transforms random write bursts into purely sequential I/O via in-memory MemTables and append-only WALs, perfectly matching write-heavy (writes >> reads) log workloads.
	- **Index Scale:** Flushes sorted, immutable SSTables to disk without needing to load large B-Tree branches into RAM, preventing disk-thrashing when indexes exceed memory. 
	- **Concurrency:** Eliminates SQLite's single-writer database lock, enabling non-blocking concurrent reads via point-in-time snapshots while ingestion pipelines continue unhindered.
	- **Compression:** Employs block-level Snappy compression and delta key-prefix encoding on immutable SSTables, drastically shrinking repetitive log text and metadata without page fragmentation.
	- **TTL / Expiration:** Purges expired retention windows at near-zero cost by dropping whole SSTable files or filtering entries during background compactions, avoiding expensive `DELETE` and blocking `VACUUM` locks.

Architecture Diagram:
![[Pasted image 20260924124254.png]]
### Workflow :
#### The Ingestion Path (Write path):
1. **Network Reception**: Client fires a UDP syslog datagram to port 514, listener grabs a reusable byte slice from sync.Pool to avoid memory allocations and reads packet to memory
2. **Parsing**: The RFC parser reads byte slices without string allocations. It extracts `<PRI>` to compute severity and facility, cuts out hostnames/timestamps, and isolates the raw log message body.
3. **Worker Processing & Tokenization:** A worker goroutine splits the message text into search tokens (e.g., `"error"`, `"timeout"`, `"database"`). It de-duplicates tokens within the same line so identical words aren't indexed multiple times for the same log.
4. **Batch Buffering:** The worker creates two items:
	- A **Raw Log Record**: Keyed by `0x01 | StreamID | Timestamp`.
	- Multiple **Inverted Index Keys** (Mapping): One per unique token, keyed by `0x02 | Token | Timestamp | StreamID`. These are pushed into a thread-safe batch accumulator.
5. **LSM Commit:** When the batcher hits 5,000 items or its 10ms timer fires, it commits the entire batch to LevelDB in one atomic sequential write (appended to the WAL and inserted into the MemTable). Reusable memory is recycled back to the pool.
#### The Search and Query Flow (Read path):
1. **Request Reception:** Node.js sends a binary request over `/tmp/log_engine.sock`. Go reads the 4-byte length prefix, pulls the Protobuf payload, and decodes it into a `QueryRequest` struct containing query terms, stream filters, and time bounds (`StartTime` to `EndTime`).
2. **LevelDB Range Seeking:**
	- **If querying by time/stream:** Go initializes an iterator pointing directly at `0x01 | StreamID | StartTime` and iterates forward until `EndTime`.
	- **If querying by search term:** Go seeks an iterator to `0x02 | SearchTerm | StartTime`. It iterates through the index keys to collect matching timestamps and stream IDs, then retrieves the raw log bodies.
3. **Streaming Back Results:** Go packs the results into a `QueryResponse` Protobuf message, prepends the 4-byte frame length, writes it back down the Unix socket to Node.js, and releases the iterator snapshot. Node.js maps the binary payload to JSON/WebSocket for React.