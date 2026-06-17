# Codebase Audit - 2026-06-08

Scope: current `migrate-swagger` worktree for the React/Vite Intent & Agent Management Console.

This audit looks for holes, unused code/imports, and optimization opportunities. It is written with the current project constraints in mind: the frontend must follow the Swagger API provided by the mentor, auth uses Bearer token, user creation belongs in the admin Users menu, and Vector Collections intentionally uses both Swagger native file storage and the Go Vector Knowledge backend.

## Verification Performed

- `npm run build` passed after Phase 3A changes.
- Simple import usage scan over `src/**/*.js` and `src/**/*.jsx` found no obvious unused imports.
- Grep scan checked risky patterns: direct `fetch`, storage access, `window.open`, `crypto.randomUUID`, exported helpers, and CRUD update paths.
- Reviewed key shared modules manually: `src/App.jsx`, `src/api/client.js`, `src/templates/hooks/useResourceCrud.js`, `src/utils/resourceUtils.jsx`, `src/features/vector-collections/components/VectorCollectionPanel.jsx`, auth store, sidebar, table, modal, and production proxy.

Current tooling note: there is no ESLint, TypeScript, or dedicated unit test runner. `npm test` only runs `vite build`, so unused imports, unused exports, accessibility regressions, and many runtime edge cases are not automatically caught.

## Phase 1 Applied

Applied after the initial audit:

- Added a UUID fallback for native Vector Collection creation.
- Added safe `sessionStorage` parsing for AI Chat persistence.
- Made Action relation rendering defensive when `data.actions` is unavailable.
- Removed technical API endpoint/raw payload display from the detail drawer and replaced it with user-facing status/detail labels.
- Cleaned up several customer-facing UI status messages so endpoint/API wording stays in docs, not the app surface.
- Revised audit wording so Swagger plus Go Vector Knowledge flow, Bearer token auth, and User role assignment match the current mentor-provided backend constraints.

## Phase 2 Applied

Applied after Phase 1:

- Added two-step Vector Collections upload status: file save and knowledge processing are shown separately.
- Added partial-success handling for User edit when the user data update succeeds but role assignment fails.
- Removed unused/future export leftovers: `authStore`, `actionLabel`, and `supportResourceOrder`.

## Phase 3A Applied

Applied after Phase 2:

- Split Vector Collections into Upload Knowledge and Collection Files sidebar children.
- Collection Files uses a paginated sortable table with upload time when available, opens a detail drawer before any original file is opened, and download is a separate explicit action.
- Added defensive Vector Collection `cmetadata` parsing for plain path strings, JSON objects, JSON arrays, and common nested file metadata keys.
- Vector Collection metadata parsing is used by Collection Files for file labels and search.

## Findings

### Accepted Constraint - Bearer token is persisted in browser storage

Evidence:

- `src/features/auth/authStore.js` uses Zustand persistence for the auth session.
- The login flow uses `POST /api/auth/login` and sends `Authorization: Bearer <token>` for Swagger API calls.
- Signup is not exposed on the login page; admin user creation goes through the Users menu.

Context:

Bearer token auth is the backend contract provided by Swagger and recommended by the mentor for this project. This is not an action item to replace with cookies unless the backend owner changes the auth design.

Risk:

A persisted Bearer token is still an accepted SPA risk: if XSS is introduced later, the token can be exposed.

Practical recommendation:

Keep Bearer token behavior as-is. Avoid adding any HTML injection surface, keep `.env` and credentials out of git, and keep public self-register disabled. If the backend later supports HttpOnly cookies, revisit the auth storage design.

### Completed in Phase 2 - User role assignment reports partial failure clearly

Evidence:

- `src/templates/hooks/useResourceCrud.js` updates user data with `PUT /api/users/{id}`.
- If role changes, it then calls `PUT /api/users/{id}/role` through `api.assignUserRole()`.

Context:

This is not a backend defect. Swagger provides user update and role assignment as separate endpoints, and the frontend must use the API as provided.

Risk:

If the first request succeeds but the role assignment request fails because of token expiry, network failure, or backend validation, the user may be partially updated. This should be rare, but the UI message should be accurate if it happens.

Result:

The two-endpoint flow is kept. If user data saves but role assignment fails, the frontend reloads data, closes the modal, and shows `Data user tersimpan, tapi role belum berhasil diubah.`

### Completed in Phase 2 - Vector upload shows two-step status

Evidence:

- `src/features/vector-collections/components/VectorCollectionPanel.jsx` uploads the original TXT/PDF to Swagger native Vector Collections.
- The same flow then posts to `/vector-webhook` so the Go Vector Knowledge backend can chunk/index into PGVector.

Context:

The two-API flow is intentional and correct:

- Swagger Vector Collections stores the original readable file so the web can list/view it and preserve file identity.
- Go Vector Knowledge `/vector-webhook` chunks/indexes the content into vector rows for AI retrieval.

Risk:

