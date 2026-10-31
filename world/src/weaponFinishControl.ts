import { bilingual, onLanguageChange } from '../../shared-client/i18n';
import { WEAPON_FINISHES, weaponFinish, weaponFinishUnlocked, type WeaponFinishStore, type WeaponFinishId } from './weaponFinishes';

/** Settings-only cosmetic control: no additional gameplay binding or overlay input mode. */
export function createWeaponFinishControl(store: WeaponFinishStore, done: ReadonlySet<string>, onChange: (finish: WeaponFinishId) => void) {
  const root = document.createElement('section'); root.className = 'settings-sliders'; root.id = 'world-weapon-finishes';
  const title = document.createElement('p'); title.className = 'settings-note';
  const label = document.createElement('label'), labelText = document.createElement('span');
  const select = document.createElement('select'); select.id = 'world-weapon-finish'; label.htmlFor = select.id; label.append(labelText, select);
  const options = WEAPON_FINISHES.map(finish => { const option = document.createElement('option'); option.value = finish.id; select.append(option); return option; });
  const note = document.createElement('p'); note.className = 'settings-note';
  const status = document.createElement('p'); status.className = 'settings-note'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const details = document.createElement('details'), summary = document.createElement('summary'), list = document.createElement('ul');
  const stories = WEAPON_FINISHES.filter(finish => finish.unlock).map(() => { const item = document.createElement('li'); list.append(item); return item; });
  details.append(summary, list); root.append(title, label, note, status, details);
  let disposed = false;
  function refresh() {
    if (disposed) return;
    const unlocked = WEAPON_FINISHES.filter(finish => weaponFinishUnlocked(finish.id, done)).length;
    title.textContent = bilingual(`旅途涂装 · ${unlocked}/${WEAPON_FINISHES.length}`, `Journey finishes · ${unlocked}/${WEAPON_FINISHES.length}`);
    labelText.textContent = bilingual('枪械与近战外观', 'Rifle and blade finish');
    WEAPON_FINISHES.forEach((finish, i) => {
      const locked = !weaponFinishUnlocked(finish.id, done); options[i].disabled = locked;
      options[i].textContent = `${bilingual(...finish.name)}${locked ? bilingual(' · 未解锁', ' · Locked') : ''}`;
      options[i].title = bilingual(...finish.story);
    });
    const active = store.active(done); select.value = active;
    note.textContent = bilingual('仅改变材质颜色，不改变伤害、射速、瞄准、握持、碰撞或武器槽位；可随时恢复原装。', 'Colors only: identical damage, fire rate, aim, grip, collision and weapon slots. Restore Original at any time.');
    const changed = active !== store.preference;
    status.textContent = changed
      ? bilingual('此存档尚未解锁已保存的涂装，暂用原装；完成对应纪事后自动恢复。', 'This save has not earned the saved finish. Original is shown until its chronicle is completed.')
      : `${bilingual(...weaponFinish(active)!.name)} · ${store.saved ? bilingual('已保存于本机', 'Saved on this device') : bilingual('已应用，当前浏览器未保存', 'Applied; not saved by this browser')}`;
    summary.textContent = bilingual('如何获得旅途涂装', 'How to earn journey finishes');
    WEAPON_FINISHES.filter(finish => finish.unlock).forEach((finish, i) => {
      stories[i].textContent = `${weaponFinishUnlocked(finish.id, done) ? '✓ ' : ''}${bilingual(...finish.name)} — ${bilingual(...finish.story)}`;
    });
  }
  select.onchange = () => { if (disposed) return; if (store.select(select.value, done)) onChange(store.active(done)); refresh(); };
  const unsubscribe = onLanguageChange(refresh); refresh();
  return { root, refresh, dispose() { if (disposed) return; disposed = true; unsubscribe(); select.onchange = null; root.remove(); } };
}
