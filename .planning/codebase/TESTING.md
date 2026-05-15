# Testing Patterns

**Analysis Date:** 2026-05-15

## Test Framework

**Runner:**
- **Vitest** `^4.1.3` (via `package.json` devDependencies)
- Config: `vite.config.ts` (merged with SvelteKit via `@sveltejs/kit/vite`)

**Assertion library:**
- Vitest built-in **`expect`** (Chai-compatible API)

**Environment:**
- **Node** test project named `server` (`environment: 'node'` in `vite.config.ts`)
- Global setup: `src/test/setup.ts` imports `fake-indexeddb/auto` so Dexie works in Node

**Vitest options:**
- `expect: { requireAssertions: true }` — every `it` must contain at least one `expect` (or `expect.assertions(n)`)

**Run commands:**

```bash
bun run test              # vitest --run (CI-style, single pass)
bun run test:unit         # vitest watch mode (no --run)
```

**Typecheck (not unit tests, but required gate):**

```bash
bun run check             # svelte-check + TypeScript
```

## Test File Organization

**Location:**
- **Co-located** with source under `src/lib/**` — not a separate `tests/` tree.
- Shared setup only in `src/test/setup.ts`.

**Naming:**
- `*.test.ts` (e.g. `stats.test.ts`, `classes.repo.test.ts`).
- `*.spec.ts` is supported by config but **not used** in the repo today.

**Structure:**

```
src/
├── test/
│   └── setup.ts                 # fake-indexeddb bootstrap
├── lib/
│   ├── logic/
│   │   ├── stats.ts
│   │   └── stats.test.ts
│   ├── repos/
│   │   ├── classes.repo.ts
│   │   └── classes.repo.test.ts
│   ├── kit/
│   │   ├── runMutation.ts
│   │   └── runMutation.test.ts
│   └── db/
│       ├── client.ts
│       └── client.smoke.test.ts
```

**Svelte components:**
- Config **excludes** `src/**/*.svelte.{test,spec}.{js,ts}` — no component tests exist yet.
- Add component tests later in a separate Vitest project if needed; follow the exclude pattern in `vite.config.ts`.

## Test Structure

**Suite organization:**

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('featureName', () => {
	beforeEach(async () => {
		// optional setup
	});

	it('does one behavior', () => {
		expect(result).toBe(expected);
	});
});
```

**Patterns observed:**
- **Top-level `describe`** per module or concern (`describe('stats')`, `describe('classes.repo')`).
- **Nested `describe`** for grouping (`sessionKindPolicy.test.ts`: `display` vs `write`).
- **One logical behavior per `it`**; name reads as a specification: `'rejects start after end'`.
- **Arrange–act–assert** inline; no shared custom test harness beyond `beforeEach`.

**Async testing:**

```typescript
it('deleteClassCascade removes students lessons absences', async () => {
	const c = await createClass({ name: 'A', totalHoursTarget: 10 });
	// ...
	await deleteClassCascade(c.id);
	expect(await db.classes.count()).toBe(0);
});
```

**Error testing:**

```typescript
await expect(updateClass(c.id, { semesterStart: '2026-05-01' })).rejects.toThrow(/both/);

expect(() => assertCanChangeSessionKind('class', 'extra', 1)).toThrow(
	RepoErrorCode.SESSION_KIND_EXTRA_BLOCKED_ABSENCES
);
```

## Mocking

**Framework:** Vitest `vi` (`vi.fn`, `vi.mock`, `vi.hoisted`)

**Patterns (SvelteKit / side effects):**

Use `vi.hoisted` so mock fns exist before `vi.mock` factory runs (`src/lib/kit/runMutation.test.ts`):

```typescript
const { invalidate, showToast, withRetry } = vi.hoisted(() => ({
	invalidate: vi.fn(),
	showToast: vi.fn(),
	withRetry: vi.fn(async <T>(fn: () => Promise<T>) => fn())
}));

vi.mock('$app/navigation', () => ({ invalidate }));
vi.mock('$lib/stores/toast', () => ({ showToast }));
vi.mock('$lib/db/withRetry', () => ({ withRetry }));

import { runMutation } from './runMutation';
```

Reset mocks in `beforeEach`:

```typescript
beforeEach(() => {
	invalidate.mockReset();
	showToast.mockReset();
	withRetry.mockImplementation(async <T>(fn: () => Promise<T>) => fn());
});
```

**Spy on callbacks:**

```typescript
const onSuccess = vi.fn();
await runMutation({ fn: async () => 'ok', onSuccess, /* ... */ });
expect(onSuccess).toHaveBeenCalledWith('ok');
```

**What to mock:**
- `$app/navigation` `invalidate`
- `$lib/stores/toast` `showToast`
- `$lib/db/withRetry` when testing mutation orchestration without retry noise
- **Do not mock Dexie** in repo integration tests — use real `db` with `fake-indexeddb`

**What NOT to mock:**
- Pure logic in `src/lib/logic/` (`stats`, `semesterCalendar`, `sessionKindPolicy`, `rosterImport`)
- Dexie schema and repo CRUD when testing repository contracts
- `repoError` / `repoErrorMessage` registry (test real mapping in `repoErrors.test.ts`)

## Fixtures and Factories

**Test data:**
- Create rows through **repo APIs** (`createClass`, `createLesson`) or direct `db.*.add` / `db.*.put` when setting up edge cases.
- Use **`crypto.randomUUID()`** for IDs in tests (same as production).
- Use fixed ISO date strings (`'2026-04-01'`) for deterministic calendar tests.

**DB reset (integration tests):**

```typescript
import { db } from '$lib/db/client';

