/** Results-only shortcut. Never participates in the live movement bindings. */
export class ResultsBoard {
  ended = false;
  open = false;
  setEnded(ended: boolean) { this.ended = ended; this.open = false; }
  toggle() { if (this.ended) this.open = !this.open; return this.open; }
  close() { this.open = false; }
  key(code: string, repeat = false, editing = false, modified = false): boolean {
    if (!this.ended || repeat || editing || modified) return false;
    if (code === 'KeyS') { this.toggle(); return true; }
    if (code === 'Escape' && this.open) { this.close(); return true; }
    return false;
  }
}

/** The HUD is itself a stacking context: raising only its child cannot clear overlays. */
export function syncResultsBoardLayers(open: boolean, hud: Pick<HTMLElement, 'classList'>, endCard: Pick<HTMLElement, 'classList'>) {
  hud.classList.toggle('viewing-scores', open);
  endCard.classList.toggle('viewing-scores', open);
}
