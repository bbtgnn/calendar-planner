# Skipped lesson kind (session marker) - design spec

**Status:** Approved for implementation planning  
**Date:** 2026-04-21  
**Scope:** Add a third lesson/session kind to mark planned weekly sessions that did not happen.

## Purpose

Teachers often have recurring weekly lessons, but occasional dates are canceled.  
The product needs a first-class way to record "this session was skipped" without counting it as a planned/done lesson and without adding hours.

## Confirmed decisions

- Introduce a third `sessionKind`: `skipped`.
- Keep skipped entries in the same chronological session table (mixed with class/extra rows).
- Reuse the existing `title` field as the skip reason (no dedicated `skipReason` column).
- Skipped sessions always have `durationHours = 0`.
- Skipped sessions do not count toward planned/done lesson metrics.
- Skipped sessions have no attendance.

## Domain rules

### Session kinds

`LessonSessionKind` becomes:

- `class`
- `extra`
- `skipped`

### Skipped invariants

- A skipped row always persists with `durationHours = 0`.
- Reason text is stored in `title`.
- Done status is non-meaningful for skipped rows and must not affect metrics.
- Attendance is not applicable to skipped rows.

### State transitions

- Create as skipped:
  - Persist kind `skipped`.
  - Force `durationHours = 0` regardless of form input.
- Switch existing row to skipped:
  - Coerce/persist `durationHours = 0`.
  - Remove attendance records for that lesson in the same transaction.
- Switch skipped to class/extra:
  - Row becomes editable for hours again.
  - User sets the non-zero hours explicitly (or accepts default form value).

## UX behavior

### Add session form

- `Kind` dropdown adds `Skipped`.
- When `Skipped` is selected:
  - Hours input is auto-set to `0`.
  - Hours input is disabled/read-only.
  - Title label becomes "Reason".
- Add action creates a normal lesson row with `sessionKind = 'skipped'`.

### Sessions table

- Keep one chronological list/table for all kinds.
- Show a dedicated `Skipped` badge for skipped rows.
- Hours column always shows `0` for skipped rows.
- Title column shows reason text.
- Done checkbox is hidden or disabled for skipped rows.

### Lesson detail page

- Kind selector adds `Skipped`.
- Changing kind to skipped:
  - Hours snap to `0`.
  - Attendance section is replaced with a message that skipped sessions do not have attendance.
- Changing away from skipped re-enables hour editing.

## Data and persistence

### Schema impact

- No new table.
- No new lesson column.
- Extend `LessonSessionKind` union with `'skipped'`.
- Existing rows are forward-compatible without migration backfill data.

### Repository rules (source of truth)

- `createLesson(...)`: if kind is skipped, save `durationHours = 0`.
- `updateLesson(...)`: if patch sets kind to skipped, save `durationHours = 0` and clear absences for that lesson in one transaction.
- Hardening: if a duration patch is applied to an already skipped row, persist `0`.

## Metrics contract

- `scheduledLessonCount` and `doneLessonCount` remain class-only.
- `scheduledExtraSessionCount` and `doneExtraSessionCount` remain extra-only.
- Skipped rows contribute to neither class nor extra lesson counts.
- Hour totals can continue summing all lessons because skipped is guaranteed to contribute zero.

## Error handling

- If attendance cleanup fails while switching to skipped, fail the update atomically and show a clear save error.
- UI should avoid silent fallback states where a row displays skipped but still has attendance data.

## Testing requirements

- Repository tests:
  - Create skipped persists `0` hours.
  - Update to skipped coerces to `0`.
  - Update to skipped clears existing absences atomically.
  - Attempted hour update on skipped remains `0`.
- Stats tests:
  - Skipped rows do not affect class/extra done/scheduled counts.
- UI tests:
  - Add form behavior for skipped (hours lock at 0, reason label).
  - Sessions table shows skipped badge and non-interactive done control.
  - Lesson detail hides attendance for skipped.

## Out of scope

- Separate skip reason field.
- New "skipped analytics" dashboards.
- Recurrence engine changes.
- Backup/sync changes.

## Implementation notes for planning phase

- Prefer repository-enforced invariants over UI-only checks.
- Keep UI copy explicit: "Skipped sessions are markers and do not count as planned lessons."
- Preserve existing class/extra behaviors unchanged except where skipped transitions intersect.
