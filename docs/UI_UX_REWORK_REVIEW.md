# UI/UX Rework Review

## Purpose

Dokumen ini adalah bahan review sebelum perubahan UI/UX dilakukan. Fokusnya hanya frontend: layout, navigasi, tabel, form, drawer, chat, dan Vector Collections. Tidak ada perubahan backend, endpoint, payload, atau data palsu.

## Design Read

Reading this as: internal operational dashboard untuk mengelola Intent, Action, Agent, Vector Collections, dan AI Chat. Arah visual yang cocok adalah quiet enterprise console: padat, jelas, minim dekorasi, dan cepat dipindai.

Recommended design dials:

- `DESIGN_VARIANCE: 4` karena dashboard perlu stabil dan predictable.
- `MOTION_INTENSITY: 2` karena cukup hover, focus, loading, dan transition kecil.
- `VISUAL_DENSITY: 7` karena user bekerja dengan data dan relasi, bukan membaca landing page.

## Non-Goals

- Tidak membuat landing page, hero section, marketing layout, decorative cards, gradient blobs, atau visual showcase.
- Tidak menambah mock data.
- Tidak mengubah endpoint API, Swagger capability map, webhook target, atau payload contract.
- Tidak memindahkan page logic ke `src/App.jsx`.
- Tidak menambah halaman Vectors CRUD sampai read endpoint tersedia.
- Tidak mengubah struktur sidebar secara besar tanpa review.

## Current UI Observations

The current dashboard is already in the right product direction:

- App shell is simple and route-based.
- Sidebar grouping follows the ERD/API scope.
- CRUD pages use shared templates and feature configs.
- Tables, modals, drawers, and unavailable states are real API-aware.
- AI Chat and Vector Collections already use real webhook flows.
- Styling is restrained: dark sidebar, neutral workspace, white panels, blue primary actions, amber warnings, red destructive states.

Main UX gaps worth improving:

- Sidebar hierarchy works, but active and unavailable states could be clearer.
- Page headers are still generic and do not expose page-specific context strongly enough.
- Tables are functional but can be easier to scan.
- Forms are valid but feel like flat field grids, especially for JSON and relation-heavy resources.
- Detail drawer is technically useful but not yet a strong inspection surface.
- AI Chat feels like a technical panel, not yet a polished chat workspace.
- Vector Collections could communicate the upload workflow more clearly.

## Proposed Rework Areas

### 1. App Shell and Sidebar

Goal: make navigation feel like a durable management console.

Possible changes:

- Strengthen active nav treatment with clearer contrast and left accent.
- Distinguish record count, no data, and unavailable endpoint states.
- Improve collapsed sidebar readability at tablet widths.
- Add hover and focus states that are visible but not decorative.
- Keep the existing grouped navigation model.

Primary files:

- `src/templates/components/Sidebar.jsx`
- `src/styles.css`

### 2. Page Header and Status Strip

Goal: make each page communicate where the user is, what data is loaded, and what actions are available.

Possible changes:

- Convert count label into a more informative status pill.
- Add loading state to refresh action.
- Make API status strip more compact and readable.
- Support page-specific secondary context without adding summary card rows.
- Keep headers compact and operational.

Primary files:

- `src/templates/components/PageHeader.jsx`
- `src/styles.css`

### 3. Resource Toolbar and Search

Goal: make filtering and create actions easier to use.

Possible changes:

- Add clear-search button when query is active.
- Show result count for active search.
- Improve placeholder copy per resource.
- Make disabled create action clearer when endpoint is unavailable.

Primary files:

- `src/templates/components/ResourceToolbar.jsx`
- `src/templates/hooks/useResourceCrud.js`
- `src/styles.css`

### 4. Table Scanning

Goal: improve readability for repeated admin work.

Possible changes:

- Sticky table header inside scroll container.
- Stronger primary column hierarchy.
- More readable row hover and selected/inspect affordance.
- Keep row actions quiet until hover or focus.
- Better empty state copy for no rows vs no search result.
- Compact pagination with clearer range text.

Primary files:

- `src/templates/components/ResourceTable.jsx`
- `src/utils/resourceUtils.jsx`
- `src/styles.css`

### 5. Detail Drawer as Inspector

Goal: make drawer useful before opening edit mode.

Possible changes:

- Add resource-specific summary at the top.
- Show capability chips for read, update, and delete.
- Keep raw JSON payload, but make it collapsible or visually secondary.
- For Actions, show target relation summary more prominently.
- For Intents, show selected Action summary.
- For Agents and External Data, emphasize host and protocol fields.

Primary files:

- `src/templates/components/DetailDrawer.jsx`
- `src/utils/resourceUtils.jsx`
- `src/styles.css`

