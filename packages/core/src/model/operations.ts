/**
 * Pure merge operations over the row model.
 */

import { diffArrays, type ArrayChange, type ArrayOptions } from 'diff';
import type { CollapsedBlockState, DiffLine, DiffStats } from '../types';
import { splitLines } from '../utils/diff';
import { buildRenderRows } from '../utils/virtual';
import { createInsertedRow, createModel, isConflictRow, DIFF_TIMEOUT_MS } from './rows';
import { normalizeEol } from './text';
import type { CollapsedRegion, MergeModel, MergeRow, MergeSnapshot, RowState, RowUpdate, Side } from './types';

export const sameState = (a: RowState, b: RowState): boolean =>
  a.present === b.present && a.from === b.from && a.resolved === b.resolved;

export const statesEqual = (a: readonly RowState[], b: readonly RowState[]): boolean =>
  a === b || (a.length === b.length && a.every((s, i) => sameState(s, b[i])));

export const initialState = (row: MergeRow): RowState => ({
  present: row.right !== null,
  from: 'right',
  resolved: !isConflictRow(row),
});

/** Row indices covered by a change block */
export const blockRowIndices = (model: MergeModel, blockIndex: number): number[] => {
  const block = model.blocks[blockIndex];
  if (!block) return [];
  const out: number[] = [];
  for (let i = block.startIndex; i <= block.endIndex; i += 1) out.push(i);
  return out;
};

/** Text and state updates for accepting one side on the given rows (legacy semantics) */
export const acceptUpdates = (
  model: MergeModel,
  states: readonly RowState[],
  indices: Iterable<number>,
  side: Side
): RowUpdate[] => {
  const out: RowUpdate[] = [];
  for (const index of indices) {
    const row = model.rows[index];
    if (!row) continue;
    const content = side === 'left' ? row.left : row.right;
    out.push({
      index,
      text: content ?? '',
      state: {
        present: content !== null,
        from: side,
        resolved: isConflictRow(row) ? true : states[index].resolved,
      },
    });
  }
  return out;
};

/** Join the present rows' lines into the merged output */
export const joinMerged = (
  states: readonly RowState[],
  lineAt: (index: number) => string,
  eol: string,
  finalNewline: boolean
): string => {
  const out: string[] = [];
  for (let i = 0; i < states.length; i += 1) if (states[i].present) out.push(lineAt(i));
  if (out.length === 0) return '';
  return out.join(eol) + (finalNewline ? eol : '');
};

export const mergedText = (snap: MergeSnapshot): string =>
  joinMerged(snap.states, (i) => snap.lines[i], snap.model.eol, snap.finalNewline);

/** Statistics with the same definitions as the legacy editor */
export const computeStats = (model: MergeModel, states: readonly RowState[]): DiffStats => {
  const stats: DiffStats = { total: 0, unchanged: 0, added: 0, removed: 0, modified: 0, conflicts: 0 };
  if (model.synthetic) return stats;
  model.rows.forEach((row, i) => {
    if (row.kind === 'inserted') return;
    stats.total += 1;
    stats[row.kind] += 1;
    if (isConflictRow(row) && !states[i].resolved) stats.conflicts += 1;
  });
  return stats;
};

/** Hidden row ranges for unchanged runs, using the legacy `buildRenderRows` rules */
export const collapsedRegions = (
  model: MergeModel,
  collapseState: Record<string, CollapsedBlockState>,
  enabled: boolean
): CollapsedRegion[] => {
  const typed = model.rows.map((row) => ({ type: row.kind === 'unchanged' ? 'unchanged' : 'modified' }) as DiffLine);
  const renderRows = buildRenderRows(typed, collapseState, enabled);
  const regions: CollapsedRegion[] = [];
  for (let k = 0; k < renderRows.length; k += 1) {
    const row = renderRows[k];
    if (row.kind !== 'collapsed') continue;
    const prev = renderRows[k - 1];
    const next = renderRows[k + 1];
    const fromRow =
      prev && prev.kind === 'line' && prev.lineIndex >= row.startIndex ? prev.lineIndex + 1 : row.startIndex;
    const toRow = next && next.kind === 'line' && next.lineIndex <= row.endIndex ? next.lineIndex - 1 : row.endIndex;
    regions.push({
      blockId: row.blockId,
      fromRow,
      toRow,
      hiddenCount: row.hiddenCount,
      canShowMoreAbove: row.canShowMoreAbove,
      canShowMoreBelow: row.canShowMoreBelow,
    });
  }
  return regions;
};

