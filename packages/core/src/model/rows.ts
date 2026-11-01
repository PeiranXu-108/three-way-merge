/**
 * Line diff → aligned rows.
 */

import { diffLines, type Change, type LinesOptions } from 'diff';
import type { DiffLine } from '../types';
import { identifyCodeBlocks, splitLines } from '../utils/diff';
import type { MergeModel, MergeRow, RowKind } from './types';

/** Upper bound for the line diff; beyond it rows are paired by index (one replaced block) */
export const DIFF_TIMEOUT_MS = 1000;

export const isConflictRow = (row: MergeRow): boolean =>
  row.left !== null && row.right !== null && row.left !== row.right;

export const createInsertedRow = (): MergeRow => ({
  kind: 'inserted',
  left: null,
  right: null,
  leftLineNo: null,
  rightLineNo: null,
});

const ensureTrailingNewline = (text: string) => (text === '' || text.endsWith('\n') ? text : `${text}\n`);

/**
 * Build aligned rows from two LF-normalised texts. Pairing rules match the legacy
 * `parseDiffToLines`: a removed hunk followed by an added hunk becomes `modified` rows
 * (`max(removed, added)` of them), otherwise rows are `removed` / `added` / `unchanged`.
 */
export const diffToRows = (left: string, right: string, timeout: number = DIFF_TIMEOUT_MS): MergeRow[] => {
  const rows: MergeRow[] = [];
  let leftNo = 1;
  let rightNo = 1;
  const push = (kind: RowKind, l: string | null, r: string | null) => {
    rows.push({
      kind,
      left: l,
      right: r,
      leftLineNo: l === null ? null : leftNo++,
      rightLineNo: r === null ? null : rightNo++,
    });
  };

  // Give both texts a final newline so the last line compares equal regardless of EOF newline.
  const a = ensureTrailingNewline(left);
  const b = ensureTrailingNewline(right);
  // `timeout` is supported by diff@5.2 but missing from @types/diff@5.
  const parts = diffLines(a, b, { timeout } as LinesOptions) as Change[] | undefined;

  if (!parts) {
    // Timed out: the texts are very different, so treat them as one replaced block.
    const ls = splitLines(a);
    const rs = splitLines(b);
    const n = Math.max(ls.length, rs.length);
    for (let i = 0; i < n; i += 1) {
      const l = i < ls.length ? ls[i] : null;
      const r = i < rs.length ? rs[i] : null;
      if (l === null) push('added', null, r);
      else if (r === null) push('removed', l, null);
      else push(l === r ? 'unchanged' : 'modified', l, r);
    }
    return rows;
  }

  for (let p = 0; p < parts.length; p += 1) {
    const part = parts[p];
    if (!part.added && !part.removed) {
      for (const content of splitLines(part.value)) push('unchanged', content, content);
      continue;
    }
    const next = parts[p + 1];
    if ((part.removed && next?.added) || (part.added && next?.removed)) {
      const removed = splitLines(part.removed ? part.value : next.value);
      const added = splitLines(part.added ? part.value : next.value);
      const n = Math.max(removed.length, added.length);
      for (let i = 0; i < n; i += 1) {
        push('modified', i < removed.length ? removed[i] : null, i < added.length ? added[i] : null);
      }
      p += 1;
      continue;
    }
    if (part.removed) {
      for (const content of splitLines(part.value)) push('removed', content, null);
    } else {
      for (const content of splitLines(part.value)) push('added', null, content);
    }
  }
  return rows;
};

export const createModel = (
  rows: MergeRow[],
  options: { eol: MergeModel['eol']; synthetic: boolean; json: boolean }
): MergeModel => {
  // Inserted rows are manual additions: they never belong to a change block.
  const typed = rows.map((row) => ({ type: row.kind === 'inserted' ? 'unchanged' : row.kind }) as DiffLine);
  const blocks = identifyCodeBlocks(typed);
  const blockOfRow = new Int32Array(rows.length).fill(-1);
  blocks.forEach((block, k) => {
    for (let i = block.startIndex; i <= block.endIndex; i += 1) blockOfRow[i] = k;
  });
  return { rows, blocks, blockOfRow, ...options };
};
