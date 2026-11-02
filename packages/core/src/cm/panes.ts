/**
 * Extension bundles for the three panes and the free-edit editor.
 */

import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { bracketMatching } from '@codemirror/language';
import { highlightSelectionMatches, search, searchKeymap } from '@codemirror/search';
import { EditorState, Prec, type Extension } from '@codemirror/state';
import {
  BlockType,
  EditorView,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  scrollPastEnd,
  type Command,
  type KeyBinding,
} from '@codemirror/view';
import { constrainRowEdits } from './constrain';
import { mergedDecorations, sideDecorations } from './decorations';
import {
  hoverField,
  manualEditTracker,
  modelFacet,
  paneFacet,
  rowStateField,
  rowStateHistory,
} from './fields';
import { actionGutter, mergedLineNumbers, sideLineNumbers } from './gutters';

/** Row index under a client Y coordinate, or -1 (collapsed widgets and empty space count as none) */
export const rowAtClientY = (view: EditorView, clientY: number): number => {
  const height = clientY - view.documentTop;
  if (height < 0) return -1;
  const block = view.lineBlockAtHeight(height);
  if (height > block.bottom || block.type !== BlockType.Text) return -1;
  return view.state.doc.lineAt(block.from).number - 1;
};

const commonSetup = (): Extension => [
  highlightSpecialChars(),
  drawSelection(),
  dropCursor(),
  highlightActiveLine(),
  highlightActiveLineGutter(),
  bracketMatching(),
  highlightSelectionMatches(),
  search({ top: true }),
  scrollPastEnd(),
  EditorState.allowMultipleSelections.of(true),
];

/** F7 / Shift+F7: next / previous change, as in VS Code's diff editor */
const navigationKeymap = (): Extension =>
  keymap.of([
    {
      key: 'F7',
      run: (view) => {
        view.state.facet(paneFacet).handlers.goToChange(1);
        return true;
      },
      shift: (view) => {
        view.state.facet(paneFacet).handlers.goToChange(-1);
        return true;
      },
    },
  ]);

/** Pointer tracking for the shared row hover (connector emphasis + line highlight) */
const hoverTracking = (): Extension =>
  EditorView.domEventHandlers({
    mousemove(event, view) {
      view.state.facet(paneFacet).handlers.hover(rowAtClientY(view, event.clientY));
      return false;
    },
    mouseleave(_event, view) {
      view.state.facet(paneFacet).handlers.hover(-1);
      return false;
    },
  });

/** Copy without placeholder lines (rows that a pane does not actually contain) */
const clipboardWithoutPlaceholders = (isPlaceholder: (state: EditorState, row: number) => boolean) =>
  EditorView.clipboardOutputFilter.of((text, state) => {
    const ranges = state.selection.ranges.filter((range) => !range.empty);
    if (!ranges.length) return text;
    return ranges
      .map((range) => {
        const parts: string[] = [];
        let pos = range.from;
        while (pos <= range.to) {
          const line = state.doc.lineAt(pos);
          if (!isPlaceholder(state, line.number - 1)) {
            parts.push(state.sliceDoc(Math.max(range.from, line.from), Math.min(range.to, line.to)));
          }
          pos = line.to + 1;
        }
        return parts.join(state.lineBreak);
      })
      .join(state.lineBreak);
  });

const swallow: Command = () => true;

const insertTwoSpaces: Command = (view) => {
  if (view.state.readOnly) return false;
  view.dispatch(view.state.update(view.state.replaceSelection('  '), { userEvent: 'input.type', scrollIntoView: true }));
  return true;
};

const clearRow: Command = (view) => {
  const seen = new Set<number>();
  const changes = [];
  for (const range of view.state.selection.ranges) {
    const line = view.state.doc.lineAt(range.head);
    if (seen.has(line.number) || !line.length) continue;
    seen.add(line.number);
    changes.push({ from: line.from, to: line.to });
  }
  if (changes.length) view.dispatch({ changes, userEvent: 'delete.line' });
  return true;
};

/**
 * The merged pane keeps one line per row (legacy behaviour): commands that would add, remove or
 * move lines are disabled; the transaction filter catches everything else (paste, drop, …).
 */
const lineLockedKeymap: KeyBinding[] = [
  { key: 'Enter', run: swallow, shift: swallow },
  { key: 'Mod-Enter', run: swallow },
  { key: 'Alt-ArrowUp', run: swallow, shift: swallow },
  { key: 'Alt-ArrowDown', run: swallow, shift: swallow },
  { key: 'Mod-Shift-k', run: clearRow },
  { key: 'Tab', run: insertTwoSpaces },
];

export const sidePaneExtensions = (): Extension => [
  EditorState.readOnly.of(true),
  hoverField,
  commonSetup(),
  navigationKeymap(),
  keymap.of([...defaultKeymap, ...searchKeymap]),
  hoverTracking(),
  sideLineNumbers(),
  sideDecorations(),
  clipboardWithoutPlaceholders((state, row) => {
    const r = state.facet(modelFacet)?.rows[row];
    if (!r) return false;
    return (state.facet(paneFacet).side === 'left' ? r.left : r.right) === null;
  }),
];

export const mergedPaneExtensions = (): Extension => [
  history(),
  rowStateField,
  rowStateHistory,
  hoverField,
  EditorState.transactionFilter.of(constrainRowEdits),
  manualEditTracker,
  commonSetup(),
  navigationKeymap(),
  Prec.high(keymap.of(lineLockedKeymap)),
  keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
  hoverTracking(),
  mergedLineNumbers(),
  actionGutter('left'),
  actionGutter('right'),
  mergedDecorations(),
  clipboardWithoutPlaceholders((state, row) => state.field(rowStateField).states[row]?.present === false),
];

export const freePaneExtensions = (): Extension => [
  history(),
  lineNumbers(),
  commonSetup(),
  keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap, ...searchKeymap]),
];
