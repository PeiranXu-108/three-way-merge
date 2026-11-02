/**
 * Keeps the merged pane line-locked: one line per diff row, as in the legacy per-line editor.
 */

import { EditorSelection, Transaction, type ChangeSpec, type TransactionSpec } from '@codemirror/state';
import { programmatic } from './fields';

/**
 * Transaction filter for the merged pane. Inserted line breaks are dropped (the legacy editor
 * stripped `\r`/`\n` from typed or pasted text) and deletions that span line breaks become
 * per-line clears, so the number of lines never changes. Merge actions and undo/redo pass through.
 */
export const constrainRowEdits = (tr: Transaction): Transaction | TransactionSpec => {
  if (!tr.docChanged || tr.annotation(programmatic) || tr.isUserEvent('undo') || tr.isUserEvent('redo')) {
    return tr;
  }
  const doc = tr.startState.doc;
  let violates = false;
  tr.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
    if (violates) return;
    if (inserted.lines > 1) violates = true;
    else if (toA > fromA && doc.lineAt(fromA).number !== doc.lineAt(toA).number) violates = true;
  });
  if (!violates) return tr;

  const specs: ChangeSpec[] = [];
  /** Start position (in the old doc) and inserted length of every original change */
  const edits: Array<[number, number]> = [];
  tr.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
    const text = inserted.sliceString(0, inserted.length, '');
    edits.push([fromA, text.length]);
    const startLine = doc.lineAt(fromA);
    const endLine = doc.lineAt(toA);
    if (startLine.number === endLine.number) {
      specs.push({ from: fromA, to: toA, insert: text });
      return;
    }
    specs.push({ from: fromA, to: startLine.to, insert: text });
    for (let n = startLine.number + 1; n < endLine.number; n += 1) {
      const line = doc.line(n);
      if (line.length) specs.push({ from: line.from, to: line.to });
    }
    if (toA > endLine.from) specs.push({ from: endLine.from, to: toA });
  });

  const changes = tr.startState.changes(specs);
  const userEvent = tr.annotation(Transaction.userEvent);
  const rest = {
    effects: tr.effects,
    scrollIntoView: tr.scrollIntoView,
    annotations: userEvent ? Transaction.userEvent.of(userEvent) : undefined,
  };
  // Nothing left to change (e.g. Backspace at the start of a row): keep the cursor where it was.
  if (changes.empty) return { selection: tr.startState.selection, ...rest };

  // Put a cursor after each change's inserted text. `mapPos(from, -1)` is the start of the
  // replacement even when the original range was replaced, independent of assoc.
  const cursors = edits.map(([from, length]) => EditorSelection.cursor(changes.mapPos(from, -1) + length));
  const start = tr.startState.selection;
  const selection =
    cursors.length === start.ranges.length
      ? EditorSelection.create(cursors, start.mainIndex)
      : EditorSelection.create([cursors[cursors.length - 1]]);
  return { changes, selection, ...rest };
};
