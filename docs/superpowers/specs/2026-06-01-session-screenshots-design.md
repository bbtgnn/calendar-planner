# Session screenshots & revised “done” — design spec

**Date:** 2026-06-01  
**Status:** Approved (brainstorming)  
**Extends:** [Lesson notes drive “done”](./2026-05-24-lesson-notes-done-design.md), [Per-class file storage](./2026-05-24-per-class-file-storage-design.md)

## Problem

Lesson **done** today means a markdown note exists for the session date. Teachers also keep slide screenshots on disk (`NN-screen.png` paired with `NN.md`). The planner does not surface missing screenshots or let users preview them from the sessions list.

## Goals

1. **Revised done** — for `class` and `extra` sessions, **done** requires **both** a valid note for the session date **and** the paired `*-screen.png` file.
2. **Missing screenshot warning** — in the sessions table **Done** column for **past** non-skipped sessions when the screenshot is missing (including when no note exists yet).
3. **Inline screenshot preview** — when the PNG exists, clicking the session row toggles a **detail row below** showing the image (multiple rows may stay expanded).
4. **Same scan lifecycle as notes** — class load + **Refresh from folder**; no filesystem watch.
5. **Semester map & lesson detail** — use the new `done` definition consistently.

## Non-goals

- Uploading, replacing, or deleting screenshots from the app (read-only).
- Warnings for orphan PNGs (file with no matching note/session).
- Global warnings list entries for missing screenshots (row-level ⚠ only).
- Screenshots for `skipped` sessions.
- Matching screenshots by calendar date in the filename (only paired to note basename).
- Showing ✓ on **future** sessions even if note + PNG already exist on disk.

## Decisions (brainstorming)

| Topic | Choice |
|--------|--------|
| Approach | Extend existing `lessonNotes` enrich pass on class load |
| Done criterion | Note for session date **and** `{stem}-screen.png` where `stem` = note basename without `.md` |
| Warn when | Session date ≤ today (UTC ISO), not `skipped` |
| No note yet | Screenshot treated as missing → warn on past sessions |
| Folders | `lezioni/` (class), `extra/` (extra) — same pairing rule |
| Missing warn UI | **Done** column (⚠ icon + tooltip) |
| Preview UI | Click **data row** toggles expand; **Open** / **Delete** use `stopPropagation` |
| Expanded rows | Multiple allowed at once |
| Image load | Check existence at scan; read bytes + object URL **on expand**; revoke on collapse/unmount |

## On-disk layout

```
{class-folder}/
  planner.json
  lezioni/
    09.md
    09-screen.png
  extra/
    02.md
    02-screen.png
```

**Pairing rule:** for matched note `fileName` `09.md` → expected screenshot `09-screen.png` in the same folder (`lezioni` or `extra`).

## Matching rules

| `sessionKind` | Folder | Done when |
|---------------|--------|-----------|
| `class` | `lezioni/` | Valid `.md` for session `date` **and** paired PNG exists |
| `extra` | `extra/` | Same |
| `skipped` | — | Never done; no screenshot scan |

**Past vs future** (compare session `date` to today’s UTC ISO calendar date):

| | `screenshotMissing` | `done` |
|---|---------------------|--------|
| Future | No | `false` (even if files exist) |
| Past, no note | Yes | `false` |
| Past, note, no PNG | Yes | `false` |
| Past, note + PNG | No | `true` (hours mismatch still ⚠, still done) |

**Duplicate notes for one date:** use the **first** matched note (same as existing hours-warning behavior) to determine `stem` and PNG pairing; emit existing `duplicate_date` warning.

## Architecture

Extend the scan started in `enrichClassLessonsFromFolder` / `matchNotesToLessons`:

