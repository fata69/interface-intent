# UI/UX Implementation Plan and Status

## Current State

The dashboard is an operational React/Vite interface for configuring AI chatbot resources from the live Swagger API. It intentionally avoids ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œAI slopÃƒÂ¢Ã¢â€šÂ¬Ã‚Â patterns: no landing-page hero, no decorative gradient blobs, no emoji icons, no fake data, and no redundant summary-card row.

The UI now uses a focused structure:

- Sidebar navigation for ERD/API resources.
- Collapsible `AI-Configuration` sub-sidebar. Sidebar follows mentor grouping: Actions owns External Data, AI Agents, Agent Utilities, and Semantic Search; Utilities, Vector Collections, and AI Chat are direct items. Vectors are not shown as an empty page because they are handled by the n8n PGVector workflow until read endpoints exist. Do not add a Semantic Search sub-submenu unless requested.
- Compact page header with record count.
- Global API status strip.
- Searchable table.
- Real API-backed add/edit/delete actions where Swagger exposes them.
- Vector Collections page for text upload, PDF upload, and Intent/Action sync through n8n.
- Detail drawer for row inspection.
- Unavailable panels for ERD resources whose endpoints are not exposed.

## Implemented UX Improvements

Implemented on 2026-06-01:

- Conditional Action form by `action_type`.
- Only the relevant Action target dropdown is shown:
  - `semantic_search` -> Semantic Search target.
  - `external_data` -> External Data target.
  - `ai_agent` -> AI Agent target.
- Non-selected Action relation fields are cleared before submit.
- Relationship-aware table display for Actions and Intents.
- Detailed Action labels in Intent dropdowns: id, action type, target label, and parameter summary.
- Enum values such as `action_type` and `protocol_request` use restrained badges.
- JSON fields have placeholders, inline validation, and a `Format JSON` control.
- Modules without read endpoints show endpoint-unavailable panels instead of generic empty tables.
- Rows open a read-only detail drawer with payload JSON and API capability information.
- Add/Edit/Delete controls are disabled when Swagger does not expose the matching method.
- AI Chat page posts to the n8n webhook through `/chat-webhook` and renders the real response.
- AI Chat includes a Semantic Search Collection selector populated from real `/api/semantic-searches/` data; the selected `collection_name` is sent to the webhook.
- Vector Collections is a dedicated page with a single board layout: Semantic Search collection selector, register collection field, tabbed POST/PUT operations, and shared request status. Registering creates a `/api/semantic-searches/` row so the collection also appears on Semantic Search. `POST` uploads text knowledge, `POST` uploads PDF via multipart field `file`, and `PUT` inserts/syncs Intent + Action data by selected `collection_name`.
- ERD alignment is name-based, not FK-based: `semantic_search.collection_name` is the Action-facing registry, while `n8n_vector_collections.name` is the PGVector collection created/filled by n8n.
- Sidebar parent items and nested submenus can be hidden or shown without leaving the page.
- n8n async responses such as `executionStarted` are rendered as readable workflow status, not raw JSON bubbles.
- Page code is feature-based: sidebar pages live under `src/features/<feature-name>/Page.jsx`, feature config lives beside it in `config.js`, shared CRUD behavior lives in `src/templates/hooks/useResourceCrud.js`, shared UI building blocks live under `src/templates/components/`, and feature registration stays in `src/config/resources.js` plus `src/features/index.js`.
- Feature pages own layout. Shared templates are intentionally small hooks/components, so page-specific UI changes do not require editing a global CRUD page template.

## API Audit Status

Latest checked sources:

- `http://172.16.210.244:8080/swagger/doc.json`
- `C:\Users\User\Downloads\Swagger UI (6_1_2026 10ÃƒÂ¯Ã‚Â¼Ã…Â¡04ÃƒÂ¯Ã‚Â¼Ã…Â¡07 AM).html`

All endpoints available in the latest Swagger HTML are utilized by the web app.

Currently available and used:

- Full CRUD plus detail: Actions, AI Agents, External Data, Intents, Semantic Search.
- List and create: Utilities.
- Create only: AI Agent Utility Mapping.
- Non-Swagger chat webhook: `POST /chat-webhook` proxied to the n8n `:5678` webhook. Payload includes `collection_name` and `semantic_search_id` from the selected Semantic Search row.
- Non-Swagger VectorDB webhook: `POST` and `PUT /vector-webhook` proxied to `:5678/webhook/update-intent`. Payload uses the selected Semantic Search `collection_name`.

Still unavailable in Swagger/API:

- `GET`, `PUT`, `DELETE` for `/api/ai-agent-utilities/`.
- Detail, update, and delete endpoints for `/api/utilities/`.
- CRUD endpoints for `n8n_vector_collections`.
- CRUD endpoints for `n8n_vectors`.

## Remaining UX Work

These are optional next improvements, not blockers for the current Swagger-backed scope.

### 1. Header Key-Value Editor

Add a structured key-value editor for `header` fields while preserving raw JSON mode. This would reduce JSON typing errors for non-technical users.

### 2. Domain-Specific Column Tuning

After mentor feedback, refine table columns per resource. Possible examples:

- AI Agents: show `agent_name`, `protocol_request`, `host`, and utility count if mapping list endpoint becomes available.
- External Data: show `protocol_request`, `host`, and default parameter summary.
- Semantic Search: show `collection_name` and related Action count.

Implement page-specific layout changes in the matching `src/features/<feature-name>/Page.jsx`. Keep `src/templates/` limited to reusable pieces.

### 3. Better Action/Intent Flow View

Consider a workflow-oriented view that shows:

```text
Intent -> Action -> Target
```

This should supplement, not replace, the CRUD tables.

### 4. Manual Visual QA

Run visual checks with several real API payload variations:

- Long `context` text.
- Long `host` URLs.
- Invalid and deeply nested JSON values.
- Empty API responses.
- Disabled/unavailable resources.

### 5. Backend-Dependent Follow-Up

If the backend later exposes missing endpoints, update the UI capability map in `src/api/client.js` and replace unavailable panels with real tables/actions.

Priority missing endpoints:

- `GET /api/ai-agent-utilities/`
- `GET /api/n8n_vector_collections/`
- `GET /api/n8n_vectors/`
- update/delete endpoints for Utilities and AI Agent Utility Mapping.

## Visual Direction

Keep the dashboard restrained and practical:

- No hero sections.
- No decorative cards inside cards.
- No emoji icons.
- No gradient/orb decoration.
- Prefer dense but readable tables, clear controls, and practical status messages.
- Keep color usage functional: neutral surfaces, blue primary actions, amber warnings, red destructive actions.

## Acceptance Criteria

Current implementation should satisfy:

- Users can understand the `Intent -> Action -> Target` flow without manually mapping raw IDs.
- Unsupported API operations are visibly unavailable and never write fake state.
- Add/Edit/Delete actions always hit real Swagger-backed endpoints.
- JSON fields prevent invalid payloads before submit.
- Tables show meaningful labels and relationship summaries, not only raw IDs.
- Intent forms show detailed Action choices, not only `#id` values.
- AI Chat sends messages to the webhook and does not use canned local replies.
- Vector Collections actions send real Swagger requests for collection registration and real webhook requests for PGVector upload/sync. No fake local collection state is stored.
- AI Chat does not show async n8n execution payloads as raw JSON when no direct text answer is returned.
- `App.jsx` remains a small shell; resource/page logic stays in page/component/config files.
- No mock data is used anywhere in the app.
