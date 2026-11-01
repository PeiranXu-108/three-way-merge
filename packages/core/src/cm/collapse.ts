/**
 * Collapsed unchanged regions: a block widget that replaces the hidden rows in every pane.
 * The merged pane shows the "show all / ▲ / ▼" controls, the side panes a placeholder, and all
 * widgets have the same fixed height so rows stay aligned.
 */

import { EditorState, StateEffect, StateField } from '@codemirror/state';
import { Decoration, EditorView, WidgetType, type DecorationSet } from '@codemirror/view';
import type { CollapsedRegion } from '../model';
import { EXPAND_STEP } from '../utils/constants';
import { messagesFacet, paneFacet, type PaneSide } from './fields';

/** Must match `.collapsed-row` height in styles/index.css */
export const COLLAPSE_WIDGET_HEIGHT = 36;

export const setCollapsedRegions = StateEffect.define<readonly CollapsedRegion[]>();

interface CollapseLabels {
  all: string;
  above: string;
  below: string;
}

const sameRegion = (a: CollapsedRegion, b: CollapsedRegion) =>
  a.blockId === b.blockId &&
  a.fromRow === b.fromRow &&
  a.toRow === b.toRow &&
  a.hiddenCount === b.hiddenCount &&
  a.canShowMoreAbove === b.canShowMoreAbove &&
  a.canShowMoreBelow === b.canShowMoreBelow;

class CollapseWidget extends WidgetType {
  constructor(
    readonly region: CollapsedRegion,
    readonly side: PaneSide,
    readonly labels: CollapseLabels
  ) {
    super();
  }

  eq(other: CollapseWidget): boolean {
    return (
      other.side === this.side &&
      sameRegion(other.region, this.region) &&
      other.labels.all === this.labels.all &&
      other.labels.above === this.labels.above &&
      other.labels.below === this.labels.below
    );
  }

  get estimatedHeight(): number {
    return COLLAPSE_WIDGET_HEIGHT;
  }

  ignoreEvent(): boolean {
    return true;
  }

  toDOM(view: EditorView): HTMLElement {
    const root = document.createElement('div');
    root.className = `collapsed-row collapsed-row-${this.side}`;
    root.dataset.blockId = this.region.blockId;
    if (this.side !== 'middle') {
      const placeholder = document.createElement('span');
      placeholder.className = 'collapsed-row-placeholder';
      placeholder.textContent = '…';
      root.append(placeholder);
      return root;
    }

    const { handlers } = view.state.facet(paneFacet);
    const button = (className: string, label: string, disabled: boolean, kind: 'above' | 'below' | 'all') => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = `twd-btn twd-btn-sm ${className}`;
      el.textContent = label;
      el.disabled = disabled;
      el.addEventListener('mousedown', (event) => event.preventDefault());
      el.addEventListener('click', (event) => {
        event.preventDefault();
        handlers.expand(this.region.blockId, kind);
      });
      return el;
    };

    const controls = document.createElement('div');
    controls.className = 'collapsed-row-controls';
    controls.append(button('collapse-btn-all', this.labels.all, false, 'all'));
    const right = document.createElement('div');
    right.className = 'collapse-buttons-right';
    right.append(
      button('collapse-btn-up', this.labels.above, !this.region.canShowMoreAbove, 'above'),
      button('collapse-btn-down', this.labels.below, !this.region.canShowMoreBelow, 'below')
    );
    controls.append(right);
    root.append(controls);
    return root;
  }
}

const buildDecorations = (state: EditorState, regions: readonly CollapsedRegion[]): DecorationSet => {
  const { side } = state.facet(paneFacet);
  const messages = state.facet(messagesFacet);
  const ranges = [];
  for (const region of regions) {
    if (region.toRow + 1 > state.doc.lines || region.fromRow > region.toRow) continue;
    const from = state.doc.line(region.fromRow + 1).from;
    const to = state.doc.line(region.toRow + 1).to;
    const labels: CollapseLabels = {
      all: messages.showAllLines(region.hiddenCount),
      above: messages.showMoreAbove(EXPAND_STEP),
      below: messages.showMoreBelow(EXPAND_STEP),
    };
    ranges.push(Decoration.replace({ widget: new CollapseWidget(region, side, labels), block: true }).range(from, to));
  }
  return Decoration.set(ranges, true);
};

export interface CollapseValue {
  regions: readonly CollapsedRegion[];
  decorations: DecorationSet;
}

export const collapseField = StateField.define<CollapseValue>({
  create: () => ({ regions: [], decorations: Decoration.none }),
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setCollapsedRegions)) {
        return { regions: effect.value, decorations: buildDecorations(tr.state, effect.value) };
      }
    }
    if (tr.docChanged) return { regions: value.regions, decorations: value.decorations.map(tr.changes) };
    return value;
  },
  provide: (field) => EditorView.decorations.from(field, (value) => value.decorations),
});

/** Collapse field pre-populated with regions, for use when creating a state */
export const collapseInit = (regions: readonly CollapsedRegion[]) =>
  collapseField.init((state) => ({ regions, decorations: buildDecorations(state, regions) }));
