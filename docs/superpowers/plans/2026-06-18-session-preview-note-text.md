# Session preview: note text + screenshot — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show plain-text note bodies (frontmatter stripped) above screenshots in the sessions table expand row, with lazy loading via File System Access API.

**Architecture:** Add `stripNoteBody` next to existing frontmatter parsing and `loadNoteBody` parallel to `loadScreenshotObjectUrl`. Replace screenshot-only expand state in `+page.svelte` with unified per-lesson preview state; load note and image in parallel on expand.

**Tech Stack:** SvelteKit 2, Svelte 5, File System Access API, Vitest, Bun

**Spec:** `docs/superpowers/specs/2026-06-18-session-preview-note-text-design.md`

---

## File map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/lessonNotes/parseFrontmatter.ts` | **Modify** | Add `stripNoteBody` |
| `src/lib/lessonNotes/parseFrontmatter.test.ts` | **Modify** | Unit tests for `stripNoteBody` |
| `src/lib/lessonNotes/loadNoteBody.ts` | **Create** | Read note file, strip frontmatter |
| `src/routes/class/[classId]/+page.svelte` | **Modify** | Preview state, expand rules, detail row UI |

---

### Task 1: `stripNoteBody` helper

**Files:**
- Modify: `src/lib/lessonNotes/parseFrontmatter.ts`
- Modify: `src/lib/lessonNotes/parseFrontmatter.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { stripNoteBody } from './parseFrontmatter';

describe('stripNoteBody', () => {
	it('returns trimmed body after frontmatter', () => {
		const text = `---
data: 09/03/2026
durata: 4.5
---

- bullet one
- bullet two
`;
		expect(stripNoteBody(text)).toBe('- bullet one\n- bullet two');
	});

	it('returns empty string when only frontmatter', () => {
		expect(stripNoteBody('---\ndata: 01/01/2026\ndurata: 1\n---\n')).toBe('');
	});

	it('returns full trimmed text when no frontmatter', () => {
		expect(stripNoteBody('  hello\nworld  ')).toBe('hello\nworld');
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/lib/lessonNotes/parseFrontmatter.test.ts`  
Expected: FAIL (`stripNoteBody` not exported)

- [ ] **Step 3: Implement**

```ts
export function stripNoteBody(text: string): string {
	const fm = text.match(FRONTMATTER_RE);
	if (!fm) return text.trim();
	return text.slice(fm[0].length).trim();
}
```

- [ ] **Step 4: Run tests**

Run: `bun run test src/lib/lessonNotes/parseFrontmatter.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/lessonNotes/parseFrontmatter.ts src/lib/lessonNotes/parseFrontmatter.test.ts
git commit -m "feat(lessonNotes): add stripNoteBody helper"
```

---

### Task 2: `loadNoteBody` loader

**Files:**
- Create: `src/lib/lessonNotes/loadNoteBody.ts`

- [ ] **Step 1: Create loader** (mirror `loadScreenshot.ts`)

```ts
import type { ClassId } from '$lib/db/types';
import { hasFolderPermission } from '$lib/persistence/classFolder';
import { getFolderHandle } from '$lib/persistence/meta';
import { stripNoteBody } from './parseFrontmatter';
import type { MatchedNoteRef } from './types';

export async function loadNoteBody(
	classId: ClassId,
	ref: MatchedNoteRef
): Promise<{ ok: true; body: string } | { ok: false; message: string }> {
	const root = await getFolderHandle(classId);
	if (!root || !(await hasFolderPermission(root, 'read'))) {
		return { ok: false, message: 'Folder not available' };
	}
	try {
		const sub = await root.getDirectoryHandle(ref.folder);
		const fileHandle = await sub.getFileHandle(ref.fileName);
		const file = await fileHandle.getFile();
		const text = await file.text();
		return { ok: true, body: stripNoteBody(text) };
	} catch {
		return { ok: false, message: 'Could not load note' };
	}
}
```

- [ ] **Step 2: Run check**

Run: `bun run check`  
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/lessonNotes/loadNoteBody.ts
git commit -m "feat(lessonNotes): add loadNoteBody for session preview"
```

---

### Task 3: Sessions table preview UI

**Files:**
- Modify: `src/routes/class/[classId]/+page.svelte`

- [ ] **Step 1: Replace `imageByLesson` with `previewByLesson`**

```ts
type LessonPreviewState = {
	note?: { body?: string; loading?: boolean; error?: string };
	image?: { url?: string; loading?: boolean; error?: string };
};

let previewByLesson = $state<Record<string, LessonPreviewState>>({});
```

- [ ] **Step 2: Update `toggleExpand`, loaders, cleanup**

- Enable when `lesson.matchedNote || lesson.screenshotRef`
- On expand: call `ensureNoteLoaded` and/or `ensureScreenshotLoaded` in parallel
- On collapse: revoke URL, delete preview entry
- `refreshNotesFromFolder` and `$effect` cleanup: revoke all URLs, clear `previewByLesson`

- [ ] **Step 3: Update detail row markup**

- Condition: `expanded.has(lesson.id) && (lesson.matchedNote || lesson.screenshotRef)`
- Note block on top (loading / error / empty placeholder / `<pre>`)
- Screenshot block below (existing behavior)
- `aria-label="Show session preview"`
- `disabled={!lesson.matchedNote && !lesson.screenshotRef}`

- [ ] **Step 4: Add CSS**

```css
.lesson-preview-detail {
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
}
.note-body {
	font-family: ui-monospace, monospace;
	white-space: pre-wrap;
	word-break: break-word;
	background: #f6f8fb;
	padding: 0.75rem;
	border-radius: 4px;
	max-height: 40vh;
	overflow-y: auto;
	margin: 0;
}
.lesson-preview-detail img {
	max-width: 100%;
	max-height: 70vh;
	display: block;
}
```

- [ ] **Step 5: Run check + tests**

Run: `bun run check && bun run test`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/routes/class/[classId]/+page.svelte
git commit -m "feat(ui): show note text in session preview expand row"
```

---

### Task 4: Manual smoke test

- [ ] Expand session with note + screenshot → text on top, image below
- [ ] Expand note-only session → text only, button enabled
- [ ] Expand screenshot-only session → image only, button enabled
- [ ] Note with empty body → “No note content”
- [ ] Collapse and re-expand → reloads cleanly
