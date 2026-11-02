# three-way-diff-editor

VS Code-style three-column diff and merge editor for React, built on CodeMirror 6. The columns are left (old), merged result and right (new). You can accept changes per line, per block or all at once, edit the result freely, and collapse unchanged regions. It also provides character-level highlighting, light/dark themes and JSON highlighting.

For full docs, demo, and dev setup, see the [repository root](https://github.com/PeiranXu-108/three-way-merge).

## Install

```bash
npm install three-way-diff-editor
# or
pnpm add three-way-diff-editor
```

**Peer dependencies:** React 18 or 19

## Usage

```tsx
import { ThreeWayDiffEditor } from 'three-way-diff-editor';

<ThreeWayDiffEditor
  oldContent={leftText}
  newContent={rightText}
  onChange={setMerged}
  onHasChangesChange={setHasChanges}
  theme="dark"
/>
```

Styles are injected by the component. To import the CSS yourself (e.g. for overrides):

```ts
import 'three-way-diff-editor/styles';
```

## Props

| Prop | Type | Description |
|------|------|-------------|
| `oldContent` | `string` | Left column (required) |
| `newContent` | `string` | Right column (required) |
| `middleContent` | `string` | Initial merged content (mapped onto the diff rows) |
| `onChange` | `(merged: string) => void` | Called after every merge action or edit |
| `onHasChangesChange` | `(hasChanges: boolean) => void` | Unsaved changes flag |
| `defaultEditMode` | `boolean` | Start in free-edit mode |
| `leftColumnTitle` | `string` | Left column header |
| `rightColumnTitle` | `string` | Right column header |
| `collapseUnchangedLines` | `boolean` | Collapse unchanged blocks (default `true`) |
| `locale` | `'en' \| 'zh'` | Language (default `'en'`) |
| `messages` | `Partial<ThreeWayMessages>` | Override UI strings |
| `theme` | `'light' \| 'dark'` | VS Code Light+ / Dark+ (default `'light'`) |
| `language` | `'auto' \| 'json' \| 'text'` | Syntax highlighting (default `'auto'`) |
| `extensions` | `Extension[]` | Extra CodeMirror extensions (memoize the array) |
| `normalizeJson` | `boolean` | Pretty-print JSON before diffing (default `true`) |
| `trimEmptyLinesOnSave` | `boolean` | Drop empty lines on free-edit save (default `true`) |

## Ref handle

`getMergedContent()`, `acceptAllLeft()`, `acceptAllRight()`, `reset()`, `goToNextChange()`, `goToPreviousChange()`. Type: `ThreeWayDiffEditorHandle`.

## Types

```ts
import type {
  ThreeWayDiffEditorProps,
  ThreeWayDiffEditorHandle,
  DiffLine,
  DiffStats,
  CharDiff,
  ThreeWayMessages,
} from 'three-way-diff-editor';
```

## License

MIT
