# Lesson planner (teacher)

Browser-only lesson planner for multiple classes: semester hour targets, dated lessons, done/todo, student rosters (CRUD + `.txt` / `.csv` import), and absence marks per session.

Each class is stored as **`planner.json`** in a **folder you choose** on disk. The app keeps a working copy in **IndexedDB** (Dexie) for fast UI and offline use; on startup it loads from your files, and after edits it writes back automatically.

## Browser requirement

Saving to folders uses the [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API). Use **Chrome** or **Edge** (Chromium). Safari and Firefox are not supported for linked storage.

## Data storage

- **One folder per class** — when you create a class (or link an existing one), you pick any directory on your machine. Paths can differ per class; there is no shared root folder.
- **`planner.json`** — each class folder contains a versioned JSON file with the class row, students, lessons, and absences. You can version it in git, copy folders between machines, or inspect backups as plain text.
- **`lezioni/` and `extra/`** — markdown lesson notes with YAML frontmatter (`data: DD/MM/YYYY`, `durata: hours`). Class sessions are **done** when a matching note exists for that date in `lezioni/`; extra / 1:1 sessions use `extra/`. Hour differences vs the planner show as warnings only. Use **Refresh from folder** on the class page after editing notes outside the app.
- **IndexedDB** — the app remembers which folder belongs to each class and holds a rebuildable working copy while you work. Deleting a class in the app removes its database rows and stored folder handle only; it does **not** delete files on disk.

### Auto-save

After successful edits, the app debounces writes for about **400 ms** per class, then flushes the full class snapshot to `planner.json`. A save indicator shows saving / saved / failed states.

### Existing data (IndexedDB migration)

If you already have classes in IndexedDB before folder linking was enabled, open **`/setup`**. The app lists every unlinked class; choose a folder for each one to write an initial `planner.json` from current data. When all classes are linked, you are redirected to the main app.

New classes require a folder pick at creation time.

### Legacy import

`/restore` remains for one-time import of old monolithic `lesson-planner-legacy-backup-*.json` files. Ongoing persistence uses per-class folders, not that backup format.

## Requirements

- [Bun](https://bun.sh) for install and scripts
- Chrome or Edge for folder-backed storage

## Develop

```bash
bun install
bun run dev
```

## Test

```bash
bun run test
```

## Build (static SPA)

```bash
bun run build
```

Output is in `build/`. Serve as static files; the app uses `index.html` as SPA fallback.

## Check

```bash
bun run check
```
