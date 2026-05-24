---
phase: task-1-zod-schemas
reviewed: 2026-05-24T20:35:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - src/lib/schemas/rows.ts
  - src/lib/schemas/plannerFile.ts
  - src/lib/schemas/legacyBackup.ts
  - src/lib/persistence/plannerFile.ts
findings:
  critical: 0
  warning: 2
  info: 1
  total: 3
status: issues_found
---

# Task 1: Code Review Report

**Reviewed:** 2026-05-24T20:35:00Z  
**Depth:** standard  
**Files Reviewed:** 4  
**Status:** issues_found  
**Commits:** `36e107f..ccbea5f`

## Summary

Task 1 delivers the planned Zod row schemas, `plannerFileSchema` / `legacyBackupSchema` with FK refinements, and thin persistence wrappers (`parsePlannerFile`, `serializePlannerFile`, `parseLegacyBackup`). Implementation matches the plan verbatim; all 18 unit tests pass. Row shapes align with `src/lib/db/types.ts`, error messages match the design spec, and FK validation logic mirrors the existing `/restore` page.

Two warnings block full parity with the design spec and current restore behavior around **missing optional fields on import**. No security or crash-level issues found. Safe to merge Task 1 with the recommended schema defaults applied before wiring `parseLegacyBackup` into `/restore` (later task).

## Warnings

### WR-01: Missing optional class fields not defaulted on import

**File:** `src/lib/schemas/rows.ts:5-13`  
**Issue:** `classRowSchema` requires `requiredStudentLessonHours`, `semesterStart`, and `semesterEnd` to be present. Legacy backups and pre-semester exports omit these fields; the current `/restore` page defaults them (`requiredStudentLessonHours → 0`, `semesterStart`/`semesterEnd → null`). Zod rejects such files. This violates the design spec: *"missing optional fields get Dexie v3 defaults (same rules as `/restore` where applicable)."* Verified: backups missing `requiredStudentLessonHours` or semester fields fail `legacyBackupSchema.safeParse`.

**Fix:**
```ts
export const classRowSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	totalHoursTarget: z.number().finite(),
	requiredStudentLessonHours: z.number().finite().default(0),
	createdAt: z.number().finite(),
	semesterStart: z.string().nullable().default(null),
	semesterEnd: z.string().nullable().default(null)
});
```

Add tests for classes/backup rows with omitted optional fields.

### WR-02: Empty lesson title accepted (restore rejects)

**File:** `src/lib/schemas/rows.ts:26`  
**Issue:** `title: z.string()` accepts `""`. The restore page uses `requireString`, which rejects empty strings and treats the row as invalid. Real backups with blank titles would restore today but fail under `parseLegacyBackup`.

**Fix:** Match restore strictness:
```ts
title: z.string().min(1),
```

## Info

### IN-01: Unused test fixture

**File:** `src/lib/persistence/plannerFile.test.ts:36-41`  
**Issue:** `validBackup` is declared but never referenced.  
**Fix:** Remove the unused constant or add a test that uses it.

---

## Verdict

**Approve with minor fixes recommended.** Core architecture, FK validation, persistence wrappers, and test coverage are solid. Apply WR-01 (and ideally WR-02) before the `/restore` migration task to avoid regressing existing backup imports.

---

_Reviewed: 2026-05-24T20:35:00Z_  
_Reviewer: Claude (gsd-code-reviewer)_  
_Depth: standard_