If Swagger upload succeeds but Go backend indexing fails, the original file can be visible in the web while the knowledge is not yet searchable through vector retrieval. The current status line separates file-save and knowledge-indexing progress.

Result:

Both APIs are still used. The UI now shows separate status pills for `File tersimpan` and `Knowledge diproses untuk pencarian`, and distinguishes file-save failure from knowledge-processing failure.

### Completed in Phase 3A - Vector file metadata parsing is defensive

Evidence:

- `src/features/vector-collections/metadata.js` centralizes Vector Collection name, file label, metadata list, and search text helpers.
- Collection Files consumes the metadata helper for file labels and search.

Context:

Swagger defines `cmetadata` as a string, but live backend metadata may reasonably appear as a plain path string, a JSON object, or a JSON array if backend behavior evolves.

Result:

Collection file labels and search are more robust across these formats. If a future backend returns multiple metadata entries in one `cmetadata` value, the drawer can display the metadata labels, while Open File still uses the Swagger UUID stream endpoint.

### Completed in Phase 1 - `crypto.randomUUID()` fallback for Vector Collections

Evidence:

- Initial audit found direct `crypto.randomUUID()` usage in Vector Collections.
- Phase 1 added a local UUID helper with `crypto.randomUUID`, `crypto.getRandomValues`, and `Math.random` fallback paths.

Result:

Native collection creation no longer depends only on `crypto.randomUUID()` availability.

### Completed in Phase 1 - Defensive Action relation access

Evidence:

- Initial audit found `data.actions.find(...)` in `src/utils/resourceUtils.jsx`.
- Phase 1 changed the Action lookup to tolerate missing `data.actions`.

Result:

Shared table rendering is safer for future partial-data rendering and tests.

### Completed in Phase 1 - Detail drawer no longer exposes technical endpoint/raw payload text

Evidence:

- Initial audit found a technical `Detail endpoint` row in the drawer.
- Phase 1 replaced it with user-facing rows: data status, edit availability, delete availability, and readable field details.

Result:

The drawer is more appropriate for an operator/candidate-user demo and no longer risks showing malformed endpoint strings or raw JSON payloads.

### Completed in Phase 1 - AI Chat storage parse is guarded

Evidence:

- Initial audit found direct `JSON.parse` on `sessionStorage` data.
- Phase 1 wraps persisted chat parsing in `try/catch` and clears corrupt storage.

Result:

Bad browser storage no longer breaks chat hydration.

### Completed in Phase 2 - Unused exported helpers / future abstraction leftovers removed

Evidence:

- Initial audit found `authStore` exported from `src/features/auth/authStore.js` without current callers.
- Initial audit found `actionLabel` exported from `src/utils/resourceUtils.jsx` without current callers.
- Initial audit found `supportResourceOrder` exported from `src/config/resources.js` even though it was an empty internal extension point.

Result:

`authStore`, `actionLabel`, and `supportResourceOrder` were removed or simplified. A focused source grep no longer finds those exported symbols.

### Low - Static analysis/test coverage is thin for the current app size

Evidence:

- `package.json` defines `test` as `vite build`.
- No ESLint, TypeScript, unit tests, or component tests are configured.

Risk:

The app now has auth, admin-only flows, multi-step user edits, Vector Collections two-step upload, and AIWO chat integration. `vite build` proves bundling but does not prove form behavior, role visibility, webhook error handling, or unused code cleanup.

Recommendation:

Add tooling in stages:

1. ESLint for React hooks, unused imports, and common JSX mistakes.
2. Unit tests for `preparePayload`, `validateRecord`, `normalizeList`, `normalizeRecord`, and `getActionTarget`.
3. A few integration/component tests for Users edit, Action conditional targets, and Vector Collections upload status.

## Optimization Opportunities

### 1. Centralize webhook request handling

AI Chat and Vector Collections each implement direct `fetch()` and response parsing. Centralizing webhook helpers would reduce duplicated error parsing and make proxy/status behavior easier to maintain.

### 2. Add per-resource API status instead of one global status string

`src/App.jsx` collapses list failures into one status string. As resources grow, operators need to know exactly which table failed and why. A per-resource status map would improve diagnostics without adding fake data.

### 3. Split `resourceUtils.jsx`

`resourceUtils.jsx` currently owns normalization, labels, relation rendering, validation, payload preparation, and JSX cell rendering. Splitting it into focused modules would make future CRUD changes easier to audit.

### 4. Reuse browser safety helpers

Phase 1 introduced safer UUID/storage handling. A shared browser utility can avoid repeating those patterns when more features need local session state or generated IDs.

## No Obvious Unused Imports Found

A simple import scan found no obvious unused imports in `src`. This is not as strong as ESLint, but it supports that the main cleanup target is unused exports/tooling rather than import statements.

## Suggested Next Fix Order

1. Add ESLint and focused unit tests for utility/payload logic.
2. Consider per-resource status tracking for list failures.
3. Centralize webhook request handling after the current Vector and Chat flows settle.
