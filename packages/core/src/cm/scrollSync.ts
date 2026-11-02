/**
 * Vertical scroll synchronisation. All panes have the same line count and line height, so equal
 * `scrollTop` means aligned rows.
 */

export class ScrollSync {
  private scrollers: HTMLElement[] = [];
  private lastTop = 0;

  constructor(private readonly onScroll: () => void) {}

  setScrollers(scrollers: HTMLElement[], top?: number): void {
    this.detach();
    this.scrollers = scrollers;
    for (const el of scrollers) el.addEventListener('scroll', this.handle, { passive: true });
    if (top !== undefined) this.scrollTo(top);
  }

  scrollTo(top: number): void {
    this.lastTop = top;
    for (const el of this.scrollers) el.scrollTop = top;
  }

  private handle = (event: Event) => {
    const source = event.currentTarget as HTMLElement;
    const top = source.scrollTop;
    // Echo of a scroll we applied ourselves (or a horizontal scroll): nothing to propagate.
    if (Math.abs(top - this.lastTop) < 0.5) return;
    this.lastTop = top;
    for (const el of this.scrollers) {
      if (el !== source && Math.abs(el.scrollTop - top) >= 0.5) el.scrollTop = top;
    }
    this.onScroll();
  };

  detach(): void {
    for (const el of this.scrollers) el.removeEventListener('scroll', this.handle);
    this.scrollers = [];
  }
}
