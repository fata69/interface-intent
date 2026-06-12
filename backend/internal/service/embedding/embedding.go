package embedding

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const defaultBatchSize = 10

// Client calls the Google Gemini Embedding API.
type Client struct {
	APIKey               string
	Model                string
	BatchSize            int
	OutputDimensionality int
	BaseURL              string
	HTTP                 *http.Client
}

// NewClient creates a Gemini embedding client.
//
// model should be "gemini-embedding-2" or "models/gemini-embedding-2".
// batchSize should be 10 (matching n8n workflow config).
func NewClient(apiKey, model string, batchSize, outputDimensionality int) *Client {
	if batchSize <= 0 {
		batchSize = defaultBatchSize
	}

	return &Client{
		APIKey:               apiKey,
		Model:                normalizeModelResource(model),
		BatchSize:            batchSize,
		OutputDimensionality: outputDimensionality,
		BaseURL:              "https://generativelanguage.googleapis.com/v1beta",
		HTTP: &http.Client{
			Timeout: 60 * time.Second,
		},
	}
}

func normalizeModelResource(model string) string {
	model = strings.TrimSpace(model)
	if model == "" {
		model = "gemini-embedding-2"
	}
	if strings.HasPrefix(model, "models/") {
		return model
	}
	return "models/" + model
}

// EmbedResult holds text and its embedding vector.
type EmbedResult struct {
	Text      string
	Embedding []float32
}

// EmbedTexts generates embeddings for a list of text chunks.
// Chunks are processed in batches of Client.BatchSize.
func (c *Client) EmbedTexts(ctx context.Context, texts []string) ([]EmbedResult, error) {
	var results []EmbedResult
	if len(texts) == 0 {
		return results, nil
	}
	if c.BatchSize <= 0 {
		c.BatchSize = defaultBatchSize
	}

	for i := 0; i < len(texts); i += c.BatchSize {
		end := i + c.BatchSize
		if end > len(texts) {
			end = len(texts)
		}
		batch := texts[i:end]

		embeddings, err := c.batchEmbed(ctx, batch)
		if err != nil {
			return nil, fmt.Errorf("embedding batch %d-%d: %w", i, end-1, err)
		}

		for j, emb := range embeddings {
			results = append(results, EmbedResult{
				Text:      batch[j],
				Embedding: emb,
			})
		}
	}

	return results, nil
}

// batchEmbed calls Gemini batchEmbedContents API for a single batch.
func (c *Client) batchEmbed(ctx context.Context, texts []string) ([][]float32, error) {
	endpoint := fmt.Sprintf(
		"%s/%s:batchEmbedContents?key=%s",
		strings.TrimRight(c.BaseURL, "/"), c.Model, url.QueryEscape(c.APIKey),
	)

	// Build request body
	type contentPart struct {
		Text string `json:"text"`
	}
	type contentItem struct {
		Parts []contentPart `json:"parts"`
	}
	type embedRequest struct {
		Model                string      `json:"model"`
		Content              contentItem `json:"content"`
		OutputDimensionality int         `json:"outputDimensionality,omitempty"`
	}
	type batchRequest struct {
		Requests []embedRequest `json:"requests"`
	}

	var requests []embedRequest
	for _, text := range texts {
		req := embedRequest{
			Model: c.Model,
			Content: contentItem{
				Parts: []contentPart{{Text: text}},
			},
		}
		if c.OutputDimensionality > 0 {
			req.OutputDimensionality = c.OutputDimensionality
		}
		requests = append(requests, req)
	}

	body, err := json.Marshal(batchRequest{Requests: requests})
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.HTTP.Do(req)
	if err != nil {
		return nil, fmt.Errorf("http request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("gemini API returned %d: %s", resp.StatusCode, string(respBody))
	}

	// Parse response
	type embeddingValues struct {
		Values []float32 `json:"values"`
	}
	type embedResponse struct {
		Embedding embeddingValues `json:"embedding"`
		Values    []float32       `json:"values"`
	}
	type batchResponse struct {
		Embeddings []embedResponse `json:"embeddings"`
	}

	var result batchResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("unmarshal response: %w", err)
	}

	var embeddings [][]float32
	for _, emb := range result.Embeddings {
		values := emb.Values
		if len(values) == 0 {
			values = emb.Embedding.Values
		}
		if len(values) == 0 {
			return nil, fmt.Errorf("gemini API returned an empty embedding")
		}
		embeddings = append(embeddings, values)
	}
	if len(embeddings) != len(texts) {
		return nil, fmt.Errorf("gemini API returned %d embeddings for %d texts", len(embeddings), len(texts))
	}

	return embeddings, nil
}
