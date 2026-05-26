# All-classes overview calendar — design spec

**Status:** Approved for implementation planning  
**Date:** 2026-05-26  
**Stack:** SvelteKit, Dexie (IndexedDB) — extends [2026-04-20 lesson planner spec](./2026-04-20-lesson-planner-design.md) and [2026-04-21 semester mini-calendars](./2026-04-21-semester-mini-calendars-design.md)

## Purpose

Teachers who run **multiple classes** need to see **which days are overloaded** when sessions from every class are combined — without switching the class dropdown repeatedly.

This feature adds a dedicated **overview page** with:

1. A **single month calendar** (one month visible at a time) spanning the **union** of all configured class semesters.
2. **“Full day”** highlighting when **≥ 2 lessons** exist on that calendar date across all **included** classes.
3. **On-demand detail** — tapping a full day opens a compact summary (total count + per-class breakdown), without leaving the page.

## Product intent (design discovery)

| Topic | Decision |
|-------|----------|
| Primary goal | Spot **busy days** when schedules from different classes overlap |
| Detail by default | **Binary** — full vs not full; no per-class breakdown until interaction |
| Full-day rule | **≥ 2 lessons total** on that date (any mix of classes) |
| Time horizon | From **earliest** `semesterStart` to **latest** `semesterEnd` among included classes |
| Layout | **One calendar**, navigate month-by-month (not a horizontal multi-month strip) |
| Interaction | **Tap full days** → popover (desktop) / bottom sheet (narrow) with per-class counts |

## Non-goals (v1)

- No editing lessons, semester dates, or class metadata from this page.
- No per-lesson titles or session-kind dots on the overview grid (those remain on per-class semester map and session list).
- No automatic semester inference from lesson dates.
- No unified “overview semester” settings separate from per-class semesters.
- No time-of-day scheduling (date-only, same as rest of app).
- No export, print, or notification workflows.

## Confirmed decisions

- **Route:** **`/overview`** (working title **“Overview”** / Italian copy TBD in implementation).
- **Header nav:** Persistent link in the app header (alongside class switcher), reachable from any class context.
- **Included classes:** Only classes with **both** `semesterStart` and `semesterEnd` set participate in (a) global date span, (b) lesson counting. Others are listed in a helper state with links to their schedule page.
- **Lesson counting:** Every `LessonRow` for an included class on that `date` counts as **1**, regardless of `sessionKind` (`class`, `extra`, `skipped`).
- **Full day:** `totalLessonsOnDate(isoDate) >= 2` across included classes only.
- **Out-of-span cells:** Days in the displayed month that fall **outside** the global `[overviewStart, overviewEnd]` use **muted** styling (reuse semester-map mute pattern); they are not marked full.
- **Per-class semester filter:** A lesson counts only if its `date` falls within **that class’s** inclusive `[semesterStart, semesterEnd]`, even when the overview month grid shows a wider global span. Lessons outside a class’s semester never count (consistent with per-class semester map).
- **Clickable cells:** Only **full** days; 0–1 lesson days are not buttons and do not open the panel.
- **Detail panel content:** Date (long form), total lesson count, list of **class name → count** for that date; optional **“Go to class”** link per row to `/class/[classId]`. No individual lesson titles in v1.
- **Visual — full day:** Light **amber/orange** fill + slightly stronger border; **not** red (red reserved for skipped kind elsewhere). Optional small **“2+”** affordance in addition to color (legend explains). **Today** uses same emphasis pattern as `SemesterMap` (`aria-current="date"`).
- **Month navigation:** Prev/next month controls; disable or hide navigation beyond months intersecting `[overviewStart, overviewEnd]`.
- **Default month on load:** Month containing **today** if today ∈ global span; else **first month** of the span.

## Data and loading

No new Dexie fields or schema version bump.

**Loader payload (conceptual):**

