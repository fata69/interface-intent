package handler

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/textproto"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"

	"vector-knowledge-backend/internal/config"
)

func TestPostKnowledgeRejectsInvalidTextRequests(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := &VectorKnowledgeHandler{Config: testConfig()}

	tests := []struct {
		name string
		body string
		want string
	}{
		{
			name: "invalid type",
			body: `{"type":"html","text":"hello","collection_name":"koperasi"}`,
			want: "Parameter type wajib diisi dengan nilai text atau pdf",
		},
		{
			name: "missing text",
			body: `{"type":"text","text":"","collection_name":"koperasi"}`,
			want: "parameter text dan collection_name terisi",
		},
		{
			name: "too long",
			body: `{"type":"text","text":"123456","collection_name":"koperasi"}`,
			want: "Teks tidak boleh lebih dari 5 karakter",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			ctx, _ := gin.CreateTestContext(recorder)
			ctx.Request = httptest.NewRequest(http.MethodPost, "/api/vector-knowledge", strings.NewReader(tt.body))
			ctx.Request.Header.Set("Content-Type", "application/json")

			h.PostKnowledge(ctx)

			if recorder.Code != http.StatusBadRequest {
				t.Fatalf("status = %d, want 400", recorder.Code)
			}
			var payload errorResponse
			if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
				t.Fatalf("decode response: %v", err)
			}
			if !strings.Contains(payload.Message, tt.want) {
				t.Fatalf("message = %q, want containing %q", payload.Message, tt.want)
			}
		})
	}
}

func TestPostKnowledgeRejectsPDFOverConfiguredRequestLimit(t *testing.T) {
	gin.SetMode(gin.TestMode)
	cfg := testConfig()
	cfg.PDFMaxSizeBytes = 20 * 1024 * 1024
	h := &VectorKnowledgeHandler{Config: cfg}

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	_ = writer.WriteField("type", "pdf")
	_ = writer.WriteField("collection_name", "koperasi")
	header := make(textproto.MIMEHeader)
	header.Set("Content-Disposition", `form-data; name="file"; filename="doc.pdf"`)
	header.Set("Content-Type", "application/pdf")
	fileWriter, err := writer.CreatePart(header)
	if err != nil {
		t.Fatalf("create form file: %v", err)
	}
	_, _ = fileWriter.Write([]byte("0123456789"))
	_ = writer.Close()

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/vector-knowledge", &body)
	ctx.Request.Header.Set("Content-Type", writer.FormDataContentType())
	ctx.Request.ContentLength = cfg.PDFMaxSizeBytes + 1

	h.PostKnowledge(ctx)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", recorder.Code)
	}
	if !strings.Contains(recorder.Body.String(), "maksimal 20 MB") {
		t.Fatalf("response = %s", recorder.Body.String())
	}
}

func testConfig() *config.Config {
	return &config.Config{
		TextMaxLength:   5,
		PDFMaxSizeBytes: 5,
		PDFMaxPages:     50,
		ChunkSize:       1000,
		ChunkOverlap:    200,
	}
}
