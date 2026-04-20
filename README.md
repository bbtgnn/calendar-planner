# Lesson planner (teacher)

Browser-only lesson planner for multiple classes: semester hour targets, dated lessons, done/todo, student rosters (CRUD + `.txt` / `.csv` import), and absence marks per session. Data stays in **IndexedDB** (Dexie) on your device.

## Requirements

- [Bun](https://bun.sh) for install and scripts

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
