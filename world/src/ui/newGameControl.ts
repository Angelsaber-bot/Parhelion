import { bilingual, onLanguageChange } from '../../../shared-client/i18n';

/** New games begin only from the Quest save panel. Gameplay has no reset binding. */
export function installNewGameControl(root: HTMLElement, onConfirm: () => void) {
  const settings = root.closest('dialog')!;
  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'world-new-game';
  const dialog = document.createElement('dialog');
  dialog.className = 'input-settings new-game-confirmation';
  dialog.setAttribute('aria-labelledby', 'world-new-game-title');
  dialog.setAttribute('aria-describedby', 'world-new-game-warning');
  const title = document.createElement('h2');
  title.id = 'world-new-game-title';
  const warning = document.createElement('p');
  warning.id = 'world-new-game-warning';
  const choices = document.createElement('div');
  choices.className = 'settings-actions';
  const cancel = document.createElement('button'), confirm = document.createElement('button');
  cancel.type = confirm.type = 'button';
  cancel.autofocus = true;
  cancel.id = 'world-new-game-cancel';
  confirm.id = 'world-new-game-confirm';
  choices.append(cancel, confirm);
  dialog.append(title, warning, choices);
  root.append(button, dialog);
  const render = () => {
    button.textContent = bilingual('开始新游戏…', 'Start a new game…');
    title.textContent = bilingual('重新开始旅程？', 'Start a new journey?');
    warning.textContent = bilingual('这会清除当前的任务、契约与发现，并空手回到起点。按键、语言和画质设置会保留。',
      'This clears your quests, contracts and discoveries and returns you to the starting point unarmed. Your controls, language and graphics settings are kept.');
    cancel.textContent = bilingual('取消', 'Cancel');
    confirm.textContent = bilingual('清除进度并开始', 'Clear progress and start');
  };
  render();
  const unsubscribe = onLanguageChange(render);
  const dismiss = () => { if (dialog.open) dialog.close(); };
  button.onclick = () => {
    if (!settings.open || !root.isConnected || dialog.open) return;
    dialog.showModal();
    cancel.focus();
  };
  cancel.onclick = dismiss;
  confirm.onclick = () => {
    if (!settings.open || !dialog.open || !root.isConnected) return;
    dismiss();
    onConfirm();
  };
  dialog.addEventListener('keydown', event => {
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      dismiss();
    } else if (event.repeat && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
    }
  });
  dialog.addEventListener('close', () => { if (settings.open) button.focus(); });
  settings.addEventListener('close', dismiss);
  return { dispose() { settings.removeEventListener('close', dismiss); dismiss(); unsubscribe(); button.remove(); dialog.remove(); } };
}
