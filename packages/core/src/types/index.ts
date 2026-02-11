/**
 * ThreeWayDiffEditor 类型定义
 */

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

export interface ThreeWayDiffEditorProps {
  oldContent: string;
  newContent: string;
  middleContent?: string;
  onChange?: (mergedContent: string) => void;
  onHasChangesChange?: (hasChanges: boolean) => void;
  defaultEditMode?: boolean;
  /** 左侧列标题，默认 "版本1" */
  leftColumnTitle?: string;
  /** 右侧列标题，默认 "版本2" */
  rightColumnTitle?: string;
  /** 是否折叠无 diff 的未变更行，默认 true（收缩）；设为 false 时始终展开 */
  collapseUnchangedLines?: boolean;
  /** 语言：'en' | 'zh'，默认 'en' */
  locale?: 'en' | 'zh';
  /** 覆盖部分文案 */
  messages?: Partial<ThreeWayMessages>;
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
