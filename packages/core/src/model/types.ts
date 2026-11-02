/**
 * Internal merge model types.
 *
 * The editor keeps one row per diff line. Every pane (left, merged, right) renders exactly one
 * CodeMirror line per row, so rows stay aligned without any spacer bookkeeping.
 */

import type { CodeBlock } from '../types';

/**
 * `inserted` rows only exist in the merged result: they are created when free-edit text (or
 * `middleContent`) contains lines that do not correspond to any diff row.
 */
export type RowKind = 'unchanged' | 'added' | 'removed' | 'modified' | 'inserted';

export type Side = 'left' | 'right';

export interface MergeRow {
  kind: RowKind;
  /** Left (old) line content, `null` when the left side has no line in this row */
  left: string | null;
  /** Right (new) line content, `null` when the right side has no line in this row */
  right: string | null;
  /** 1-based line number in the left text */
  leftLineNo: number | null;
  /** 1-based line number in the right text */
  rightLineNo: number | null;
}

/** Per-row merge decision, stored in the merged editor's state */
export interface RowState {
  /** Whether the row contributes a line to the merged output */
  present: boolean;
  from: 'left' | 'right' | 'manual';
  resolved: boolean;
}

export interface MergeModel {
  rows: MergeRow[];
  blocks: CodeBlock[];
  /** Index into `blocks` for every row, or -1 */
  blockOfRow: Int32Array;
  /** Line separator used for the merged output */
  eol: '\n' | '\r\n';
  /** True when both inputs were empty and a single placeholder row was synthesised */
  synthetic: boolean;
  /** True when both inputs look like JSON (used by `language: 'auto'`) */
  json: boolean;
}

export interface MergeSnapshot {
  model: MergeModel;
  states: RowState[];
  /** Merged-pane text for every row (`''` for rows that are not present) */
  lines: string[];
  /** Whether the merged output ends with a line separator */
  finalNewline: boolean;
}

export interface CollapsedRegion {
  blockId: string;
  /** First hidden row (inclusive) */
  fromRow: number;
  /** Last hidden row (inclusive) */
  toRow: number;
  hiddenCount: number;
  canShowMoreAbove: boolean;
  canShowMoreBelow: boolean;
}

export interface RowUpdate {
  index: number;
  text: string;
  state: RowState;
}
