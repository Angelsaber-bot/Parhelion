import { bilingual, onLanguageChange } from '../../shared-client/i18n';
import { resolutionMode, type ResolutionMode } from './renderQuality';
const KEY = 'parhelion-world-resolution-v1';
export function readResolutionMode(params: URLSearchParams): ResolutionMode {
  if (params.has('resolution')) return resolutionMode(params.get('resolution'));
  try { return resolutionMode(localStorage.getItem(KEY)); } catch { return 'balanced'; }
}
/** Lives inside the existing controls dialog; input capture and close/blur behavior stay unchanged. */
export function attachRenderSettings(mode: ResolutionMode, quality: string, change: (mode: ResolutionMode) => void) {
  const host = document.querySelector('#world-settings .settings-sliders');
  if (!host) return;
  const group = document.createElement('div'); group.className = 'settings-sliders';
  const label = document.createElement('label'), title = document.createElement('span');
  const select = document.createElement('select'); select.id = 'world-resolution';
  for (const value of ['crisp', 'balanced', 'adaptive']) { const option = document.createElement('option'); option.value = value; select.append(option); }
  select.value = mode; label.append(title, select);
  const note = document.createElement('p'); note.className = 'settings-note';
  const effectsLabel = document.createElement('label'), effectsText = document.createElement('span');
  const effects = document.createElement('select'); effects.id = 'world-effects-quality';
  for (const value of ['low', 'med', 'high']) { const option = document.createElement('option'); option.value = value; effects.append(option); }
  effects.value = quality; effectsLabel.append(effectsText, effects);
  const reload = document.createElement('button'); reload.type = 'button';
  reload.onclick = () => { const url = new URL(location.href); url.searchParams.set('q', effects.value); location.assign(url.href); };
  const render = () => {
    title.textContent = bilingual('渲染清晰度', 'Render resolution');
    const labels = [bilingual('原生清晰：最高 2×（较高 GPU 成本）', 'Native crisp: up to 2× (higher GPU cost)'), bilingual('均衡（默认）：固定最高 1.25×', 'Balanced (default): fixed, up to 1.25×'), bilingual('自适应：1×–2×（主动选择）', 'Adaptive: 1×–2× (opt-in)')];
    Array.from(select.options).forEach((option, i) => option.textContent = labels[i]);
    effectsText.textContent = bilingual('特效质量', 'Effects quality');
    const names = [bilingual('低', 'Low'), bilingual('标准', 'Standard'), bilingual('高：环境遮蔽与更密草地', 'High: ambient occlusion and denser grass')];
    Array.from(effects.options).forEach((option, i) => option.textContent = names[i]);
    reload.textContent = bilingual('应用特效并重新加载', 'Apply effects and reload');
    note.textContent = bilingual('清晰度立即生效。默认均衡保持固定分辨率，不会自动跌到模糊的低分辨率。原生清晰最高 2×，相对 1.25× 最多增加 156% 像素成本；帧率不足可选均衡。自适应只在前台运行时调整。低特效限制为 1×。特效更改会重新加载地图；仅保留已保存进度，未保存时请先备份。', 'Resolution applies immediately. Default Balanced stays fixed and never silently drops to a blurry low resolution. Native Crisp reaches 2×, up to 156% more pixels than 1.25×; choose Balanced if frame rate is low. Adaptive adjusts only in the foreground. Low effects cap resolution at 1×. Applying effects reloads the map. Only saved progress is kept; back up any unsaved progress first.');
  };
  select.onchange = () => { const value = resolutionMode(select.value); try { localStorage.setItem(KEY, value); } catch { /* session-only if storage unavailable */ } const url = new URL(location.href); url.searchParams.set('resolution', value); history.replaceState(history.state, '', url.href); change(value); };
  group.append(label, effectsLabel, reload, note); host.after(group); render(); onLanguageChange(render);
}
