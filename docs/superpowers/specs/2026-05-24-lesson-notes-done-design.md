# Lesson notes drive “done” status — design spec

**Date:** 2026-05-24  
**Status:** Approved (brainstorming)  
**Extends:** [Per-class file storage](./2026-05-24-per-class-file-storage-design.md), [Lesson planner](./2026-04-20-lesson-planner-design.md)

## Problem

Teachers mark sessions **Done** manually in the app, but real completion is evidenced by markdown lesson notes on disk (`lezioni/`, `extra/`). Manual flags drift from reality (e.g. `done: true` in `planner.json` while hours in the note file disagree with the schedule).

## Goals

1. **Derived done** — for `class` and `extra` sessions, **done** means a valid note file exists for that session’s **calendar date** in the correct folder.
2. **Hour mismatches are warnings only** — `durata` ≠ planner `durationHours` still counts as done; surface a warning.
3. **Warnings list** — orphans, duplicate note dates, parse errors, hour mismatches in one summary strip on the class page.
4. **Scan on class open** + **Refresh from folder** (no global scan on startup; no filesystem watch).
5. **UI:** mini semester calendars show **done** visually on dots; sessions table highlights the **upcoming** session.

## Non-goals

- Creating or editing `.md` from the app.
- Matching by filename (`01.md`); only frontmatter `data` / `durata`.
- File-based done for `skipped` sessions.
- Reading `data.yaml`, `presenze.csv`, or other side files for done.
- Auto-updating planner hours from note `durata`.
- Watching folders for external changes (refresh is explicit or on class load).

## Decisions (brainstorming)

| Topic | Choice |
|--------|--------|
| Done criterion | Note exists for session **date** (not exact hours) |
| Hours | Mismatch → **warning**, still **done** |
| Folders | `lezioni/` → `class`; `extra/` → `extra` |
| Note format | YAML frontmatter: `data: DD/MM/YYYY`, `durata: <number>` |
| `done` in JSON | **Derived only**; UI does not toggle; flush may write derived values for git readability |
| Scan timing | **Class load** + **Refresh from folder** |
| Orphans / duplicates | **Warnings list** only (no separate orphan page) |

## On-disk layout

Per linked class directory (File System Access API):

```
{class-folder}/
  planner.json
  lezioni/*.md      # class sessions
  extra/*.md        # extra / 1:1
```

Example frontmatter:

```yaml
---
data: 09/03/2026
durata: 4.5
---
```

- `data` is parsed as Italian calendar date → ISO `YYYY-MM-DD` (UTC convention, same as semester map).
- Missing subfolder → empty set (no error).

## Matching rules

| `sessionKind` | Folder | Done when |
|---------------|--------|-----------|
| `class` | `lezioni/` | ≥1 valid `.md` with `data` = session `date` |
| `extra` | `extra/` | Same |
| `skipped` | — | Always not done; no file scan |

**Per session row**

- `doneDerived: boolean` from date match.
- `hoursWarning?: { plannerHours, noteHours, fileName, folder }` when done and `durata !== durationHours`.

**Warnings (global list, not per row only)**

| Code | Example message |
|------|------------------|
| `hours_mismatch` | Hours: planner 5h vs lezioni/01.md 4.5h (2026-03-09) |
| `duplicate_date` | Duplicate notes for 2026-04-27 in lezioni/ |
| `orphan_note` | Orphan note: lezioni/old.md dated 2026-02-01 (no matching session) |
| `parse_error` | Could not parse lezioni/broken.md (missing data:) |

- Duplicate dates in one folder: session still **done**; add `duplicate_date` warning.
- Orphan: file date matches no session of **that folder’s kind** (`lezioni` ↔ class only, `extra` ↔ extra only).

## Architecture (recommended)

**Scan module + enrich at class load** (not in components, not synced as user-editable state).

| Module | Responsibility |
|--------|----------------|
| `src/lib/lessonNotes/parseFrontmatter.ts` | Parse `data`, `durata`; IT date → ISO |
| `src/lib/lessonNotes/scanFolder.ts` | List `.md` in a subdir via directory handle |
| `src/lib/lessonNotes/match.ts` | `matchNotesToLessons(lessons, classNotes, extraNotes)` → enriched lessons + `warnings[]` |
| `src/lib/persistence/classFolder.ts` | Reuse read access to class root |
| `src/routes/class/[classId]/+page.ts` | After `listLessons`, scan + return `{ lessons, noteWarnings, upcomingLessonId(s) }` |
| `src/lib/logic/stats.ts` | Unchanged; callers pass lessons with **derived** `done` |
| `src/lib/application/lessons.ts` | Reject or ignore `done` in patches for `class` / `extra` |

