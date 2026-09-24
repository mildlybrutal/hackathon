package ipc

import (
	"context"
	"fmt"
	"log"
	"net"
	"os"

	"engine/internal/search"
	pb "engine/proto/logengine"

	"google.golang.org/grpc"
)

// LogServiceServer satisfies the protobuf-generated LogServiceServer interface
type LogServiceServer struct {
	pb.UnimplementedLogServiceServer
	queryEngine *search.QueryEngine
}

// GRPCServer manages the lifecycle of the gRPC server and Unix domain listener
type GRPCServer struct {
	socketPath string
	server     *grpc.Server
	listener   net.Listener
}

func NewGRPCServer(socketPath string, qe *search.QueryEngine) *GRPCServer {
	s := grpc.NewServer()
	service := &LogServiceServer{queryEngine: qe}
	pb.RegisterLogServiceServer(s, service)

	return &GRPCServer{
		socketPath: socketPath,
		server:     s,
	}
}

// Start binds to the Unix Domain Socket and begins serving in a goroutine
func (s *GRPCServer) Start() error {
	// Clean up stale socket file if it exists from an earlier run
	if err := os.Remove(s.socketPath); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("failed to unlink existing socket: %w", err)
	}

	l, err := net.Listen("unix", s.socketPath)
	if err != nil {
		return fmt.Errorf("failed to listen on unix socket %s: %w", s.socketPath, err)
	}
	s.listener = l

	// Set file permissions so Node.js process has read/write access
	if err := os.Chmod(s.socketPath, 0666); err != nil {
		_ = l.Close()
		return fmt.Errorf("failed to set socket permissions: %w", err)
	}

	go func() {
		if err := s.server.Serve(l); err != nil && err != grpc.ErrServerStopped {
			log.Printf("gRPC server encountered an error: %v", err)
		}
	}()

	return nil
}

// Stop gracefully stops the gRPC server and unlinks the socket file
func (s *GRPCServer) Stop() {
	if s.server != nil {
		s.server.GracefulStop()
	}
	if s.listener != nil {
		_ = s.listener.Close()
	}
	_ = os.Remove(s.socketPath)
}

// Query implements the Unary search RPC
func (s *LogServiceServer) Query(ctx context.Context, req *pb.QueryRequest) (*pb.QueryResponse, error) {
	rawLogs, err := s.queryEngine.SearchTerm(req.Term, req.StartTimeNano, req.EndTimeNano, int(req.Limit))
	if err != nil {
		return &pb.QueryResponse{
			Error: err.Error(),
		}, nil
	}

	entries := make([]*pb.LogEntry, len(rawLogs))
	for i, raw := range rawLogs {
		entries[i] = &pb.LogEntry{
			Message: string(raw),
		}
	}

	return &pb.QueryResponse{
		Logs:       entries,
		TotalFound: int64(len(entries)),
	}, nil
}

// StreamQuery streams matched log entries directly to the client as they are retrieved
func (s *LogServiceServer) StreamQuery(req *pb.QueryRequest, stream pb.LogService_StreamQueryServer) error {
	rawLogs, err := s.queryEngine.SearchTerm(req.Term, req.StartTimeNano, req.EndTimeNano, int(req.Limit))
	if err != nil {
		return err
	}

	for _, raw := range rawLogs {
		entry := &pb.LogEntry{
			Message: string(raw),
		}
		if err := stream.Send(entry); err != nil {
			return err
		}
	}

	return nil
}
