/**
 * Build the initial merge snapshot from the editor inputs.
 */

import { applyText, initialState } from './operations';
import { createModel, diffToRows, DIFF_TIMEOUT_MS } from './rows';
import { detectEol, formatJsonSafe, looksLikeJson, normalizeEol } from './text';
import type { MergeRow, MergeSnapshot } from './types';

export interface BuildOptions {
  /** Pretty-print JSON objects/arrays before diffing (legacy default: true) */
  normalizeJson: boolean;
  timeout?: number;
}

export const buildModel = (
  oldContent: string,
  newContent: string,
  middleContent: string | undefined,
  options: BuildOptions
): MergeSnapshot => {
  const eol = detectEol(newContent, oldContent);
  const rawLeft = normalizeEol(oldContent);
  const rawRight = normalizeEol(newContent);
  const left = options.normalizeJson ? formatJsonSafe(rawLeft) : rawLeft;
  const right = options.normalizeJson ? formatJsonSafe(rawRight) : rawRight;
  const finalNewline = rawRight !== '' ? rawRight.endsWith('\n') : rawLeft.endsWith('\n');

  let rows: MergeRow[] = diffToRows(left, right, options.timeout ?? DIFF_TIMEOUT_MS);
  const synthetic = rows.length === 0;
  if (synthetic) {
    rows = [{ kind: 'unchanged', left: '', right: '', leftLineNo: null, rightLineNo: null }];
  }

  const model = createModel(rows, { eol, synthetic, json: looksLikeJson(left, right) });
  const snapshot: MergeSnapshot = {
    model,
    states: rows.map(initialState),
    lines: rows.map((row) => row.right ?? ''),
    finalNewline,
  };

  if (middleContent === undefined) return snapshot;

  const rawMiddle = normalizeEol(middleContent);
  const middle = options.normalizeJson ? formatJsonSafe(rawMiddle) : rawMiddle;
  const mapped = applyText(snapshot, middle, { trimEmptyLines: false, timeout: options.timeout });
  return { ...mapped, finalNewline: rawMiddle !== '' ? rawMiddle.endsWith('\n') : finalNewline };
};