- `classes`: all `ClassRow` records (id, name, semester bounds).
- `lessonsByClassId`: lessons for included classes only (or all classes with client-side filter — implementation may batch-query by class ids).
- Derived on server or client via pure helpers (prefer shared pure functions + unit tests).

**Pure helpers (names illustrative):**

- `overviewSpan(classes)` → `{ start, end } | null` from min start / max end of classes with valid paired semesters; `null` if none qualify.
- `includedClassIds(classes)` → ids with both semester dates set.
- `lessonsOnDate(lessonsByClass, isoDate, classSemesterBounds)` → count + `Map<classId, count>` respecting per-class semester inclusion.
- `isFullDay(count)` → `count >= 2`.
- Reuse existing **Monday-first month grid** builder from semester map where possible.

## UI specification (`/overview`)

### Page shell

- `<h1>` e.g. **“Lesson overview”** (copy can be localized).
- Subtitle: e.g. **“Days with at least 2 lessons across your classes”**.
- When span exists: info line **“From {start} to {end}”** (locale-formatted).
- Card layout consistent with existing `.card` pages.

### Empty and partial states

| State | UI |
|-------|-----|
| No classes | Same guidance as home: use **Create class** in header |
| Zero classes with semester | No calendar; message: set semester start/end on each class; list class names with links to `/class/[id]` |
| Some classes missing semester | Calendar for included classes; discrete note: **“N classes without a semester are not included”** with expandable or simple list of names |
| No full days in current month | Normal calendar; no extra banner |

### Month calendar

- Weekday header: **Monday first** (match `SemesterMap`).
- 6×7 grid per month.
- Cell states: **normal**, **full**, **muted** (outside global span), **today** (combinable with normal/full).
- `aria-label` on grid region e.g. **“Overview month”**.
- Legend: **Normal day** / **Full day (2+ lessons)**.

### Full-day detail panel

- **Desktop:** anchored popover near cell; focus trap; Esc closes.
- **Mobile:** bottom sheet pattern.
- **Keyboard:** full days are `<button type="button">` with `aria-expanded` when open.
- Panel lists only classes with **≥ 1** lesson that day (omit zero rows).

## Edge cases

- **Single included class:** Overview still works; full days are days with ≥ 2 lessons in that class.
- **Same date, two classes, one lesson each:** Full day (2 total).
- **Three lessons, one class:** Full day; panel shows one row with count 3.
- **Class added mid-year:** Appears in overview once semester saved; recount on navigation/invalidation.
- **Semester shortened** after lessons exist: lessons outside new bounds stop counting; no data deletion.
- **Timezone:** Date-only `YYYY-MM-DD` discipline identical to semester map and lesson rows.

## Accessibility

- Full-day state not conveyed by color alone: border weight and/or **“2+”** text + legend.
- Focus visible on interactive full-day cells.
- Panel announced to screen readers (`role="dialog"` or appropriate pattern).

## Testing (v1)

**Unit tests** on pure helpers:

- Span: min/max across multiple classes; `null` when none configured.
- Counting: 2 lessons same class → full; 1+1 two classes → full; 1 total → not full.
- Per-class semester exclusion: lesson outside class semester does not count.
- Class without semester excluded from span and counts.

**Manual / component smoke (optional):** month nav boundaries; panel open/close; link to class schedule.

## Relation to existing surfaces

| Surface | Role |
|---------|------|
| `/class/[classId]` + `SemesterMap` | Per-class semester editing + kind dots + done flags |
| **`/overview`** | Cross-class **load** view; binary full days + tap summary |
| Header class switcher | Unchanged; overview is additive |

This document does not change per-class semester UI or lesson storage.

## Implementation notes (non-binding)

- Consider extracting shared month-grid utilities from `SemesterMap.svelte` into `$lib/calendar/` if duplication would otherwise grow.
- Loader should avoid N+1 round-trips where the repository supports listing lessons by multiple class ids.
- Use `data-sveltekit-preload-data` on header overview link consistent with other nav.
