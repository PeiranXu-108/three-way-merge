# three-way-diff-editor

A **React** three-column (left / center / right) diff and merge editor: accept left/right per line, edit the merged result, virtual scrolling, and character-level highlighting.

## Features

- **Three-column view**: left (old / yours), center (merged result), right (new / theirs)
- **Merge actions**:
  - Toolbar: accept all left / accept all right / reset
  - Per line: choose accept left/right for conflict lines, or edit the line
  - Per block: accept left/right for contiguous change blocks
- **Free-edit mode**: edit the full merged content; on exit, confirm save or discard. Save trims empty lines (see “Behavior”).
- **Performance**: virtual scrolling (overscan) for large files
- **Character-level diff**: compare left/right and highlight character differences
- **Scroll sync**: three columns scroll together with connector lines between changed rows

## Install

```bash
npm i three-way-diff-editor
```

Or with pnpm:

```bash
pnpm add three-way-diff-editor
```

## Quick start

```tsx
import React, { useState } from 'react';
import { ThreeWayDiffEditor } from 'three-way-diff-editor';

export default function Example() {
  const [merged, setMerged] = useState('');

  return (
    <ThreeWayDiffEditor
      oldContent={`{\n  "a": 1\n}\n`}
      newContent={`{\n  "a": 2\n}\n`}
      onChange={(nextMerged) => setMerged(nextMerged)}
      onHasChangesChange={(hasChanges) => {
        // e.g. for "unsaved changes" hints
        console.log('hasChanges:', hasChanges);
      }}
    />
  );
}
```

## Styles (Less)

The component **does not** inject styles automatically. Import them at your app entry or where you use the editor. Use the package export:

```ts
import 'three-way-diff-editor/styles';
```

> Note: the `styles` export is a Less file (not compiled CSS). If your build does **not** support Less, add Less handling or compile this package’s Less in your pipeline.

## API

### `ThreeWayDiffEditorProps`

| Prop | Type | Required | Description |
| --- | --- | --- | --- |
| `oldContent` | `string` | Yes | Left column content (old / yours) |
| `newContent` | `string` | Yes | Right column content (new / theirs) |
| `middleContent` | `string` | No | Initial merged content; when provided, overrides the default merge per line and marks those lines as `manual` |
| `onChange` | `(mergedContent: string) => void` | No | Called when the merged result changes (line choice, inline edit, or free edit) |
| `onHasChangesChange` | `(hasChanges: boolean) => void` | No | Whether the result has changed from the initial state (e.g. for “unsaved changes”) |
| `defaultEditMode` | `boolean` | No | **Not used in current version** (reserved) |

### Exported types

You can import types from the package:

```ts
import type { DiffLine, DiffStats, ThreeWayDiffEditorProps } from 'three-way-diff-editor';
```

## Behavior (important)

- **Conflict**: a line is in conflict when both left and right have content and they differ (`leftContent !== null && rightContent !== null && leftContent !== rightContent`). Unresolved conflicts are counted as “remaining conflicts”.
- **Free-edit save**: on save, empty/whitespace-only lines are removed, then the result is synced back to internal `diffLines`.
- **`middleContent` alignment**: overrides by line index (`middleContent.split('\n')[index]`). If the string has fewer lines, extra lines are not overridden.

## Dependencies

### Peer dependencies

- `react` (>= 18)
- `react-dom` (>= 18)

### Dependencies

- `diff`

## Develop in this repo / run the demo

From the repository root:

```bash
pnpm install
pnpm --filter three-way-diff-demo dev
```


## License

MIT
