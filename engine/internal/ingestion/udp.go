package ingestion

import (
	"log"
	"net"
	"sync"
)

type PacketBuffer struct {
	Data []byte
	Size int
}

type UDPListener struct {
	conn       *net.UDPConn
	bufferPool *sync.Pool
	outChan    chan PacketBuffer
	quit       chan struct{}
}

func NewUDPListener(addr string, queueSize int) (*UDPListener, error) {
	udpAddr, err := net.ResolveUDPAddr("udp", addr)

	if err != nil {
		return nil, err
	}

	conn, err := net.ListenUDP("udp", udpAddr)

	if err != nil {
		return nil, err
	}
	_ = conn.SetReadBuffer(16 * 1024 * 1024)

	return &UDPListener{
		conn: conn,
		bufferPool: &sync.Pool{
			New: func() any {
				return make([]byte, 2048) // max MTU payload
			},
		},
		outChan: make(chan PacketBuffer, queueSize),
		quit:    make(chan struct{}),
	}, nil
}

func (u *UDPListener) Start() {
	go func() {
		for {
			buf := u.bufferPool.Get().([]byte)
			n, _, err := u.conn.ReadFromUDP(buf)
			if err != nil {
				select {
				case <-u.quit:
					return
				default:
					log.Printf("UDP Read error: %v", err)
					continue
				}
			}

			u.outChan <- PacketBuffer{
				Data: buf,
				Size: n,
			}
		}
	}()
}

func (u *UDPListener) Packets() <-chan PacketBuffer {
	return u.outChan
}

func (u *UDPListener) ReleaseBuffer(buf []byte) {
	u.bufferPool.Put(buf)
}

func (u *UDPListener) Close() error {
	close(u.quit)
	return u.conn.Close()
}
