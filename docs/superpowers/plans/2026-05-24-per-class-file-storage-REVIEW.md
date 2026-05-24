---
phase: per-class-file-storage
reviewed: 2026-05-24T21:06:00Z
depth: deep
files_reviewed: 38
files_reviewed_list:
  - src/lib/application/attendance.ts
  - src/lib/application/classes.test.ts
  - src/lib/application/classes.ts
  - src/lib/application/lessons.ts
  - src/lib/application/students.ts
  - src/lib/db/client.ts
  - src/lib/db/types.ts
  - src/lib/kit/runMutation.test.ts
  - src/lib/kit/runMutation.ts
  - src/lib/persistence/classFolder.ts
  - src/lib/persistence/flush.ts
  - src/lib/persistence/hydrate.ts
  - src/lib/persistence/linkClass.ts
  - src/lib/persistence/meta.test.ts
  - src/lib/persistence/meta.ts
  - src/lib/persistence/notify.ts
  - src/lib/persistence/plannerFile.test.ts
  - src/lib/persistence/plannerFile.ts
  - src/lib/persistence/setup.ts
  - src/lib/persistence/snapshot.test.ts
  - src/lib/persistence/snapshot.ts
  - src/lib/schemas/legacyBackup.ts
  - src/lib/schemas/plannerFile.test.ts
  - src/lib/schemas/plannerFile.ts
  - src/lib/schemas/rows.ts
  - src/lib/ui/saveStatus.svelte.ts
  - src/lib/ui/toast.svelte.ts
  - src/routes/+layout.svelte
  - src/routes/+layout.ts
  - src/routes/class/[classId]/+layout.svelte
  - src/routes/class/[classId]/+layout.ts
  - src/routes/class/[classId]/+page.svelte
  - src/routes/class/[classId]/SemesterMap.svelte
  - src/routes/class/[classId]/lesson/[lessonId]/+page.svelte
  - src/routes/class/[classId]/students/+page.svelte
  - src/routes/restore/+page.svelte
  - src/routes/setup/+page.svelte
  - src/routes/setup/+page.ts
findings:
  critical: 2
  warning: 4
  info: 2
  total: 8
status: issues_found
---

# Per-class file storage: Final Code Review

**Reviewed:** 2026-05-24T21:06:00Z  
**Depth:** deep  
**Diff:** `a6ad8b0..5b76a6d`  
**Files Reviewed:** 38  
**Status:** issues_found  
**Tests:** 99/99 passing (`bun run test`)

## Summary

The feature is well-structured and largely matches the approved design: persistence layer on top of Dexie, application use-cases calling `notifyClassDirty`, repos unchanged for reads, Zod validation, `/setup` migration, folder picker on create, debounced flush, reconnect banner, and README updates. All unit tests pass.

**Not ready to merge.** Two critical data-integrity bugs in the hydrate/flush lifecycle can silently revert user edits. Startup hydration also fails closed in a way that blocks the app instead of showing per-class reconnect UI as specified.

## Spec Coverage

| Requirement | Status |
|-------------|--------|
| File as source of truth (load from file on startup) | ⚠️ Implemented but over-aggressive (re-hydrates on invalidation) |
| Dexie as working store; repos unchanged for reads | ✅ |
| Per-class folder at creation | ✅ `createClassAndLinkFolder` |
| Remember handles in IndexedDB meta | ✅ `classFolders` v4 |
| Debounced auto-save (~400ms) | ✅ |
| Setup for existing IDB users | ✅ `/setup` |
| Portable versioned JSON | ✅ |
| Delete class removes meta only | ✅ |
| Permission lost → reconnect banner | ⚠️ Banner exists, but startup permission failure crashes load |
| Save status UI | ✅ Global indicator |
| Legacy `/restore` | ✅ Migrated to Zod schemas |
| Settings: Export all classes | ❌ Not implemented |
| Save failure: toast + retry | ⚠️ Toast only, no retry |
| Routes call application, not persistence | ⚠️ Setup/reconnect call persistence directly |
| README documentation | ✅ |

## Critical Issues

### CR-01: Hydrate races with debounced flush — silent data loss

**File:** `src/routes/+layout.ts:19-21`, `src/lib/persistence/hydrate.ts:27-41`, `src/lib/persistence/flush.ts:12-24`

**Issue:** Root layout calls `hydrateAllLinkedClassesFromFiles()` on every load when setup is complete. Hydration replaces Dexie rows from on-disk `planner.json`. Flush is debounced 400ms after mutations. Two failure modes:

1. **Rename class** — `updateClass` writes Dexie → `notifyClassDirty` schedules flush → `invalidate(CLASSES_LIST_LOAD_KEY)` re-runs root layout → hydrate reads stale file → overwrites rename → scheduled flush writes stale data back. **Rename is permanently lost.**

2. **Page reload within 400ms of any edit** — Dexie has fresh data, file is stale, hydrate on reload overwrites Dexie. **Edit lost.**

The spec says files win on startup load, not on every layout invalidation. Re-hydrating after each mutation invalidation (or reload before flush completes) violates "Dexie retains edits until flush succeeds."

**Fix:** Hydrate once per browser session (module-level flag or `$app/state`), not on every root layout re-run. Optionally `await flushClassNow(classId)` before any operation that triggers re-hydration. Add `beforeunload`/`pagehide` handler to flush pending timers synchronously.

```ts
// +layout.ts — hydrate only on cold start
let hydratedThisSession = false;

export const load: LayoutLoad = async ({ depends, url }) => {
  depends(CLASSES_LIST_LOAD_KEY);
  // ... setup redirect ...
  if (!hydratedThisSession && !(await needsSetup())) {
    await hydrateAllLinkedClassesFromFiles();
    hydratedThisSession = true;
  }
  return { classes: await listClasses(), fileStorageUnsupported: false };
};
```

