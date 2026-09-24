package main

import (
	"bytes"
	"fmt"
	"log"
	"net/http"
	"time"
)

func main() {
	const totalLogs = 100000
	const batchSize = 1000

	client := &http.Client{Timeout: 10 * time.Second}
	fmt.Printf("Ingesting %d logs via HTTP in batches of %d...\n", totalLogs, batchSize)

	start := time.Now()
	for i := 0; i < totalLogs; i += batchSize {
		var buf bytes.Buffer
		for j := 0; j < batchSize; j++ {
			buf.WriteString(fmt.Sprintf(
				"<34>Sep 24 16:20:00 srv-%d nginx: worker-%d connection timeout to /api/checkout\n",
				(i+j)%10, (i+j)%4,
			))
		}

		resp, err := client.Post("http://localhost:8080/ingest", "text/plain", &buf)
		if err != nil {
			log.Fatalf("Ingest failed at index %d: %v", i, err)
		}
		resp.Body.Close()
	}

	elapsed := time.Since(start)
	rate := float64(totalLogs) / elapsed.Seconds()
	fmt.Printf("Done: %d logs in %s (%.2f logs/sec)\n", totalLogs, elapsed, rate)
}
