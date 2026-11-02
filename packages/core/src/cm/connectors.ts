/**
 * Connector strips drawn in the gaps between panes: one band per changed row, coloured by change
 * type, with the hovered row emphasised. Rows are aligned, so a band links the same row in the
 * neighbouring panes.
 */

import { BlockType, type BlockInfo, type EditorView } from '@codemirror/view';
import type { MergeModel } from '../model';

export interface ConnectorState {
  /** Any pane can serve as the geometry reference, since all panes share the same layout */
  view: EditorView;
  model: MergeModel;
  hover: number;
  gaps: HTMLElement[];
}

const textBlocks = (blocks: readonly BlockInfo[]): BlockInfo[] =>
  blocks.flatMap((block) => (Array.isArray(block.type) ? textBlocks(block.type) : block.type === BlockType.Text ? [block] : []));

export class Connectors {
  private frame = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly host: HTMLElement,
    private readonly getState: () => ConnectorState | null
  ) {}

  schedule(): void {
    if (this.frame || typeof requestAnimationFrame === 'undefined') return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.draw();
    });
  }

  draw(): void {
    const rect = this.host.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.round(rect.width * dpr);
    const height = Math.round(rect.height * dpr);
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.canvas.style.width = `${rect.width}px`;
      this.canvas.style.height = `${rect.height}px`;
    }
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const state = this.getState();
    if (!state || !rect.width) return;
    const { view, model, hover, gaps } = state;
    const scroller = view.scrollDOM.getBoundingClientRect();
    const clipTop = scroller.top - rect.top;
    const clipBottom = scroller.bottom - rect.top;
    const style = getComputedStyle(this.host);
    const color = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
    const colors = {
      added: color('--twd-connector-added', '#9bb955'),
      removed: color('--twd-connector-removed', '#f14c4c'),
      modified: color('--twd-connector-modified', '#ffa600'),
      hover: color('--twd-connector-hover', '#d4a373'),
    };
    const columns = gaps.map((gap) => {
      const r = gap.getBoundingClientRect();
      return [r.left - rect.left, r.width] as const;
    });

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, clipTop, rect.width, Math.max(0, clipBottom - clipTop));
    ctx.clip();
    const docTop = view.documentTop - rect.top;
    for (const block of textBlocks(view.viewportLineBlocks)) {
      const top = docTop + block.top;
      const bottom = top + block.height;
      if (bottom < clipTop || top > clipBottom) continue;
      const index = view.state.doc.lineAt(block.from).number - 1;
      const row = model.rows[index];
      if (!row || row.kind === 'unchanged' || row.kind === 'inserted') continue;
      const hovered = index === hover;
      ctx.globalAlpha = hovered ? 0.9 : 0.45;
      ctx.fillStyle = colors[row.kind];
      for (const [x, w] of columns) ctx.fillRect(x + 3, top + 1, w - 6, block.height - 2);
      if (hovered) {
        ctx.globalAlpha = 1;
        ctx.strokeStyle = colors.hover;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (const [x, w] of columns) {
          ctx.moveTo(x, top + block.height / 2);
          ctx.lineTo(x + w, top + block.height / 2);
        }
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  destroy(): void {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
  }
}
