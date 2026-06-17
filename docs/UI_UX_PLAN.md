# UI/UX Implementation Status

## Current State

The dashboard is an operational React/Vite interface for configuring AI chatbot resources from the live Swagger API. It is not a landing page and does not use mock data.

Active sources:

- ERD: `ERD.mmd` and `ERD_VIEW.html` in the repository root.
- Swagger: `http://172.16.210.244:8080/swagger/index.html#/`.
- Internal app server: `litmas@172.16.210.244`.

The UI uses a focused management-console structure:

- Route-based navigation through `react-router-dom`.
- Collapsible `AI-Configuration` sidebar.
- Compact page header and API status strip.
- Searchable CRUD tables with pagination and sortable ID headers.
- Modal forms with validation and request loading states.
- Detail drawer for row inspection.
- Clear unavailable states for unsupported operations.
- Auth-protected dashboard with admin-only Roles and Users pages.

## Current Sidebar

```text
AI-Configuration
- Intents
- Usecases
- Actions
  - External Data
  - AI Agents
  - Agent Utilities
  - Semantic Search
- Utilities
- Vector Collections
  - Upload Knowledge
  - Collection Files
- Roles
- Users
- AI Chat
```

Do not add a separate Vectors CRUD page until the API exposes direct read endpoints for vector chunk rows.

## Implemented UX

- Conditional Action form by `action_type`.
- Only the relevant Action target dropdown is shown.
- Non-selected Action relation fields are cleared before submit.
- Relationship-aware table display for Actions, Intents, Users, and relation fields.
- Detailed Action labels in Intent dropdowns.
- Enum values such as `action_type` and `protocol_request` use compact badges.
- JSON-like fields have validation, placeholders, and a Format JSON control.
- Modules without read/update/delete endpoints keep unsupported actions disabled.
- Shared CRUD tables include rows-per-page options `10`, `25`, and `50`.
- Empty states distinguish between no data and no search result.
- CRUD modals autofocus the first field, support Escape-to-close when idle, use resource-specific submit labels, and disable controls while saving.
- Detail endpoints that fail can fall back to the list row for view/edit flows.
- AI Chat posts to AIWO through `/chat-webhook` and renders real responses.
- AI Chat requires a selected usecase before sending and sends `sessionId`, `chatInput`, and numeric `usecaseId`.
- AI Chat state persists in `sessionStorage` for the browser session.
- Intents exposes a `Sync Intents` header action for AIWO cache synchronization through `/intent-sync`.
- Vector Collections uses Semantic Search collection names, native `/api/vector-collections`, and Go backend `/vector-webhook` indexing.
- Native vector collection rows can be listed, created when needed, and used to upload, preview, or explicitly download the original file.
- Vector Collections is organized around the selected collection: choose the target collection first, then view the saved knowledge file and upload Text/PDF for that collection.
- Vector Collections is split into two sidebar children: Upload Knowledge for Text/PDF upload, and Collection Files for browsing/viewing saved knowledge files.
- Clicking the Vector Collections parent opens Upload Knowledge by default, so the parent does not need its own empty landing page.
- Vector Collection file labels are parsed defensively from `cmetadata`, including plain path strings, JSON objects, and JSON arrays when the backend returns more than one metadata entry.
- Webhook/API async responses such as `executionStarted` are rendered as readable workflow status.
- Page code remains feature-based; `App.jsx` stays as app shell/router.

## API UX Status

Fully CRUD-backed in UI:

- Actions
- AI Agents
- External Data
- Intents
- Usecases
- Users
- Semantic Search

Partially backed in UI:

- Roles: list and create only.
- Utilities: list and create only.
- Agent Utilities: create only.
- Vector Collections Upload Knowledge: select target collection, create native row when needed, upload the original file, and send Text/PDF to the Go Vector Knowledge backend.
- Vector Collections Collection Files: list saved Vector Collection files, open a detail drawer first, then separate original file preview through `Open File` from explicit `Download`.

Separate from Swagger CRUD:

- AI Chat via `/chat-webhook`.
- Intent cache synchronization via `/intent-sync`.
- Vector indexing via `/vector-webhook`.

## Remaining UX Work

These are optional next improvements, not blockers for current scope.

### Header Key-Value Editor

Add a structured key-value editor for `header` fields while preserving raw JSON mode.

### Domain-Specific Column Tuning

Refine table columns per resource after more real data is available.

### Action/Intent Flow View

Consider a supplemental view showing:

```text
Intent -> Action -> Target
```

Keep CRUD tables as the default operational view unless specifically changed.

### Manual Visual QA

Run visual checks with real payload variations:

- Long `context` text.
- Long `host` URLs.
- Invalid and deeply nested JSON values.
- Empty API responses.
- Unauthorized or forbidden admin pages.

### Backend-Dependent Follow-Up

If backend later exposes missing endpoints, update `src/api/client.js` and replace unavailable states with real actions.

Priority missing endpoints:

- `GET /api/ai-agent-utilities/`
- Update/delete endpoints for Utilities.
- Direct read endpoint for `n8n_vectors` if a knowledge viewer is needed.

## Visual Direction

Keep the dashboard restrained and practical:

- No hero sections.
- No decorative cards inside cards.
- No emoji icons.
- No gradient/orb decoration.
- Dense but readable tables.
- Functional color usage: neutral surfaces, blue primary actions, amber warnings, red destructive actions.

## Acceptance Criteria

Current implementation should satisfy:

- Users can understand the Intent -> Action -> Target flow without manually mapping raw IDs.
- Unsupported API operations are visibly unavailable and never write fake state.
- Add/Edit/Delete actions hit real Swagger-backed endpoints when available.
- JSON fields prevent invalid payloads before submit.
- Foreign key fields use dropdowns populated from API data.
- AI Chat sends real webhook messages and does not use canned local replies.
- Vector Collections sends real API/webhook requests for original file upload and vector indexing.
- `App.jsx` remains a small shell; feature logic stays in feature folders.
- No mock data is used anywhere in the app.

