# Testing Patterns

**Analysis Date:** 2026-04-21

## Test Framework

**Runner:**
- Vitest `^4.1.3` from `package.json`.
- Config: `vite.config.ts` with one `server` project (`environment: 'node'`, `setupFiles: ['src/test/setup.ts']`, include `src/**/*.{test,spec}.{js,ts}`).

**Assertion Library:**
- Vitest built-in `expect` matcher API in `src/lib/**/*.test.ts`.

**Run Commands:**
```bash
bun run test              # Run all tests once (--run)
bun run test:unit         # Run Vitest in default mode
bun run check             # Type + Svelte static checks (non-test quality gate)
```

## Test File Organization

**Location:**
- Co-locate tests beside implementation under `src/lib/**` (for example `src/lib/logic/stats.ts` + `src/lib/logic/stats.test.ts`).
- Shared test bootstrap in `src/test/setup.ts`.

**Naming:**
- Use `*.test.ts` consistently (`src/lib/repos/classes.repo.test.ts`, `src/lib/repos/lessons.repo.test.ts`, `src/lib/logic/sessionKindUi.test.ts`).

**Structure:**
```
src/
  lib/
    db/*.test.ts
    logic/*.test.ts
    repos/*.test.ts
  test/setup.ts
```

## Test Structure

**Suite Organization:**
```typescript
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '$lib/db/client';

beforeEach(async () => {
	await db.delete();
	await db.open();
});

describe('lessons.repo', () => {
	it('updateLesson throws when switching class to extra if absences exist', async () => {
		// arrange, act, assert
	});
});
```

**Patterns:**
- Use `describe` per module and `it` per behavior rule (`src/lib/repos/lessons.repo.test.ts`, `src/lib/logic/stats.test.ts`, `src/lib/logic/rosterImport.test.ts`).
- Include explicit assertions in every test because `expect.requireAssertions` is enabled in `vite.config.ts`.
- For repository tests, reset IndexedDB in `beforeEach` with `db.delete()` and `db.open()` as in `src/lib/repos/classes.repo.test.ts` and `src/lib/repos/lessons.repo.test.ts`.
- Cover both success and failure paths for business rules, including thrown-domain-error assertions (`SESSION_KIND_EXTRA_BLOCKED_ABSENCES` in `src/lib/repos/lessons.repo.test.ts`).

## Mocking

**Framework:** Vitest mocks/spies via `vi` (`src/lib/db/withRetry.test.ts`).

**Patterns:**
```typescript
const fn = vi.fn(async () => {
	throw new Error('x');
});
await expect(withRetry(fn, { retries: 1 })).rejects.toThrow('x');
expect(fn).toHaveBeenCalledTimes(2);
```

**What to Mock:**
- Mock retry callback behavior and invocation counts (`src/lib/db/withRetry.test.ts`).
- Use `fake-indexeddb/auto` globally in `src/test/setup.ts` instead of ad-hoc per-test DB mocks.

**What NOT to Mock:**
- Do not mock repo internals when validating Dexie transaction behavior (`src/lib/repos/classes.repo.test.ts`, `src/lib/repos/lessons.repo.test.ts`).
- Do not mock pure logic modules (`src/lib/logic/stats.ts`, `src/lib/logic/sessionKindUi.ts`, `src/lib/logic/rosterImport.ts`); test deterministic inputs directly.

## Fixtures and Factories

**Test Data:**
```typescript
const c = await createClass({ name: 'A', totalHoursTarget: 10 });
const lesson = await createLesson({ classId: c.id, date: '2026-05-01', durationHours: 1, title: 'L' });
await db.absences.add({ id: `${lesson.id}__${sid}`, lessonId: lesson.id, studentId: sid });
```

**Location:**
- Inline arrangement inside each test is the standard pattern; no dedicated fixtures/factories directory is present.

## Coverage

**Requirements:** No numeric coverage gate detected (no coverage script, no CI threshold config).

**View Coverage:**
```bash
bun run test:unit -- --coverage
```

## Test Types

**Unit Tests:**
- Pure computation and parser behavior are unit tested (`src/lib/logic/stats.test.ts`, `src/lib/logic/rosterImport.test.ts`, `src/lib/logic/sessionKindUi.test.ts`).

**Integration Tests:**
- Repository behavior runs against real Dexie tables in Node test runtime (`src/lib/repos/classes.repo.test.ts`, `src/lib/repos/lessons.repo.test.ts`).
- DB smoke coverage verifies client wiring and read/write path (`src/lib/db/client.smoke.test.ts`).

**E2E Tests:**
- Not used (no Playwright/Cypress config detected and no route-level UI tests under `src/routes/**`).

## Skipped Behavior Coverage

- `LessonSessionKind` includes `'skipped'` in `src/lib/db/types.ts`; tests must treat this as a first-class branch whenever session-kind logic changes.
- Repository tests verify skipped invariants in `src/lib/repos/lessons.repo.test.ts`:
  - `createLesson` with `sessionKind: 'skipped'` stores `durationHours = 0`.
  - `updateLesson(..., { sessionKind: 'skipped' })` clears absences atomically.
  - skipped sessions keep `durationHours = 0` even when a duration patch is supplied.
- Logic tests verify skipped UI/label/editability behavior in `src/lib/logic/sessionKindUi.test.ts`.
- Stats tests verify skipped sessions do not influence class/extra counts in `src/lib/logic/stats.test.ts`.
- Import parser tests assert skipped-line accounting via the `skipped` field in `src/lib/logic/rosterImport.test.ts`.

## CI Usage

- CI workflows are not detected (`.github/workflows/*.yml` missing), so tests currently run as local/pre-commit discipline.
- Build and quality scripts exist in `package.json`, but no repository-level automation is enforcing them remotely.
- Team convention: run `bun run test` and `bun run check` before merging changes.

## Common Patterns

**Async Testing:**
```typescript
await expect(updateLesson(lesson.id, { sessionKind: 'extra' })).rejects.toThrow(
	'SESSION_KIND_EXTRA_BLOCKED_ABSENCES'
);
```

**Error Testing:**
```typescript
await expect(withRetry(fn, { retries: 1 })).rejects.toThrow('x');
```

---

*Testing analysis: 2026-04-21*
