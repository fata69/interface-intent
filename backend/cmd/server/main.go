package main

import (
	"context"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"

	"vector-knowledge-backend/internal/config"
	"vector-knowledge-backend/internal/handler"
	"vector-knowledge-backend/internal/middleware"
	"vector-knowledge-backend/internal/service/embedding"
	"vector-knowledge-backend/internal/service/vectorstore"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	if cfg.GeminiAPIKey == "" {
		log.Fatal("GEMINI_API_KEY is required. Set it in .env file.")
	}
	if cfg.DBUser == "" || cfg.DBName == "" {
		log.Fatal("DB_USER and DB_NAME are required. Set them in .env file.")
	}

	ctx := context.Background()
	store, err := vectorstore.NewStore(ctx, cfg.DSN())
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer store.Close()
	log.Println("Database connected.")

	embedder := embedding.NewClient(
		cfg.GeminiAPIKey,
		cfg.GeminiEmbeddingModel,
		cfg.EmbeddingBatchSize,
		cfg.GeminiOutputDimensionality,
	)
	log.Printf(
		"Embedding client ready (model: %s, batch: %d, output_dimensionality: %d)",
		cfg.GeminiEmbeddingModel,
		cfg.EmbeddingBatchSize,
		cfg.GeminiOutputDimensionality,
	)

	h := &handler.VectorKnowledgeHandler{
		Config:   cfg,
		Store:    store,
		Embedder: embedder,
	}

	gin.SetMode(cfg.GinMode)
	r := gin.Default()

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "healthy",
			"service": "vector-knowledge-backend",
		})
	})

	api := r.Group("/api")
	api.Use(middleware.BearerAuth(cfg.AuthAPIURL))
	{
		api.POST("/vector-knowledge", h.PostKnowledge)
		api.PUT("/vector-knowledge", h.PutSyncIntents)
	}

	webhook := r.Group("/webhook")
	webhook.Use(middleware.BearerAuth(cfg.AuthAPIURL))
	{
		webhook.POST("/update-intent", h.PostKnowledge)
		webhook.PUT("/update-intent", h.PutSyncIntents)
	}

	addr := ":" + cfg.Port
	log.Printf("Vector Knowledge Backend starting on %s", addr)
	log.Printf("POST /api/vector-knowledge  - upload text/PDF knowledge")
	log.Printf("PUT  /api/vector-knowledge  - sync intents to VectorDB")
	log.Printf("POST /webhook/update-intent - n8n-compatible upload text/PDF knowledge")
	log.Printf("PUT  /webhook/update-intent - n8n-compatible sync intents to VectorDB")
	log.Printf("GET  /health                - health check")

	if err := r.Run(addr); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
