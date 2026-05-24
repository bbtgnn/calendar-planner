# Per-class file storage (File System Access API) — design spec

**Date:** 2026-05-24  
**Status:** Approved (brainstorming)  
**Extends:** [2026-04-20 lesson planner spec](./2026-04-20-lesson-planner-design.md)

## Problem

Data lives only in IndexedDB (Dexie). Teachers cannot version data in git, copy folders between machines, or inspect backups as plain JSON. A legacy monolithic JSON import exists at `/restore`, but there is no ongoing file-backed persistence.

## Goals

1. **File as source of truth** — each class persists to `planner.json` in a user-chosen directory via the [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API).
2. **Keep Dexie** as the working store (repos, indexes, tests with `fake-indexeddb`); hydrate from files on load, flush to files after mutations.
3. **Per-class folder** — no single global data directory; the user picks a folder when creating a class (and during one-time migration).
4. **Remember directory handles** in IndexedDB meta so reopening the app does not re-pick folders every visit (until permission is revoked).
5. **Debounced auto-save** (~400ms quiet period) per class after successful mutations.
6. **Export / setup** for existing IndexedDB users (e.g. two classes already in the DB): link each class to a folder and write initial `planner.json` files.
7. **Portable, versionable JSON** with an explicit `version` field for future schema changes.

## Non-goals

- Single global parent folder with auto-discovered `class-name/` subfolders.
- Optional per-class linking (IDB-only classes) — **folder required** at creation to keep one code path.
- Deleting on-disk folders when deleting a class in the app (only remove stored handle).
- Renaming on-disk directories when renaming a class in the UI (only `class.name` in JSON changes).
- Watching external file edits or auto-reload from disk.
- Merge / conflict resolution if `planner.json` is edited outside the app while it is open.
- Replacing Dexie with a file-only data layer.
- Safari / Firefox without File System Access API (show unsupported message; no polyfill).

## Architecture (recommended: sync layer on repos)

**Approach:** Add a **persistence module** on top of existing repos. Repos continue to read/write Dexie. The module:

- Stores `classId → FileSystemDirectoryHandle` in IndexedDB **meta** (not lesson tables).
- On startup (linked classes): read each `planner.json` → validate → replace that class’s rows in Dexie.
- After successful `runMutation`: schedule **debounced** flush for affected `classId`(s) → serialize class slice → write `planner.json`.

This is **not** dual-write with two equal masters: the file wins on load; Dexie is a rebuildable working copy for the session.

## On-disk layout

Each class has its **own** directory, chosen independently (paths may be anywhere on disk):

```
/path/you/picked-for-math/
  planner.json

/elsewhere/fisica-4b/
  planner.json
```

There is **no** required shared root. Folder names are whatever the user selected; display name lives only in JSON.

## `planner.json` format (v1)

```json
{
  "version": 1,
  "class": {
    "id": "uuid",
    "name": "Matematica 3A",
    "totalHoursTarget": 40,
    "requiredStudentLessonHours": 0,
    "createdAt": 1710000000000,
    "semesterStart": null,
    "semesterEnd": null
  },
  "students": [],
  "lessons": [],
  "absences": []
}
```

- **`version`**: integer; increment when breaking schema changes (mirror Dexie migration discipline).
- Rows match current `ClassRow`, `StudentRow`, `LessonRow`, `AbsenceRow` from `src/lib/db/types.ts`.
- Unknown keys on import are stripped; missing optional fields get Dexie v3 defaults (same rules as `/restore` where applicable).
- FK validation within the file: students/lessons reference `class.id`; absences reference lesson/student ids in the same file.

## IndexedDB meta

Separate from lesson tables (new Dexie table or small dedicated DB — implementation choice in plan):

| Field | Purpose |
|--------|---------|
| `classId` | Primary key |
| `directoryHandle` | `FileSystemDirectoryHandle` (structured-cloneable in IndexedDB) |
| `linkedAt` | Optional timestamp |
| `lastSyncedAt` | Optional timestamp after successful flush |

**Delete class in app:** run existing `deleteClassCascade` in Dexie + remove meta row only. **Do not** delete user files on disk.

## App states

| State | Condition | Behavior |
|--------|-----------|----------|
| **Setup required** | One or more classes in Dexie lack a directory handle | Blocking setup UI until every class is linked |
| **Linked** | Every class has a handle with readwrite permission | Normal app; load from files on startup; auto-save to files |
| **Permission lost** | `verifyPermission` fails for a class | Banner on that class: **Reconnect folder**; no silent IDB-only mode |

