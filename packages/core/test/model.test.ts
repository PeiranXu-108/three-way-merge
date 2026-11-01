import { describe, expect, it } from 'vitest';
import { newContent as demoNew, oldContent as demoOld } from '../../../demo/src/demoData';
import {
  acceptUpdates,
  applyText,
  blockRowIndices,
  buildModel,
  charRanges,
  collapsedRegions,
  computeStats,
  formatJsonSafe,
  hasLossyNumbers,
  mergedText,
  type MergeSnapshot,
  type RowUpdate,
} from '../src/model';
import type { DiffLine } from '../src/types';
import { parseDiffToLines } from '../src/utils/diff';
import { buildRenderRows } from '../src/utils/virtual';

const build = (oldText: string, newText: string, middle?: string, normalizeJson = true) =>
  buildModel(oldText, newText, middle, { normalizeJson });

const applyUpdates = (snap: MergeSnapshot, updates: RowUpdate[]): MergeSnapshot => {
  const states = snap.states.slice();
  const lines = snap.lines.slice();
  for (const u of updates) {
    states[u.index] = u.state;
    lines[u.index] = u.text;
  }
  return { ...snap, states, lines };
};

const legacyStats = (lines: DiffLine[]) => ({
  total: lines.length,
  unchanged: lines.filter((l) => l.type === 'unchanged').length,
  added: lines.filter((l) => l.type === 'added').length,
  removed: lines.filter((l) => l.type === 'removed').length,
  modified: lines.filter((l) => l.type === 'modified').length,
  conflicts: lines.filter(
    (l) => l.leftContent !== null && l.rightContent !== null && l.leftContent !== l.rightContent && !l.conflictResolved
  ).length,
});

const parityFixtures: Array<[string, string, string]> = [
  ['demo JSON', demoOld, demoNew],
  ['text edits', 'a\nb\nc\nd\ne\n', 'a\nB\nc\ne\nf\n'],
  ['blank lines', 'x\n\ny\nz\n', 'x\ny\n\nz\n'],
  ['removal only', 'a\nb\nc\n', 'a\nc\n'],
  ['addition only', 'a\nc\n', 'a\nb\nc\n'],
];

describe('parity with the legacy row builder', () => {
  it.each(parityFixtures)('%s: same rows as parseDiffToLines', (_name, oldText, newText) => {
    const snap = build(oldText, newText);
    const legacy = parseDiffToLines(oldText, newText);
    expect(snap.model.rows.map((r) => [r.kind, r.left, r.right])).toEqual(
      legacy.map((l) => [l.type, l.leftContent, l.rightContent])
    );
  });

  it.each(parityFixtures)('%s: same stats as the legacy editor', (_name, oldText, newText) => {
    const snap = build(oldText, newText);
    expect(computeStats(snap.model, snap.states)).toEqual(legacyStats(parseDiffToLines(oldText, newText)));
  });

  it('collapses the same rows as buildRenderRows', () => {
    const snap = build(demoOld, demoNew);
    const state = { '0-0': { above: 0, below: 0, expanded: false } };
    const regions = collapsedRegions(snap.model, state, true);
    const legacyCollapsed = buildRenderRows(parseDiffToLines(demoOld, demoNew), state, true).filter(
      (r) => r.kind === 'collapsed'
    );
    expect(regions.map((r) => r.hiddenCount)).toEqual(legacyCollapsed.map((r) => (r as { hiddenCount: number }).hiddenCount));
    for (const region of regions) {
      expect(region.toRow - region.fromRow + 1).toBe(region.hiddenCount);
      for (let i = region.fromRow; i <= region.toRow; i += 1) expect(snap.model.rows[i].kind).toBe('unchanged');
    }
    expect(collapsedRegions(snap.model, {}, false)).toEqual([]);
  });
});

