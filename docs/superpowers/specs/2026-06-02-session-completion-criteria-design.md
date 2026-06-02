# Session completion criteria & Done column — design spec

**Date:** 2026-06-02  
**Status:** Approved (brainstorming)  
**Extends:** [Session screenshots & revised “done”](./2026-06-01-session-screenshots-design.md), [Lesson notes drive “done”](./2026-05-24-lesson-notes-done-design.md)

## Problem

**Done** today means a past class/extra session has a note for its date and a paired `*-screen.png`. Teachers also record attendance in `presenze.csv` (column per lesson stem). The UI shows a single ✓ or a screenshot ⚠, and screenshot preview is toggled by clicking the whole table row — which conflicts with scanning the row and with showing **per-criterion** progress.

## Goals

1. **Pluggable completion criteria** — code registry (`SESSION_CRITERIA`) so new checks can be added without redesigning the Done column.
2. **Three initial criteria** — lesson note (`.md`), paired screenshot (`*-screen.png`), attendance column in `presenze.csv` (class sessions only).
3. **Done column UX** — for past non-skipped sessions: one **muted/primary** Lucide icon per applicable criterion; when **all** applicable criteria are satisfied, show a **single green ✓** instead of separate icons.
4. **Screenshot preview** — toggle from the **Actions** column (icon button), not row click.
5. **Same scan lifecycle** — class load + **Refresh from folder**; no filesystem watch.
6. **Consistent `done`** — derived boolean drives stats, semester dots, flush to `planner.json`, and lesson detail.

## Non-goals

- Uploading or editing notes, screenshots, or CSV from the app (read-only).
- Matching `presenze` columns by session date (only by note **stem**).
- Attendance criterion for `extra` or `skipped` sessions.
- Criteria icons or “done” state for **future** sessions (still `—`).
- Per-class manifest file to enable/disable criteria (registry in code only for now).
- Global warnings list entries for missing attendance columns (row-level icons only).
- Replacing in-app Dexie attendance with CSV as source of truth.

## Decisions (brainstorming)

| Topic | Choice |
|--------|--------|
| Approach | Code registry + enrich pipeline (**Approach 1**) |
| Registry shape | `SESSION_CRITERIA: CriterionDef[]` (plain `id: string`) |
| Icons | `@lucide/svelte` — `FileText`, `Image`, `Users`; `icon: typeof Icon` |
| Presenze path | Class folder root: `presenze.csv` |
| CSV layout | Row 0 = headers (stems); column 0 = student names |
| Presenze column key | Note stem (`09` from `09.md`) |
| Presenze satisfied | Header `stem` exists **and** ≥1 non-empty cell in that column |
| Criteria by kind | `class`: note + screenshot + attendance; `extra`: note + screenshot; `skipped`: `—` |
| Future sessions | `—` (no criterion icons, `done: false`) |
| Hours mismatch | **Warning only** — ⚠ when `hoursWarning` set, whether or not session is done |
| Screenshot preview | Actions column icon button; remove row `onclick` expand |
| Supersedes | Screenshot spec Done column (✓ + ⚠) and row-click expand |

## Criterion catalog

```ts
import type { Icon } from '@lucide/svelte';
import { FileText, Image, Users } from '@lucide/svelte';

type CriterionDef = {
  id: string;
  label: string;
  icon: typeof Icon;
  appliesTo: (kind: LessonSessionKind) => boolean;
};

export const SESSION_CRITERIA: CriterionDef[] = [
  {
    id: 'note',
    label: 'Lesson note',
    icon: FileText,
    appliesTo: (k) => k === 'class' || k === 'extra'
  },
  {
    id: 'screenshot',
    label: 'Screenshot',
    icon: Image,
    appliesTo: (k) => k === 'class' || k === 'extra'
  },
  {
    id: 'attendance',
    label: 'Attendance',
    icon: Users,
    appliesTo: (k) => k === 'class'
  }
];
```

