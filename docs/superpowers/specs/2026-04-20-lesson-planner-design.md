# Lesson planner (teacher) — design spec

**Status:** Approved for implementation planning  
**Date:** 2026-04-20  
**Stack:** SvelteKit, Vite, Dexie (IndexedDB)

## Purpose

A **browser-only** application for teachers to plan **multiple classes** across a **semester**: schedule **dated lessons** with **hours per date**, track **done vs to-do**, see **hours and lesson stats**, and record **absent students** per lesson session. **No server**; all data stays on the device.

## Non-goals (v1)

- **No** backend, sync, or accounts.
- **No** full **export/import backup** (browser storage only; may be added later).
- **No** weekly recurring templates as the primary model — planning is **semester-scoped** with **manually entered dates**.

---

## Domain model

### Class

- Identifier, **name**.
- **`totalHoursTarget`**: semester hour budget (number).
- Ordering or `createdAt` for stable lists optional (implementation detail).

### Student

- Belongs to exactly **one class**.
- **Name** (v1); optional extra fields deferred unless needed.
- **CRUD** in-app.

### Lesson (session)

- Belongs to exactly **one class**.
- **`date`**: **calendar date only**, stored as `YYYY-MM-DD` to avoid timezone off-by-one errors.
- **`durationHours`**: hours taught that day (number).
- **`title`**: string (optional default e.g. “Lesson”).
- **`done`**: boolean — marks completion for stats.
- **`sessionKind`**: `class`, `extra`, or `skipped`.
- **Skipped sessions:** store the skip reason in `title`, force `durationHours = 0`, have no attendance, and are excluded from planned/done lesson metrics.

### Attendance

- For each **lesson** and **student**, record whether the student was **absent** that session.
- **Default:** everyone **present**; teacher marks **absent** only.
- Representation: implementation may use a set of absent student IDs per lesson or equivalent normalized rows in Dexie.

### Derived values (per class)

- **`scheduledHours`**: sum of `durationHours` over all lessons in the class.
- **`remainingHours`**: `totalHoursTarget − scheduledHours` (may be **negative** if overscheduled).
- **`scheduledLessonCount`**: count of **class** sessions only (`sessionKind === 'class'`), not Extra / 1:1 / Skipped rows.
- **`doneLessonCount`**: among **class** sessions only, count with `done === true`; skipped rows are excluded.

*(Later contract work adds `requiredStudentLessonHours` (M), teacher vs student hour conversions, and Extra session counts separately — see implementation and `docs/superpowers/plans/2026-04-20-teacher-student-contract-stats.md`.)*

---

## User-facing surfaces

### Global

- **Class switcher**: select active class; **create**, **rename**, **delete** class (confirm on delete).
- **Last active class id** may be stored in **`localStorage`** as a small UI preference.
- **All structured data** in **Dexie**.

### Per-class: Overview / schedule (default)

- Edit **`totalHoursTarget`**.
- Show **scheduled hours**, **remaining hours** (or **over-by** if negative).
- **Table or list** of lessons sorted by **date**: date, hours, title, **done** checkbox, entry point to **attendance**.
- **Add lesson**: date, hours, title.
- **Edit** and **delete** lesson.

### Per-class: Students

- **CRUD** for roster.
- **Import**: `.txt` (e.g. one name per line) and `.csv` (define use of first column or a `name` header).
- Flow: file picker → **parse** → **preview** → confirm.
- **Append** vs **replace** roster; **replace** requires explicit confirmation (destructive for that class’s roster / related absence rows per cascade rules).

### Per-class: Lesson / attendance

- Detail view for one lesson: session fields + **full class list** with **absent** toggle per student.
- **Auto-save** on change (recommended for v1) to reduce lost work.

### Per-class: Stats

- Same view as overview **or** dedicated area: **hours** (target, scheduled, remaining/over) and **lessons** (**done** / **scheduled**; optional **%** of scheduled lessons done).

---

## Stats (exact definitions)

| Metric | Definition |
|--------|------------|
| Target hours | `totalHoursTarget` |
| Scheduled hours | Sum of `durationHours` over all lessons in the class |
| Remaining hours | `target − scheduled` (negative ⇒ overscheduled) |
| Scheduled lesson count | **Class** sessions only (`sessionKind === 'class'`), excluding Extra / 1:1 and Skipped rows |
| Done lesson count | **Class** sessions with `done === true` (Extra and Skipped sessions use separate tracking or are excluded from planned lesson metrics) |

---

## Validation & edge cases

- **Overscheduling:** allowed; **no hard block**. UI makes remaining negative or shows “over by X h.”
- **Duplicate dates:** **allowed** (e.g. two sessions same day). Optional **non-blocking** duplicate-date hint.
- **Zero students:** lessons and hours still work; attendance section empty or hidden.
- **Student delete:** **hard delete** with **cascade** removal of absence records for that student (v1 simplicity).
- **Class delete:** remove class and **cascade** students, lessons, and attendance data (application-level deletes in Dexie).

## Import

- Skip invalid lines; report **imported count** and **skipped count**.
- **Replace** wipes existing students for that class before insert (with confirmation).

## Errors & empty states

- **IndexedDB / Dexie** write failures: user-visible message; **retry** once where reasonable; never fail silently for critical saves.
- **No classes:** prompt to create first class.
- **No lessons:** show zeros and prompt to add first lesson.
- **No students:** explain that attendance appears after roster exists.

## Architecture notes (SvelteKit)

- **Client-only persistence:** Dexie in the browser; no reliance on server APIs for data.
- **Deployment shape:** static hosting compatible (e.g. **`@sveltejs/adapter-static`**) so the app can be served as static files.
- **Separation:** thin routes/pages; **data access** centralized (Dexie helpers / small modules) for testability.

## Testing (v1)

- **Unit tests** for: scheduled hours sum, remaining hours, lesson counts, import parsing (CSV/txt).
- **Optional** light component or integration test if cost is low — not a hard gate.

---

## Open items for implementation plan (not ambiguities)

- Exact **Dexie schema** (table names, indexes).
- **CSV** column detection rules (first column vs header row).
- Minimal **accessibility** pass (labels, keyboard) as part of UI work.
