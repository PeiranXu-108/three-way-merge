/**
 * Character-level change ranges for one aligned row (run-length, no per-character objects).
 */

import { diffChars, type BaseOptions, type Change } from 'diff';

export type Range = [from: number, to: number];

export interface CharRanges {
  /** Ranges removed from the left line */
  left: Range[];
  /** Ranges added to the right line */
  right: Range[];
}

/** Lines longer than this are highlighted as a whole instead of character by character */
export const CHAR_DIFF_MAX_LENGTH = 2000;
export const CHAR_DIFF_TIMEOUT_MS = 30;

const EMPTY: CharRanges = { left: [], right: [] };
const whole = (text: string): Range[] => (text.length ? [[0, text.length]] : []);

const pushRange = (ranges: Range[], from: number, to: number) => {
  const last = ranges[ranges.length - 1];
  if (last && last[1] === from) last[1] = to;
  else ranges.push([from, to]);
};

export const charRanges = (left: string | null, right: string | null): CharRanges => {
  if (left === null && right === null) return EMPTY;
  if (left === null) return { left: [], right: whole(right as string) };
  if (right === null) return { left: whole(left), right: [] };
  if (left === right) return EMPTY;
  if (left.length > CHAR_DIFF_MAX_LENGTH || right.length > CHAR_DIFF_MAX_LENGTH) {
    return { left: whole(left), right: whole(right) };
  }

  const parts = diffChars(left, right, { timeout: CHAR_DIFF_TIMEOUT_MS } as BaseOptions) as Change[] | undefined;
  if (!parts) return { left: whole(left), right: whole(right) };

  const out: CharRanges = { left: [], right: [] };
  let li = 0;
  let ri = 0;
  for (const part of parts) {
    const len = part.value.length;
    if (part.removed) {
      pushRange(out.left, li, li + len);
      li += len;
    } else if (part.added) {
      pushRange(out.right, ri, ri + len);
      ri += len;
    } else {
      li += len;
      ri += len;
    }
  }
  return out;
};
