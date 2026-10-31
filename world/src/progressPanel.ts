import { bilingual, onLanguageChange } from '../../shared-client/i18n';
import { encodeOriginalProgressText } from './progressRecovery';
import { WorldProgress, parseProgressBackup, type ProgressPersistenceState } from './progress';

const STATUS: Record<ProgressPersistenceState, [string, string]> = {
  ready: ['任务与发现会自动保存在当前浏览器。', 'Quests and discoveries save automatically in this browser.'],
  saved: ['任务进度已保存到当前浏览器。', 'Quest progress is saved in this browser.'],
  unavailable: ['浏览器未开放本地存储。本次进度仅保留在当前页面；离开前可下载备份。', 'Local storage is unavailable. This session only keeps progress in memory; download a backup before leaving.'],
  invalid: ['已有存档无法完整读取。可读取的当前进度已保留，未从旧版存档自动恢复，也未改动个人设置。', 'The existing save could not be fully read. Readable current progress is retained; no legacy progress was restored or personal settings changed.'],
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
  const original = document.createElement('button'); original.type = 'button';
  const originalHelp = document.createElement('p'); originalHelp.className = 'settings-note';
  let disposed = false, readGeneration = 0;
  let resultText: [string, string] | null = null;
  const setResult = (line: [string, string] | null) => { resultText = line; result.textContent = line ? bilingual(...line) : ''; };
  const download = (raw: string | Uint8Array<ArrayBuffer>, name: string, type = 'application/json') => {
    const url = URL.createObjectURL(new Blob([raw], { type }));
    const link = document.createElement('a'); link.href = url; link.download = name;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const failedReplacement = () => setResult(['未替换存档：存储不可用或存档已被另一页面改动。原数据与本次进度保持不变。', 'Save not replaced: storage failed or another tab changed it. Stored data and session progress are unchanged.']);
  const render = () => {
    if (disposed) return;
    result.textContent = resultText ? bilingual(...resultText) : '';
    title.textContent = bilingual('任务存档', 'Quest save'); status.textContent = bilingual(...STATUS[progress.persistence]);
    if (progress.saveBlocked) status.textContent = bilingual('原存档需要检查并已受保护，可读取的当前进度已保留，本次进度尚未保存。可下载原始数据及本次进度，或明确确认替换；自动保存不会覆盖原数据。', 'Original save needs review and is protected; readable current progress is retained, but this session is not saved. Download original/session data or explicitly confirm replacement. Autosave will not overwrite the original.');
    retry.textContent = progress.saveBlocked ? bilingual('用本次进度替换…', 'Replace with session progress…') : bilingual('重新保存', 'Retry save'); backup.textContent = bilingual('下载进度备份', 'Download progress backup');
    restore.textContent = bilingual('从备份恢复…', 'Restore a backup…');
    original.textContent = bilingual('下载无损原始记录', 'Download lossless original'); original.hidden = progress.exportUnreadableSnapshot() === null;
    originalHelp.hidden = original.hidden;
    originalHelp.textContent = bilingual('以 UTF-16LE（.utf16le）保留原始文本数据，供排查或修复；不是可直接导入的进度备份，不会修改当前记录。', 'Preserves the original text data as UTF-16LE (.utf16le) for diagnosis or repair. Not a directly importable progress backup; the current record is unchanged.');
    retry.hidden = progress.persistence === 'ready' || progress.persistence === 'saved';
    warning.hidden = progress.persistence !== 'failed' && progress.persistence !== 'unavailable' && progress.persistence !== 'invalid';
    warning.textContent = progress.saveBlocked ? bilingual('原存档受保护 · 本次进度尚未保存 · 请到设置备份或恢复', 'Original save protected · Session not saved · Back up or restore in Settings') : progress.persistence === 'invalid'
      ? bilingual('已有存档无法读取 · 请先到设置检查或恢复备份', 'Existing save unreadable · Check Settings or restore a backup before continuing')
      : bilingual('任务尚未保存 · 设置中可重试或下载备份', 'Quest progress is not saved · Retry or back up in Settings');
  };
  retry.addEventListener('click', event => {
    event.stopPropagation(); if (disposed) return;
    if (!progress.saveBlocked) { progress.save(); return; }
    const expected = progress.captureStoredSnapshot();
    if (!expected) { failedReplacement(); return; }
    // A repair prompt for corrupt bytes must not silently adopt a newer tab's save.
    const originalRaw = progress.exportUnreadableSnapshot();
    if (originalRaw !== null && expected.raw !== originalRaw) { failedReplacement(); return; }
    if (!window.confirm(bilingual('用本次页面进度替换原存档并重新载入？建议先下载原始数据与本次进度。个人设置保留。', 'Replace the original save with this session and reload? Download the original and session progress first if needed. Personal settings are kept.')) || disposed) return;
    if (progress.restoreSnapshot(progress.exportSnapshot(), expected) === 'restored') onRestored();
    else failedReplacement();
  });
  backup.addEventListener('click', event => { event.stopPropagation(); if (!disposed) download(progress.exportSnapshot(), 'parhelion-world-progress.json'); });
  original.addEventListener('click', event => {
    event.stopPropagation(); if (disposed) return;
    const raw = progress.exportUnreadableSnapshot(); if (raw !== null) download(encodeOriginalProgressText(raw), 'parhelion-world-unreadable-original.utf16le', 'application/octet-stream');
  });
  restore.addEventListener('click', event => { event.stopPropagation(); if (disposed) return; file.value = ''; file.click(); });
  file.addEventListener('change', async () => {
    const generation = ++readGeneration;
    const selected = file.files?.[0]; if (!selected || disposed) { if (!disposed) restore.disabled = false; return; }
    setResult(null); restore.disabled = true;
    try {
      if (selected.size > 262144) throw new Error('invalid');
      const raw = await selected.text(); if (disposed || generation !== readGeneration) return;
      if (!parseProgressBackup(raw)) throw new Error('invalid');
      const expected = progress.captureStoredSnapshot();
      if (!expected) { failedReplacement(); return; }
      const originalRaw = progress.exportUnreadableSnapshot();
      if (progress.saveBlocked && originalRaw !== null && expected.raw !== originalRaw) { failedReplacement(); return; }
      const accepted = window.confirm(bilingual('用这个备份替换当前任务进度并重新载入世界？按键、语言、画质和外观偏好将保留。建议先下载当前进度备份。', 'Replace current quest progress with this backup and reload the world? Controls, language, graphics and cosmetic preferences are kept. Download your current progress first if needed.'));
      if (!accepted || disposed || generation !== readGeneration) return;
      const outcome = progress.restoreSnapshot(raw, expected);
      if (outcome === 'restored') onRestored();
      else failedReplacement();
    } catch {
      if (!disposed && generation === readGeneration) setResult(['无法读取有效的进度备份，当前存档未改动。', 'This is not a readable progress backup. Your current save was not changed.']);
    } finally { if (!disposed && generation === readGeneration) restore.disabled = false; }
  });
  root.append(title, status, retry, backup, restore, original, originalHelp, file, result); document.body.append(warning);
  const unsubscribe = progress.subscribe(render), locale = onLanguageChange(render); render();
  return { root, cancelPendingRead() { if (disposed) return; readGeneration++; restore.disabled = false; file.value = ''; }, dispose() { if (disposed) return; disposed = true; readGeneration++; unsubscribe(); locale(); root.remove(); warning.remove(); } };
}
