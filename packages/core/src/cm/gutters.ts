/**
 * Gutters: real line numbers for every pane and merge action buttons for the merged pane.
 */

import type { EditorState } from '@codemirror/state';
import { EditorView, GutterMarker, gutter, type ViewUpdate } from '@codemirror/view';
import { isConflictRow, type MergeModel, type Side } from '../model';
import { messagesFacet, modelFacet, paneFacet, rowStateField } from './fields';

class TextMarker extends GutterMarker {
  constructor(readonly text: string) {
    super();
  }

  eq(other: TextMarker): boolean {
    return other.text === this.text;
  }

  toDOM(): Node {
    return document.createTextNode(this.text);
  }
}

const rowIndexAt = (view: EditorView, pos: number) => view.state.doc.lineAt(pos).number - 1;

const lineNumberGutter = (
  numberAt: (state: EditorState, row: number) => number | null,
  maxNumber: (state: EditorState) => number,
  changed: (update: ViewUpdate) => boolean = () => false
) => {
  const spacerText = (state: EditorState) => String(Math.max(99, maxNumber(state)));
  return gutter({
    class: 'cm-lineNumbers twd-line-numbers',
    lineMarker(view, line) {
      const n = numberAt(view.state, rowIndexAt(view, line.from));
      return n ? new TextMarker(String(n)) : null;
    },
    lineMarkerChange: (update) => update.startState.facet(modelFacet) !== update.state.facet(modelFacet) || changed(update),
    initialSpacer: (view) => new TextMarker(spacerText(view.state)),
    updateSpacer: (spacer, update) => {
      const text = spacerText(update.state);
      return (spacer as TextMarker).text === text ? spacer : new TextMarker(text);
    },
  });
};

const sideMaxCache = new WeakMap<MergeModel, { left: number; right: number }>();
const sideMax = (model: MergeModel) => {
  let cached = sideMaxCache.get(model);
  if (!cached) {
    cached = { left: 0, right: 0 };
    for (const row of model.rows) {
      if (row.leftLineNo) cached.left = Math.max(cached.left, row.leftLineNo);
      if (row.rightLineNo) cached.right = Math.max(cached.right, row.rightLineNo);
    }
    sideMaxCache.set(model, cached);
  }
  return cached;
};

/** Line numbers of the original left/right text (blank on placeholder rows) */
export const sideLineNumbers = () =>
  lineNumberGutter(
    (state, row) => {
      const r = state.facet(modelFacet)?.rows[row];
      if (!r) return null;
      return state.facet(paneFacet).side === 'left' ? r.leftLineNo : r.rightLineNo;
    },
    (state) => {
      const model = state.facet(modelFacet);
      if (!model) return 0;
      return sideMax(model)[state.facet(paneFacet).side === 'left' ? 'left' : 'right'];
    }
  );

/** Line numbers of the merged output (blank on rows that are not part of it) */
export const mergedLineNumbers = () =>
  lineNumberGutter(
    (state, row) => state.field(rowStateField).mergedNo[row] || null,
    (state) => state.field(rowStateField).presentCount,
    (update) => update.startState.field(rowStateField) !== update.state.field(rowStateField)
  );

class ActionMarker extends GutterMarker {
  constructor(
    readonly side: Side,
    readonly row: number,
    /** Block index for the block button, -1 for none */
    readonly blockIndex: number,
    readonly blockTitle: string,
    /** Whether to show the per-line button (conflict rows) */
    readonly line: boolean,
    readonly active: boolean,
    readonly lineTitle: string
  ) {
    super();
  }

  eq(other: ActionMarker): boolean {
    return (
      other.side === this.side &&
      other.row === this.row &&
      other.blockIndex === this.blockIndex &&
      other.blockTitle === this.blockTitle &&
      other.line === this.line &&
      other.active === this.active &&
      other.lineTitle === this.lineTitle
    );
  }

  toDOM(view: EditorView): Node {
    const { handlers } = view.state.facet(paneFacet);
    const cell = document.createElement('div');
    cell.className = 'twd-action-cell';
    const slot = () => {
      const span = document.createElement('span');
      span.className = 'twd-action-slot';
      return span;
    };
    // Width spacer (row -1): same size as two buttons, but inert.
    if (this.row < 0) {
      cell.append(slot(), slot());
      return cell;
    }

    const make =(className: string, label: string, title: string, action: string, onClick: () => void) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `twd-action ${className}`;
      button.textContent = label;
      button.title = title;
      button.setAttribute('aria-label', title);
      button.dataset.action = action;
      button.dataset.row = String(this.row);
      button.addEventListener('mousedown', (event) => event.preventDefault());
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
      });
      return button;
    };

    const block =
      this.blockIndex >= 0
        ? make('twd-action-block', this.side === 'left' ? '▶' : '◀', this.blockTitle, `block-${this.side}`, () =>
            handlers.acceptBlock(this.blockIndex, this.side)
          )
        : slot();
    const line = this.line
      ? make(
          `twd-action-line${this.active ? ' active' : ''}`,
          this.side === 'left' ? '›' : '‹',
          this.lineTitle,
          `line-${this.side}`,
          () => handlers.acceptLine(this.row, this.side)
        )
      : slot();
    // Block buttons sit on the outer edge (left of the left gutter, right of the right gutter).
    if (this.side === 'left') cell.append(block, line);
    else cell.append(line, block);
    return cell;
  }
}

/**
 * Merge actions. The left gutter shows ▶ (accept the left block) on a block's first row, the
 * right gutter shows ◀ (accept the right block) on its last row, matching the legacy placement.
 * Conflict rows also get per-line › / ‹ buttons, highlighted when that side is selected.
 */
export const actionGutter = (side: Side) =>
  gutter({
    class: `twd-actions twd-actions-${side}`,
    side: side === 'left' ? 'before' : 'after',
    lineMarker(view, line) {
      const model = view.state.facet(modelFacet);
      if (!model) return null;
      const index = rowIndexAt(view, line.from);
      const row = model.rows[index];
      if (!row) return null;
      const blockIndex = model.blockOfRow[index] ?? -1;
      const block = blockIndex >= 0 ? model.blocks[blockIndex] : null;
      const showBlock = !!block && (side === 'left' ? block.startIndex === index : block.endIndex === index);
      const conflict = isConflictRow(row);
      if (!showBlock && !conflict) return null;
      const messages = view.state.facet(messagesFacet);
      const state = view.state.field(rowStateField).states[index];
      const blockTitle =
        showBlock && block
          ? side === 'left'
            ? messages.acceptLeftBlock(block.lineCount)
            : messages.acceptRightBlock(block.lineCount)
          : '';
      return new ActionMarker(
        side,
        index,
        showBlock ? blockIndex : -1,
        blockTitle,
        conflict,
        conflict && state?.from === side,
        side === 'left' ? messages.acceptLeftLine : messages.acceptRightLine
      );
    },
    lineMarkerChange: (update) =>
      update.startState.field(rowStateField) !== update.state.field(rowStateField) ||
      update.startState.facet(messagesFacet) !== update.state.facet(messagesFacet) ||
      update.startState.facet(modelFacet) !== update.state.facet(modelFacet),
    initialSpacer: () => new ActionMarker(side, -1, 0, '', true, false, ''),
  });
