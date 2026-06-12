package handler

import (
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"vector-knowledge-backend/internal/config"
	"vector-knowledge-backend/internal/service/chunker"
	"vector-knowledge-backend/internal/service/embedding"
	"vector-knowledge-backend/internal/service/pdf"
	"vector-knowledge-backend/internal/service/vectorstore"
)

// VectorKnowledgeHandler handles the POST and PUT /api/vector-knowledge endpoints.
type VectorKnowledgeHandler struct {
	Config   *config.Config
	Store    *vectorstore.Store
	Embedder *embedding.Client
}

// errorResponse is the standard JSON error shape matching n8n responses.
type errorResponse struct {
	ErrorCode int    `json:"error_code"`
	Message   string `json:"message"`
}

// successResponse is the standard JSON success shape matching n8n responses.
type successResponse struct {
	ErrorCode int    `json:"error_code"`
	Message   string `json:"message"`
}

// PostKnowledge handles POST /api/vector-knowledge
//
// Accepts either:
//   - JSON body with type:"text", text, collection_name
//   - Multipart form with type:"pdf", collection_name, file (PDF binary)
//
// This replaces the entire n8n POST /webhook/update-intent flow.
func (h *VectorKnowledgeHandler) PostKnowledge(c *gin.Context) {
	contentType := c.GetHeader("Content-Type")

	if strings.HasPrefix(contentType, "multipart/form-data") {
		h.handlePDFUpload(c)
		return
	}

	// Default: JSON body
	h.handleTextUpload(c)
}

// handleTextUpload processes text knowledge upload.
// Replaces n8n: Switch(TEXT) → Satpam Teks → PGVector Store
func (h *VectorKnowledgeHandler) handleTextUpload(c *gin.Context) {
	var body struct {
		Type           string `json:"type"`
		Text           string `json:"text"`
		CollectionName string `json:"collection_name"`
	}

	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, errorResponse{
			ErrorCode: 1,
			Message:   "Request body tidak valid.",
		})
		return
	}

	// Validate type (replaces n8n Switch node)
	if body.Type != "text" {
		c.JSON(http.StatusBadRequest, errorResponse{
			ErrorCode: 1,
			Message:   "Request ditolak! Parameter type wajib diisi dengan nilai text atau pdf.",
		})
		return
	}

	// Validate text and collection_name (replaces n8n Satpam Teks)
	if strings.TrimSpace(body.Text) == "" || strings.TrimSpace(body.CollectionName) == "" {
		c.JSON(http.StatusBadRequest, errorResponse{
			ErrorCode: 1,
			Message:   "Request ditolak! Pastikan parameter text dan collection_name terisi. Teks tidak boleh lebih dari " + strconv.Itoa(h.Config.TextMaxLength) + " karakter.",
		})
		return
	}

	if len(body.Text) > h.Config.TextMaxLength {
		c.JSON(http.StatusBadRequest, errorResponse{
			ErrorCode: 1,
			Message:   "Request ditolak! Pastikan parameter text dan collection_name terisi. Teks tidak boleh lebih dari " + strconv.Itoa(h.Config.TextMaxLength) + " karakter.",
		})
		return
	}

	// Process: chunk → embed → store (replaces n8n PGVector Store + sub-nodes)
	documentID := "Input_Teks_Manual"
	metadata := map[string]interface{}{
		"document_id": documentID,
	}

	if err := h.processAndStore(c.Request.Context(), body.Text, body.CollectionName, metadata); err != nil {
		log.Printf("ERROR text upload: %v", err)
		c.JSON(http.StatusInternalServerError, errorResponse{
			ErrorCode: 500,
			Message:   "Gagal memproses TEXT! AI mengalami kendala atau TEXT tidak terbaca.",
		})
		return
	}

	c.JSON(http.StatusOK, successResponse{
		ErrorCode: 0,
		Message:   "berhasil menambahkan intent",
	})
}

