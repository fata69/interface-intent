package chunker

import "strings"

// Chunk represents a piece of split text with its position index.
type Chunk struct {
	Text  string
	Index int
}

// RecursiveCharacterSplit splits text using recursive character strategy,
// replicating the n8n RecursiveCharacterTextSplitter behavior.
//
// Parameters match the n8n workflow config:
//   - chunkSize: 1000 (default from n8n)
//   - chunkOverlap: 200 (from n8n workflow)
//   - separators: ["\n\n", "\n", " ", ""] (LangChain default)
func RecursiveCharacterSplit(text string, chunkSize, chunkOverlap int) []Chunk {
	if chunkSize <= 0 {
		return nil
	}
	if chunkOverlap < 0 {
		chunkOverlap = 0
	}
	if chunkOverlap >= chunkSize {
		chunkOverlap = chunkSize - 1
	}

	separators := []string{"\n\n", "\n", " ", ""}
	texts := splitRecursive(text, separators, chunkSize, chunkOverlap)
	chunks := make([]Chunk, 0, len(texts))
	for _, value := range texts {
		if value == "" {
			continue
		}
		chunks = append(chunks, Chunk{Text: value, Index: len(chunks)})
	}
	return chunks
}

func splitRecursive(text string, separators []string, chunkSize, chunkOverlap int) []string {
	if runeLen(text) <= chunkSize {
		if text != "" {
			return []string{text}
		}
		return nil
	}

	sep := ""
	rest := []string{}
	for i, s := range separators {
		if s == "" || strings.Contains(text, s) {
			sep = s
			rest = separators[i+1:]
			break
		}
	}

	var splits []string
	if sep == "" {
		splits = splitRunes(text)
	} else {
		splits = strings.Split(text, sep)
	}

	pieces := make([]string, 0, len(splits))
	for _, split := range splits {
		if split == "" {
			continue
		}
		if runeLen(split) <= chunkSize {
			pieces = append(pieces, split)
			continue
		}
		if len(rest) == 0 {
			pieces = append(pieces, splitByRuneSize(split, chunkSize)...)
		} else {
			pieces = append(pieces, splitRecursive(split, rest, chunkSize, chunkOverlap)...)
		}
	}

	return mergeSplits(pieces, sep, chunkSize, chunkOverlap)
}

func mergeSplits(splits []string, sep string, chunkSize, chunkOverlap int) []string {
	separatorLen := runeLen(sep)
	chunks := []string{}
	current := []string{}
	total := 0

	for _, split := range splits {
		splitLen := runeLen(split)
		additionalLen := splitLen
		if len(current) > 0 {
			additionalLen += separatorLen
		}

		if total+additionalLen > chunkSize && len(current) > 0 {
			chunks = append(chunks, strings.Join(current, sep))

			for total > chunkOverlap || (total+additionalLen > chunkSize && total > 0) {
				removedLen := runeLen(current[0])
				current = current[1:]
				total -= removedLen
				if len(current) > 0 {
					total -= separatorLen
				}
			}
		}

		if splitLen == 0 {
			continue
		}
		if len(current) > 0 {
			total += separatorLen
		}
		current = append(current, split)
		total += splitLen
	}

	if len(current) > 0 {
		chunks = append(chunks, strings.Join(current, sep))
	}
	return chunks
}

func splitRunes(text string) []string {
	runes := []rune(text)
	parts := make([]string, 0, len(runes))
	for _, value := range runes {
		parts = append(parts, string(value))
	}
	return parts
}

func splitByRuneSize(text string, size int) []string {
	runes := []rune(text)
	parts := []string{}
	for start := 0; start < len(runes); start += size {
		end := start + size
		if end > len(runes) {
			end = len(runes)
		}
		parts = append(parts, string(runes[start:end]))
	}
	return parts
}

func runeLen(text string) int {
	return len([]rune(text))
}
