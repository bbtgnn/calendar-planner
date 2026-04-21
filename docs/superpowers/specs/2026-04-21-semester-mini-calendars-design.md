# Semester mini-calendars (per-class) — design spec

**Status:** Approved for implementation planning  
**Date:** 2026-04-21  
**Stack:** SvelteKit, Dexie (IndexedDB) — extends [2026-04-20 lesson planner spec](./2026-04-20-lesson-planner-design.md)

## Purpose

Teachers need a **compact, at-a-glance map** of where sessions fall across a **manually defined academic semester**, without replacing the existing session list. This feature adds:

1. **Per-class semester bounds** (manual start and end dates).
2. A **horizontal strip of small monthly calendars** covering every calendar month from start through end, with **session kinds shown as colored dots** inside each day cell (view-only).

## Non-goals (v1)

- No click / drill-down / quick-add from calendar cells.
- No automatic semester inference from lesson dates (bounds are always teacher-set).
- No change to how lessons are stored beyond optional display filtering rules below.

## Confirmed decisions

- **Persistence:** **Approach 1** — `semesterStart` / `semesterEnd` on **`ClassRow`** in Dexie (nullable pair); schema migration from prior version.
- **Strip coverage:** One mini-month per **calendar month** from **semester start through semester end** (inclusive), laid out **side by side**; **horizontal scroll** when the span is long.
- **Out-of-range days** inside the first/last month grid: **muted** styling; **no dots** in those cells (even if a data anomaly placed a lesson outside the configured range — dots still follow calendar bounds).
- **Dots encode `sessionKind` only:** `class`, `extra`, `skipped`. **At most one dot per kind per day** (multiple lessons of the same kind that day → one dot for that kind).
- **Colors:** **`skipped` uses red** for the dot and legend swatch. **`class`** and **`extra`** use distinct non-red colors **consistent with existing session UI** where the codebase already defines kind styling; if none exists yet for this surface, pick two accessible hues and document CSS variables used by both the strip and legend.
- **Interaction:** Calendar strip is **view-only** (cells are not buttons or links; no pointer affordance implying action).
- **Placement:** **`/class/[classId]`** — a **“Semester”** card **above** “Add session” and “Sessions”, with the strip directly under the date inputs.

## Data model

### `ClassRow` additions

| Field | Type | Meaning |
|-------|------|--------|
| `semesterStart` | `string \| null` | First day of the semester map, `YYYY-MM-DD`, or `null` |
| `semesterEnd` | `string \| null` | Last day of the semester map, `YYYY-MM-DD`, or `null` |

### Invariants

- **Pairing:** Either **both** fields are `null` (no semester map) or **both** are non-null strings with **`semesterStart ≤ semesterEnd`** (compare as calendar dates using the same date-only discipline as lesson `date` fields — avoid timezone off-by-one).
- **Lessons:** No schema change to `LessonRow`. Lessons **may** exist on dates outside `[semesterStart, semesterEnd]`; they remain in the session list and stats. The mini-calendars **only show dots for dates inside** the inclusive semester range.

## Persistence and repository behavior

- Bump Dexie **schema version**; backfill existing classes with `semesterStart: null`, `semesterEnd: null`.
- **`updateClass`** (or equivalent patch API): accept updates to these fields; **reject** invalid pairs (e.g. start after end, or exactly one of the two set) with a **clear user-visible error** (toast), matching the tone of existing validation on the class page.
- **Route data:** Extend the class loader payload types so `+page.svelte` receives the new fields without an extra fetch.

## UI specification (`/class/[classId]`)

### Semester card

- Heading: e.g. **“Semester”** (`<h2>`).
- Two **`<input type="date">`** controls: **Start**, **End**.
- **Save** action aligned with the existing **explicit “Save targets”** pattern on the same page (button + success/error toast), not silent autosave.
- When **both** dates are unset: show brief helper copy (“Set semester start and end to see the map”) and **do not render** the strip.
- When **both** dates are set and valid: render the **month strip** below the controls.

### Month strip

- Container: **`overflow-x: auto`**; provide an accessible name (e.g. `aria-label="Semester months"`).
- Each month block: **title** (month + year), **weekday header** row with **Monday as the first column** (v1 default).
- **Grid:** standard 6×7 month layout with leading/trailing blanks for alignment.
- **In-range cell:** day numeral (small) + a **row of dots** (0–3) for kinds present that day.
- **Out-of-range cell** (same month grid, but day ∉ `[semesterStart, semesterEnd]`): **muted** background/text; **suppress dots**.
- **Legend:** three entries — Class, Extra / 1:1, Skipped — with swatches; **Skipped swatch and dots: red**.

### Visual / accessibility

- Strip remains usable on **narrow viewports** via horizontal scroll; no desktop-only requirement.
- View-only: **no** `role="button"` on day cells, **no** keyboard activation requirement for cells beyond scroll container focus if applicable.

## Derived logic (pure, testable)

Implement small pure helpers (exact names are implementation details), for example:

- Enumerate **calendar months** touched inclusively by `[semesterStart, semesterEnd]`.
- Build a **month grid** (weeks × days) for a given year-month with Monday-first alignment.
- **`isDateInSemester(isoDate, start, end)`** for dot and mute rules.
- **`kindsByDate(lessons) -> Map<YYYY-MM-DD, Set<LessonSessionKind>>`** using **unique** kinds per date for the active class.

**Unit tests (v1):** month enumeration, inclusive range checks, kind aggregation (including duplicate same kind same day → one dot), edge cases for same-month start/end and single-month semester.

## Edge cases

- **Adjusting semester** to exclude dates that already have lessons: **no auto-delete**; list and stats unchanged; dots simply disappear for excluded dates.
- **Invalid save attempts:** block save, toast, keep previous saved bounds in the DB.

## Relation to existing product spec

This document **adds** surfaces and fields; it does not remove the per-class session **table/list** as the primary editing surface. Update cross-references in implementation work so the main lesson planner spec remains the source for lesson/student/attendance behavior.
