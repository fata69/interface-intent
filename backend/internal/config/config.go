package config

import (
	"bufio"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

// Config holds all application configuration loaded from environment variables.
type Config struct {
	// Server
	Port    string
	GinMode string

	// Database
	DBHost     string
	DBPort     string
	DBUser     string
	DBPassword string
	DBName     string
	DBSSLMode  string

	// Gemini Embedding
	GeminiAPIKey               string
	GeminiEmbeddingModel       string
	GeminiOutputDimensionality int
	EmbeddingBatchSize         int

	// Chunking
	ChunkSize    int
	ChunkOverlap int

	// Upload limits
	TextMaxLength   int
	PDFMaxSizeBytes int64
	PDFMaxPages     int

	// Auth
	AuthAPIURL string
}

// Load reads .env file (if present) and populates Config from environment variables.
func Load() (*Config, error) {
	loadEnvFile()

	cfg := &Config{
		Port:    envOrDefault("PORT", "8082"),
		GinMode: envOrDefault("GIN_MODE", "release"),

		DBHost:     envOrDefault("DB_HOST", "localhost"),
		DBPort:     envOrDefault("DB_PORT", "5432"),
		DBUser:     os.Getenv("DB_USER"),
		DBPassword: os.Getenv("DB_PASSWORD"),
		DBName:     os.Getenv("DB_NAME"),
		DBSSLMode:  envOrDefault("DB_SSLMODE", "disable"),

		GeminiAPIKey:               os.Getenv("GEMINI_API_KEY"),
		GeminiEmbeddingModel:       envOrDefault("GEMINI_EMBEDDING_MODEL", "gemini-embedding-2"),
		GeminiOutputDimensionality: envIntOrDefault("GEMINI_OUTPUT_DIMENSIONALITY", 0),
		EmbeddingBatchSize:         envIntOrDefault("EMBEDDING_BATCH_SIZE", 10),

		ChunkSize:    envIntOrDefault("CHUNK_SIZE", 1000),
		ChunkOverlap: envIntOrDefault("CHUNK_OVERLAP", 200),

		TextMaxLength:   envIntOrDefault("TEXT_MAX_LENGTH", 50000),
		PDFMaxSizeBytes: envInt64OrDefault("PDF_MAX_SIZE_BYTES", 20971520),
		PDFMaxPages:     envIntOrDefault("PDF_MAX_PAGES", 50),

		AuthAPIURL: os.Getenv("AUTH_API_URL"),
	}

	return cfg, nil
}

func loadEnvFile() {
	_ = godotenv.Load()

	file, err := os.Open(".env")
	if err != nil {
		return
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(strings.TrimPrefix(scanner.Text(), "\ufeff"))
		if line == "" || strings.HasPrefix(line, "#") || !strings.Contains(line, "=") {
			continue
		}

		parts := strings.SplitN(line, "=", 2)
		key := strings.TrimSpace(parts[0])
		if key == "" || os.Getenv(key) != "" {
			continue
		}

		value := strings.TrimSpace(parts[1])
		value = strings.Trim(value, `"'`)
		_ = os.Setenv(key, value)
	}
}

// DSN returns the PostgreSQL connection string.
func (c *Config) DSN() string {
	return "postgres://" + c.DBUser + ":" + c.DBPassword +
		"@" + c.DBHost + ":" + c.DBPort +
		"/" + c.DBName + "?sslmode=" + c.DBSSLMode
}

func envOrDefault(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func envIntOrDefault(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return fallback
}

func envInt64OrDefault(key string, fallback int64) int64 {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil {
			return n
		}
	}
	return fallback
}