**Types (load / UI)**

```ts
type LessonNoteWarning = {
  code: 'hours_mismatch' | 'duplicate_date' | 'orphan_note' | 'parse_error';
  message: string;
  lessonId?: string;
  dateIso?: string;
};

type EnrichedLesson = LessonRow & {
  done: boolean; // derived for class/extra; false for skipped
  hoursWarning?: { plannerHours: number; noteHours: number; fileName: string; folder: 'lezioni' | 'extra' };
};
```

Dexie may still store legacy `done` on `LessonRow`; enrich **overwrites** `done` in the load result for `class` / `extra` only.

## Lifecycle

1. User opens `/class/[id]` → load lessons from Dexie → read `lezioni/` + `extra/` from linked handle → enrich → render.
2. User clicks **Refresh from folder** → invalidate `classLessonsLoadKey` → repeat scan.
3. User edits `planner.json` / lessons via app → flush unchanged except optional derived `done` on serialize (implementation detail in plan).

## UI

### Warnings strip

- Below class title or above sessions table: `<ul>` of warning messages.
- **Refresh from folder** button beside heading; invalidates class load.

### Sessions table

- Remove Done **checkbox** for `class` / `extra`.
- **Done column:** read-only indicator (e.g. ✓ / —); optional ⚠ when `hoursWarning`.
- **Upcoming session:** among sessions with `sessionKind` `class` or `extra`, find the **earliest** `date` where `date >= today` (UTC ISO, same as `SemesterMap`). Highlight **every row** on that date (multiple sessions same day → all highlighted). If no future/today session, no highlight.
  - Row style: e.g. `tr.upcoming` with left border or soft background; `aria-label` “Upcoming session”.
  - Skipped sessions on that date are **not** used to pick the upcoming date but can appear on the same day if co-scheduled (highlight follows date rule).

### Semester mini calendars (`SemesterMap.svelte`)

Today: kind dots (`class` / `extra` / `skipped`) per day via `uniqueKindsByDate`.

**Add done styling on kind dots** for `class` and `extra` only:

- Pass enriched data: per `isoDate` and kind, whether **all** sessions of that kind on that day are derived-done (if multiple class sessions same day, all must have notes for the day to show “done” dot — OR per-dot per session: prefer **per session** accuracy).
- **Rule:** For each lesson on `cell.isoDate`, if `done` derived, the corresponding kind dot gets class `dot-done` (e.g. filled/solid dot or inner check). If any class session that day is not done, class dot on that day is **not** `dot-done` (or show hollow vs solid).
- **Legend:** add entry “Done (note on disk)” with example `dot class dot-done`.
- Skipped dots unchanged.
- Hour mismatch does **not** change done dot; optional tiny ⚠ on cell `title` if any warning for that date.

### Lesson detail page

- Read-only done + link text to expected folder/file if known.
- No done checkbox.

## `planner.json`

- **Load:** ignore stored `done` for enrichment of `class` / `extra`.
- **Save:** implementation may write derived `done` on flush for backward-compatible git diffs; never from user toggle.

## Testing (Vitest)

- Frontmatter parse: valid IT dates, invalid/missing fields.
- Match: done by date; hours warning; duplicate; orphan; class vs extra folder isolation.
- Upcoming: today, future, past-only, same-day multiple.
- No FSA in unit tests — pure functions with fixture note lists.

## Verification (manual)

1. Class with `lezioni/01.md` matching a session date → session and calendar dot show done.
2. Remove file → refresh → not done.
3. Same date, `durata` 4.5 vs planner 5 → done + warning in list.
4. Orphan `extra/xx.md` → warning only.
5. Two files same date in `lezioni/` → done + duplicate warning.
6. Next future class session row and calendar day visually marked upcoming.
7. Skipped session: no file done; checkbox area N/A as today.

## Relation to file-storage spec

Unchanged: per-class directory handle, `planner.json` hydrate/flush, debounce, setup flow. This spec adds **read-only** scans of subfolders on class load and does not require new files in the picker contract beyond user-created `lezioni/` and `extra/`.