## Lifecycle

### Startup (all classes linked)

1. For each meta entry: `directoryHandle.requestPermission({ mode: 'readwrite' })` / `verifyPermission`.
2. Read `planner.json` from each handle.
3. Validate and **replace** that class’s rows in Dexie (per-class transaction or single coordinated load).
4. Continue normal SvelteKit loads from repos.

### Create class

1. Collect class fields (as today).
2. **`showDirectoryPicker()`** — user picks folder for this class.
3. Write initial `planner.json` + Dexie insert + store handle in meta.
4. If user cancels picker, do not create the class.

### Mutations (lessons, students, attendance, class settings)

1. Existing repo + `runMutation` path updates Dexie.
2. On success, enqueue debounced flush for affected `classId`(s).
3. Flush reads current Dexie slice, writes full `planner.json` (full snapshot per save — acceptable at expected data size).

### Save status UI

- Global or per-class indicator: **Saving…** / **Saved** / **Save failed**.
- On failure: toast + retry; Dexie retains edits until flush succeeds.

## Migration: existing IndexedDB classes (e.g. two classes)

When the app detects classes in Dexie without handles:

1. Show **setup** route (e.g. `/setup` or blocking overlay), not the main schedule UI.
2. List each class: *Not linked* → **Choose folder**.
3. For each class in order:
   - User picks directory via `showDirectoryPicker()`.
   - App writes `planner.json` from **current Dexie data** for that class.
   - Stores handle in meta.
4. When **all** classes are linked → redirect to `/` (normal app).

**Export all classes…** (settings): same flow — sequential folder picker per class — for users who want to re-link or migrate later without recreating data.

No re-entry of lessons required; only folder picks (two picks for two classes).

## UI surfaces

| Surface | Purpose |
|---------|---------|
| **Setup / link** | First-run and incomplete migration |
| **Create class** | Includes directory picker (required) |
| **Settings** | Export all classes to folders; optional reconnect help text |
| **Class scope** | Reconnect banner if permission denied |
| **Save indicator** | Debounced write feedback |

`/restore` remains for **legacy monolithic** `lesson-planner-legacy-backup-*.json` (four top-level arrays). Not the primary storage path. May be removed later after migration.

## Module boundaries (implementation plan)

| Module | Responsibility |
|--------|----------------|
| `src/lib/schemas/*` | Zod schemas for rows, `planner.json`, legacy backup |
| `src/lib/persistence/*` | FSA I/O, meta handles, hydrate, debounced flush |
| `src/lib/application/*` | Use-cases: repo write → `notifyClassDirty(classId)` |
| `src/lib/ui/*.svelte.ts` | Runes-based toast and save status (not `writable` stores) |
| `src/lib/repos/*` | Dexie-only CRUD (unchanged) |
| `src/lib/kit/runMutation.ts` | UI only: retry, invalidate, toast |

Repos stay in `src/lib/repos/*`; no Dexie calls inside `src/lib/logic/*`. Routes call **application** inside `runMutation`, not persistence directly.

## Error messages (user-facing)

| Condition | Message |
|-----------|---------|
| FSA not supported | “This browser does not support saving to folders. Use Chrome or Edge.” |
| Permission denied | “Could not access folder — reconnect to continue saving.” |
| Invalid `planner.json` on load | “Could not load planner.json — file may be damaged.” |
| Write failure | “Could not save to folder — try again.” |
| Setup incomplete | “Link a folder for each class to continue.” |

## Browser support

File System Access API: Chromium-based browsers (Chrome, Edge). Detect `'showDirectoryPicker' in window` (or feature check) before enabling linked mode.

## Testing

| Layer | Strategy |
|-------|----------|
| `plannerFile.ts` | Vitest: round-trip serialize/parse, validation, defaults |
| Repos | Unchanged; `fake-indexeddb` |
| FSA | Manual verification in browser; optional mocked handles in unit tests if low cost |

## Verification (manual)

1. App with two classes in Dexie, no meta handles → setup lists both classes.
2. Link class A to folder A, class B to folder B → two `planner.json` files created with correct counts.
3. Edit a lesson → after debounce, file on disk updates.
4. Reload app → data matches files.
5. Delete class in app → Dexie row gone, meta gone, folders on disk unchanged.
6. Revoke site permission → reconnect flow restores saves.

## Cleanup / follow-ups

- After stable file storage ships, consider archiving `/restore` and legacy backup spec.
- README: document folder-per-class workflow and browser requirement.
