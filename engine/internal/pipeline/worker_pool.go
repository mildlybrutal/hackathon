package pipeline

import (
	"engine/internal/ingestion"
	"engine/internal/storage"
	"sync"
)

// IndexItem contains the pre-encoded keys ready to be committed to LevelDB
type IndexItem struct {
	LogKey   []byte
	LogValue []byte
	TermKeys [][]byte
}

type Pipeline struct {
	rawQueue chan ingestion.PacketBuffer
	outQueue chan IndexItem
	workers  int
	wg       sync.WaitGroup
	release  func([]byte)
}

func NewPipeline(workers int, queueSize int, releaseFn func([]byte)) *Pipeline {
	return &Pipeline{
		rawQueue: make(chan ingestion.PacketBuffer, queueSize),
		outQueue: make(chan IndexItem, queueSize),
		workers:  workers,
		release:  releaseFn,
	}
}

func (p *Pipeline) Start() {
	for i := 0; i < p.workers; i++ {
		p.wg.Add(1)
		go p.workerLoop()
	}
}

func (p *Pipeline) Submit(pkt ingestion.PacketBuffer) {
	p.rawQueue <- pkt
}

func (p *Pipeline) Output() <-chan IndexItem {
	return p.outQueue
}

func (p *Pipeline) workerLoop() {
	defer p.wg.Done()

	for pkt := range p.rawQueue {
		parsed := ingestion.ParseSyslogRFC3164(pkt.Data[:pkt.Size])
		streamID := uint64(parsed.Facility)

		// 1. Prepare raw log entry key/value
		logKey := storage.EncodeLogKey(streamID, parsed.TimestampNano)
		val := make([]byte, len(parsed.Message))
		copy(val, parsed.Message)

		// 2. Tokenize message payload
		tokens := Tokenize(parsed.Message)
		termKeys := make([][]byte, 0, len(tokens))

		for _, term := range tokens {
			idxKey := storage.EncodeIndexKey(term, parsed.TimestampNano, streamID)
			termKeys = append(termKeys, idxKey)
		}

		// Recycle raw packet slice back to sync.Pool
		p.release(pkt.Data)

		p.outQueue <- IndexItem{
			LogKey:   logKey,
			LogValue: val,
			TermKeys: termKeys,
		}
	}
}

func (p *Pipeline) Close() {
	close(p.rawQueue)
	p.wg.Wait()
	close(p.outQueue)
}
