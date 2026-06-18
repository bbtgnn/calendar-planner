# Session preview: note text + screenshot — design spec

**Date:** 2026-06-18  
**Status:** Approved (brainstorming)  
**Extends:** [Session screenshots](./2026-06-01-session-screenshots-design.md), [Session completion criteria](./2026-06-02-session-completion-criteria-design.md)

## Problem

The sessions table expand control (image icon in **Actions**) shows only the paired PNG screenshot. Teachers often want to read the lesson note body without leaving the list. The markdown body (content after YAML frontmatter) is not surfaced anywhere in the planner UI today.

## Goals

1. **Note text in expand row** — when expanded, show the matched note’s body as **plain text** (markdown source, no HTML rendering), with frontmatter stripped.
2. **Layout** — note block on top, screenshot below (when each is available).
3. **Expand when note or screenshot exists** — enable the preview button if `matchedNote` **or** `screenshotRef` is set (not screenshot-only).
4. **Empty body** — if the file has frontmatter but no body content, show muted placeholder: “No note content”.
5. **Same load lifecycle as screenshots** — lazy load on expand via File System Access API; no scan-time body caching.

## Non-goals

- Rendering markdown to HTML (no new markdown dependency).
- Editing notes from the preview row.
- Changing done / completion criteria logic.
- Preloading note bodies during folder scan or enrich.
- Changing the Lucide icon (keep `Image`).

## Decisions (brainstorming)

| Topic | Choice |
|--------|--------|
| Approach | Mirror screenshot loading: `stripNoteBody` + `loadNoteBody` parallel to existing screenshot helpers |
| Note display | Plain text in `<pre>`, monospace, `pre-wrap` |
| Layout | Note top, screenshot below; full width stacked |
| Expand enabled | `matchedNote \|\| screenshotRef` |
| Empty note body | Muted “No note content” |
| Button `aria-label` | “Show session preview” |
| Detail row class | Rename `screenshot-detail` → `lesson-preview-detail` |

## Architecture

### New utilities

**`stripNoteBody(text: string): string`** in `src/lib/lessonNotes/parseFrontmatter.ts`

- Reuse existing `FRONTMATTER_RE` (`^---\n...\n---`).
- If frontmatter matches: return trimmed text after the closing `---`.
- If no frontmatter: return full `text.trim()` (consistent with tolerant read behavior).

**`loadNoteBody(classId, ref: MatchedNoteRef)`** in `src/lib/lessonNotes/loadNoteBody.ts`

- Same permission and path resolution as `loadScreenshotObjectUrl` (`getFolderHandle`, `hasFolderPermission`, `ref.folder/ref.fileName`).
- Read file as text, apply `stripNoteBody`, return `{ ok: true, body }` or `{ ok: false, message }`.
- Error messages: `"Folder not available"`, `"Could not load note"`.

### UI state (`+page.svelte`)

Replace screenshot-only `imageByLesson` with per-lesson **preview** state:

```ts
type LessonPreviewState = {
  note?: { body?: string; loading?: boolean; error?: string };
  image?: { url?: string; loading?: boolean; error?: string };
};
```

- `toggleExpand`: no-op if neither `matchedNote` nor `screenshotRef`; otherwise toggle expand set.
- On expand: start `loadNoteBody` and/or `loadScreenshotObjectUrl` in parallel (skip missing refs).
- On collapse: revoke object URL for that lesson; remove preview entry from state.
- On unmount / `refreshNotesFromFolder`: revoke all URLs and clear preview state (existing pattern).

### UI layout

Detail row when `expanded.has(lesson.id)` and (`matchedNote` or `screenshotRef`):

1. **Note block** (only if `matchedNote`):
   - Loading → “Loading note…”
   - Error → warn text
   - Success, empty `body` → “No note content” (muted)
   - Success, non-empty → `<pre class="note-body">{body}</pre>`

2. **Screenshot block** (only if `screenshotRef`):
   - Unchanged loading / error / `<img>` behavior from current implementation.

**CSS**

- `.note-body`: monospace, `white-space: pre-wrap`, `word-break: break-word`, light background `#f6f8fb`, padding, border-radius, `max-height: 40vh`, `overflow-y: auto`.
- `.lesson-preview-detail img`: keep `max-width: 100%`, `max-height: 70vh`.
- Gap between note and image when both present.

## Error handling

| Condition | Behavior |
|-----------|----------|
| Folder not linked / no read permission | Per-block error: “Folder not available” |
| File missing or read failure | Per-block error: “Could not load note” / “Could not load screenshot” |
| One ref missing | Show only the available block; no error for absent ref |
| Note load fails, screenshot succeeds | Note shows error; image still renders below |

Loads are independent; partial preview is valid.

## Files

| File | Change |
|------|--------|
| `src/lib/lessonNotes/parseFrontmatter.ts` | Add `stripNoteBody` |
| `src/lib/lessonNotes/parseFrontmatter.test.ts` | Unit tests for `stripNoteBody` |
| `src/lib/lessonNotes/loadNoteBody.ts` | New loader |
| `src/routes/class/[classId]/+page.svelte` | Preview state, expand rules, detail row UI, CSS |

No changes to `enrich.ts`, `match.ts`, or `scanFolder.ts`.

## Testing

### Unit (`parseFrontmatter.test.ts`)

- Strips frontmatter and returns trimmed body.
- Empty body after frontmatter → `""`.
- File without frontmatter → full trimmed text.

### Unit (`loadNoteBody`)

- Happy path: returns body without frontmatter (mock filesystem or shared read helper if extracted).
- Missing file → `{ ok: false }`.

### Manual smoke

- Note + screenshot: text on top, image below.
- Note only (no PNG): text only; button enabled.
- Screenshot only (no `matchedNote`): image only; button enabled.
- Empty note body: “No note content”.
- Collapse and re-expand: loads again; no leaked object URLs.

## Success criteria

- Expanding a session with a matched note shows readable plain-text body without frontmatter.
- Screenshot still appears below when `screenshotRef` exists.
- Preview button works when only note or only screenshot is available.
- No new npm dependencies; `bun run check` and `bun run test` pass.
