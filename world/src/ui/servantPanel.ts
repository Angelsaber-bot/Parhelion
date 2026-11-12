import { bilingual, onLanguageChange, getLanguage } from '../../../shared-client/i18n';
import { COMPANIONS, type FirstContract, type CompanionId } from '../companions/contracts';
import { ContractServant, outfitLabel } from '../companions/servant';
import type { ModelCompanion } from '../companions/modelCompanion';
import { isModelCompanionId } from '../characters/catalog';
import './servant.css';

/** World-only controls; does not touch Arena's independent loadout/skin selectors. */
export function createServantPanel(servant: ContractServant, contract: FirstContract, onOpen: () => void, model?: ModelCompanion) {
  const launcher = document.createElement('button');
  launcher.id = 'servant-open'; launcher.type = 'button'; launcher.className = 'hud';
  const dialog = document.createElement('dialog'); dialog.id = 'servant-settings';
  const title = document.createElement('h2'), close = document.createElement('button');
  const header = document.createElement('header'); close.type = 'button'; header.append(title, close);
  const label = document.createElement('label'), labelText = document.createElement('span');
  const select = document.createElement('select'); select.id = 'servant-outfit';
  const armor = document.createElement('option'), civilian = document.createElement('option');
  armor.value = 'armor'; civilian.value = 'civilian'; select.append(armor, civilian); label.append(labelText, select);
  const note = document.createElement('p'), state = document.createElement('p'), saved = document.createElement('p');
  note.className = 'servant-note'; state.setAttribute('role', 'status'); state.setAttribute('aria-live', 'polite');
  const actions = document.createElement('div'); actions.className = 'servant-actions';
  const summon = document.createElement('button'), retry = document.createElement('button');
  retry.id = 'servant-retry';
  summon.type = retry.type = 'button'; actions.append(summon, retry);
  const pickLabel = document.createElement('label'), pickText = document.createElement('span');
  const pick = document.createElement('select'); pick.id = 'servant-active'; pickLabel.append(pickText, pick);
  dialog.append(header, pickLabel, label, note, state, saved, actions); document.body.append(launcher, dialog);
  let signature = '';
  function render() {
    const status = companionStatus(servant, contract, model);
    const next = [getLanguage(), status, servant.appearance.outfit, servant.appearance.saved, contract.roster.join(','), contract.selected, contract.companionSummoned].join('|');
    if (signature === next) return;
    signature = next;
    launcher.textContent = bilingual('从者', 'Servants');
    title.textContent = bilingual('同行从者', 'Traveling companion');
    dialog.setAttribute('aria-label', title.textContent);
    close.textContent = bilingual('关闭 ✕', 'Close ✕');
    labelText.textContent = bilingual('选择外观', 'Choose outfit');
    armor.textContent = outfitLabel('armor'); civilian.textContent = outfitLabel('civilian');
    select.value = servant.appearance.outfit;
    const showSaber = contract.selected === 'saber';
    label.hidden = note.hidden = saved.hidden = !showSaber;
    note.textContent = bilingual('Saber 的两套外观均可持剑协助。', 'Saber can assist with her sword in either outfit.');
    state.textContent = status;
    saved.textContent = servant.appearance.saved ? bilingual('外观选择保存于本机。', 'Outfit preference is saved on this device.') : bilingual('外观已应用；当前浏览器无法保存，下次可能恢复默认。', 'Outfit applied, but this browser cannot save the preference.');
    pickText.textContent = bilingual('当前从者', 'Active servant');
    pick.replaceChildren(...COMPANIONS.filter(s => contract.has(s.id)).map(s => { const o = document.createElement('option'); o.value = s.id; o.textContent = bilingual(s.name, s.nameEn); return o; }));
    pick.value = contract.selected ?? ''; pickLabel.hidden = !contract.anyRecruited;
    summon.disabled = !contract.anyRecruited;
    summon.textContent = contract.anyRecruited ? (contract.companionSummoned ? bilingual('收回从者', 'Recall servant') : bilingual('召唤从者', 'Summon servant')) : bilingual('先前往圣剑湖缔约', 'Form a contract at Sword Lake first');
    retry.textContent = bilingual('重试模型加载', 'Retry model loading');
    retry.hidden = !(showSaber ? servant.state === 'failed' : !!contract.following && model?.selected === contract.following && model.state === 'failed');
  }
  const visibility = () => { launcher.hidden = !!document.pointerLockElement; };
  launcher.onclick = (e) => { e.stopPropagation(); if (dialog.open) return; onOpen(); render(); dialog.showModal(); };
  close.onclick = () => dialog.close();
  pick.onchange = () => { contract.select(pick.value as CompanionId); render(); };
  select.onchange = () => { void servant.selectOutfit(select.value).then(render); render(); };
  retry.onclick = () => {
    const active = contract.following;
    if (contract.selected === 'saber') void servant.retry().then(render);
    else if (active && model?.selected === active) void model.retry().then(render);
    render();
  };
  summon.onclick = () => { contract.toggle(); render(); };
  // Native modal focus/ESC behavior; input cannot leak into gameplay or click-to-lock.
  for (const name of ['keydown', 'keyup', 'mousedown', 'mouseup', 'click', 'wheel']) dialog.addEventListener(name, e => e.stopPropagation());
  const unsubscribe = onLanguageChange(render);
  document.addEventListener('pointerlockchange', visibility); render(); visibility();
  return {
    get open() { return dialog.open; },
    render() { if (dialog.open) render(); },
    dispose() { unsubscribe(); document.removeEventListener('pointerlockchange', visibility); dialog.remove(); launcher.remove(); },
  };
}

export function companionStatus(servant: ContractServant, contract: FirstContract, model?: ModelCompanion) {
  const selected = COMPANIONS.find(entry => entry.id === contract.selected);
  if (!selected || selected.id === 'saber') return servant.status;
  let label = bilingual('已收回', 'Recalled');
  if (contract.isFollowing(selected.id)) {
    label = bilingual('同行中', 'Following');
    if (isModelCompanionId(selected.id)) {
      if (model?.selected !== selected.id || model.state === 'loading') label = bilingual('模型加载中', 'Loading model');
      else if (model.state === 'failed') label = bilingual('模型加载失败', 'Model failed to load');
      else if (model.placementPending) label = bilingual('等待可站立的位置', 'Waiting for clear ground');
    }
  }
  return `${bilingual(selected.name, selected.nameEn)} · ${label}`;
}
