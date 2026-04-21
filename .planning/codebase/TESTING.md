# Testing Patterns

**Analysis Date:** 2026-04-21

## Test Framework

**Runner:**
- Vitest `^4.1.3` (`package.json`).
- Config: `vite.config.ts` (single `server` project with `environment: 'node'`, `expect.requireAssertions: true`, setup file `src/test/setup.ts`).

**Assertion Library:**
- Vitest built-in `expect`/matcher API (`src/lib/**/*.test.ts`).

**Run Commands:**
```bash
bun run test              # Run all tests once (--run)
bun run test:unit         # Run Vitest in default mode
bun run check             # Type + Svelte static checks (non-test quality gate)
```

## Test File Organization

**Location:**
- Co-located tests beside source modules in `src/lib/**` (e.g. `src/lib/logic/stats.ts` + `src/lib/logic/stats.test.ts`).
- Shared test bootstrap in `src/test/setup.ts`.

**Naming:**
- Use `*.test.ts` suffix consistently (`src/lib/repos/classes.repo.test.ts`, `src/lib/db/withRetry.test.ts`).

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
- Use `describe` by module boundary, `it` by business rule/scenario (`src/lib/repos/lessons.repo.test.ts`, `src/lib/logic/rosterImport.test.ts`).
- Use explicit assertions in every test to satisfy `requireAssertions` (`vite.config.ts`).
- Reset Dexie state in `beforeEach` for repository/integration tests (`src/lib/repos/*.test.ts`).
- Validate both happy and failure paths for critical rules (e.g. rejection assertion for blocked session-kind change in `src/lib/repos/lessons.repo.test.ts`).

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
- Mock callback-based transient behavior and retry loops (`src/lib/db/withRetry.test.ts`).
- Stub in-memory browser DB APIs through `fake-indexeddb/auto` at setup level (`src/test/setup.ts`) rather than per-test local mocks.

**What NOT to Mock:**
- Do not mock repository functions when validating data-integrity rules; use the actual Dexie-backed `db` (`src/lib/repos/classes.repo.test.ts`, `src/lib/repos/lessons.repo.test.ts`).
- Do not mock pure logic modules (`src/lib/logic/stats.ts`, `src/lib/logic/rosterImport.ts`); test them directly with deterministic inputs.

## Fixtures and Factories

**Test Data:**
```typescript
const c = await createClass({ name: 'A', totalHoursTarget: 10 });
const lesson = await createLesson({ classId: c.id, date: '2026-05-01', durationHours: 1, title: 'L' });
await db.absences.add({ id: `${lesson.id}__${sid}`, lessonId: lesson.id, studentId: sid });
```

**Location:**
- Inline setup per test is the dominant pattern; no shared fixture/factory directory is currently used.

## Coverage

**Requirements:** No numeric coverage gate detected (no coverage script, no CI threshold config).

**View Coverage:**
```bash
bun run test:unit -- --coverage
```

## Test Types

**Unit Tests:**
- Pure computational and parsing logic are unit-tested in isolation (`src/lib/logic/stats.test.ts`, `src/lib/logic/rosterImport.test.ts`).

**Integration Tests:**
- Repository behavior is tested against real Dexie tables in node test runtime (`src/lib/repos/classes.repo.test.ts`, `src/lib/repos/lessons.repo.test.ts`).
- DB smoke coverage verifies client wiring and read/write path (`src/lib/db/client.smoke.test.ts`).

**E2E Tests:**
- Not used (no Playwright/Cypress config detected, and no `src/routes/**/*.test.*` coverage for UI workflows).

## CI Usage

- CI workflows are not detected (`.github/workflows/*.yml` missing), so tests currently run as local/pre-commit discipline.
- Build and quality scripts exist in `package.json`, but no repository-level automation is enforcing them remotely.
- Recommended current team convention: run `bun run test` and `bun run check` before merging.

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

## Current Gaps

- UI route behavior is untested (`src/routes/+layout.svelte`, `src/routes/class/[classId]/+page.svelte`, `src/routes/class/[classId]/students/+page.svelte`, `src/routes/class/[classId]/lesson/[lessonId]/+page.svelte`).
- Attendance repository lacks direct test coverage (`src/lib/repos/attendance.repo.ts` has no paired `attendance.repo.test.ts`).
- Students repository import/replace transaction rules are only indirectly exercised via UI usage; dedicated repo tests are missing for `replaceStudents` and `appendStudents` (`src/lib/repos/students.repo.ts`).
- New business-rule surfaces in `src/lib/logic/stats.ts` have core coverage, but edge-case guardrails (negative/very large values, floating-point precision boundaries) are not explicitly asserted.
- Load-function error paths are not tested (`src/routes/class/[classId]/+layout.ts`, `src/routes/class/[classId]/lesson/[lessonId]/+page.ts`).

---

*Testing analysis: 2026-04-21*
