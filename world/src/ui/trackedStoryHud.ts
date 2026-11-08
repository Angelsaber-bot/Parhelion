export interface TrackedStoryHudState {
  title: string;
  instruction: string;
  returnHint: string;
  status?: string;
}
/** Explicitly pinned story context, alongside—not instead of—the original
 * objectives. Reattaches after their normal render without polling the DOM or
 * replacing focusable controls. Text is always plain authored/localized copy. */
export function createTrackedStoryHud(container: HTMLElement) {
  const root = document.createElement('section'); root.id = 'world-tracked-story';
  root.setAttribute('aria-label', 'Tracked story');
  Object.assign(root.style, { borderBottom: '1px solid #8c9eb255', paddingBottom: '9px', marginBottom: '9px' });
  const title = document.createElement('h3'), instruction = document.createElement('div'), status = document.createElement('div'), hint = document.createElement('div');
  instruction.className = 'cur'; status.className = hint.className = 'tracked-story-note';
  Object.assign(hint.style, { opacity: '.75', fontSize: '11px', marginTop: '4px' });
  Object.assign(status.style, { color: '#79521f', marginTop: '4px' });
  root.append(title, instruction, status, hint);
  let disposed = false, previous = '';
  return {
    update(state: TrackedStoryHudState | null) {
      if (disposed) return;
      if (!state) { root.remove(); previous = ''; return; }
      if (root.parentElement !== container) container.prepend(root);
      const next = JSON.stringify(state); if (next === previous) return; previous = next;
      root.setAttribute('aria-label', state.title);
      title.textContent = state.title; instruction.textContent = state.instruction;
      status.textContent = state.status ?? ''; status.hidden = !state.status; hint.textContent = state.returnHint;
    },
    dispose() { disposed = true; previous = ''; root.remove(); },
  };
}
