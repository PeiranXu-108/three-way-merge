/**
 * ThreeWayDiffEditor type definitions
 */

import type { Extension } from '@codemirror/state';
import type { ThreeWayMessages } from '../i18n';

export interface CharDiff {
  type: 'added' | 'removed' | 'unchanged';
  value: string;
  index: number;
}

export interface DiffLine {
  lineNumber: number;
  type: 'unchanged' | 'added' | 'removed' | 'modified';
  leftContent: string | null;
  rightContent: string | null;
  mergedContent: string | null;
  selectedFrom: 'left' | 'right' | 'manual';
  conflictResolved?: boolean;
  leftCharDiffs?: CharDiff[];
  rightCharDiffs?: CharDiff[];
}

export type EditorTheme = 'light' | 'dark';

/** `auto` enables JSON syntax highlighting when both inputs are JSON objects/arrays */
export type EditorLanguage = 'auto' | 'json' | 'text';

export interface ThreeWayDiffEditorProps {
  oldContent: string;
  newContent: string;
  /** Initial merged content; mapped onto the diff rows (lines that match neither side become manual) */
  middleContent?: string;
  /** Called with the merged result after every merge action or edit (not on initial render) */
  onChange?: (mergedContent: string) => void;
  /** Called with `false` after loading, then whenever the unsaved-changes state flips */
  onHasChangesChange?: (hasChanges: boolean) => void;
  /** Open the merge result in free-edit mode on mount */
  defaultEditMode?: boolean;
  /** Left column title, default "Version 1" */
  leftColumnTitle?: string;
  /** Right column title, default "Version 2" */
  rightColumnTitle?: string;
  /** Whether to collapse unchanged lines with no diff, default true (collapsed); set to false to always expand */
  collapseUnchangedLines?: boolean;
  /** Language: 'en' | 'zh', default 'en' */
  locale?: 'en' | 'zh';
  /** Override some text content */
  messages?: Partial<ThreeWayMessages>;
  /** Colour theme (VS Code Light+ / Dark+), default 'light' */
  theme?: EditorTheme;
  /** Syntax highlighting, default 'auto' */
  language?: EditorLanguage;
  /** Extra CodeMirror extensions applied to every pane (memoize the array) */
  extensions?: Extension[];
  /** Pretty-print JSON objects/arrays before diffing, default true (legacy behaviour) */
  normalizeJson?: boolean;
  /** Remove empty / whitespace-only lines when saving free-edit changes, default true (legacy behaviour) */
  trimEmptyLinesOnSave?: boolean;
}

/** Imperative API exposed through `ref` */
export interface ThreeWayDiffEditorHandle {
  /** Current merged result (including unsaved free-edit text) */
  getMergedContent(): string;
  acceptAllLeft(): void;
  acceptAllRight(): void;
  /** Restore the initial merge */
  reset(): void;
  /** Move the cursor to the next change block (F7) */
  goToNextChange(): void;
  /** Move the cursor to the previous change block (Shift+F7) */
  goToPreviousChange(): void;
}

export interface CodeBlock {
  startIndex: number;
  endIndex: number;
  type: 'removed' | 'added' | 'modified';
  lineCount: number;
}

export type CollapsedBlockState = {
  above: number;
  below: number;
  expanded: boolean;
};

export type RenderRow =
  | { kind: 'line'; lineIndex: number; line: DiffLine }
  | {
      kind: 'collapsed';
      blockId: string;
      startIndex: number;
      endIndex: number;
      hiddenCount: number;
      canShowMoreAbove: boolean;
      canShowMoreBelow: boolean;
    };

export interface DiffStats {
  total: number;
  unchanged: number;
  added: number;
  removed: number;
  modified: number;
  conflicts: number;
}
