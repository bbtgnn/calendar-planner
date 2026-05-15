# Testing Patterns

**Analysis Date:** 2026-05-15

## Test Framework

**Runner:**
- Vitest `^4.1.3` (see `package.json`)
- Config: `vite.config.ts` (Vitest `projects` nested under `test`)

**Assertion library:**
- Vitest built-in `expect` (Jest-compatible API)
- `expect: { requireAssertions: true }` — every test must contain at least one assertion

**Environment:**
- Project name `server`, `environment: 'node'`
- Setup: `src/test/setup.ts` imports `fake-indexeddb/auto` so Dexie works in Node

**Run commands:**

```bash
bun run test              # vitest --run (CI-style, single pass)
bun run test:unit         # vitest (watch mode)
```

**Typecheck (not unit tests):**

```bash
bun run check             # svelte-check + TypeScript
```

## Test File Organization

**Location:**
- Co-located beside source: `src/lib/**/*.test.ts`
- No separate `tests/` or `__tests__/` tree

**Naming:**
- `*.test.ts` only (no `*.spec.ts` in repo)
- Smoke test naming: `client.smoke.test.ts` for minimal DB sanity check

**Structure:**

```
src/
├── test/
│   └── setup.ts                 # fake-indexeddb bootstrap
├── lib/
│   ├── db/
│   │   ├── client.ts
│   │   ├── client.smoke.test.ts
│   │   └── withRetry.test.ts
│   ├── logic/
│   │   ├── stats.ts
│   │   ├── stats.test.ts
│   │   └── …
│   └── repos/
│       ├── classes.repo.ts
│       ├── classes.repo.test.ts
│       └── …
```

**Excluded from Vitest include glob:**
- `src/**/*.svelte.{test,spec}.{js,ts}` — no Svelte component tests configured

## Test Structure

**Suite organization:**

```typescript
import { describe, expect, it } from 'vitest';
import { parseCsvNames, parseTxtNames } from './rosterImport';

describe('rosterImport', () => {
	it('parseTxtNames trims and drops empties', () => {
		const r = parseTxtNames('  a \n\nb\r\nc');
		expect(r.names).toEqual(['a', 'b', 'c']);
		expect(r.skipped).toBe(0);
	});
});
```

**Patterns:**
- One top-level `describe` per module under test (matches file name: `describe('stats', ...)`, `describe('classes.repo', ...)`)
- Test titles are full sentences describing behavior: `'updateLesson throws when switching class to extra if absences exist'`
- Prefer table-style inputs inline in the test body; no shared fixture files
- No `afterEach` / global teardown beyond repo tests’ `beforeEach`

**IndexedDB integration tests:**

```typescript
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '$lib/db/client';
import { createClass, deleteClassCascade, updateClass } from './classes.repo';

beforeEach(async () => {
	await db.delete();
	await db.open();
});

describe('classes.repo', () => {
	it('deleteClassCascade removes students lessons absences', async () => {
		// arrange via createClass / direct db.*.add
		// act
		// assert with expect(await db.*.count())
	});
});
```

Use the same `beforeEach` pattern in `src/lib/repos/classes.repo.test.ts` and `src/lib/repos/lessons.repo.test.ts`.

## Mocking

**Framework:** Vitest `vi` (minimal use)

**Patterns:**

```typescript
import { describe, expect, it, vi } from 'vitest';
import { withRetry } from './withRetry';

it('retries once then succeeds', async () => {
	const fn = vi.fn(async () => {
		// throw once, then return
	});
	await expect(withRetry(fn, { retries: 1 })).resolves.toBe(42);
	expect(fn).toHaveBeenCalledTimes(2);
});
```

**What to mock:**
- Only isolate units without a real DB: `vi.fn` for callback retry behavior in `src/lib/db/withRetry.test.ts`
- Do not mock Dexie in repo tests — use real `db` with `fake-indexeddb`