| Piece | Responsibility |
|--------|----------------|
| `src/lib/lessonNotes/screenshot.ts` (new) | `screenshotFileNameForNote(noteFileName)`, `pairedScreenshotExists(dirHandle, folder, noteFileName)` |
| `src/lib/persistence/classFolder.ts` | Optional helper: `fileExistsInSubdir(root, subdir, fileName)` |
| `src/lib/lessonNotes/match.ts` | After note match, check PNG; set `done`, `screenshotMissing`, `screenshotRef` |
| `src/lib/lessonNotes/types.ts` | Extend `EnrichedLesson` |
| `src/routes/class/[classId]/+page.svelte` | Done column ⚠; expandable rows; lazy image load |
| `src/routes/class/[classId]/lesson/[lessonId]/+page.svelte` | Read-only done copy |
| `src/lib/lessonNotes/calendarDone.ts` | Consumes enriched `done` (no logic change if `done` already correct) |

**Types**

```ts
type ScreenshotRef = {
  folder: 'lezioni' | 'extra';
  fileName: string; // e.g. 09-screen.png
};

type EnrichedLesson = LessonRow & {
  done: boolean;
  hoursWarning?: LessonHoursWarning;
  screenshotMissing?: boolean; // past, non-skipped, PNG absent
  screenshotRef?: ScreenshotRef;   // PNG present at scan time
};
```

When folder not linked or read permission missing (`notesScanned: false`), enrichment does not set `screenshotMissing` or `screenshotRef`; `done` remains `false` for class/extra (unchanged from pre-scan behavior).

## UI

### Sessions table (`+page.svelte`)

**Done column**

- `skipped` → `—`
- Future → `—` (no ⚠)
- Past, `done` → `✓` (+ existing hours ⚠ if `hoursWarning`)
- Past, `screenshotMissing` → `—` + ⚠ (`warn-icon`)
  - Tooltip: `No note for this date` if no note; else `Missing screenshot (expected lezioni/09-screen.png)` (folder-aware)

**Expandable rows**

- If `screenshotRef` is set: main `<tr>` is clickable (`cursor: pointer`, hover affordance), `aria-expanded` reflects state.
- Toggle adds/removes following `<tr class="screenshot-detail">` with single `colspan` cell and `<img>`.
- **Open** / **Delete**: `onclick` stops propagation.
- Load image on first expand via File System Access API from stored class handle; show inline error text if read fails.
- Multiple lessons may be expanded simultaneously.

### Lesson detail page

- Done line: **Yes** only when note + screenshot; otherwise short text matching list tooltips.

### Semester mini calendars

- `kindDotsDoneByDate` already keys off lesson `done` — no separate change beyond enriched `done`.

### Warnings strip (global note warnings)

- Unchanged; missing screenshots are **not** duplicated in the global list.

## Errors & edge cases

- PNG deleted after scan: expand shows error; user can **Refresh from folder**.
- Revoke all object URLs when rows collapse or component destroys.
- Read permission lost: same as notes — no scan until reconnect.

## Testing (Vitest)

**`match.ts` / screenshot helpers**

- Done only with note + PNG.
- Past, no note → `screenshotMissing`, not done.
- Past, note, no PNG → `screenshotMissing`, not done.
- Future with note + PNG → not done, no `screenshotMissing`.
- Skipped → no flags.
- `extra/` pairing mirrors `lezioni/`.
- `09.md` → expects `09-screen.png`.

**UI (optional, lightweight)**

- ⚠ renders when `screenshotMissing`.
- Row click inserts detail row; action buttons do not toggle.

## Verification (manual)

1. Past class session with `09.md` + `09-screen.png` → ✓, row expands to show image.
2. Note without PNG → ⚠ in Done, not done.
3. Past session with no note → ⚠, not done.
4. Future session with files on disk → no ✓, no ⚠.
5. Extra session in `extra/` with paired files → same as class.
6. Two rows expanded at once; Open still navigates to lesson editor.
7. Refresh after adding PNG on disk → ✓ without app restart.

## Amendment to lesson-notes-done spec

The row “Done criterion | Note exists for session **date**” in [2026-05-24-lesson-notes-done-design.md](./2026-05-24-lesson-notes-done-design.md) is **superseded** by this spec: done requires **note + paired screenshot**, with future sessions never marked done in the UI.
