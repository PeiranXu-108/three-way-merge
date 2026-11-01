/**
 * Owns the three CodeMirror panes (plus the free-edit editor) and the merge model. Framework
 * agnostic: the React component only forwards props and renders the chrome.
 */

import { json } from '@codemirror/lang-json';
import { EditorState, Text, Transaction, type ChangeSpec, type Compartment, type Extension } from '@codemirror/state';
import { EditorView, type ViewUpdate } from '@codemirror/view';
import type { ThreeWayMessages } from '../i18n';
import {
  acceptUpdates,
  applyText,
  blockRowIndices,
  buildModel,
  collapsedRegions,
  computeStats,
  joinMerged,
  sameState,
  statesEqual,
  type CollapsedRegion,
  type MergeModel,
  type MergeSnapshot,
  type RowState,
  type RowUpdate,
  type Side,
} from '../model';
import type { CollapsedBlockState, DiffStats } from '../types';
import { EXPAND_STEP } from '../utils/constants';
import { collapseInit, setCollapsedRegions } from '../cm/collapse';
import { Connectors } from '../cm/connectors';
import {
  computeRowStatesValue,
  extraCompartment,
  languageCompartment,
  messagesCompartment,
  messagesFacet,
  modelFacet,
  paneFacet,
  programmatic,
  rowStateField,
  setHoverRow,
  setRowStates,
  themeCompartment,
  type PaneHandlers,
  type RowStateChange,
} from '../cm/fields';
import { freePaneExtensions, mergedPaneExtensions, sidePaneExtensions } from '../cm/panes';
import { ScrollSync } from '../cm/scrollSync';
import { themeExtension, type ThemeName } from '../cm/theme';

export type LanguageOption = 'auto' | 'json' | 'text';

export interface ControllerDom {
  /** Grid element containing the panes and gaps; the connector canvas covers it */
  panels: HTMLElement;
  left: HTMLElement;
  middle: HTMLElement;
  free: HTMLElement;
  right: HTMLElement;
  gaps: HTMLElement[];
  canvas: HTMLCanvasElement;
}

export interface ControllerCallbacks {
  onChange(merged: string): void;
  onHasChanges(hasChanges: boolean): void;
  onStats(stats: DiffStats): void;
  onEditModeChange(editing: boolean): void;
}

export interface ControllerOptions {
  messages: ThreeWayMessages;
  theme: ThemeName;
  language: LanguageOption;
  extensions: Extension[];
  collapse: boolean;
}

export interface LoadInput {
  oldContent: string;
  newContent: string;
  middleContent?: string;
  normalizeJson: boolean;
}

const statsEqual = (a: DiffStats, b: DiffStats) =>
  a.total === b.total &&
  a.unchanged === b.unchanged &&
  a.added === b.added &&
  a.removed === b.removed &&
  a.modified === b.modified &&
  a.conflicts === b.conflicts;

const nextFrame = (fn: () => void) => {
  if (typeof requestAnimationFrame === 'undefined') fn();
  else requestAnimationFrame(fn);
};

export class MergeController {
  private readonly left: EditorView;
  private readonly middle: EditorView;
  private readonly right: EditorView;
  private free: EditorView | null = null;
  private freeInitial = '';

  private model: MergeModel;
  private finalNewline: boolean;
  private baseline: MergeSnapshot;
  private baselineDoc: Text;

  private collapseState: Record<string, CollapsedBlockState> = {};
  private regions: CollapsedRegion[] = [];
  private lastInput: LoadInput | null = null;
  private lastHasChanges: boolean | null = null;
  private lastStats: DiffStats | null = null;

  private hover = -1;
  private pendingHover = -1;
  private hoverFrame = 0;

  private readonly scrollSync: ScrollSync;
  private readonly connectors: Connectors;
  private readonly resizeObserver: ResizeObserver | null = null;
  private readonly handlers: PaneHandlers;
  private destroyed = false;