beforeEach(async () => {
	await db.delete();
	await db.open();
});
```

Used in `src/lib/repos/classes.repo.test.ts` and `src/lib/repos/lessons.repo.test.ts`.

**No shared fixture module** — inline minimal rows in each test for clarity.

## Coverage

**Requirements:** None enforced in repo (no coverage thresholds in `vite.config.ts` or CI config detected).

**View coverage:** Not configured. To add later, extend Vitest with `coverage` provider in `vite.config.ts` and document the command here.

## Test Types

**Unit tests (pure logic):**
- **Scope:** `src/lib/logic/*` — no database, no mocks.
- **Examples:** `src/lib/logic/stats.test.ts`, `src/lib/logic/semesterCalendar.test.ts`, `src/lib/logic/rosterImport.test.ts`, `src/lib/logic/sessionKindPolicy.test.ts`.
- **Approach:** Table-driven inputs, `expect` on return values and thrown errors.

**Unit tests (small infrastructure):**
- **Scope:** `src/lib/db/withRetry.test.ts`, `src/lib/kit/repoErrors.test.ts`.
- **Approach:** `vi.fn` for retry behavior; direct calls for error registry.

**Integration tests (repos + Dexie):**
- **Scope:** `src/lib/repos/*.repo.test.ts` — real IndexedDB via `fake-indexeddb`.
- **Approach:** Reset DB each test; assert counts and row shapes after cascade deletes and transactions.

**Smoke tests:**
- **Scope:** `src/lib/db/client.smoke.test.ts` — verifies DB open + single table write/read/delete.
- **Use when:** Changing Dexie schema versions in `src/lib/db/client.ts`.

**Kit / orchestration tests:**
- **Scope:** `src/lib/kit/runMutation.test.ts` — mocks navigation, toast, retry; asserts invalidation and toast precedence (`mapError` > `repoErrorMessage` > `errorToast` > `Error.message`).

**E2E tests:**
- **Not used** (no Playwright/Cypress config or `e2e/` directory).

**Svelte / route tests:**
- **Not used** — UI and `load` functions are exercised manually and via `bun run check`.

## Test Inventory (current)

| File | Kind | Focus |
|------|------|--------|
| `src/lib/logic/stats.test.ts` | Unit | Contract hour math, class vs extra vs skipped |
| `src/lib/logic/semesterCalendar.test.ts` | Unit | ISO dates, grids, semester merge/validation |
| `src/lib/logic/sessionKindPolicy.test.ts` | Unit | Session kind UI rules and write guards |
| `src/lib/logic/rosterImport.test.ts` | Unit | CSV/TXT name parsing |
| `src/lib/kit/repoErrors.test.ts` | Unit | Error code → user message map |
| `src/lib/kit/runMutation.test.ts` | Unit (mocked) | Invalidation, toasts, error resolution |
| `src/lib/db/withRetry.test.ts` | Unit | Retry count and non-retriable errors |
| `src/lib/db/client.smoke.test.ts` | Smoke | Dexie open/write |
| `src/lib/repos/classes.repo.test.ts` | Integration | Cascade delete, semester validation |
| `src/lib/repos/lessons.repo.test.ts` | Integration | Session kind transitions, absence clearing |

## Common Patterns

**Testing repo error codes:**
- Assert thrown `Error.message` equals the code string (e.g. `'SESSION_KIND_EXTRA_BLOCKED_ABSENCES'`) or use `RepoErrorCode` in `toThrow()`.
- Assert user-facing copy via `repoErrorMessage` in `repoErrors.test.ts`, not duplicated strings in every repo test.

**Testing policy before repo:**
- `sessionKindPolicy.test.ts` covers rules in isolation; `lessons.repo.test.ts` proves the same rules at persistence boundary.

**Package manager:**
- Use **`bun run test`** to match README and CI expectations (`README.md`).

## Where to Add New Tests

| Change location | Add test in |
|-----------------|-------------|
| New pure function in `src/lib/logic/` | Co-located `*.test.ts` beside module |
| New repo method | Co-located `src/lib/repos/<name>.repo.test.ts` |
| New `runMutation` behavior | `src/lib/kit/runMutation.test.ts` |
| Dexie schema version | Extend `client.smoke.test.ts` + relevant repo tests |
| New Svelte UI behavior | No harness yet — add Vitest browser/svelte project or manual UAT until configured |

**Do not add tests under `.cursor/`, `docs/`, or `.planning/`** — production code in `src/` only.

## Gaps and priorities

| Gap | Risk | Suggested test |
|-----|------|----------------|
| No tests for `students.repo.ts`, `attendance.repo.ts` | Regressions in roster/absence CRUD | Mirror `classes.repo.test.ts` patterns |
| No route/`load` tests | Wrong `depends()` keys | Light tests with mocked `parent()` or E2E later |
| No `.svelte` tests | UI regressions on class/lesson pages | Vitest component project when needed |
| No coverage reporting | Unknown blind spots | Optional `vitest --coverage` in CI |

---

*Testing analysis: 2026-05-15*