### CR-02: Startup hydration throws — entire app blocked on permission/file errors

**File:** `src/lib/persistence/hydrate.ts:27-41`, `src/routes/+layout.ts:19-21`

**Issue:** `hydrateAllLinkedClassesFromFiles` throws on missing handle, denied permission, or invalid JSON. Root layout does not catch this, so SvelteKit load fails and the app never renders — including the per-class reconnect banner specified in the design.

The spec defines **Permission lost → Banner on that class: Reconnect folder**, not a fatal startup error.

**Fix:** Per-class try/catch in hydration; skip failed classes and surface errors via layout data so class scope can show reconnect banner. Do not throw from root layout load for recoverable permission/file errors.

```ts
export async function hydrateAllLinkedClassesFromFiles(): Promise<HydrateResult[]> {
  const results: HydrateResult[] = [];
  for (const classId of await listFolderClassIds()) {
    try {
      // ... existing per-class logic ...
      results.push({ classId, ok: true });
    } catch (e) {
      results.push({ classId, ok: false, message: e instanceof Error ? e.message : 'Load failed' });
    }
  }
  return results;
}
```

## Warnings

### WR-01: Legacy restore leaves stale folder handles

**File:** `src/routes/restore/+page.svelte:90-99`

**Issue:** Restore transaction clears `classes`, `students`, `lessons`, `absences` but not `classFolders`. Stale meta entries remain. On next load, hydration loops all meta IDs and can re-import classes from old on-disk files, producing inconsistent state after a restore.

**Fix:** Include `db.classFolders.clear()` in the restore transaction (or `removeFolderHandle` for each known entry).

### WR-02: Missing `planner.json` throws uncaught

**File:** `src/lib/persistence/classFolder.ts:22-34`

**Issue:** `readPlannerFile` calls `handle.getFileHandle(PLANNER_FILE_NAME)` without try/catch. A missing file throws instead of returning `{ ok: false, message: '...' }`, bypassing the designed error path and crashing hydration.

**Fix:**
```ts
try {
  const fileHandle = await handle.getFileHandle(PLANNER_FILE_NAME);
  // ...
} catch {
  return { ok: false, message: 'Could not load planner.json — file may be damaged.' };
}
```

### WR-03: Settings "Export all classes" not implemented

**File:** (missing)

**Issue:** Design spec UI surfaces table lists **Settings → Export all classes to folders** for re-linking without recreating data. No settings route or export flow exists in the diff.

**Fix:** Add settings surface with sequential folder picker per class (same as `/setup` flow), or document as deferred follow-up if intentionally descoped.

### WR-04: Save failure has toast but no retry

**File:** `src/lib/persistence/flush.ts:41-44`

**Issue:** Spec says "On failure: toast + retry." Implementation shows toast and sets status to `failed`, but provides no retry button or automatic retry. User must trigger another mutation to re-flush.

**Fix:** Add retry affordance in save status UI (`flushClassNow` on click when `failed`), or exponential backoff retry in `flushClassNow`.

## Info

### IN-01: Routes bypass application layer for folder linking

**File:** `src/routes/setup/+page.svelte:4-5`, `src/routes/class/[classId]/+layout.svelte:4-6`

**Issue:** Spec says routes call application inside `runMutation`, not persistence directly. Setup and reconnect import `pickClassFolder`, `linkClassToPickedFolder`, `putFolderHandle` from persistence.

**Fix:** Move to `src/lib/application/classes.ts` (e.g. `linkExistingClassToFolder`, `reconnectClassFolder`) for consistency. Low risk — not a blocker.

### IN-02: `createClass` notifies dirty before folder is linked

**File:** `src/lib/application/classes.ts:28-36`

**Issue:** `createClassAndLinkFolder` calls `createClass`, which calls `notifyClassDirty` before a handle exists. Flush no-ops (`flushClassNow` returns early). Harmless but slightly noisy.

**Fix:** Split internal `createClassInDb` without notify, or defer notify until after link succeeds.

---

## Architecture Assessment

**Strengths:**
- Clean module boundaries: `schemas/`, `persistence/`, `application/`, `ui/`
- Repos untouched (`git diff a6ad8b0..5b76a6d -- src/lib/repos/` empty)
- Reads still go through repos in `+page.ts` loaders
- Writes routed through application layer in all class mutation pages
- Toast migrated from `writable` store to runes (`toast.svelte.ts`)
- Good test coverage for schemas, snapshot, meta, planner round-trip

**Gaps:**
- Hydrate/flush lifecycle is the main architectural flaw (CR-01)
- Setup/reconnect UI reaches into persistence directly (IN-01)

## Merge Verdict

### Blockers (must fix before merge)

1. **CR-01** — Hydrate/flush race causes silent data loss on rename and quick reload
2. **CR-02** — Startup hydration errors block the entire app

### Recommended before merge (not strictly blocking)

3. **WR-01** — Clear `classFolders` on legacy restore
4. **WR-02** — Catch missing `planner.json` in `readPlannerFile`

### Can ship as follow-up

5. **WR-03** — Settings export-all flow
6. **WR-04** — Save retry UX
7. **IN-01**, **IN-02** — Layering polish

**Ready to merge? No.** Fix CR-01 and CR-02 first; they affect core data integrity in normal use (rename, reload, permission revoke).

---

_Reviewed: 2026-05-24T21:06:00Z_  
_Reviewer: Claude (gsd-code-reviewer)_  
_Depth: deep_