describe('initial merge', () => {
  it('defaults to the right side and preserves the final newline', () => {
    const snap = build('a\nb\n', 'a\nc\n', undefined, false);
    expect(mergedText(snap)).toBe('a\nc\n');
    expect(mergedText(build('a\nb', 'a\nc', undefined, false))).toBe('a\nc');
  });

  it('keeps CRLF line endings', () => {
    const snap = build('a\r\nb\r\n', 'a\r\nc\r\n', undefined, false);
    expect(snap.model.eol).toBe('\r\n');
    expect(snap.model.rows.map((r) => r.left)).toEqual(['a', 'b']);
    expect(mergedText(snap)).toBe('a\r\nc\r\n');
  });

  it('does not turn empty content into "{}"', () => {
    const snap = build('', 'hello\nworld\n');
    expect(snap.model.rows.map((r) => [r.kind, r.left, r.right])).toEqual([
      ['added', null, 'hello'],
      ['added', null, 'world'],
    ]);
    expect(mergedText(snap)).toBe('hello\nworld\n');
  });

  it('synthesises one editable row when both inputs are empty', () => {
    const snap = build('', '');
    expect(snap.model.synthetic).toBe(true);
    expect(snap.model.rows).toHaveLength(1);
    expect(computeStats(snap.model, snap.states).total).toBe(0);
    expect(mergedText(snap)).toBe('');
  });

  it('treats blank lines as real lines with line numbers', () => {
    const snap = build('a\n\nb', 'a\n\nc', undefined, false);
    expect(snap.model.rows[1]).toMatchObject({ kind: 'unchanged', left: '', right: '', leftLineNo: 2, rightLineNo: 2 });
  });

  it('reports real per-side line numbers', () => {
    const snap = build('x\ny', 'n1\nn2\nn3\nx\ny', undefined, false);
    expect(snap.model.rows.map((r) => [r.leftLineNo, r.rightLineNo])).toEqual([
      [null, 1],
      [null, 2],
      [null, 3],
      [1, 4],
      [2, 5],
    ]);
  });

  it('groups change blocks and maps rows to blocks', () => {
    const snap = build('a\nb\nc\nd\n', 'a\nB\nC\nd\n', undefined, false);
    expect(snap.model.blocks).toEqual([{ startIndex: 1, endIndex: 2, type: 'modified', lineCount: 2 }]);
    expect(Array.from(snap.model.blockOfRow)).toEqual([-1, 0, 0, -1]);
    expect(blockRowIndices(snap.model, 0)).toEqual([1, 2]);
  });
});

describe('JSON normalisation', () => {
  it('pretty-prints objects like the legacy normalizeJson', () => {
    expect(formatJsonSafe('{"a":1,"b":[1,2]}')).toBe('{\n  "a": 1,\n  "b": [\n    1,\n    2\n  ]\n}');
  });

  it('leaves scalars, invalid JSON and empty text untouched', () => {
    expect(formatJsonSafe('42')).toBe('42');
    expect(formatJsonSafe('true')).toBe('true');
    expect(formatJsonSafe('{oops')).toBe('{oops');
    expect(formatJsonSafe('')).toBe('');
  });

  it('skips formatting when numbers would lose precision', () => {
    const text = '{"id":12345678901234567890,"a":1}';
    expect(hasLossyNumbers(text)).toBe(true);
    expect(formatJsonSafe(text)).toBe(text);
    expect(hasLossyNumbers('{"id":9007199254740991,"pi":3.14159}')).toBe(false);
    expect(hasLossyNumbers('{"x":0.12345678901234567}')).toBe(true);
    expect(hasLossyNumbers('{"s":"12345678901234567890"}')).toBe(false);
  });

  it('can be disabled', () => {
    const snap = build('{"a":1}', '{"a":2}', undefined, false);
    expect(snap.model.rows.map((r) => [r.left, r.right])).toEqual([['{"a":1}', '{"a":2}']]);
  });
});

describe('accepting changes', () => {
  it('accepts a conflict line from the left and resolves it', () => {
    const snap = build('a\nb\n', 'a\nc\n', undefined, false);
    expect(computeStats(snap.model, snap.states).conflicts).toBe(1);
    const next = applyUpdates(snap, acceptUpdates(snap.model, snap.states, [1], 'left'));
    expect(mergedText(next)).toBe('a\nb\n');
    expect(next.states[1]).toEqual({ present: true, from: 'left', resolved: true });
    expect(computeStats(next.model, next.states).conflicts).toBe(0);
  });

  it('accept-all-left reproduces the left text, including removed rows', () => {
    const snap = build('a\nb\nc\n', 'a\nX\n', undefined, false);
    const all = snap.model.rows.map((_, i) => i);
    expect(mergedText(applyUpdates(snap, acceptUpdates(snap.model, snap.states, all, 'left')))).toBe('a\nb\nc\n');
    expect(mergedText(applyUpdates(snap, acceptUpdates(snap.model, snap.states, all, 'right')))).toBe('a\nX\n');
  });

  it('accepting the left side of an added row removes it from the output', () => {
    const snap = build('a\n', 'a\nnew\n', undefined, false);
    const next = applyUpdates(snap, acceptUpdates(snap.model, snap.states, [1], 'left'));
    expect(next.states[1].present).toBe(false);
    expect(mergedText(next)).toBe('a\n');
  });
});

