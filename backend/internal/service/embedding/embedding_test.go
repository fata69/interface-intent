package embedding

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestNewClientNormalizesModelResource(t *testing.T) {
	tests := []struct {
		name  string
		model string
		want  string
	}{
		{name: "bare", model: "gemini-embedding-2", want: "models/gemini-embedding-2"},
		{name: "resource", model: "models/gemini-embedding-2", want: "models/gemini-embedding-2"},
		{name: "empty", model: "", want: "models/gemini-embedding-2"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client := NewClient("key", tt.model, 10, 0)
			if client.Model != tt.want {
				t.Fatalf("Model = %q, want %q", client.Model, tt.want)
			}
		})
	}
}

func TestEmbedTextsBuildsBatchEmbedRequest(t *testing.T) {
	var capturedPath string
	var capturedQuery string
	var capturedBody struct {
		Requests []struct {
			Model                string `json:"model"`
			OutputDimensionality int    `json:"outputDimensionality"`
			Content              struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"requests"`
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedPath = r.URL.Path
		capturedQuery = r.URL.RawQuery
		if err := json.NewDecoder(r.Body).Decode(&capturedBody); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"embeddings":[{"values":[0.1,0.2]},{"values":[0.3,0.4]}]}`))
	}))
	defer server.Close()

	client := NewClient("secret key", "models/gemini-embedding-2", 10, 768)
	client.BaseURL = server.URL

	results, err := client.EmbedTexts(context.Background(), []string{"first", "second"})
	if err != nil {
		t.Fatalf("EmbedTexts returned error: %v", err)
	}
	if len(results) != 2 {
		t.Fatalf("len(results) = %d, want 2", len(results))
	}
	if capturedPath != "/models/gemini-embedding-2:batchEmbedContents" {
		t.Fatalf("path = %q", capturedPath)
	}
	if capturedQuery != "key=secret+key" {
		t.Fatalf("query = %q", capturedQuery)
	}
	if len(capturedBody.Requests) != 2 {
		t.Fatalf("len(requests) = %d, want 2", len(capturedBody.Requests))
	}
	if capturedBody.Requests[0].Model != "models/gemini-embedding-2" {
		t.Fatalf("request model = %q", capturedBody.Requests[0].Model)
	}
	if capturedBody.Requests[0].OutputDimensionality != 768 {
		t.Fatalf("outputDimensionality = %d, want 768", capturedBody.Requests[0].OutputDimensionality)
	}
	if got := capturedBody.Requests[1].Content.Parts[0].Text; got != "second" {
		t.Fatalf("second text = %q", got)
	}
}
