# Three-Way Diff Editor

A React three-column diff and merge editor with a VS Code look, built on [CodeMirror 6](https://codemirror.net/). Compare two versions (left / right), resolve changes per line, per block or all at once, and edit the merged result in the middle.

## Features

- **Three aligned columns:** left (old / yours), merged result, right (new / theirs). Every pane is a CodeMirror editor with one line per diff row, so rows stay aligned and the panes scroll together.
- **Merge controls:**
  - Toolbar: accept all left, accept all right, reset.
  - Per block: ▶ / ◀ in the merged pane's gutters.
  - Per line: › / ‹ on conflict lines; the chosen side is highlighted.
  - Accepts can be undone and redone (`Ctrl/Cmd+Z`), together with the merge decisions.
- **Editing the result:** type directly in the merged pane (one line per row, like the original editor). For multi-line edits, use **Free edit**, a full editor whose changes are mapped back onto the rows without losing lines. Leaving it with changes asks to save or discard.
- **Collapsed unchanged regions:** long unchanged runs collapse to "Show all N lines / ▲ 10 / ▼ 10", in sync across all panes.
- **Highlighting:**
  - Character-level highlighting of changes.
  - Connector strips between panes show which rows correspond, and follow the mouse.
  - JSON syntax highlighting.
- **VS Code look and keys:** Light+ / Dark+ themes, search (`Ctrl/Cmd+F`), next/previous change (`F7` / `Shift+F7`).
- **Large files:** CodeMirror renders only what is visible. A 20k-line file opens in about 0.5 s.
- **i18n:** English and Chinese (`locale="en" | "zh"`), with per-string overrides.

## Install

```bash
npm install three-way-diff-editor
# or
pnpm add three-way-diff-editor
```

**Peer dependencies:** React 18 or 19. CodeMirror packages are regular dependencies.

## Quick start

```tsx
import { useRef, useState } from 'react';
import { ThreeWayDiffEditor, type ThreeWayDiffEditorHandle } from 'three-way-diff-editor';

function App() {
  const [merged, setMerged] = useState('');
  const editor = useRef<ThreeWayDiffEditorHandle>(null);

  return (
    <>
      <ThreeWayDiffEditor
        ref={editor}
        oldContent={'line 1\nline 2\n'}
        newContent={'line 1\nline 2 changed\n'}
        onChange={setMerged}
        onHasChangesChange={(hasChanges) => console.log('Unsaved:', hasChanges)}
        theme="dark"
      />
      <button onClick={() => console.log(editor.current?.getMergedContent())}>Export</button>
    </>
  );
}
```

Styles are injected automatically. To use the raw CSS (e.g. for overrides):

```ts
import 'three-way-diff-editor/styles';
```

The editor fills its container's height: the root element `.three-way-diff-container` defaults to `height: calc(100vh - 150px)`, so override that in your own CSS when needed.

## API

### Props

| Prop | Type | Description |
|------|------|-------------|
| `oldContent` | `string` | Left column content (required) |
| `newContent` | `string` | Right column content (required) |
| `middleContent` | `string` | Initial merged content, mapped onto the diff rows (see Behavior) |
| `onChange` | `(merged: string) => void` | Called with the merged result after every merge action or edit (not on the initial render) |
| `onHasChangesChange` | `(hasChanges: boolean) => void` | Called with `false` after loading, then whenever the unsaved-changes state flips |
| `defaultEditMode` | `boolean` | Open the merged result in free-edit mode on mount |
| `leftColumnTitle` | `string` | Left column header (default from locale) |
| `rightColumnTitle` | `string` | Right column header (default from locale) |
| `collapseUnchangedLines` | `boolean` | Collapse unchanged blocks (default `true`) |
| `locale` | `'en' \| 'zh'` | Language (default `'en'`) |
| `messages` | `Partial<ThreeWayMessages>` | Override UI strings |
| `theme` | `'light' \| 'dark'` | VS Code Light+ / Dark+ (default `'light'`) |
| `language` | `'auto' \| 'json' \| 'text'` | Syntax highlighting; `auto` enables JSON when both inputs are JSON (default `'auto'`) |
| `extensions` | `Extension[]` | Extra CodeMirror extensions for every pane (memoize the array) |
| `normalizeJson` | `boolean` | Pretty-print JSON objects/arrays before diffing (default `true`) |
| `trimEmptyLinesOnSave` | `boolean` | Drop empty lines when saving free-edit changes (default `true`) |

### Ref handle

| Method | Description |
|--------|-------------|
| `getMergedContent()` | Current merged result (including unsaved free-edit text) |
| `acceptAllLeft()` / `acceptAllRight()` | Same as the toolbar buttons |
| `reset()` | Restore the initial merge |
| `goToNextChange()` / `goToPreviousChange()` | Move to the next / previous change block |

```ts
import type {
  ThreeWayDiffEditorProps,
  ThreeWayDiffEditorHandle,
  ThreeWayMessages,
  DiffLine,
  DiffStats,
  CharDiff,
} from 'three-way-diff-editor';
```

### Keyboard

| Keys | Action |
|------|--------|
| `F7` / `Shift+F7` | Next / previous change |
| `Ctrl/Cmd+F` | Search in the focused pane |
| `Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z` | Undo / redo in the merged pane (including accepts) |
| `Tab` | Insert two spaces in the merged pane |
| `Ctrl/Cmd+Shift+K` | Clear the current merged line |

## Behavior

- **Conflict:** a line is in conflict when both sides have it and the contents differ. Unresolved conflicts are counted in the stats; accepting a side or editing the line resolves it.
- **Merged pane:** one line per diff row. Rows that are not part of the result (for example after accepting a side that has no such line) show as hatched placeholders. Enter is disabled, and pasted line breaks are removed, as in the original per-line editor. Use **Free edit** for multi-line changes.
- **Free-edit save:** the edited text is matched line by line against the current result. Unchanged lines keep their rows, edited lines are written into their rows, deleted lines are removed, and extra lines become new rows (shown as placeholders on both sides). Nothing is lost. With `trimEmptyLinesOnSave` (default), empty lines are removed first. **Discard** restores the previous result and reports it through `onChange`.
- **`middleContent`:** mapped onto the rows the same way. Lines equal to the left side count as "accepted left", lines matching neither side as manual edits. Passing back the value received from `onChange` does not reset the editor.
- **Line endings:** CRLF input produces CRLF output, and a final newline is kept when the input had one.
- **JSON:** with `normalizeJson` (default), JSON objects and arrays are pretty-printed with two spaces before diffing. Empty text, non-JSON text, and JSON whose numbers would lose precision (integers beyond 2^53, decimals with more than 15 significant digits) are left as they are.

## Migrating from 0.1.x

The props are unchanged; the following behavior changed:

- Line numbers are the real line numbers of each text (0.1.x showed row indexes), and blank lines keep their number.
- Free-edit save no longer drops lines that do not correspond to an existing row, and `middleContent` no longer shifts lines after a removed row.
- Discarding free-edit changes now calls `onChange` with the restored value.
- The final newline and CRLF line endings are preserved in the output.
- Empty content is no longer shown as `{}`, and JSON is not reformatted when that would lose number precision.
- `onChange` is called once per action (0.1.x called it twice under React StrictMode).
- `defaultEditMode` is implemented.
- The per-line accept buttons described in the 0.1.x README are now rendered.
- Styling changed (VS Code look). The line class names (`removed-line`, `added-line`, `modified-line`, `merged-line`, `has-conflict`, `from-left`, `code-block-*`, `char-added` / `char-removed`, `collapsed-row`) are kept on the CodeMirror lines. Colours are CSS variables on `.three-way-diff-container`, so they can be overridden.

## Repo structure

- **`packages/core`:** publishable package `three-way-diff-editor`.
  - `src/model`: the pure merge model (rows, mapping, stats).
  - `src/cm`: CodeMirror extensions.
  - `src/editor/MergeController.ts`: coordinates the panes.
- **`demo`:** Vite demo app. Switch between samples (JSON, a 20k-line file, CRLF, empty side, blank lines), themes and locales, or compare with the published legacy 0.1.1 (`?impl=legacy`).
- **`e2e`:** Playwright tests that drive the demo.

## Development

Uses **pnpm** (do not use `npm install` in subpackages; `workspace:*` requires root install).

```bash
pnpm install
pnpm run dev          # run the demo
pnpm run build        # build core + demo for production
pnpm test             # unit tests (vitest)
pnpm test:e2e         # browser tests (Playwright, starts the demo dev server)
```

Run only the demo:

```bash
pnpm --filter three-way-diff-demo dev
```

## License

MIT
