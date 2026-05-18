# Stats summary redesign — implementation plan

> **Goal:** Three teacher-hour stat boxes on the class page via `buildTeacherHourStatBoxes()`.

**Architecture:** Add cap/tier/box builders in `stats.ts` (TDD); simplify `+page.svelte` to render the array.

**Tech stack:** Svelte 5, Vitest, existing contract math in `stats.ts`.

---

### Task 1: `effectiveExtraTeacherHourCap` + tests

- [ ] Test dynamic cap when `T_class > C_min`
- [ ] Implement in `stats.ts`

### Task 2: `contractCompletionTier` + `buildTeacherHourStatBoxes` + tests

- [ ] Tests for three boxes, tiers, skipped, edge cases
- [ ] Implement builders and labels

### Task 3: Class page UI

- [ ] Replace stats markup with `{#each statBoxes}`
- [ ] Remove unused derived state and CSS

### Task 4: Verify

- [ ] `bun run test`