**What NOT to mock:**
- `src/lib/logic/*` pure functions — test directly with literals
- Repository methods under test — exercise real `classes.repo` / `lessons.repo` against indexed DB
- `$app/navigation`, Svelte components, or load functions — not covered by current suite

## Fixtures and Factories

**Test data:**
- Inline object literals and `createClass` / `createLesson` helpers from repos
- IDs via `crypto.randomUUID()` inside tests
- Dates as fixed ISO strings: `'2026-04-01'`, `'2026-05-01'`

**Location:**
- No `fixtures/` directory; no factory modules

## Coverage

**Requirements:** None enforced (no `@vitest/coverage-v8` script, no CI coverage gate)

**View coverage:** Not configured. To add later, install coverage provider and extend `vite.config.ts` `test` block.

## Test Types

**Unit tests (pure logic):**
- `src/lib/logic/stats.test.ts` — hour/stat helpers
- `src/lib/logic/semesterCalendar.test.ts` — date grid and semester validation
- `src/lib/logic/sessionKindUi.test.ts` — session kind UI rules
- `src/lib/logic/rosterImport.test.ts` — CSV/TXT parsing
- No DB, no `beforeEach`, fast deterministic assertions

**Integration tests (repos + Dexie):**
- `src/lib/repos/classes.repo.test.ts` — cascade delete, semester update validation
- `src/lib/repos/lessons.repo.test.ts` — session kind transitions, skipped hours, absence clearing
- Reset DB each test with `db.delete()` / `db.open()`

**Smoke tests:**
- `src/lib/db/client.smoke.test.ts` — single write/read/delete on `classes` table

**E2E tests:** Not used (no Playwright/Cypress in `package.json`)

**Svelte / route tests:** Not used — UI and `+page.ts` loads are untested by automation

## Common Patterns

**Async testing:**

```typescript
it('updateClass rejects semester with only start set', async () => {
	const c = await createClass({ name: 'S', totalHoursTarget: 1 });
	await expect(updateClass(c.id, { semesterStart: '2026-04-01' })).rejects.toThrow(/both/);
});
```

**Error testing:**
- `await expect(promise).rejects.toThrow(/regex/)` for validation messages
- `expect(() => fn()).toThrow(/both/)` for synchronous asserts (`assertValidSemesterBounds`)
- Stable error substring checks for domain codes: `/SESSION_KIND_EXTRA_BLOCKED_ABSENCES/` when testing repo throws

**Equality:**
- `toEqual` for arrays and objects
- `toBe` for primitives and referential identity
- `toHaveLength` for fixed-size grids (e.g. 42 calendar cells in `semesterCalendar.test.ts`)

## Gaps (where to add tests)

| Area | Status | Suggested approach |
|------|--------|-------------------|
| `src/lib/repos/students.repo.ts` | No tests | `beforeEach` DB reset; test `replaceStudents` clears absences |
| `src/lib/repos/attendance.repo.ts` | No tests | put/delete absence rows; `listAbsentStudentIds` |
| `src/routes/**/+page.ts` loads | No tests | Optional: extract load logic or test with Kit utilities |
| `.svelte` components | Excluded | Add `environment: 'jsdom'` project + `@testing-library/svelte` if needed |
| `withRetry` + real Dexie errors | Partial | Only `vi.fn` unit tests today |

## Adding New Tests

**New pure helper in `src/lib/logic/`:**
1. Create `src/lib/logic/{name}.test.ts` next to `{name}.ts`
2. Import `describe`, `expect`, `it` from `vitest`
3. Cover edge cases and error paths with regex `rejects.toThrow` / `toThrow` where applicable

**New repo in `src/lib/repos/`:**
1. Create `src/lib/repos/{name}.repo.test.ts`
2. Add shared `beforeEach` that runs `await db.delete(); await db.open();`
3. Use repo public API for arrange/act; assert via `db.*.get/count` or return values
4. For multi-table invariants, assert all affected tables after cascade operations

**Run before commit:**

```bash
bun run test
bun run check
```

---

*Testing analysis: 2026-05-15*
