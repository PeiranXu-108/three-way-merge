/**
 * Shared CodeMirror state: facets, fields and effects used by all panes.
 */

import { invertedEffects } from '@codemirror/commands';
import { Annotation, Compartment, EditorState, Facet, StateEffect, StateField } from '@codemirror/state';
import { getMessages, type ThreeWayMessages } from '../i18n';
import { isConflictRow, sameState } from '../model';
import type { MergeModel, RowState, Side } from '../model';

export type PaneSide = 'left' | 'middle' | 'right';

/** Callbacks from editor UI (gutters, widgets, keymaps) into the controller */
export interface PaneHandlers {
  acceptLine(row: number, side: Side): void;
  acceptBlock(blockIndex: number, side: Side): void;
  expand(blockId: string, kind: 'above' | 'below' | 'all'): void;
  goToChange(direction: 1 | -1): void;
  hover(row: number): void;
}

export interface PaneConfig {
  side: PaneSide;
  handlers: PaneHandlers;
}

const noop = () => {};
const DEFAULT_PANE: PaneConfig = {
  side: 'middle',
  handlers: { acceptLine: noop, acceptBlock: noop, expand: noop, goToChange: noop, hover: noop },
};

export const paneFacet = Facet.define<PaneConfig, PaneConfig>({
  combine: (values) => values[0] ?? DEFAULT_PANE,
});

export const modelFacet = Facet.define<MergeModel, MergeModel | null>({
  combine: (values) => values[0] ?? null,
});

export const messagesFacet = Facet.define<ThreeWayMessages, ThreeWayMessages>({
  combine: (values) => values[0] ?? getMessages('en'),
});

/** Compartments let the controller swap configuration in every pane without rebuilding state */
export const themeCompartment = new Compartment();
export const languageCompartment = new Compartment();
export const messagesCompartment = new Compartment();
export const extraCompartment = new Compartment();

/** Marks transactions created by merge actions (accept, reset, free-edit save) */
export const programmatic = Annotation.define<boolean>();

export interface RowStateChange {
  index: number;
  prev: RowState;
  next: RowState;
}

export const setRowStates = StateEffect.define<readonly RowStateChange[]>();

export interface RowStatesValue {
  states: readonly RowState[];
  /** Merged-output line number for every present row (0 for absent rows) */
  mergedNo: Int32Array;
  presentCount: number;
}

export const computeRowStatesValue = (states: readonly RowState[]): RowStatesValue => {
  const mergedNo = new Int32Array(states.length);
  let count = 0;
  for (let i = 0; i < states.length; i += 1) {
    if (states[i].present) {
      count += 1;
      mergedNo[i] = count;
    }
  }
  return { states, mergedNo, presentCount: count };
};

export const rowStateField = StateField.define<RowStatesValue>({
  create: () => computeRowStatesValue([]),
  update(value, tr) {
    let states: RowState[] | null = null;
    for (const effect of tr.effects) {
      if (!effect.is(setRowStates)) continue;
      if (!states) states = value.states.slice();
      for (const change of effect.value) {
        if (change.index >= 0 && change.index < states.length) states[change.index] = change.next;
      }
    }
    return states ? computeRowStatesValue(states) : value;
  },
});

/** Undo/redo restores row decisions together with the text */
export const rowStateHistory = invertedEffects.of((tr) => {
  const inverted: StateEffect<unknown>[] = [];
  for (const effect of tr.effects) {
    if (effect.is(setRowStates)) {
      inverted.push(
        setRowStates.of(effect.value.map((change) => ({ index: change.index, prev: change.next, next: change.prev })))
      );
    }
  }
  return inverted;
});

/**
 * Typing in a merged row marks it as a manual choice and resolves its conflict, like the legacy
 * per-line editor. Added as an effect so that undo can invert it.
 */
export const manualEditTracker = EditorState.transactionExtender.of((tr) => {
  if (!tr.docChanged || tr.annotation(programmatic) || tr.isUserEvent('undo') || tr.isUserEvent('redo')) {
    return null;
  }
  if (tr.effects.some((effect) => effect.is(setRowStates))) return null;
  const model = tr.startState.facet(modelFacet);
  if (!model) return null;
  const { states } = tr.startState.field(rowStateField);
  const doc = tr.startState.doc;
  const touched = new Set<number>();
  tr.changes.iterChangedRanges((fromA, toA) => {
    const first = doc.lineAt(fromA).number;
    const last = doc.lineAt(toA).number;
    for (let n = first; n <= last; n += 1) touched.add(n - 1);
  });
  const changes: RowStateChange[] = [];
  for (const index of touched) {
    const prev = states[index];
    const row = model.rows[index];
    if (!prev || !row) continue;
    const next: RowState = { present: true, from: 'manual', resolved: isConflictRow(row) ? true : prev.resolved };
    if (!sameState(prev, next)) changes.push({ index, prev, next });
  }
  return changes.length ? { effects: setRowStates.of(changes) } : null;
});

export const setHoverRow = StateEffect.define<number>();

/** Row under the pointer (-1 for none), mirrored into every pane */
export const hoverField = StateField.define<number>({
  create: () => -1,
  update(value, tr) {
    for (const effect of tr.effects) if (effect.is(setHoverRow)) value = effect.value;
    return value;
  },
});
