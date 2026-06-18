# Hour progress table — design spec

**Date:** 2026-06-18  
**Status:** Approved (brainstorming)  
**Scope:** Class detail page stats panel (`src/routes/class/[classId]/+page.svelte`) and `src/lib/logic/stats.ts`

## Problem

The class page stats area shows a single **planned / total** ratio per box (Contract, Class, Extra). **Done** hours are not shown, so teachers cannot see contract vs scheduled vs completed in one place. The display also reads like progress when it only reflects scheduling.

## Goals

1. Show **contract**, **planned**, and **done** for four metrics in one scannable view.
2. Add a **Student lesson hours** row (M, 50-minute units) alongside Contract, Class, and Extra.
3. Keep editable **N** and **M** inputs above the table; repeat those values (and derived caps) in the table’s Contract column (hybrid).
4. Drop tier colors and percent-only hero lines — three plain numbers per row.

## Non-goals

- Changing how lessons store `durationHours`, `sessionKind`, or `done`.
- Progress bars, tier colors, or percent columns in the stats table.
- New shared Svelte components (table inline on class page).
- Session counts in the stats table (hours only).
- Loader changes for notes scan state.

## Definitions (locked)

| Symbol | Meaning |
|--------|---------|
| `N` | Contract teacher hours (`totalHoursTarget`, 60-min units) |
| `M` | Required student lesson hours (`requiredStudentLessonHours`, 50-min units) |
| `C_min` | `minimumClassTeacherHoursForStudentLessonHours(M)` |
| `T_class` | Sum of `durationHours` for `sessionKind === 'class'` |
| `T_extra` | Sum of `durationHours` for `sessionKind === 'extra'` |
| `T_all` | `T_class + T_extra` (skipped excluded) |
| `extraCap` | `effectiveExtraTeacherHourCap(N, M, T_class)` |

**Planned:** scheduled calendar hours (regardless of `done`). Skipped sessions excluded.

**Done:** sum of `durationHours` where `done === true`. Skipped sessions excluded. Class and extra counted separately per row.

## The four rows

| Row | Contract | Planned | Done |
|-----|----------|---------|------|
| **Contract** | `N` | `T_all` | Done class + done extra teacher hours |
| **Class** | `C_min` | `T_class` | Done class teacher hours only |
| **Extra** | `extraCap` | `T_extra` | Done extra teacher hours only |
| **Student** | `M` | `studentHoursFromTeacherHours(T_class)` | `studentHoursFromTeacherHours(done class teacher hours)` |

**Student row:** planned and done derive from **class** sessions only; extra does not count toward M.

**Extra warning:** When `N - C_min < 0`, set `warning` on the extra row:

> Contract N is below the minimum teacher hours needed for M — raise N or lower M.

## Display format

- One decimal per value, suffix ` h` (e.g. `75.0 h`).
- Row labels include unit hint: `Contract (60 min)`, `Student (50 min)`.
- When a contract denominator is not applicable (`N = 0` for contract row contract column only): show `—`.
- When contract is `0` but meaningful (`M = 0`, `extraCap = 0`): show `0.0 h`.
- Do not clamp when planned or done exceed contract.

## UI layout

**Top block (unchanged behavior)**

- Contract hours (N) input, Student lesson hours (M) input, Save targets button.

**Stats table** (replaces three `.stat-box` cards)

| | Contract | Planned | Done |
|--|----------|---------|------|
| Contract (60 min) | … | … | … |
| Class (60 min) | … | … | … |
| Extra (60 min) | … | … | … |
| Student (50 min) | … | … | … |

- Wrapped in `.table-wrap` for narrow viewports.
- Contract column is read-only (values mirror inputs and derived caps).
- Extra-row warning below the table or under that row.
- Duplicate-date hint and lesson-notes panel unchanged below.

**CSS cleanup**

Remove unused: `.stats-summary`, `.stat-box`, `.stat-box__title`, `.size-8`, `.size-4`, `.tier-done`, `.tier-almost`, `.tier-behind`.

## Implementation

### `src/lib/logic/stats.ts`

```ts
export type HourProgressRowKey = 'contract' | 'class' | 'extra' | 'student';

export type HourProgressRow = {
  key: HourProgressRowKey;
  label: string;
  contract: number | null;
  planned: number;
  done: number;
  warning?: string;
};

export function sumDoneTeacherHoursForKind(
  lessons: LessonForContractStats[],
  kind: LessonSessionKind
): number;

export function buildHourProgressRows(
  contractTeacherHours: number,
  requiredStudentLessonHours: number,
  lessons: LessonForContractStats[]
): HourProgressRow[];
```

Replace `buildTeacherHourStatBoxes` usage on the class page. Remove or retain `TeacherHourStatBox` / `buildTeacherHourStatBoxes` only if other callers exist; otherwise delete dead API. Keep `contractCompletionTier` only if still tested and useful elsewhere.

### `src/routes/class/[classId]/+page.svelte`

- `$derived` → `buildHourProgressRows(Number(targetHours), Number(targetStudentLessonHours), data.lessons)`.
- Render `<table>` with header row and `{#each}` over rows.
- Format cells with tabular nums and `toFixed(1)`.

### Data flow

```
targetHours / targetStudentLessonHours (local state, saved via updateClass)
        ↓
buildHourProgressRows(N, M, data.lessons)
        ↓
4 rows × { contract, planned, done } → table cells
```

When notes are not scanned, lesson `done` flags are false; done column shows `0.0 h` (consistent with per-lesson `—` in sessions table).

## Edge cases

| Case | Behavior |
|------|----------|
| `N = 0` | Contract row contract column: `—` |
| `M = 0` | Student and Class contract columns: `0.0 h` |
| `N < C_min` | Extra row `warning` set |
| No lessons | Planned and done: `0.0 h` |
| `T_class > C_min` | Class planned may exceed class contract; extraCap shrinks |
| Skipped sessions | Excluded from all planned and done sums |

## Testing

Extend `src/lib/logic/stats.test.ts`:

1. Contract row — contract/planned/done values
2. Class row — `C_min`, `T_class`, done class only
3. Extra row — dynamic `extraCap`, warning when `N < C_min`
4. Student row — M and conversion from class hours
5. Skipped exclusion
6. `sumDoneTeacherHoursForKind` helper

## Success criteria

- Class page shows 4×3 stats table plus target inputs above.
- No tier colors or single-ratio hero boxes.
- Contract column repeats N, C_min, extraCap, M.
- Vitest covers `buildHourProgressRows` and `sumDoneTeacherHoursForKind`.

## Supersedes

Partially supersedes display goals in `docs/superpowers/specs/2026-05-18-stats-summary-design.md` (three planned/total boxes, no done column). Domain math and `extraCap` behavior remain unchanged.