// handlePDFUpload processes PDF knowledge upload.
// Replaces n8n: Switch(DOCUMENT) → Satpam File → validations → Extract → PGVector Store
func (h *VectorKnowledgeHandler) handlePDFUpload(c *gin.Context) {
	uploadType := c.PostForm("type")
	collectionName := c.PostForm("collection_name")

	// Validate type
	if uploadType != "pdf" {
		c.JSON(http.StatusBadRequest, errorResponse{
			ErrorCode: 1,
			Message:   "Request ditolak! Parameter type wajib diisi dengan nilai text atau pdf.",
		})
		return
	}

	// Validate collection_name and file presence (replaces n8n Satpam File)
	fileHeader, err := c.FormFile("file")
	if err != nil || strings.TrimSpace(collectionName) == "" {
		c.JSON(http.StatusBadRequest, errorResponse{
			ErrorCode: 1,
			Message:   "Request ditolak! Pastikan collection_name terisi dan file tidak kosong.",
		})
		return
	}

	// Validate MIME type (replaces n8n Satpam Jenis File)
	if fileHeader.Header.Get("Content-Type") != "application/pdf" {
		c.JSON(http.StatusBadRequest, errorResponse{
			ErrorCode: 400,
			Message:   "File ditolak! Dokumen wajib berformat PDF.",
		})
		return
	}

	// n8n checks the full multipart request content-length, not only the file size.
	if c.Request.ContentLength > h.Config.PDFMaxSizeBytes || (c.Request.ContentLength <= 0 && fileHeader.Size > h.Config.PDFMaxSizeBytes) {
		c.JSON(http.StatusBadRequest, errorResponse{
			ErrorCode: 400,
			Message:   fmt.Sprintf("File ditolak! Ukuran dokumen kebesaran, maksimal %d MB.", h.Config.PDFMaxSizeBytes/1024/1024),
		})
		return
	}

	// Read PDF file
	file, err := fileHeader.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, errorResponse{
			ErrorCode: 500,
			Message:   "Gagal membaca file upload.",
		})
		return
	}
	defer file.Close()

	pdfBytes, err := io.ReadAll(file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, errorResponse{
			ErrorCode: 500,
			Message:   "Gagal membaca file upload.",
		})
		return
	}

	// Extract text from PDF (replaces n8n Extract from File)
	result, err := pdf.ExtractTextFromBytes(pdfBytes)
	if err != nil {
		log.Printf("ERROR pdf extract: %v", err)
		c.JSON(http.StatusInternalServerError, errorResponse{
			ErrorCode: 500,
			Message:   "Gagal memproses dokumen! AI mengalami kendala atau PDF tidak terbaca.",
		})
		return
	}

	// Validate page count (replaces n8n Satpam Halaman)
	if result.NumPages > h.Config.PDFMaxPages {
		c.JSON(http.StatusBadRequest, errorResponse{
			ErrorCode: 400,
			Message:   fmt.Sprintf("File ditolak! Dokumen kepanjangan, maksimal %d halaman.", h.Config.PDFMaxPages),
		})
		return
	}

	if strings.TrimSpace(result.Text) == "" {
		c.JSON(http.StatusBadRequest, errorResponse{
			ErrorCode: 400,
			Message:   "PDF tidak mengandung teks yang bisa dibaca.",
		})
		return
	}

	// Process: chunk → embed → store
	metadata := map[string]interface{}{
		"document_id": fileHeader.Filename,
	}

	if err := h.processAndStore(c.Request.Context(), result.Text, collectionName, metadata); err != nil {
		log.Printf("ERROR pdf upload: %v", err)
		c.JSON(http.StatusInternalServerError, errorResponse{
			ErrorCode: 500,
			Message:   "Gagal memproses dokumen! AI mengalami kendala atau PDF tidak terbaca.",
		})
		return
	}

	c.JSON(http.StatusOK, successResponse{
		ErrorCode: 0,
		Message:   "berhasil menambahkan intent",
	})
}