describe('lossless text mapping (free-edit save and middleContent)', () => {
  it('keeps every line when the edited text has more lines than rows', () => {
    const snap = build('a\nb', 'a\nc', undefined, false);
    const next = applyText(snap, 'a\nX\nY\nZ', { trimEmptyLines: false });
    expect(mergedText(next)).toBe('a\nX\nY\nZ');
    expect(next.model.rows.map((r) => r.kind)).toEqual(['unchanged', 'modified', 'inserted', 'inserted']);
    expect(next.model).not.toBe(snap.model);
    // Mapping the same text again changes nothing.
    expect(mergedText(applyText(next, 'a\nX\nY\nZ', { trimEmptyLines: false }))).toBe('a\nX\nY\nZ');
  });

  it('passing the default merge back as middleContent is a no-op', () => {
    const base = build('a\nb\nc', 'a\nc', undefined, false);
    const echoed = build('a\nb\nc', 'a\nc', mergedText(base), false);
    expect(mergedText(echoed)).toBe('a\nc');
    expect(echoed.states).toEqual(base.states);
    expect(echoed.model.rows).toEqual(base.model.rows);
  });

  it('maps middleContent onto the right rows and classifies the choices', () => {
    const base = build('a\nb\nc\n', 'a\nB\nc\n', undefined, false);
    const fromLeft = build('a\nb\nc\n', 'a\nB\nc\n', 'a\nb\nc\n', false);
    expect(fromLeft.states[1]).toEqual({ present: true, from: 'left', resolved: true });
    expect(computeStats(fromLeft.model, fromLeft.states).conflicts).toBe(0);
    const manual = build('a\nb\nc\n', 'a\nB\nc\n', 'a\nmine\nc\n', false);
    expect(manual.states[1]).toEqual({ present: true, from: 'manual', resolved: true });
    expect(mergedText(manual)).toBe('a\nmine\nc\n');
    expect(base.states[1].resolved).toBe(false);
  });

  it('deleting lines makes rows absent and drops manual rows', () => {
    const snap = build('a\nb\nc', 'a\nb\nc', undefined, false);
    const withExtra = applyText(snap, 'a\nb\nextra\nc', { trimEmptyLines: false });
    const removed = applyText(withExtra, 'a\nc', { trimEmptyLines: false });
    expect(mergedText(removed)).toBe('a\nc');
    expect(removed.model.rows.map((r) => r.kind)).toEqual(['unchanged', 'unchanged', 'unchanged']);
    expect(removed.states[1].present).toBe(false);
  });

  it('optionally trims empty lines (legacy free-edit save)', () => {
    const snap = build('a\nb\n', 'a\nb\n', undefined, false);
    expect(mergedText(applyText(snap, 'a\n\n  \nb\n', { trimEmptyLines: true }))).toBe('a\nb\n');
    expect(mergedText(applyText(snap, 'a\n\nb\n', { trimEmptyLines: false }))).toBe('a\n\nb\n');
  });
});

describe('character ranges', () => {
  it('produces merged run-length ranges whose complements form the common subsequence', () => {
    const left = 'hello world, value: 1';
    const right = 'hello there, value: 2';
    const ranges = charRanges(left, right);
    const keep = (text: string, rs: Array<[number, number]>) => {
      let out = '';
      let pos = 0;
      for (const [from, to] of rs) {
        expect(from).toBeGreaterThan(pos === 0 && from === 0 ? -1 : pos - 1);
        out += text.slice(pos, from);
        pos = to;
      }
      return out + text.slice(pos);
    };
    expect(keep(left, ranges.left)).toBe(keep(right, ranges.right));
    expect(keep(left, ranges.left).startsWith('hello ')).toBe(true);
    for (const rs of [ranges.left, ranges.right]) {
      for (let i = 1; i < rs.length; i += 1) expect(rs[i][0]).toBeGreaterThan(rs[i - 1][1]);
    }
  });

  it('highlights whole lines when one side is missing or empty', () => {
    expect(charRanges('abc', null)).toEqual({ left: [[0, 3]], right: [] });
    expect(charRanges(null, 'abc')).toEqual({ left: [], right: [[0, 3]] });
    expect(charRanges('', 'abc')).toEqual({ left: [], right: [[0, 3]] });
    expect(charRanges('same', 'same')).toEqual({ left: [], right: [] });
  });
});

describe('large inputs', () => {
  it('builds 20k fully different lines quickly via the timeout fallback', () => {
    const lines = (n: number, f: (i: number) => string) => Array.from({ length: n }, (_, i) => f(i)).join('\n');
    const start = Date.now();
    const snap = build(lines(20000, (i) => `line ${i} aaaa`), lines(20000, (i) => `LINE ${i} bbbb`), undefined, false);
    expect(Date.now() - start).toBeLessThan(5000);
    expect(snap.model.rows).toHaveLength(20000);
  });
});
