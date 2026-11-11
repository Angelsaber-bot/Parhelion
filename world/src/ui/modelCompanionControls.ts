import { bilingual } from '../../../shared-client/i18n';
import { MODEL_COMPANIONS, isModelCompanionId } from '../characters/catalog';
import type { ModelCompanion } from '../companions/modelCompanion';

/** A clearly separate, session-only opt-in inside the existing servant modal. */
export function createModelCompanionControls(companion: ModelCompanion) {
  const element = document.createElement('section');
  const label = document.createElement('label'), title = document.createElement('span');
  const select = document.createElement('select'); select.id = 'model-companion';
  label.append(title, select);
  const note = document.createElement('p'), status = document.createElement('p');
  note.className = 'servant-note';
  status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const retry = document.createElement('button'); retry.type = 'button'; retry.id = 'model-companion-retry';
  const choices = [document.createElement('option'), ...MODEL_COMPANIONS.map(() => document.createElement('option'))];
  choices[0].value = '';
  MODEL_COMPANIONS.forEach((entry, index) => { choices[index + 1].value = entry.id; });
  select.append(...choices);
  element.append(label, note, status, retry);
  let disposed = false;
  function render() {
    if (disposed) return;
    title.textContent = bilingual('世界从者同行 · 可领取', 'World servant companion · Claimable');
    choices[0].textContent = bilingual('无（不加载额外模型）', 'None (no extra model loaded)');
    MODEL_COMPANIONS.forEach((entry, index) => { choices[index + 1].textContent = bilingual(entry.name, entry.nameEn); });
    select.value = companion.selected ?? '';
    note.textContent = bilingual('暂停菜单打开「从者领取」，选择目标后跟随金色指引前往奥尔良守城集市、古埃及商队绿洲或秦地骊山工匠集镇。基础攻击为临时程序动作；专属技能/宝具动作尚未恢复。建议在开阔地使用。', 'Open Claim servants in the pause menu, select a destination and follow the gold guide to Defenders Market in Orleans, Caravan Oasis in Egypt or Lishan Artisan Town in Qin. Basic attack uses a temporary procedural motion; dedicated skills/ultimates are not restored. Best in open areas.');
    const messages = {
      off: ['未启用额外模型。', 'Extra model disabled.'],
      loading: ['模型加载中，可随时切换或取消。', 'Loading model. You can switch or cancel at any time.'],
      ready: companion.placementPending ? ['模型已加载，继续游戏并移至空间足够的地面后显示。', 'Model loaded. Resume on ground with enough open space to show it.'] : ['模型同行中，使用原生动作与通用寻路。', 'Following with native animation and generic navigation.'],
      failed: ['模型加载失败。可重试、切换或选择“无”。', 'Model failed to load. Retry, switch, or choose None.'],
    };
    const message = messages[companion.state];
    status.textContent = bilingual(message[0], message[1]);
    retry.textContent = bilingual('重试模型加载', 'Retry model loading');
    retry.hidden = companion.state !== 'failed';
  }
  select.onchange = () => {
    const id = isModelCompanionId(select.value) ? select.value : null;
    void companion.select(id).then(render);
    render();
  };
  retry.onclick = () => { void companion.retry().then(render); render(); };
  render();
  return { element, render, dispose() { if (disposed) return; disposed = true; select.onchange = null; retry.onclick = null; element.remove(); } };
}
