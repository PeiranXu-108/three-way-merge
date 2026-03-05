# Three-Way Diff Editor

A React three-column diff and merge editor: compare two versions (left / right), resolve conflicts per line or per block, and edit the merged result with virtual scrolling and character-level highlighting.

## Features

- **Three-column layout** — Left (old / yours), center (merged result), right (new / theirs) with scroll sync and connector lines
- **Merge controls** — Toolbar: accept all left / accept all right / reset; per line: accept left, accept right, or edit; per block: accept left/right for contiguous changes
- **Free-edit mode** — Edit the full merged text; save or discard on exit (empty lines are trimmed on save)
- **Performance** — Virtual scrolling with overscan for large files
- **Character-level diff** — Inline highlighting of character differences between left and right
- **i18n** — English and Chinese (`locale="en"` | `"zh"`), with optional message overrides

## Install

```bash
npm install three-way-diff-editor
# or
pnpm add three-way-diff-editor
```

**Peer dependencies:** React 18+

## Quick start

```tsx
import { ThreeWayDiffEditor } from 'three-way-diff-editor';

function App() {
  const [merged, setMerged] = useState('');

  return (
    <ThreeWayDiffEditor
      oldContent="line 1\nline 2\n"
      newContent="line 1\nline 2 changed\n"
      onChange={setMerged}
      onHasChangesChange={(hasChanges) => console.log('Unsaved:', hasChanges)}
    />
  );
}
```

Styles are injected automatically. To use the raw CSS (e.g. for overrides):

```ts
import 'three-way-diff-editor/styles';
```

## API

| Prop | Type | Description |
|------|------|-------------|
| `oldContent` | `string` | Left column content (required) |
| `newContent` | `string` | Right column content (required) |
| `middleContent` | `string` | Initial merged content; overrides default merge and marks lines as manual |
| `onChange` | `(merged: string) => void` | Called when the merged result changes |
| `onHasChangesChange` | `(hasChanges: boolean) => void` | Called when there are unsaved changes |
| `leftColumnTitle` | `string` | Left column header (default from locale) |
| `rightColumnTitle` | `string` | Right column header (default from locale) |
| `collapseUnchangedLines` | `boolean` | Collapse unchanged blocks (default `true`) |
| `locale` | `'en' \| 'zh'` | Language (default `'en'`) |
| `messages` | `Partial<ThreeWayMessages>` | Override UI strings |

```ts
import type {
  ThreeWayDiffEditorProps,
  DiffLine,
  DiffStats,
  CharDiff,
  ThreeWayMessages,
} from 'three-way-diff-editor';
```

## Behavior

- **Conflict:** a line is in conflict when both left and right differ. Unresolved conflicts are counted and shown in the stats.
- **Free-edit save:** on save, empty/whitespace-only lines are removed, then the result is applied.
- **`middleContent`:** overrides merged content by line index; if it has fewer lines, extra lines are left as the default merge.

## Repo structure

- **`packages/core`** — Publishable package `three-way-diff-editor`
- **`demo`** — Vite demo app

## Development

Uses **pnpm** (do not use `npm install` in subpackages; `workspace:*` requires root install).

```bash
pnpm install
pnpm run dev          # build core + run demo
pnpm run build        # build core + demo for production
```

Run only the demo:

```bash
pnpm --filter three-way-diff-demo dev
```

## License

MIT
