import { bilingual, onLanguageChange } from '../../shared-client/i18n';
import { WorldProgress, parseProgressBackup, type ProgressPersistenceState } from './progress';

const STATUS: Record<ProgressPersistenceState, [string, string]> = {
  ready: ['任务与发现会自动保存在当前浏览器。', 'Quests and discoveries save automatically in this browser.'],
  saved: ['任务进度已保存到当前浏览器。', 'Quest progress is saved in this browser.'],
  unavailable: ['浏览器未开放本地存储。本次进度仅保留在当前页面；离开前可下载备份。', 'Local storage is unavailable. This session only keeps progress in memory; download a backup before leaving.'],
  invalid: ['已有存档无法读取。未从旧版存档自动恢复，也未改动个人设置。', 'The existing save could not be read. No legacy progress was restored and personal settings were not changed.'],
  failed: ['本次进度尚未保存，可能是存储空间不足。请重试或先下载进度备份，不要刷新页面。', 'Progress is not saved, possibly because storage is full. Retry or download a progress backup before reloading.'],
};

/** No polling and no automatic downloads. Storage failures remain visible until a
 * successful write, while quests continue to use the same in-memory progress. */
export function createProgressPanel(progress: WorldProgress, onRestored: () => void) {
  const root = document.createElement('section'); root.className = 'settings-sliders'; root.id = 'world-progress-status';
  const title = document.createElement('strong'), status = document.createElement('p');
  status.className = 'settings-note'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const retry = document.createElement('button'), backup = document.createElement('button'); retry.type = backup.type = 'button';
  const restore = document.createElement('button'), file = document.createElement('input'), result = document.createElement('p');
  restore.type = 'button'; file.type = 'file'; file.accept = 'application/json,.json'; file.hidden = true;
  result.className = 'settings-note'; result.setAttribute('role', 'status');
  const warning = document.createElement('aside'); warning.id = 'world-save-warning'; warning.hidden = true; warning.setAttribute('role', 'status');
  Object.assign(warning.style, { position: 'fixed', left: '50%', bottom: '18px', transform: 'translateX(-50%)', maxWidth: 'min(520px, 85vw)', padding: '10px 14px', borderRadius: '10px', background: '#362b19ed', color: '#ffe3a5', fontSize: '12px', zIndex: '6', pointerEvents: 'none' });
  let disposed = false;
  const render = () => {
    if (disposed) return;
    title.textContent = bilingual('任务存档', 'Quest save'); status.textContent = bilingual(...STATUS[progress.persistence]);
    retry.textContent = bilingual('重新保存', 'Retry save'); backup.textContent = bilingual('下载进度备份', 'Download progress backup');
    restore.textContent = bilingual('从备份恢复…', 'Restore a backup…');
    retry.hidden = progress.persistence === 'ready' || progress.persistence === 'saved';
    warning.hidden = progress.persistence !== 'failed' && progress.persistence !== 'unavailable';
    warning.textContent = bilingual('任务尚未保存 · 设置中可重试或下载备份', 'Quest progress is not saved · Retry or back up in Settings');
  };
  retry.addEventListener('click', event => { event.stopPropagation(); progress.save(); });
  backup.addEventListener('click', event => {
    event.stopPropagation();
    const url = URL.createObjectURL(new Blob([progress.exportSnapshot()], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'parhelion-world-progress.json';
    document.body.append(link); link.click(); link.remove();
    // Keep the object URL alive through navigation dispatch, then release it.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  restore.addEventListener('click', event => { event.stopPropagation(); file.value = ''; file.click(); });
  file.addEventListener('change', async () => {
    const selected = file.files?.[0]; if (!selected || disposed) return;
    result.textContent = ''; restore.disabled = true;
    try {
      if (selected.size > 262144) throw new Error('invalid');
      const raw = await selected.text(); if (disposed) return;
      if (!parseProgressBackup(raw)) throw new Error('invalid');
      const accepted = window.confirm(bilingual('用这个备份替换当前任务进度并重新载入世界？按键、语言、画质和外观偏好将保留。建议先下载当前进度备份。', 'Replace current quest progress with this backup and reload the world? Controls, language, graphics and cosmetic preferences are kept. Download your current progress first if needed.'));
      if (!accepted || disposed) return;
      const outcome = progress.restoreSnapshot(raw);
      if (outcome === 'restored') onRestored();
      else result.textContent = bilingual('恢复未写入，当前任务进度保持不变。', 'Restore was not written; current quest progress is unchanged.');
    } catch {
      if (!disposed) result.textContent = bilingual('无法读取有效的进度备份，当前存档未改动。', 'This is not a readable progress backup. Your current save was not changed.');
    } finally { if (!disposed) restore.disabled = false; }
  });
  root.append(title, status, retry, backup, restore, file, result); document.body.append(warning);
  const unsubscribe = progress.subscribe(render), locale = onLanguageChange(render); render();
  return { root, dispose() { if (disposed) return; disposed = true; unsubscribe(); locale(); root.remove(); warning.remove(); } };
}