Evaluators live next to the registry (e.g. `evaluateSessionCriteria(ctx, lesson, matchSlice)`). Adding criterion #4 = new `CriterionDef` + evaluator branch + tests.

## Per-criterion rules

| `id` | Applies to | Satisfied when |
|------|------------|----------------|
| `note` | `class`, `extra` | Valid `.md` for session **date** in `lezioni/` or `extra/` (existing frontmatter match) |
| `screenshot` | `class`, `extra` | `{stem}-screen.png` exists in same folder as matched note (`stem` = note basename without `.md`) |
| `attendance` | `class` only | `presenze.csv` has column header equal to `stem` and ≥1 non-whitespace value in that column below the header row |

**Stem source:** from the **first** note matched for the session date (same as duplicate-date / hours-warning behavior). If there is no note, `stem` is unknown → `screenshot` and `attendance` are not satisfied.

**Past vs future** (session `date` vs today UTC ISO calendar date):

| | `criteria` shown | `done` |
|---|------------------|--------|
| Future | No (`—` in UI) | `false` |
| Past, skipped | No (`—`) | `false` |
| Past, not skipped | Yes (icons or ✓) | `true` iff every applicable criterion satisfied |

When folder not linked or read permission missing (`notesScanned: false`), do not set `criteria`; `done` stays `false` for class/extra (unchanged pre-scan behavior).

## Derived `done`

```ts
done =
  isPast(date) &&
  sessionKind !== 'skipped' &&
  applicableCriteria.every((c) => c.satisfied);
```

`applicableCriteria` = entries in `SESSION_CRITERIA` where `appliesTo(sessionKind)` is true, evaluated against scan context.

## Types

```ts
type CriterionStatus = { id: string; satisfied: boolean };

type EnrichedLesson = LessonRow & {
  criteria?: CriterionStatus[];
  matchedNote?: MatchedNoteRef;
  screenshotRef?: ScreenshotRef;
  hoursWarning?: LessonHoursWarning;
  done: boolean;
};
```

**Remove** `screenshotMissing` and `doneColumnTooltip` driven by it. Tooltips come from criterion `label` plus path hints (e.g. `lezioni/09.md`, `09-screen.png`, `presenze.csv` column `09`).

## On-disk layout

```
{class-folder}/
  planner.json
  presenze.csv          # row 0: stems; col 0: student names
  lezioni/
    09.md
    09-screen.png
  extra/
    02.md
    02-screen.png
```

## Architecture

| Piece | Responsibility |
|--------|----------------|
| `package.json` | Add `@lucide/svelte` |
| `src/lib/sessionCompletion/types.ts` | `CriterionDef`, `CriterionStatus`, `CompletionContext` |
| `src/lib/sessionCompletion/criteria.ts` | `SESSION_CRITERIA`, `evaluateSessionCriteria` |
| `src/lib/sessionCompletion/presenze.ts` | `parsePresenzeCsv(text) → Map<stem, boolean>` |
| `src/lib/sessionCompletion/presenze.test.ts` | Parser tests |
| `src/lib/lessonNotes/enrich.ts` | Read `presenze.csv` once; build `CompletionContext` |
| `src/lib/lessonNotes/match.ts` | Set `criteria`, `done`, refs; drop `screenshotMissing` |
| `src/lib/lessonNotes/types.ts` | Extend `EnrichedLesson`; remove `screenshotMissing` |
| `src/routes/class/[classId]/+page.svelte` | Done column icons / ✓; Actions preview button |
| `src/routes/class/[classId]/lesson/[lessonId]/+page.svelte` | Criteria checklist + done line |
| `README.md` | Document criteria, `presenze.csv`, Done column behavior |

**`CompletionContext`** (built once per enrich): `todayIso`, note indexes, screenshot sets, `presenzeByStem: Map<string, boolean>`, `notesScanned`.

## UI

### Sessions table — Done column

