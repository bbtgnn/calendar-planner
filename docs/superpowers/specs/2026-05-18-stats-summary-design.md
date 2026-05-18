# Stats summary redesign — design spec

**Date:** 2026-05-18  
**Status:** Approved (brainstorming)  
**Scope:** Class detail page stats panel (`src/routes/class/[classId]/+page.svelte`) and `src/lib/logic/stats.ts`

## Problem

The class page stats area mixes two hero boxes, a long list of derived metrics (flex, unplanned, student hours, session counts), and tier legends. Teachers need a single glance at three teacher-hour ratios; everything else is noise.

## Goals

1. Show exactly **three** stat boxes, all values in **teacher hours** (60-minute units).
2. Each box shows **planned / total** and **(percent%)** prominently.
3. Color tiers (**done / almost / behind**) apply only to the **Contract** box percent.
4. Extra box **total** shrinks when class hours exceed the minimum required for student lesson hours `M`.

## Non-goals

- Changing how lessons store `durationHours` or `sessionKind`.
- Student-hour display in the stats panel (inputs for `M` remain for class/extra denominators).
- Done-session progress, session counts, or flex/unplanned hero lines in the UI.
- New shared Svelte components (logic lives in `stats.ts`; page renders three boxes inline).

## Definitions (locked)

| Symbol | Meaning |
|--------|---------|
| `N` | Contract teacher hours (`totalHoursTarget`) |
| `M` | Required student lesson hours (`requiredStudentLessonHours`, 50-min units) |
| `C_min` | `minimumClassTeacherHoursForStudentLessonHours(M)` |
| `T_class` | Sum of `durationHours` for `sessionKind === 'class'` |
| `T_extra` | Sum of `durationHours` for `sessionKind === 'extra'` |
| `T_all` | `T_class + T_extra` (skipped sessions are a separate kind and are excluded) |

**Planned hours:** all scheduled sessions on the calendar (`class` + `extra` for numerators as applicable), regardless of the `done` flag. Skipped sessions do not contribute.

## The three boxes

### Box 1 — Contract

| | |
|--|--|
| **Title** | Contract |
| **Planned** | `T_all` |
| **Total** | `N` |
| **Percent** | `round(T_all / N * 100)` when `N > 0`; may exceed 100 |
| **Tier** | On the **percent line only**: `done` if ≥100%, `almost` if >85%, else `behind` |

### Box 2 — Class

| | |
|--|--|
| **Title** | Class |
| **Planned** | `T_class` |
| **Total** | `C_min` |
| **Percent** | `round(T_class / C_min * 100)` when `C_min > 0` |
| **Tier** | None (neutral styling) |

### Box 3 — Extra (dynamic cap)

The extra budget is not the static pool `N - C_min`. Class hours **beyond** `C_min` consume flex/extra space:

```
beyond   = max(0, T_class - C_min)
extraCap = max(0, (N - C_min) - beyond)
```

| | |
|--|--|
| **Title** | Extra |
| **Planned** | `T_extra` |
| **Total** | `extraCap` (dynamic) |
| **Percent** | `round(T_extra / extraCap * 100)` when `extraCap > 0` |
| **Tier** | None |

**Example:** `N=100`, `C_min=50`, `T_class=60` → `beyond=10` → `extraCap=40`. If `T_extra=15`, display `15.0 / 40.0 h` and `(38%)`, not vs `50`.

**Warning (box 3 only):** When `N - C_min < 0` (contract cannot cover `M`), show under the box:

> Contract N is below the minimum teacher hours needed for M — raise N or lower M.

## Display format

Each box:

- **Primary line:** `{planned} / {total} h` — one decimal each (e.g. `87.0 / 100.0 h`).
- **Secondary line:** `({percent}%)` — integer percent, same rounding as `contractScheduledFillPercent` today.

When denominator ≤ 0:

- Fraction label: `—` (no numeric fraction).
- Percent label: `(—%)`.
- `percent` field: `null`.
- Do not clamp over-100% values.

## UI layout

- Keep the targets row: Contract hours (`N`), Student lesson hours (`M`), Save.
- Replace current two hero boxes + `.stats` list with a **single row of three** `.stat-box` elements (`.stats-summary` grid: 3 columns desktop, stack on narrow viewports).
- Remove: hours-left hero, lesson/extra session caption, completion legend, all `.stats` paragraph lines.
- Remove unused CSS: `.stats`, `.completion-legend`, tier-sub variants if unused after markup change.
- Duplicate-date hint unchanged.

## Implementation approach (B)

Add to `src/lib/logic/stats.ts`:

```ts
export type TeacherHourStatBoxKey = 'contract' | 'class' | 'extra';

export type TeacherHourStatBox = {
  key: TeacherHourStatBoxKey;
  title: string;
  planned: number;
  total: number;
  percent: number | null;
  fractionLabel: string;
  percentLabel: string;
  tier?: 'done' | 'almost' | 'behind';
  warning?: string;
};

/** Effective extra hour cap after class overage beyond C_min. */
export function effectiveExtraTeacherHourCap(
  contractTeacherHours: number,
  requiredStudentLessonHours: number,
  classTeacherHoursScheduled: number
): number;

export function contractCompletionTier(percent: number): 'done' | 'almost' | 'behind';

export function buildTeacherHourStatBoxes(
  contractTeacherHours: number,
  requiredStudentLessonHours: number,
  lessons: LessonForContractStats[]
): TeacherHourStatBox[];
```

`buildTeacherHourStatBoxes` composes existing helpers (`sumTeacherHoursForKind`, `minimumClassTeacherHoursForStudentLessonHours`, `contractScheduledFillPercent` or equivalent percent math) and formats labels.

**Page (`+page.svelte`):** Call `buildTeacherHourStatBoxes` in a `$derived`, loop three boxes, apply `tier-{tier}` class only when `box.key === 'contract'` on the percent line.

**Cleanup:** Remove unused imports and derived values from the page. Keep `stats.ts` exports that remain tested and useful (`remainingFlexTeacherHours`, etc.) unless a follow-up dead-code pass confirms zero callers.

## Testing

Extend `src/lib/logic/stats.test.ts`:

1. **Contract box** — `T_all / N` percent and tier boundaries (85, 100).
2. **Class box** — `T_class / C_min`.
3. **Extra box** — `extraCap` shrinks when `T_class > C_min`; percent uses dynamic cap.
4. **Skipped** — skipped hours do not affect numerators.
5. **Edge cases** — `N = 0`, `C_min = 0`, `extraCap = 0`, `N < C_min` warning flag.

## Success criteria

- Class page shows only three teacher-hour stat boxes plus target inputs.
- Fraction and percent are both visible in every box.
- Extra box total decreases when class scheduled hours exceed `C_min`.
- Contract percent uses tier colors; class and extra do not.
- Vitest covers `buildTeacherHourStatBoxes` and `effectiveExtraTeacherHourCap`.
