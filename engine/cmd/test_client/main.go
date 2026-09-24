package main

import (
	"context"
	"fmt"
	"log"
	"time"

	pb "engine/proto/logengine"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

func main() {
	// Connect to Unix Domain Socket
	conn, err := grpc.NewClient(
		"unix:///tmp/log_engine.sock",
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	if err != nil {
		log.Fatalf("Failed to connect to UDS: %v", err)
	}
	defer conn.Close()

	client := pb.NewLogServiceClient(conn)

	// Ingested logs are stored with their current UnixNano timestamp
	now := time.Now().UnixNano()
	startWindow := now - int64(24*time.Hour)

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	resp, err := client.Query(ctx, &pb.QueryRequest{
		Term:          "connection",
		StartTimeNano: startWindow,
		EndTimeNano:   now,
		Limit:         10,
	})
	if err != nil {
		log.Fatalf("Query RPC failed: %v", err)
	}

	fmt.Printf("Received %d matches (Total: %d):\n", len(resp.Logs), resp.TotalFound)
	for i, logEntry := range resp.Logs {
		fmt.Printf(" [%d] %s\n", i+1, logEntry.Message)
	}
}