  constructor(
    private readonly dom: ControllerDom,
    private readonly options: ControllerOptions,
    private readonly callbacks: ControllerCallbacks
  ) {
    this.handlers = {
      acceptLine: (row, side) => this.acceptRows([row], side),
      acceptBlock: (blockIndex, side) => this.acceptRows(blockRowIndices(this.model, blockIndex), side),
      expand: (blockId, kind) => this.expand(blockId, kind),
      goToChange: (direction) => this.goToChange(direction),
      hover: (row) => this.setHover(row),
    };

    const empty = buildModel('', '', undefined, { normalizeJson: false });
    this.model = empty.model;
    this.finalNewline = empty.finalNewline;
    this.baseline = empty;
    this.baselineDoc = Text.of(empty.lines);

    this.left = new EditorView({ parent: dom.left, state: this.sideState('left', empty) });
    this.middle = new EditorView({ parent: dom.middle, state: this.mergedState(empty) });
    this.right = new EditorView({ parent: dom.right, state: this.sideState('right', empty) });

    this.connectors = new Connectors(dom.canvas, dom.panels, () => this.connectorState());
    this.scrollSync = new ScrollSync(() => this.connectors.schedule());
    this.scrollSync.setScrollers([this.left.scrollDOM, this.middle.scrollDOM, this.right.scrollDOM]);
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.connectors.schedule());
      this.resizeObserver.observe(dom.panels);
    }
  }

  // ---------------------------------------------------------------- state construction

  private shared(): Extension[] {
    return [
      themeCompartment.of(themeExtension(this.options.theme)),
      languageCompartment.of(this.languageExtension()),
      messagesCompartment.of(messagesFacet.of(this.options.messages)),
      extraCompartment.of(this.options.extensions),
    ];
  }

  private languageExtension(): Extension {
    const { language } = this.options;
    return language === 'json' || (language === 'auto' && this.model.json) ? json() : [];
  }

  private sideState(side: Side, snap: MergeSnapshot): EditorState {
    const doc = snap.model.rows.map((row) => (side === 'left' ? row.left : row.right) ?? '').join('\n');
    return EditorState.create({
      doc,
      extensions: [
        modelFacet.of(snap.model),
        paneFacet.of({ side, handlers: this.handlers }),
        collapseInit(this.regions),
        sidePaneExtensions(),
        EditorView.contentAttributes.of({ 'aria-label': side === 'left' ? 'Left version' : 'Right version' }),
        this.shared(),
      ],
    });
  }

  private mergedState(snap: MergeSnapshot): EditorState {
    return EditorState.create({
      doc: snap.lines.join('\n'),
      extensions: [
        modelFacet.of(snap.model),
        paneFacet.of({ side: 'middle', handlers: this.handlers }),
        rowStateField.init(() => computeRowStatesValue(snap.states)),
        collapseInit(this.regions),
        mergedPaneExtensions(),
        EditorView.contentAttributes.of({ 'aria-label': 'Merge result' }),
        EditorView.updateListener.of((update) => this.onMergedUpdate(update)),
        this.shared(),
      ],
    });
  }

  /** Replace all pane states (new row structure). History restarts, scroll position is kept. */
  private install(snap: MergeSnapshot): void {
    const top = this.middle.scrollDOM.scrollTop;
    this.model = snap.model;
    this.finalNewline = snap.finalNewline;
    this.regions = collapsedRegions(this.model, this.collapseState, this.options.collapse);
    this.left.setState(this.sideState('left', snap));
    this.middle.setState(this.mergedState(snap));
    this.right.setState(this.sideState('right', snap));
    this.scrollSync.scrollTo(top);
    this.connectors.schedule();
  }

  private paneViews(): EditorView[] {
    return [this.left, this.middle, this.right];
  }

  private allViews(): EditorView[] {
    return this.free ? [...this.paneViews(), this.free] : this.paneViews();
  }

  // ---------------------------------------------------------------- inputs

  load(input: LoadInput): void {
    const prev = this.lastInput;
    if (
      prev &&
      prev.oldContent === input.oldContent &&
      prev.newContent === input.newContent &&
      prev.normalizeJson === input.normalizeJson
    ) {
      if (prev.middleContent === input.middleContent) return;
      // Controlled usage: the parent echoed our own onChange output back as middleContent.
      if (input.middleContent !== undefined && input.middleContent === this.getMergedContent()) {
        this.lastInput = input;
        return;
      }
    }
    this.lastInput = input;
    const snap = buildModel(input.oldContent, input.newContent, input.middleContent, {
      normalizeJson: input.normalizeJson,
    });
    if (this.free) this.closeFree();
    this.baseline = snap;
    this.baselineDoc = Text.of(snap.lines);
    this.collapseState = {};
    this.install(snap);
    this.lastHasChanges = null;
    this.emitStatus();
  }

  setMessages(messages: ThreeWayMessages): void {
    if (messages === this.options.messages) return;
    this.options.messages = messages;
    this.reconfigure(messagesCompartment, messagesFacet.of(messages));
    this.applyCollapse();
  }

  setTheme(theme: ThemeName): void {
    if (theme === this.options.theme) return;
    this.options.theme = theme;
    this.reconfigure(themeCompartment, themeExtension(theme));
    this.connectors.schedule();
  }

  setLanguage(language: LanguageOption, extensions: Extension[]): void {
    const languageChanged = language !== this.options.language;
    const extensionsChanged = extensions !== this.options.extensions;
    this.options.language = language;
    this.options.extensions = extensions;
    if (languageChanged) this.reconfigure(languageCompartment, this.languageExtension());
    if (extensionsChanged) this.reconfigure(extraCompartment, extensions);
  }

  setCollapseEnabled(enabled: boolean): void {
    if (enabled === this.options.collapse) return;
    this.options.collapse = enabled;
    this.applyCollapse();
  }

  private reconfigure(compartment: Compartment, extension: Extension): void {
    for (const view of this.allViews()) view.dispatch({ effects: compartment.reconfigure(extension) });
  }

  // ---------------------------------------------------------------- output

  getMergedContent(): string {
    if (this.free) return this.toEol(this.free.state.doc.toString());
    return this.mergedWith(this.model.eol);
  }

  private mergedWith(eol: string): string {
    const state = this.middle.state;
    return joinMerged(state.field(rowStateField).states, (i) => state.doc.line(i + 1).text, eol, this.finalNewline);
  }

  private toEol(text: string): string {
    return this.model.eol === '\n' ? text : text.replace(/\n/g, this.model.eol);
  }

  private onMergedUpdate(update: ViewUpdate): void {
    const rowsChanged = update.startState.field(rowStateField) !== update.state.field(rowStateField);
    if (update.docChanged || rowsChanged) {
      this.callbacks.onChange(this.getMergedContent());
      this.emitStatus();
    }
    if (update.viewportChanged || update.geometryChanged || update.heightChanged) this.connectors.schedule();
  }

  private computeHasChanges(): boolean {
    if (this.model !== this.baseline.model || this.finalNewline !== this.baseline.finalNewline) return true;
    const state = this.middle.state;
    if (!statesEqual(state.field(rowStateField).states, this.baseline.states)) return true;
    return !state.doc.eq(this.baselineDoc);
  }

  private emitStatus(): void {
    if (this.destroyed) return;
    const stats = computeStats(this.model, this.middle.state.field(rowStateField).states);
    if (!this.lastStats || !statsEqual(stats, this.lastStats)) {
      this.lastStats = stats;
      this.callbacks.onStats(stats);
    }
    const hasChanges = this.computeHasChanges();
    if (hasChanges !== this.lastHasChanges) {
      this.lastHasChanges = hasChanges;
      this.callbacks.onHasChanges(hasChanges);
    }
  }

  // ---------------------------------------------------------------- merge actions

  /** Apply row text/state updates as one undoable transaction. Returns false if nothing changed. */
  private applyUpdates(updates: RowUpdate[], userEvent: string): boolean {
    const state = this.middle.state;
    const { states } = state.field(rowStateField);
    const changes: ChangeSpec[] = [];
    const effects: RowStateChange[] = [];
    for (const update of updates) {
      if (update.index >= state.doc.lines) continue;
      const line = state.doc.line(update.index + 1);
      if (line.text !== update.text) changes.push({ from: line.from, to: line.to, insert: update.text });
      const prev = states[update.index];
      if (prev && !sameState(prev, update.state)) effects.push({ index: update.index, prev, next: update.state });
    }
    if (!changes.length && !effects.length) return false;
    this.middle.dispatch({
      changes,
      effects: effects.length ? setRowStates.of(effects) : undefined,
      annotations: [programmatic.of(true), Transaction.userEvent.of(userEvent)],
    });
    return true;
  }

  acceptRows(indices: number[], side: Side): void {
    if (this.free || !indices.length) return;
    const { states } = this.middle.state.field(rowStateField);
    this.applyUpdates(acceptUpdates(this.model, states, indices, side), 'twd.accept');
  }

  acceptAll(side: Side): void {
    this.acceptRows(
      this.model.rows.map((_, i) => i),
      side
    );
  }

  /** Back to the initial merge (legacy: always notifies onChange). Undoable when rows are unchanged. */
  reset(): void {
    if (this.free) this.closeFree();
    this.collapseState = {};
    const baseline = this.baseline;
    if (this.model === baseline.model) {
      this.finalNewline = baseline.finalNewline;
      const updates = baseline.lines.map((text, index) => ({ index, text, state: baseline.states[index] }));
      const changed = this.applyUpdates(updates, 'twd.reset');
      this.applyCollapse();
      if (!changed) {
        this.callbacks.onChange(this.getMergedContent());
        this.emitStatus();
      }
      return;
    }
    this.install(baseline);
    this.callbacks.onChange(this.getMergedContent());
    this.emitStatus();
  }

  private snapshot(): MergeSnapshot {
    const state = this.middle.state;
    const lines: string[] = [];
    for (let n = 1; n <= state.doc.lines; n += 1) lines.push(state.doc.line(n).text);
    return {
      model: this.model,
      states: state.field(rowStateField).states as RowState[],
      lines,
      finalNewline: this.finalNewline,
    };
  }

  private applySnapshot(next: MergeSnapshot): void {
    this.finalNewline = next.finalNewline;
    if (next.model === this.model) {
      const updates = next.lines.map((text, index) => ({ index, text, state: next.states[index] }));
      if (!this.applyUpdates(updates, 'twd.freeEdit')) {
        this.callbacks.onChange(this.getMergedContent());
        this.emitStatus();
      }
      return;
    }
    this.collapseState = {};
    this.install(next);
    this.callbacks.onChange(this.getMergedContent());
    this.emitStatus();
  }

  // ---------------------------------------------------------------- collapse

  expand(blockId: string, kind: 'above' | 'below' | 'all'): void {
    const current = this.collapseState[blockId] ?? { above: 0, below: 0, expanded: false };
    const next =
      kind === 'all'
        ? { ...current, expanded: true }
        : kind === 'above'
          ? { ...current, above: (current.above || 0) + EXPAND_STEP }
          : { ...current, below: (current.below || 0) + EXPAND_STEP };
    this.collapseState = { ...this.collapseState, [blockId]: next };
    this.applyCollapse();
  }

  private applyCollapse(): void {
    this.regions = collapsedRegions(this.model, this.collapseState, this.options.collapse);
    for (const view of this.paneViews()) view.dispatch({ effects: setCollapsedRegions.of(this.regions) });
    this.connectors.schedule();
  }

  // ---------------------------------------------------------------- navigation & hover

  goToChange(direction: 1 | -1): void {
    if (this.free) return;
    const { blocks } = this.model;
    if (!blocks.length) return;
    const view = this.middle;
    const current = view.state.doc.lineAt(view.state.selection.main.head).number - 1;
    const target =
      direction > 0
        ? (blocks.find((b) => b.startIndex > current) ?? blocks[0])
        : ([...blocks].reverse().find((b) => b.startIndex < current) ?? blocks[blocks.length - 1]);
    const line = view.state.doc.line(target.startIndex + 1);
    view.dispatch({
      selection: { anchor: line.from },
      effects: EditorView.scrollIntoView(line.from, { y: 'center' }),
      userEvent: 'select',
    });
    view.focus();
  }

  private setHover(row: number): void {
    this.pendingHover = row;
    if (this.hoverFrame) return;
    const apply = () => {
      this.hoverFrame = 0;
      if (this.destroyed || this.pendingHover === this.hover) return;
      this.hover = this.pendingHover;
      for (const view of this.paneViews()) view.dispatch({ effects: setHoverRow.of(this.hover) });
      this.connectors.schedule();
    };
    if (typeof requestAnimationFrame === 'undefined') apply();
    else this.hoverFrame = requestAnimationFrame(apply);
  }

  private connectorState() {
    if (this.destroyed) return null;
    return { view: this.left, model: this.model, hover: this.hover, gaps: this.dom.gaps };
  }

  // ---------------------------------------------------------------- free edit

  get isFreeEditing(): boolean {
    return this.free !== null;
  }

  enterFreeEdit(): void {
    if (this.free || this.destroyed) return;
    const text = this.mergedWith('\n');
    this.freeInitial = text;
    const top = this.middle.scrollDOM.scrollTop;
    const free = new EditorView({
      parent: this.dom.free,
      state: EditorState.create({
        doc: text,
        extensions: [
          freePaneExtensions(),
          EditorView.contentAttributes.of({ 'aria-label': 'Free edit' }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) this.callbacks.onChange(this.toEol(update.state.doc.toString()));
          }),
          this.shared(),
        ],
      }),
    });
    this.free = free;
    this.callbacks.onEditModeChange(true);
    this.scrollSync.setScrollers([this.left.scrollDOM, free.scrollDOM, this.right.scrollDOM]);
    nextFrame(() => {
      if (this.free !== free) return;
      free.requestMeasure();
      this.scrollSync.scrollTo(top);
      free.focus();
    });
  }

  /** 'confirm' when the free-edit text changed and the user must choose Save or Discard */
  requestExitFreeEdit(): 'exited' | 'confirm' {
    if (!this.free) return 'exited';
    if (this.free.state.doc.toString() !== this.freeInitial) return 'confirm';
    this.closeFree();
    return 'exited';
  }

  discardFreeEdit(): void {
    if (!this.free) return;
    const changed = this.free.state.doc.toString() !== this.freeInitial;
    this.closeFree();
    // The parent saw the live edits through onChange: hand it the restored value.
    if (changed) this.callbacks.onChange(this.getMergedContent());
  }

  saveFreeEdit(trimEmptyLines: boolean): void {
    if (!this.free) return;
    const text = this.free.state.doc.toString();
    this.closeFree();
    this.applySnapshot(applyText(this.snapshot(), text, { trimEmptyLines }));
  }

  private closeFree(): void {
    const free = this.free;
    if (!free) return;
    const top = free.scrollDOM.scrollTop;
    this.free = null;
    free.destroy();
    this.scrollSync.setScrollers([this.left.scrollDOM, this.middle.scrollDOM, this.right.scrollDOM]);
    this.callbacks.onEditModeChange(false);
    nextFrame(() => {
      if (this.destroyed) return;
      this.middle.requestMeasure();
      this.scrollSync.scrollTo(top);
      this.connectors.schedule();
    });
  }

  // ---------------------------------------------------------------- teardown

  destroy(): void {
    this.destroyed = true;
    if (this.hoverFrame) cancelAnimationFrame(this.hoverFrame);
    this.scrollSync.detach();
    this.connectors.destroy();
    this.resizeObserver?.disconnect();
    this.free?.destroy();
    this.free = null;
    this.left.destroy();
    this.middle.destroy();
    this.right.destroy();
  }
}
