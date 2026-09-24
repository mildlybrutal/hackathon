package main

import (
	"log"
	"net/http"
	"os"
	"os/signal"
	"runtime"
	"syscall"
	"time"

	"engine/internal/ingestion"
	"engine/internal/ipc"
	"engine/internal/pipeline"
	"engine/internal/search"
	"engine/internal/storage"

	"github.com/syndtr/goleveldb/leveldb"
)

const (
	socketPath = "/tmp/log_engine.sock"
	udpAddr    = ":5140"
	httpAddr   = ":8080"
)

func main() {
	// 1. Storage Engine
	db, err := storage.OpenDB("./data/leveldb")
	if err != nil {
		log.Fatalf("Failed to open LevelDB: %v", err)
	}
	defer db.Close()

	// 2. In-Memory Hot Index & gRPC IPC Server
	memIndex := search.NewMemoryIndex()
	queryEngine := search.NewQueryEngine(db.Raw(), memIndex)
	grpcServer := ipc.NewGRPCServer(socketPath, queryEngine)
	if err := grpcServer.Start(); err != nil {
		log.Fatalf("Failed to start gRPC IPC server: %v", err)
	}
	defer grpcServer.Stop()
	log.Printf("gRPC IPC Server online at unix://%s", socketPath)

	// 3. UDP Ingress Listener
	udpListener, err := ingestion.NewUDPListener(udpAddr, 20000)
	if err != nil {
		log.Fatalf("Failed to bind UDP: %v", err)
	}
	defer udpListener.Close()
	udpListener.Start()
	log.Printf("Syslog UDP Ingest listening on %s", udpAddr)

	// 4. Ingestion Worker Pipeline
	numWorkers := runtime.NumCPU()
	pipe := pipeline.NewPipeline(numWorkers, 20000, udpListener.ReleaseBuffer)
	pipe.Start()
	defer pipe.Close()
	log.Printf("Pipeline initialized with %d tokenization workers", numWorkers)

	// Forward UDP packets into pipeline
	go func() {
		for pkt := range udpListener.Packets() {
			pipe.Submit(pkt)
		}
	}()

	// 5. HTTP Ingress Listener
	rawIngestChan := make(chan ingestion.PacketBuffer, 10000)
	httpListener := ingestion.NewHTTPListener(httpAddr, rawIngestChan, func() []byte {
		return make([]byte, 2048)
	})
	go func() {
		if err := httpListener.Start(); err != nil && err != http.ErrServerClosed {
			log.Printf("HTTP listener closed: %v", err)
		}
	}()
	defer httpListener.Close()
	log.Printf("Syslog HTTP Ingest listening on %s/ingest", httpAddr)

	// Forward HTTP packets into pipeline
	go func() {
		for pkt := range rawIngestChan {
			pipe.Submit(pkt)
		}
	}()

	// 6. LevelDB Batch Flush & Hot Index Registration Loop
	batch := new(leveldb.Batch)
	batchSize := 0
	const maxBatchSize = 2500
	ticker := time.NewTicker(15 * time.Millisecond)
	defer ticker.Stop()

	flush := func() {
		if batchSize == 0 {
			return
		}
		if err := db.WriteBatch(batch); err != nil {
			log.Printf("Batch write failed: %v", err)
		}
		batch.Reset()
		batchSize = 0
	}

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	for {
		select {
		case item := <-pipe.Output():
			// Raw log entry write
			batch.Put(item.LogKey, item.LogValue)
			batchSize++

			// Term inverted keys & memory index registration
			for _, idxKey := range item.TermKeys {
				batch.Put(idxKey, nil)
				batchSize++

				term, ts, streamID, ok := storage.DecodeIndexKey(idxKey)
				if ok {
					memIndex.Add(term, search.PostingEntry{
						TimestampNano: ts,
						StreamID:      streamID,
					})
				}
			}

			if batchSize >= maxBatchSize {
				flush()
			}

		case <-ticker.C:
			flush()

		case <-sigChan:
			log.Println("Shutting down engine...")
			flush()
			return
		}
	}
}
