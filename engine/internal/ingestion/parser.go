package ingestion

import (
	"bytes"
	"strconv"
	"time"
)

type ParsedLog struct {
	Priority      int
	Facility      int
	Severity      int
	TimestampNano int64
	Hostname      string
	Message       []byte
}

func ParseSyslogRFC3164(data []byte) ParsedLog {
	res := ParsedLog{
		TimestampNano: time.Now().UnixNano(),
		Severity:      6, // Default to info
		Facility:      1, // Default to user-level
	}

	if len(data) == 0 {
		return res
	}

	// 1. Check for PRI prefix: <PRIVALUE>
	if data[0] == '<' {
		endPri := bytes.IndexByte(data, '>')
		if endPri > 1 && endPri <= 5 {
			priVal, err := strconv.Atoi(string(data[1:endPri]))
			if err == nil {
				res.Priority = priVal
				res.Facility = priVal >> 3
				res.Severity = priVal & 7
			}
			data = data[endPri+1:]
		}
	}

	// Trim leading whitespace
	data = bytes.TrimLeft(data, " ")

	// 2. Syslog timestamp format: "Mmm dd hh:mm:ss" (15 chars)
	if len(data) > 16 && data[3] == ' ' && data[6] == ' ' && data[15] == ' ' {
		// Advance past timestamp
		data = data[16:]
	}

	// 3. Extract Hostname (delimited by space)
	data = bytes.TrimLeft(data, " ")
	spaceIdx := bytes.IndexByte(data, ' ')
	if spaceIdx != -1 {
		res.Hostname = string(data[:spaceIdx])
		res.Message = bytes.TrimLeft(data[spaceIdx+1:], " ")
	} else {
		res.Message = data
	}

	return res
}
