// HTTP endpoint alongside UDP that accepts line-delimited plain-text or syslog lines via POST /ingest
package ingestion

import (
	"bufio"
	"io"
	"net/http"
	"time"
)

type HTTPListener struct {
	server    *http.Server
	outChan   chan<- PacketBuffer
	poolAlloc func() []byte
}

func NewHTTPListener(addr string, outChan chan<- PacketBuffer, poolAlloc func() []byte) *HTTPListener {
	h := &HTTPListener{
		outChan:   outChan,
		poolAlloc: poolAlloc,
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/ingest", h.handleIngest)

	h.server = &http.Server{
		Addr:         addr,
		Handler:      mux,
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 5 * time.Second,
	}
	return h
}

func (h *HTTPListener) handleIngest(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	scanner := bufio.NewScanner(r.Body)
	defer r.Body.Close()

	count := 0
	for scanner.Scan() {
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}

		buf := h.poolAlloc()
		n := copy(buf, line)

		h.outChan <- PacketBuffer{
			Data: buf,
			Size: n,
		}
		count++
	}

	if err := scanner.Err(); err != nil && err != io.EOF {
		http.Error(w, "Error reading body", http.StatusBadRequest)
		return
	}

	w.WriteHeader(http.StatusAccepted)
	_, _ = w.Write([]byte(`{"status":"ok"}`))
}

func (h *HTTPListener) Start() error {
	return h.server.ListenAndServe()
}

func (h *HTTPListener) Close() error {
	return h.server.Close()
}
