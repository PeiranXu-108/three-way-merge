# three-way-diff-editor

React three-column diff and merge editor: left (old) / center (merged) / right (new), with per-line or per-block accept, free-edit mode, virtual scrolling, and character-level highlighting.

## Install

```bash
npm install three-way-diff-editor
# or
pnpm add three-way-diff-editor
```

**Peer dependencies:** React 18+

## Usage

```tsx
import { ThreeWayDiffEditor } from 'three-way-diff-editor';

<ThreeWayDiffEditor
  oldContent={leftText}
  newContent={rightText}
  onChange={setMerged}
  onHasChangesChange={setHasChanges}
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
| `middleContent` | `string` | Initial merged content |
| `onChange` | `(merged: string) => void` | Called when merged result changes |
| `onHasChangesChange` | `(hasChanges: boolean) => void` | Unsaved changes flag |
| `leftColumnTitle` | `string` | Left column header |
| `rightColumnTitle` | `string` | Right column header |
| `collapseUnchangedLines` | `boolean` | Collapse unchanged blocks (default `true`) |
| `locale` | `'en' \| 'zh'` | Language (default `'en'`) |
| `messages` | `Partial<ThreeWayMessages>` | Override UI strings |

## Types

```ts
import type {
  ThreeWayDiffEditorProps,
  DiffLine,
  DiffStats,
  CharDiff,
  ThreeWayMessages,
} from 'three-way-diff-editor';
```

## Development and demo

This package lives in a monorepo. For full docs, demo, and dev setup, see the [repository root](https://github.com/your-username/threeWayMerge) (replace with your GitHub repo URL).

## License

MIT
