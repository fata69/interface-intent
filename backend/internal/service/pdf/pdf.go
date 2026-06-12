package pdf

import (
	"bytes"
	"fmt"
	"io"
	"strings"

	gopdf "github.com/ledongthuc/pdf"
)

// ExtractResult holds the extracted text and metadata from a PDF.
type ExtractResult struct {
	Text     string
	NumPages int
}

// ExtractText reads a PDF from an io.ReaderAt and returns the full text content
// and number of pages.
//
// This replaces n8n's "Extract from File" node (PDF mode).
func ExtractText(reader io.ReaderAt, size int64) (*ExtractResult, error) {
	r, err := gopdf.NewReader(reader, size)
	if err != nil {
		return nil, fmt.Errorf("gagal membuka PDF: %w", err)
	}

	numPages := r.NumPage()
	var textBuilder strings.Builder

	for i := 1; i <= numPages; i++ {
		page := r.Page(i)
		if page.V.IsNull() {
			continue
		}

		content, err := page.GetPlainText(nil)
		if err != nil {
			// Skip unreadable pages but continue
			continue
		}
		textBuilder.WriteString(content)
		if i < numPages {
			textBuilder.WriteString("\n\n")
		}
	}

	return &ExtractResult{
		Text:     strings.TrimSpace(textBuilder.String()),
		NumPages: numPages,
	}, nil
}

// ExtractTextFromBytes is a convenience wrapper that accepts raw PDF bytes.
func ExtractTextFromBytes(data []byte) (*ExtractResult, error) {
	reader := bytes.NewReader(data)
	return ExtractText(reader, int64(len(data)))
}
