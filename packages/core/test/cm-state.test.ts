import { history, redo, undo } from '@codemirror/commands';
import { EditorState, Transaction } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { constrainRowEdits } from '../src/cm/constrain';
import {
  computeRowStatesValue,
  manualEditTracker,
  modelFacet,
  programmatic,
  rowStateField,
  rowStateHistory,
  setRowStates,
} from '../src/cm/fields';
import { buildModel } from '../src/model';

const lockedState = (doc: string, anchor = 0, head = anchor) =>
  EditorState.create({
    doc,
    selection: { anchor, head },
    extensions: [EditorState.transactionFilter.of(constrainRowEdits), EditorState.allowMultipleSelections.of(true)],
  });

describe('line-locked merged pane', () => {
  it('strips typed or pasted line breaks', () => {
    const state = lockedState('abc\ndef', 1);
    const next = state.update({ changes: { from: 1, insert: 'x\ny' }, userEvent: 'input.paste' }).state;
    expect(next.doc.toString()).toBe('axybc\ndef');
    expect(next.selection.main.head).toBe(3);
  });

  it('ignores Enter-like insertions and Backspace at line start', () => {
    const state = lockedState('abc\ndef');
    expect(state.update({ changes: { from: 3, insert: '\n' }, userEvent: 'input' }).state.doc.toString()).toBe('abc\ndef');
    expect(state.update({ changes: { from: 3, to: 4 }, userEvent: 'delete.backward' }).state.doc.toString()).toBe(
      'abc\ndef'
    );
  });

  it('turns cross-line deletions into per-line clears', () => {
    const state = lockedState('abc\ndef\nghi', 1, 9);
    const next = state.update({ changes: { from: 1, to: 9, insert: 'X' }, userEvent: 'input.type' }).state;
    expect(next.doc.toString()).toBe('aX\n\nhi');
    expect(next.doc.lines).toBe(3);
    expect(next.selection.main.head).toBe(2);
  });

  it('lets programmatic transactions through', () => {
    const state = lockedState('abc');
    const next = state.update({ changes: { from: 3, insert: '\nmore' }, annotations: programmatic.of(true) }).state;
    expect(next.doc.lines).toBe(2);
  });
});

describe('row state history', () => {
  const setup = () => {
    const snap = buildModel('a\nb\n', 'a\nc\n', undefined, { normalizeJson: false });
    const state = EditorState.create({
      doc: snap.lines.join('\n'),
      extensions: [
        history(),
        modelFacet.of(snap.model),
        rowStateField.init(() => computeRowStatesValue(snap.states)),
        rowStateHistory,
        manualEditTracker,
        EditorState.transactionFilter.of(constrainRowEdits),
      ],
    });
    return { snap, state };
  };
  const run = (state: EditorState, command: typeof undo) => {
    let result = state;
    command({ state, dispatch: (tr: Transaction) => (result = tr.state) });
    return result;
  };

  it('undoes and redoes an accept together with its row decision', () => {
    const { snap, state } = setup();
    const line = state.doc.line(2);
    const accepted = state.update({
      changes: { from: line.from, to: line.to, insert: 'b' },
      effects: setRowStates.of([{ index: 1, prev: snap.states[1], next: { present: true, from: 'left', resolved: true } }]),
      annotations: [programmatic.of(true), Transaction.userEvent.of('twd.accept')],
    }).state;
    expect(accepted.doc.toString()).toBe('a\nb');
    expect(accepted.field(rowStateField).states[1].from).toBe('left');

    const undone = run(accepted, undo);
    expect(undone.doc.toString()).toBe('a\nc');
    expect(undone.field(rowStateField).states[1]).toEqual(snap.states[1]);

    const redone = run(undone, redo);
    expect(redone.doc.toString()).toBe('a\nb');
    expect(redone.field(rowStateField).states[1]).toEqual({ present: true, from: 'left', resolved: true });
  });

  it('marks typed rows as manual and resolved, and undo restores them', () => {
    const { snap, state } = setup();
    const typed = state.update({ changes: { from: state.doc.line(2).to, insert: 'Z' }, userEvent: 'input.type' }).state;
    expect(typed.field(rowStateField).states[1]).toEqual({ present: true, from: 'manual', resolved: true });
    expect(typed.field(rowStateField).states[0]).toEqual(snap.states[0]);
    const undone = run(typed, undo);
    expect(undone.doc.toString()).toBe('a\nc');
    expect(undone.field(rowStateField).states[1]).toEqual(snap.states[1]);
  });

  it('tracks merged line numbers for present rows', () => {
    const value = computeRowStatesValue([
      { present: true, from: 'right', resolved: true },
      { present: false, from: 'right', resolved: true },
      { present: true, from: 'right', resolved: true },
    ]);
    expect(Array.from(value.mergedNo)).toEqual([1, 0, 2]);
    expect(value.presentCount).toBe(2);
  });
});
