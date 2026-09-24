package main

import (
	"context"
	"fmt"
	"log"
	"sort"
	"time"

	pb "engine/proto/logengine"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

func main() {
	conn, err := grpc.NewClient(
		"unix:///tmp/log_engine.sock",
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	if err != nil {
		log.Fatalf("Failed to connect to UDS: %v", err)
	}
	defer conn.Close()

	client := pb.NewLogServiceClient(conn)

	const runs = 500
	durations := make([]time.Duration, runs)
	now := time.Now().UnixNano()
	startWindow := now - int64(1*time.Hour)

	// Warmup
	_, _ = client.Query(context.Background(), &pb.QueryRequest{
		Term: "timeout", StartTimeNano: startWindow, EndTimeNano: now, Limit: 50,
	})

	for i := 0; i < runs; i++ {
		t0 := time.Now()
		resp, err := client.Query(context.Background(), &pb.QueryRequest{
			Term:          "timeout",
			StartTimeNano: startWindow,
			EndTimeNano:   now,
			Limit:         50,
		})
		elapsed := time.Since(t0)

		if err != nil {
			log.Fatalf("Query failed on run %d: %v", i, err)
		}
		if resp.Error != "" {
			log.Fatalf("RPC returned error: %s", resp.Error)
		}

		durations[i] = elapsed
	}

	// Calculate metrics
	sort.Slice(durations, func(i, j int) bool { return durations[i] < durations[j] })
	var total time.Duration
	for _, d := range durations {
		total += d
	}

	p50 := durations[runs/2]
	p90 := durations[int(float64(runs)*0.90)]
	p99 := durations[int(float64(runs)*0.99)]
	avg := total / runs

	fmt.Println("──────────────────────────────────────────")
	fmt.Printf("Benchmark Results (%d queries, term: 'timeout'):\n", runs)
	fmt.Printf("  Average Latency: %s (%d µs)\n", avg, avg.Microseconds())
	fmt.Printf("  P50  (Median)  : %s (%d µs)\n", p50, p50.Microseconds())
	fmt.Printf("  P90            : %s (%d µs)\n", p90, p90.Microseconds())
	fmt.Printf("  P99 (Worst 1%%): %s (%d µs)\n", p99, p99.Microseconds())

	fmt.Println("──────────────────────────────────────────")
}
