package storage

import (
	"bytes"
	"encoding/binary"
)

const (
	PrefixLogRecord byte = 0x01
	PrefixIndexTerm byte = 0x02
)

// formats: 0x01 | [StreamID: 8B] | [TimestampNano: 8B]
func EncodeLogKey(streamID uint64, timestampNano int64) []byte {
	buf := make([]byte, 17)
	buf[0] = PrefixLogRecord
	binary.BigEndian.PutUint64(buf[1:9], streamID)
	binary.BigEndian.PutUint64(buf[9:17], uint64(timestampNano))
	return buf
}

// extracts StreamID and TimestampNano
func DecodeLogKey(key []byte) (streamID uint64, timestampNano int64, ok bool) {
	if len(key) != 17 || key[0] != PrefixLogRecord {
		return 0, 0, false
	}
	streamID = binary.BigEndian.Uint64(key[1:9])
	timestampNano = int64(binary.BigEndian.Uint64(key[9:17]))
	return streamID, timestampNano, true
}

// formats: 0x02 | [Term] | 0x00 | [TimestampNano: 8B] | [StreamID: 8B]
func EncodeIndexKey(term string, timestampNano int64, streamID uint64) []byte {
	termBytes := []byte(term)
	buf := make([]byte, 1+len(termBytes)+1+8+8)
	buf[0] = PrefixIndexTerm
	copy(buf[1:], termBytes)
	buf[1+len(termBytes)] = 0x00 // Null delimiter
	offset := 2 + len(termBytes)
	binary.BigEndian.PutUint64(buf[offset:offset+8], uint64(timestampNano))
	binary.BigEndian.PutUint64(buf[offset+8:offset+16], streamID)
	return buf
}

// parse term, timestamp, and streamID

func DecodeIndexKey(key []byte) (term string, timestampNano int64, streamID uint64, ok bool) {
	if len(key) < 18 || key[0] != PrefixIndexTerm {
		return "", 0, 0, false
	}
	delimIdx := bytes.IndexByte(key[1:], 0x00)
	if delimIdx == -1 {
		return "", 0, 0, false
	}
	actualDelim := 1 + delimIdx
	term = string(key[1:actualDelim])
	offset := actualDelim + 1
	if len(key)-offset != 16 {
		return "", 0, 0, false
	}
	timestampNano = int64(binary.BigEndian.Uint64(key[offset : offset+8]))
	streamID = binary.BigEndian.Uint64(key[offset+8 : offset+16])
	return term, timestampNano, streamID, true
}

// writes 0x01 | [StreamID: 8B] | [TimestampNano: 8B] directly into dst (must be >= 17 bytes)
func EncodeLogKeyToBuf(dst []byte, streamID uint64, timestampNano int64) {
	dst[0] = PrefixLogRecord
	binary.BigEndian.PutUint64(dst[1:9], streamID)
	binary.BigEndian.PutUint64(dst[9:17], uint64(timestampNano))
}
