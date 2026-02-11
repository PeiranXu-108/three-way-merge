/**
 * Virtualized rendering helpers
 */

import { CollapsedBlockState, DiffLine, RenderRow } from '../types';
import { COLLAPSED_ROW_HEIGHT, COLLAPSE_THRESHOLD, CONTEXT_LINES, LINE_ROW_HEIGHT } from './constants';

export const clamp = (value: number, min: number, max: number) => {
  return Math.min(max, Math.max(min, value));
};

export const buildRowMetrics = (rows: RenderRow[]) => {
  const offsets = new Array(rows.length + 1);
  offsets[0] = 0;
  for (let i = 0; i < rows.length; i += 1) {
    offsets[i + 1] = offsets[i] + (rows[i].kind === 'line' ? LINE_ROW_HEIGHT : COLLAPSED_ROW_HEIGHT);
  }
  return { offsets, totalHeight: offsets[rows.length] };
};

export const findRowIndex = (offsets: number[], offset: number) => {
  let low = 0;
  let high = offsets.length - 1;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (offsets[mid] <= offset) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return Math.max(0, low - 1);
};

export const buildRenderRows = (
  diffLines: DiffLine[],
  collapsedState: Record<string, CollapsedBlockState>
): RenderRow[] => {
  const rows: RenderRow[] = [];
  let i = 0;

  while (i < diffLines.length) {
    const line = diffLines[i];
    const isUnchanged = line.type === 'unchanged';

    if (!isUnchanged) {
      rows.push({ kind: 'line', lineIndex: i, line });
      i += 1;
      continue;
    }

    let j = i;
    while (j < diffLines.length && diffLines[j].type === 'unchanged') j += 1;

    const start = i;
    const end = j - 1;
    const len = end - start + 1;
    const blockId = `${start}-${end}`;
    const state = collapsedState[blockId] || { above: 0, below: 0, expanded: false };

    if (len <= COLLAPSE_THRESHOLD || state.expanded) {
      for (let k = start; k <= end; k += 1) rows.push({ kind: 'line', lineIndex: k, line: diffLines[k] });
      i = j;
      continue;
    }

    const headKeep = Math.max(0, Math.min(len, CONTEXT_LINES + (state.above || 0)));
    const tailKeep = Math.max(0, Math.min(len, CONTEXT_LINES + (state.below || 0)));

    if (headKeep + tailKeep >= len) {
      for (let k = start; k <= end; k += 1) rows.push({ kind: 'line', lineIndex: k, line: diffLines[k] });
      i = j;
      continue;
    }

    for (let k = start; k < start + headKeep; k += 1) {
      rows.push({ kind: 'line', lineIndex: k, line: diffLines[k] });
    }

    const hiddenCount = len - headKeep - tailKeep;

    const remaining = hiddenCount;
    const canShowMoreAbove = remaining > 0 && headKeep < len - tailKeep;
    const canShowMoreBelow = remaining > 0 && tailKeep < len - headKeep;

    rows.push({
      kind: 'collapsed',
      blockId,
      startIndex: start,
      endIndex: end,
      hiddenCount,
      canShowMoreAbove,
      canShowMoreBelow,
    });

    for (let k = end - tailKeep + 1; k <= end; k += 1) {
      rows.push({ kind: 'line', lineIndex: k, line: diffLines[k] });
    }

    i = j;
  }

  return rows;
};