### 6. Form Modal Rework

Goal: reduce form mistakes and make relation-heavy CRUD easier.

Possible changes:

- Group fields by purpose: Identity, Target, Request, Payload.
- Make Action forms feel guided by `action_type`.
- Keep non-selected Action target fields cleared before submit.
- Improve JSON field presentation with stronger validation state.
- Add sticky modal action footer for long forms.
- Preserve labels above inputs and no placeholder-as-label.

Primary files:

- `src/templates/components/ResourceModal.jsx`
- `src/templates/components/FormField.jsx`
- `src/features/actions/config.js`
- `src/styles.css`

### 7. Intent -> Action -> Target Flow View

Goal: help users understand the actual chatbot configuration relationship, not only raw tables.

Possible changes:

- Add a secondary view on Intents or Actions.
- Show compact relation rows: Intent -> Action -> Target.
- Allow inspect/edit from the flow row.
- Keep the table as the default or primary data view unless review decides otherwise.

Primary files:

- `src/features/intents/Page.jsx`
- `src/features/actions/Page.jsx`
- `src/utils/resourceUtils.jsx`
- `src/styles.css`

### 8. AI Chat Workspace

Goal: make chat testing feel intentional and readable.

Possible changes:

- Add a proper empty state when no messages exist.
- Improve user and assistant message hierarchy.
- Replace pending text with a skeleton or typing-style loading bubble.
- Move Session ID into a compact session utility bar.
- Make reset chat action visually separate from normal refresh.
- Keep the existing webhook payload contract.

Primary files:

- `src/features/ai-chat/Page.jsx`
- `src/features/ai-chat/chatStore.js`
- `src/styles.css`

### 9. Vector Collections Workflow

Goal: make knowledge upload steps clearer.

Possible changes:

- Present flow as Select Collection -> Choose Input -> Upload -> Result.
- Make collection picker the first clear step.
- Make Text/PDF segmented control clearer.
- Improve PDF dropzone and selected-file state.
- Improve upload result panel and inline warning copy.
- Keep POST-only UI and do not expose PUT sync by default.

Primary files:

- `src/features/vector-collections/Page.jsx`
- `src/features/vector-collections/components/VectorCollectionPanel.jsx`
- `src/styles.css`

### 10. Visual System Cleanup

Goal: make CSS easier to maintain and more consistent.

Possible changes:

- Add semantic CSS tokens in `:root`.
- Reduce repeated hardcoded colors.
- Keep radius scale at 8px for panels, controls, tables, modals, and drawers.
- Improve focus rings and button contrast.
- Add reduced motion handling for transitions.
- Keep lucide icons because the project already depends on `lucide-react`.

Primary files:

- `src/styles.css`

## Recommended Phases

### Phase 1: Foundation Polish

Scope:

- CSS tokens.
- Buttons, focus states, hover states.
- Sidebar active and unavailable states.
- Page header and status strip polish.

Why first:

- Low risk.
- Affects the whole app.
- Does not touch resource behavior.

### Phase 2: Table and Drawer

Scope:

- Sticky table headers.
- Better row hierarchy.
- Improved empty states.
- Detail drawer as inspector.

Why second:

- High daily UX impact.
- Still mostly shared components.

### Phase 3: Workflow Pages

Scope:

- AI Chat workspace remake.
- Vector Collections workflow remake.
- Optional Intent -> Action -> Target flow view.

Why third:

- Most visible product improvement.
- Needs more review because page-specific UX decisions are involved.

### Phase 4: Form Experience

Scope:

- Grouped modal fields.
- Better JSON validation presentation.
- Improved relation field UX.
- Sticky modal action footer.

Why fourth:

- Higher risk because forms are tied to payload correctness.
- Best done after visual foundation is stable.

## Review Questions

1. Should the first pass be broad polish across the whole app, or one feature page remake first?
2. Should the table remain the primary default view for Intents and Actions?
3. Should the Intent -> Action -> Target flow view be added as a tab, a secondary panel, or a separate route?
4. Should AI Chat look more like a chat app, or stay closer to a test console?
5. Should Vector Collections be presented as a step workflow, or keep the current compact board layout?

## Acceptance Criteria

Any selected rework should satisfy:

- No backend or API contract changes.
- No fake client-side records.
- `App.jsx` remains a shell/router.
- Feature-specific layout stays in feature folders.
- Shared templates remain reusable and not over-specialized.
- Unsupported operations remain disabled and clearly explained.
- Tables remain dense enough for operational use.
- Forms preserve validation and payload preparation behavior.
- UI remains responsive on desktop, tablet, and mobile.
- `npm run build` passes before handoff for code changes.

