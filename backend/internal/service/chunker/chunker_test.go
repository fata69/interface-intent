package chunker

import (
	"strings"
	"testing"
)

func TestRecursiveCharacterSplitCharacterFallbackKeepsSizeAndOverlap(t *testing.T) {
	chunks := RecursiveCharacterSplit("abcdefghijklmnopqrstuvwxyz", 10, 3)
	if len(chunks) < 3 {
		t.Fatalf("expected multiple chunks, got %d", len(chunks))
	}

	for _, chunk := range chunks {
		if got := len([]rune(chunk.Text)); got > 10 {
			t.Fatalf("chunk %d length = %d, want <= 10: %q", chunk.Index, got, chunk.Text)
		}
	}

	for i := 1; i < len(chunks); i++ {
		previousRunes := []rune(chunks[i-1].Text)
		wantPrefix := string(previousRunes[len(previousRunes)-3:])
		if !strings.HasPrefix(chunks[i].Text, wantPrefix) {
			t.Fatalf("chunk %d = %q, want prefix %q", i, chunks[i].Text, wantPrefix)
		}
	}
}

func TestRecursiveCharacterSplitUsesParagraphSeparatorFirst(t *testing.T) {
	text := "alpha beta\n\ngamma delta\n\nepsilon zeta"
	chunks := RecursiveCharacterSplit(text, 25, 5)
	if len(chunks) == 0 {
		t.Fatal("expected chunks")
	}

	for _, chunk := range chunks {
		if strings.Contains(chunk.Text, "\n\ngamma") && strings.Contains(chunk.Text, "epsilon") {
			t.Fatalf("paragraph split did not happen before lower-priority separators: %q", chunk.Text)
		}
	}
}