// PutSyncIntents handles PUT /api/vector-knowledge
//
// Reads all intents+actions from DB, embeds them, and inserts into PGVector.
// This replaces the entire n8n PUT /webhook/update-intent flow.
func (h *VectorKnowledgeHandler) PutSyncIntents(c *gin.Context) {
	var body struct {
		CollectionName string `json:"collection_name"`
	}

	if err := c.ShouldBindJSON(&body); err != nil || strings.TrimSpace(body.CollectionName) == "" {
		c.JSON(http.StatusBadRequest, errorResponse{
			ErrorCode: 1,
			Message:   "request body tidak lengkap pada method PUT (collection_name wajib diisi)",
		})
		return
	}

	ctx := c.Request.Context()

	// Query intents (replaces n8n Execute SQL query)
	intents, err := h.Store.QueryIntentsWithActions(ctx)
	if err != nil {
		log.Printf("ERROR query intents: %v", err)
		c.JSON(http.StatusInternalServerError, errorResponse{
			ErrorCode: 500,
			Message:   "Gagal membaca data intent dari database.",
		})
		return
	}

	// Check data not empty (replaces n8n Satpam data kosong)
	if len(intents) == 0 {
		c.JSON(http.StatusBadRequest, errorResponse{
			ErrorCode: 404,
			Message:   "Proses dibatalkan. Data intent di database sedang kosong!",
		})
		return
	}

	// Ensure collection exists
	collectionUUID, err := h.Store.EnsureCollection(ctx, body.CollectionName)
	if err != nil {
		log.Printf("ERROR ensure collection: %v", err)
		c.JSON(http.StatusInternalServerError, errorResponse{
			ErrorCode: 500,
			Message:   "Gagal menyiapkan collection.",
		})
		return
	}

	// Prepare texts for embedding
	var texts []string
	for _, intent := range intents {
		texts = append(texts, intent.Context)
	}

	// Generate embeddings
	embedResults, err := h.Embedder.EmbedTexts(ctx, texts)
	if err != nil {
		log.Printf("ERROR embed intents: %v", err)
		c.JSON(http.StatusInternalServerError, errorResponse{
			ErrorCode: 500,
			Message:   "Gagal memproses TEXT! AI mengalami kendala atau TEXT tidak terbaca.",
		})
		return
	}

	// Build vector records with intent metadata
	var records []vectorstore.VectorRecord
	for i, emb := range embedResults {
		intent := intents[i]
		records = append(records, vectorstore.VectorRecord{
			Text:      emb.Text,
			Embedding: emb.Embedding,
			Metadata: map[string]interface{}{
				"action_id":        fmt.Sprintf("%d", intent.ActionID),
				"action_type":      intent.ActionType,
				"parameter_needed": intent.ParameterNeeded,
			},
		})
	}

	// Insert into PGVector
	inserted, err := h.Store.InsertVectors(ctx, collectionUUID, records)
	if err != nil {
		log.Printf("ERROR insert vectors: %v", err)
		c.JSON(http.StatusInternalServerError, errorResponse{
			ErrorCode: 500,
			Message:   "Gagal memproses TEXT! AI mengalami kendala atau TEXT tidak terbaca.",
		})
		return
	}

	log.Printf("PUT sync: inserted %d vectors into collection %s", inserted, body.CollectionName)

	c.JSON(http.StatusOK, successResponse{
		ErrorCode: 0,
		Message:   "berhasil mengupdate intent dari database ke VectorDB",
	})
}

// processAndStore is the shared pipeline: chunk → embed → store.
// Used by both text and PDF upload handlers.
func (h *VectorKnowledgeHandler) processAndStore(
	ctx context.Context,
	text, collectionName string,
	baseMetadata map[string]interface{},
) error {
	// 1. Chunk text (replaces n8n Recursive Character Text Splitter)
	chunks := chunker.RecursiveCharacterSplit(text, h.Config.ChunkSize, h.Config.ChunkOverlap)
	if len(chunks) == 0 {
		return fmt.Errorf("no chunks produced from text")
	}

	// 2. Embed chunks (replaces n8n Embeddings Google Gemini)
	var chunkTexts []string
	for _, chunk := range chunks {
		chunkTexts = append(chunkTexts, chunk.Text)
	}

	embedResults, err := h.Embedder.EmbedTexts(ctx, chunkTexts)
	if err != nil {
		return fmt.Errorf("embed chunks: %w", err)
	}

	// 3. Ensure collection exists
	collectionUUID, err := h.Store.EnsureCollection(ctx, collectionName)
	if err != nil {
		return fmt.Errorf("ensure collection: %w", err)
	}

	// 4. Build vector records
	var records []vectorstore.VectorRecord
	for _, emb := range embedResults {
		meta := make(map[string]interface{})
		for k, v := range baseMetadata {
			meta[k] = v
		}
		records = append(records, vectorstore.VectorRecord{
			Text:      emb.Text,
			Embedding: emb.Embedding,
			Metadata:  meta,
		})
	}

	// 5. Insert into PGVector (replaces n8n Postgres PGVector Store)
	inserted, err := h.Store.InsertVectors(ctx, collectionUUID, records)
	if err != nil {
		return fmt.Errorf("insert vectors: %w", err)
	}

	log.Printf("POST knowledge: inserted %d vectors into collection %s", inserted, collectionName)
	return nil
}
