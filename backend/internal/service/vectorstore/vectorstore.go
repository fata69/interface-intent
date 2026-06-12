package vectorstore

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/pgvector/pgvector-go"
)

// Store handles PGVector database operations.
// This replaces n8n's "Postgres PGVector Store" node.
type Store struct {
	Pool *pgxpool.Pool
}

// NewStore creates a new vector store with a connection pool.
func NewStore(ctx context.Context, dsn string) (*Store, error) {
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		return nil, fmt.Errorf("connect to database: %w", err)
	}

	// Verify connection
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping database: %w", err)
	}

	return &Store{Pool: pool}, nil
}

// Close releases the database connection pool.
func (s *Store) Close() {
	s.Pool.Close()
}

// VectorRecord represents a single vector row to insert.
type VectorRecord struct {
	Text       string
	Embedding  []float32
	Metadata   map[string]interface{}
	DocumentID string
}

// EnsureCollection finds an existing collection by name, or creates one.
// Returns the collection UUID.
//
// This matches the n8n PGVector Store behavior that auto-creates collections.
func (s *Store) EnsureCollection(ctx context.Context, collectionName string) (string, error) {
	collectionName = strings.TrimSpace(collectionName)
	if collectionName == "" {
		return "", fmt.Errorf("collection name is required")
	}

	// Try to find existing collection
	var existingUUID string
	err := s.Pool.QueryRow(ctx,
		`SELECT uuid FROM n8n_vector_collections WHERE name = $1 LIMIT 1`,
		collectionName,
	).Scan(&existingUUID)

	if err == nil {
		return existingUUID, nil
	}

	if err != pgx.ErrNoRows {
		return "", fmt.Errorf("query collection: %w", err)
	}

	// Create new collection
	newUUID := uuid.New().String()
	_, err = s.Pool.Exec(ctx,
		`INSERT INTO n8n_vector_collections (uuid, name, cmetadata) VALUES ($1::uuid, $2, $3::jsonb)`,
		newUUID, collectionName, "{}",
	)
	if err != nil {
		return "", fmt.Errorf("create collection: %w", err)
	}

	return newUUID, nil
}

// InsertVectors inserts multiple vector records into a collection.
//
// This replaces the n8n PGVector Store insert operation.
// Each record gets: id (uuid), text, metadata (jsonb), embedding (vector), collection_id (uuid).
func (s *Store) InsertVectors(ctx context.Context, collectionUUID string, records []VectorRecord) (int, error) {
	if len(records) == 0 {
		return 0, nil
	}

	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return 0, fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	inserted := 0
	for _, rec := range records {
		metaJSON, err := json.Marshal(rec.Metadata)
		if err != nil {
			return inserted, fmt.Errorf("marshal metadata: %w", err)
		}

		vectorID := uuid.New().String()
		embedding := pgvector.NewVector(rec.Embedding)

		_, err = tx.Exec(ctx,
			`INSERT INTO n8n_vectors (id, text, metadata, embedding, collection_id)
			 VALUES ($1::uuid, $2, $3::jsonb, $4, $5::uuid)`,
			vectorID, rec.Text, string(metaJSON), embedding, collectionUUID,
		)
		if err != nil {
			return inserted, fmt.Errorf("insert vector row: %w", err)
		}
		inserted++
	}

	if err := tx.Commit(ctx); err != nil {
		return 0, fmt.Errorf("commit transaction: %w", err)
	}

	return inserted, nil
}

// IntentRow represents an intent+action row from the database.
// This matches the n8n SQL query:
//
//	SELECT i.context, i.action_id, a.action_type, a.parameter_needed
//	FROM intent i JOIN action a ON i.action_id = a.id;
type IntentRow struct {
	Context         string
	ActionID        int
	ActionType      string
	ParameterNeeded string
}

// QueryIntentsWithActions fetches all intents joined with their actions.
// This replaces the n8n "Execute a SQL query" node used in the PUT flow.
func (s *Store) QueryIntentsWithActions(ctx context.Context) ([]IntentRow, error) {
	rows, err := s.Pool.Query(ctx, `
		SELECT
			i.context,
			i.action_id,
			a.action_type,
			COALESCE(a.parameter_needed::text, '')
		FROM intent i
		JOIN action a ON i.action_id = a.id
	`)
	if err != nil {
		return nil, fmt.Errorf("query intents: %w", err)
	}
	defer rows.Close()

	var results []IntentRow
	for rows.Next() {
		var row IntentRow
		if err := rows.Scan(&row.Context, &row.ActionID, &row.ActionType, &row.ParameterNeeded); err != nil {
			return nil, fmt.Errorf("scan intent row: %w", err)
		}
		results = append(results, row)
	}

	return results, rows.Err()
}
