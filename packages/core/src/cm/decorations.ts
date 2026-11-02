/**
 * Line classes and character-level highlights, computed for the visible viewport only.
 * Class names match the legacy editor so existing CSS overrides keep working.
 */

import { RangeSetBuilder } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view';
import { charRanges, isConflictRow, type CharRanges, type MergeModel } from '../model';
import { hoverField, messagesFacet, modelFacet, paneFacet, rowStateField } from './fields';

const charCache = new WeakMap<MergeModel, Map<number, CharRanges>>();

const charRangesFor = (model: MergeModel, index: number): CharRanges => {
  let rows = charCache.get(model);
  if (!rows) {
    rows = new Map();
    charCache.set(model, rows);
  }
  let ranges = rows.get(index);
  if (!ranges) {
    const row = model.rows[index];
    ranges = charRanges(row.left, row.right);
    rows.set(index, ranges);
  }
  return ranges;
};

const removedMark = Decoration.mark({ class: 'char-diff char-removed' });
const addedMark = Decoration.mark({ class: 'char-diff char-added' });

/** Iterate the visible lines once each, in document order */
const forEachVisibleLine = (
  view: EditorView,
  callback: (line: { from: number; to: number; number: number }) => void
) => {
  let last = 0;
  for (const { from, to } of view.visibleRanges) {
    let pos = from;
    while (pos <= to) {
      const line = view.state.doc.lineAt(pos);
      if (line.number > last) {
        last = line.number;
        callback(line);
      }
      pos = line.to + 1;
    }
  }
};

const buildSideDecorations = (view: EditorView): DecorationSet => {
  const model = view.state.facet(modelFacet);
  if (!model) return Decoration.none;
  const side = view.state.facet(paneFacet).side === 'left' ? 'left' : 'right';
  const hover = view.state.field(hoverField);
  const hint = view.state.facet(messagesFacet).connectorHint;
  const builder = new RangeSetBuilder<Decoration>();

  forEachVisibleLine(view, (line) => {
    const index = line.number - 1;
    const row = model.rows[index];
    if (!row) return;
    const content = row[side];
    const classes: string[] = [];
    if (content === null) classes.push('empty-line', 'twd-placeholder');
    else if (row.kind === 'modified') classes.push('modified-line');
    else if (row.kind === 'removed' && side === 'left') classes.push('removed-line');
    else if (row.kind === 'added' && side === 'right') classes.push('added-line');
    if (index === hover) classes.push('twd-hover');
    const changed = content !== null && row.kind !== 'unchanged' && row.kind !== 'inserted';
    const attributes: Record<string, string> = { 'data-row': String(index) };
    if (changed) attributes.title = hint;
    builder.add(line.from, line.from, Decoration.line({ class: classes.join(' '), attributes }));

    if (changed && content) {
      for (const [from, to] of charRangesFor(model, index)[side]) {
        builder.add(line.from + from, line.from + to, side === 'left' ? removedMark : addedMark);
      }
    }
  });
  return builder.finish();
};

const buildMergedDecorations = (view: EditorView): DecorationSet => {
  const model = view.state.facet(modelFacet);
  if (!model) return Decoration.none;
  const { states } = view.state.field(rowStateField);
  const hover = view.state.field(hoverField);
  const builder = new RangeSetBuilder<Decoration>();

  forEachVisibleLine(view, (line) => {
    const index = line.number - 1;
    const row = model.rows[index];
    const state = states[index];
    if (!row || !state) return;
    const classes = ['merged-line', isConflictRow(row) ? 'has-conflict' : 'no-conflict', `from-${state.from}`];
    const blockIndex = model.blockOfRow[index] ?? -1;
    const block = blockIndex >= 0 ? model.blocks[blockIndex] : null;
    if (block) {
      classes.push(`code-block-${block.type}`, 'code-block-line');
      if (block.startIndex === index) classes.push('code-block-first-line');
      if (block.endIndex === index) classes.push('code-block-last-line');
    }
    if (row.kind === 'inserted') classes.push('twd-inserted');
    if (!state.present) classes.push('empty-line', 'twd-placeholder');
    if (state.resolved && isConflictRow(row)) classes.push('twd-resolved');
    if (index === hover) classes.push('twd-hover');
    builder.add(
      line.from,
      line.from,
      Decoration.line({ class: classes.join(' '), attributes: { 'data-row': String(index) } })
    );
  });
  return builder.finish();
};

const decorationPlugin = (build: (view: EditorView) => DecorationSet, extraCheck: (update: ViewUpdate) => boolean) =>
  ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = build(view);
      }

      update(update: ViewUpdate) {
        if (
          update.docChanged ||
          update.viewportChanged ||
          update.startState.field(hoverField) !== update.state.field(hoverField) ||
          update.startState.facet(modelFacet) !== update.state.facet(modelFacet) ||
          update.startState.facet(messagesFacet) !== update.state.facet(messagesFacet) ||
          extraCheck(update)
        ) {
          this.decorations = build(update.view);
        }
      }
    },
    { decorations: (plugin) => plugin.decorations }
  );

export const sideDecorations = () => decorationPlugin(buildSideDecorations, () => false);

export const mergedDecorations = () =>
  decorationPlugin(
    buildMergedDecorations,
    (update) => update.startState.field(rowStateField) !== update.state.field(rowStateField)
  );
