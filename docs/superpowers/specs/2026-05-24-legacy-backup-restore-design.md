# Legacy backup restore — design spec

**Date:** 2026-05-24  
**Status:** Approved (brainstorming)  
**Scope:** One-off utility page at `/restore` — **intentionally disposable** after migration is complete.

## Problem

The teacher has a legacy JSON backup (`lesson-planner-legacy-backup-*.json`) exported from an earlier version of the app. The current browser-only app stores data in Dexie (IndexedDB) and has no import path. Data must be restored once, then this page can be deleted.

## Goals

1. Provide a hidden route `/restore` (no header nav link) with a button to pick a `.json` backup file.
2. **Replace all** IndexedDB data with the backup contents after user confirmation.
3. Show a brief summary (class/lesson/student/absence counts) before restore.
4. On success, redirect to `/` with a toast.

## Non-goals

- Export / backup creation.
- Merge mode or conflict resolution.
- Separate reusable module (`src/lib/backup/…`) — logic lives inline in the page file.
- Unit tests for the restore logic (one-off page; delete after use).
- Nav link or discoverability in the main UI.
- Long-term support for multiple backup format versions.

## Backup format (legacy)

Top-level JSON object with four arrays:

```json
{
  "classes": [...],
  "students": [...],
  "lessons": [...],
  "absences": [...]
}
```

**Known differences from current schema:**

- Lessons may include `recordStatus` (e.g. `"recorded"`) — **strip** on import; not stored in current `LessonRow`.
- Optional fields may be missing on older rows — apply defaults matching current Dexie v3 schema.

**Reference backup:** `lesson-planner-legacy-backup-2026-05-24.json` — 2 classes, ~40 lessons, empty students/absences.

## Page & user flow

**File:** `src/routes/restore/+page.svelte` (all logic inline)

**Route:** `/restore` — not linked from `src/routes/+layout.svelte`.

**UI elements:**

1. Warning text: restore replaces **all** data in this browser; cannot be undone.
2. Hidden `<input type="file" accept=".json,application/json">` + **Choose backup file** button.
3. After valid parse: summary line (e.g. “2 classes, 40 lessons, 0 students, 0 absences”).
4. **Restore** button (enabled only when a valid backup is loaded).
5. Inline error area for validation failures.

**Interaction:**

1. User clicks **Choose backup file** → native file picker.
2. Page reads file as text, `JSON.parse`, validate shape.
3. If invalid → show error, do not enable Restore.
4. If valid → show summary, enable Restore.
5. User clicks **Restore** → `window.confirm("Replace all data with this backup? This cannot be undone.")`.
6. On confirm → Dexie transaction (see below).
7. On success → `clearLastClassId()`, toast “Backup restored”, `goto('/')`.
8. On failure → toast / inline error; existing data unchanged (transaction rollback).

## Import logic (inline in page)

### Validation (before any write)

- Top-level object has `classes`, `students`, `lessons`, `absences` as arrays.
- Each class row: `id`, `name`, `totalHoursTarget`, `createdAt` required; default `requiredStudentLessonHours` to `0`, `semesterStart`/`semesterEnd` to `null` if missing.
- Each student row: `id`, `classId`, `name` required.
- Each lesson row: `id`, `classId`, `date`, `durationHours`, `title`, `done` required; default `sessionKind` to `'class'` if missing; omit `recordStatus` and any other unknown keys.
- Each absence row: `id`, `lessonId`, `studentId` required.
- FK checks: every `student.classId` and `lesson.classId` exists in `classes`; every `absence.lessonId` exists in `lessons`, every `absence.studentId` exists in `students`.

Return a typed error message string on failure (shown inline).

### Write (single Dexie transaction)

Using `db` from `$lib/db/client`:

1. `db.transaction('rw', db.classes, db.students, db.lessons, db.absences, async () => { … })`
2. Clear all four tables: `clear()` on each.
3. `bulkAdd` validated rows preserving original IDs.
4. After transaction commits: `clearLastClassId()` from `$lib/preferences/activeClass`.

If the transaction throws, Dexie rolls back — no partial state.

## Error messages (user-facing)

| Condition | Message |
|-----------|---------|
| Invalid JSON | “Could not read file — not valid JSON.” |
| Wrong shape | “Not a valid backup file — expected classes, students, lessons, and absences.” |
| FK failure | “Backup has invalid references — restore cancelled.” |
| Dexie error | “Restore failed — your existing data was not changed.” |

## Styling

Match existing app patterns from `+layout.svelte`: system font, `#f6f7f9` background, simple `.btn` buttons, muted helper text. No new shared components.

## Cleanup (after migration)

When the teacher confirms data is restored and verified:

1. Delete `src/routes/restore/+page.svelte`.
2. Optionally delete this spec or mark it archived.

## Verification (manual)

1. Open `/restore` in dev (`bun run dev`).
2. Pick `lesson-planner-legacy-backup-2026-05-24.json`.
3. Confirm summary shows 2 classes, ~40 lessons.
4. Click Restore, confirm dialog.
5. Land on `/` with both classes visible in switcher; lessons appear on each class schedule.
6. Refresh page — data persists in IndexedDB.
