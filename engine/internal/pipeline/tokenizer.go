package pipeline

import (
	"strings"
	"unicode"
)

func Tokenize(payload []byte) []string {
	text := string(payload)
	words := strings.FieldsFunc(text, func(r rune) bool {
		return !unicode.IsLetter(r) && !unicode.IsNumber(r)
	})

	seen := make(map[string]struct{}, len(words))
	tokens := make([]string, 0, len(words))

	for _, w := range words {
		if len(w) < 2 || len(w) > 64 {
			continue // Drop single chars and excessively long junk
		}
		term := strings.ToLower(w)
		if _, exists := seen[term]; !exists {
			seen[term] = struct{}{}
			tokens = append(tokens, term)
		}
	}
	return tokens
}