- **Skipped** → `—`
- **Future** → `—`
- **Past**, `notesScanned`, not skipped:
  - **All applicable criteria satisfied** → green **✓** (`title`: e.g. “All complete”)
  - **Otherwise** → one Lucide icon per applicable criterion (registry order):
    - satisfied → `primary` token / class
    - not satisfied → `muted`
    - `title` / `aria-label`: `{label}: present` or `{label}: missing` (+ path hint)
  - **`hoursWarning`** → ⚠ beside ✓ or beside criterion icons (does not block ✓)

### Sessions table — Actions column

- **Open** / **Delete** unchanged.
- When `screenshotRef` is set: icon button (e.g. `Image` from Lucide, or dedicated control) with `aria-label="Show screenshot"`, `aria-expanded` tied to expand state.
- Toggle inserts/removes **screenshot detail** row below (same lazy load via File System Access API, revoke object URLs on collapse/unmount).
- **No** `onclick` on the main data `<tr>`; remove `row-expandable` / row-level `aria-expanded`.

### Lesson detail page

- Read-only checklist: applicable criteria with icons (muted/primary) and short labels.
- Summary line: done only when all applicable criteria satisfied (past); future → “Scheduled (not yet counted as done)”.

### Semester mini calendars

- `kindDotsDoneByDate` continues to use `lesson.done` — no change beyond enriched `done` definition.

## `presenze.csv` parsing

- Read file at class root during enrich (if handle + read permission).
- **Delimiter:** comma (RFC-style CSV).
- **Header row:** index 0; stem headers trimmed; column 0 is student name column (not a stem).
- **Stem match:** exact string match to note stem (case-sensitive).
- **Column has data:** at least one body row with non-whitespace in that column index.
- **Missing file:** empty map → all attendance criteria unsatisfied.
- **Parse failure:** empty map + optional `LessonNoteWarning` with `code: 'presenze_parse_error'` in global warnings strip.

## Errors & edge cases

- PNG or CSV changed after scan: preview may fail until **Refresh from folder**; criterion icons reflect last scan.
- Note deleted after scan: refresh updates criteria.
- Duplicate notes for one date: first note defines stem for screenshot + attendance.
- Orphan `presenze` columns (no matching session/note): no row UI (non-goal to warn globally).
- Read permission revoked: same as notes — no scan until reconnect.

## Testing (Vitest)

**`presenze.ts`**

- Headers `09`, `10`; column `09` has one filled cell → `09` true, `10` false if empty.
- Missing column for stem → false.
- Malformed CSV → parse error warning or empty map (per implementation choice in plan).

**`match.ts` / criteria**

- Class past: note + png + presenze → all satisfied, `done: true`.
- Class past: note + png, no presenze column → not done, three icons (or two satisfied + one muted).
- Extra past: note + png → done; no attendance in criteria list length.
- Future with all files on disk → `done: false`, no `criteria` in UI terms (enrich may omit or UI ignores).
- Skipped → no criteria, not done.
- No note → note/screenshot/attendance unsatisfied for class.

**UI (optional)**

- All satisfied → only ✓ visible.
- Partial → N icons, no ✓.
- Actions preview toggles detail row; Open does not toggle.

## Verification (manual)

1. Past class session: `09.md`, `09-screen.png`, `presenze.csv` column `09` with data → green ✓ only.
2. Missing PNG → Image icon muted; no ✓.
3. Missing presenze column → Users muted.
4. Extra session with note + png → ✓ (two criteria only).
5. Future session with files on disk → `—` in Done.
6. Actions **Show screenshot** expands image; row click does nothing.
7. Refresh after adding presenze column → Users turns primary / ✓ appears when all met.

## Amendment to prior specs

- [2026-06-01-session-screenshots-design.md](./2026-06-01-session-screenshots-design.md): Done column ⚠ for `screenshotMissing` and **row-click** preview are **superseded** by this spec.
- [2026-05-24-lesson-notes-done-design.md](./2026-05-24-lesson-notes-done-design.md): Done is no longer “note only”; see criteria table above.