const stateForText = (row: MergeRow, prev: RowState, text: string | null): RowState => {
  if (text === null) {
    if (row.left === null) return { present: false, from: 'left', resolved: prev.resolved };
    if (row.right === null) return { present: false, from: 'right', resolved: prev.resolved };
    return { present: false, from: 'manual', resolved: true };
  }
  if (text === row.left && row.left !== row.right) return { present: true, from: 'left', resolved: true };
  if (text === row.right) return { present: true, from: 'right', resolved: prev.resolved };
  return { present: true, from: 'manual', resolved: isConflictRow(row) ? true : prev.resolved };
};

export interface ApplyTextOptions {
  /** Remove empty / whitespace-only lines first (legacy free-edit save behaviour) */
  trimEmptyLines: boolean;
  timeout?: number;
}

/**
 * Map an arbitrary merged text back onto the rows without losing any line.
 *
 * The present rows' lines are diffed against the new lines: equal lines keep their rows, replaced
 * lines are written into the paired rows, deleted lines make rows absent, and extra lines become
 * new `inserted` rows placed after the preceding row. Returns the same `model` object when the row
 * structure is unchanged.
 */
export const applyText = (snap: MergeSnapshot, text: string, options: ApplyTextOptions): MergeSnapshot => {
  const { model, states, lines } = snap;
  let normalized = normalizeEol(text);
  const finalNewline = normalized !== '' ? normalized.endsWith('\n') : snap.finalNewline;
  if (options.trimEmptyLines) {
    normalized = normalized
      .split('\n')
      .filter((line) => line.trim() !== '')
      .join('\n');
  }
  const nextLines = splitLines(normalized);

  const present: number[] = [];
  states.forEach((s, i) => {
    if (s.present) present.push(i);
  });
  const current = present.map((i) => lines[i]);

  const diffed = diffArrays(current, nextLines, {
    timeout: options.timeout ?? DIFF_TIMEOUT_MS,
  } as ArrayOptions<string, string>) as ArrayChange<string>[] | undefined;
  const parts: ArrayChange<string>[] = diffed ?? [
    ...(current.length ? [{ value: current, count: current.length, removed: true }] : []),
    ...(nextLines.length ? [{ value: nextLines, count: nextLines.length, added: true }] : []),
  ];

  const assign = new Map<number, string | null>();
  const inserts = new Map<number, string[]>();
  const addInsert = (after: number, values: string[]) => {
    if (!values.length) return;
    const list = inserts.get(after);
    if (list) list.push(...values);
    else inserts.set(after, [...values]);
  };

  let pi = 0;
  for (let h = 0; h < parts.length; h += 1) {
    const part = parts[h];
    if (!part.added && !part.removed) {
      pi += part.value.length;
      continue;
    }
    let removedValues: string[] = [];
    let addedValues: string[] = [];
    const next = parts[h + 1];
    if (part.removed) {
      removedValues = part.value;
      if (next?.added) {
        addedValues = next.value;
        h += 1;
      }
    } else {
      addedValues = part.value;
      if (next?.removed) {
        removedValues = next.value;
        h += 1;
      }
    }
    const k = removedValues.length;
    const m = addedValues.length;
    for (let j = 0; j < k; j += 1) assign.set(present[pi + j], j < m ? addedValues[j] : null);
    if (m > k) {
      const after = k > 0 ? present[pi + k - 1] : pi > 0 ? present[pi - 1] : -1;
      addInsert(after, addedValues.slice(k));
    }
    pi += k;
  }

  if (assign.size === 0 && inserts.size === 0) return { ...snap, finalNewline };

  const rows: MergeRow[] = [];
  const outStates: RowState[] = [];
  const outLines: string[] = [];
  let structural = false;
  const emitInserted = (after: number) => {
    const values = inserts.get(after);
    if (!values) return;
    structural = true;
    for (const value of values) {
      rows.push(createInsertedRow());
      outStates.push({ present: true, from: 'manual', resolved: true });
      outLines.push(value);
    }
  };

  emitInserted(-1);
  model.rows.forEach((row, i) => {
    if (assign.has(i)) {
      const value = assign.get(i) as string | null;
      if (value === null && row.kind === 'inserted') {
        // A manual row whose line was deleted disappears entirely.
        structural = true;
        emitInserted(i);
        return;
      }
      outStates.push(value === lines[i] ? states[i] : stateForText(row, states[i], value));
      outLines.push(value ?? '');
    } else {
      outStates.push(states[i]);
      outLines.push(lines[i]);
    }
    rows.push(row);
    emitInserted(i);
  });

  if (rows.length === 0) {
    // Keep at least one row so every pane has a line to edit.
    rows.push(createInsertedRow());
    outStates.push({ present: false, from: 'manual', resolved: true });
    outLines.push('');
  }

  const nextModel = structural
    ? createModel(rows, { eol: model.eol, synthetic: model.synthetic, json: model.json })
    : model;
  return { model: nextModel, states: outStates, lines: outLines, finalNewline };
};
