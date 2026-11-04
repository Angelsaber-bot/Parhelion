import { bilingual, onLanguageChange } from '../../../shared-client/i18n';
import { newRoomCode, normalizeRoomCode } from './coopProtocol';
import type { CoopStatus } from './coopSession';

export interface CoopPanelOptions {
  status(): { status: CoopStatus; code: string | null; host: boolean; partner: string };
  join(code: string): void;
  leave(): void;
  canOpen(): boolean;
}

const STATUS_TEXT: Record<CoopStatus, [string, string]> = {
  idle: ['未联机', 'Not connected'],
  connecting: ['正在连接…', 'Connecting…'],
  waiting: ['房间已开 · 等待队友', 'Room open · Waiting for a partner'],
  paired: ['已联机', 'Connected'],
  closed: ['连接已断开', 'Disconnected'],
  error: ['连接失败', 'Connection failed'],
};

/** Link a friend opens to join the same room (the World reads `?room=`). */
export function inviteLink(code: string, href = location.href) {
  const url = new URL(href); url.searchParams.set('room', code); url.hash = '';
  return url.toString();
}

/** Room code dialog: create a room, join a friend's code, copy an invite, leave. */
export function createCoopPanel(options: CoopPanelOptions) {
  const root = document.createElement('dialog'); root.id = 'world-coop';
  const title = document.createElement('h2'), intro = document.createElement('p'), status = document.createElement('p'), code = document.createElement('div');
  const create = document.createElement('button'), copy = document.createElement('button'), input = document.createElement('input'), join = document.createElement('button');
  const leave = document.createElement('button'), close = document.createElement('button'), joinRow = document.createElement('div'), rules = document.createElement('ul');
  title.id = 'world-coop-title'; root.setAttribute('aria-labelledby', title.id);
  status.id = 'world-coop-status'; status.setAttribute('role', 'status'); code.id = 'world-coop-code';
  for (const b of [create, copy, join, leave, close]) b.type = 'button';
  create.id = 'world-coop-create'; copy.id = 'world-coop-copy'; join.id = 'world-coop-join'; leave.id = 'world-coop-leave'; close.id = 'world-coop-close';
  input.id = 'world-coop-input'; input.maxLength = 7; input.autocomplete = 'off'; input.spellcheck = false; input.setAttribute('autocapitalize', 'characters');
  joinRow.className = 'coop-row'; joinRow.append(input, join);
  root.append(title, intro, rules, status, code, create, copy, joinRow, leave, close); document.body.append(root);
  let note = '';
  function render() {
    const s = options.status(), live = s.status === 'waiting' || s.status === 'paired' || s.status === 'connecting';
    title.textContent = bilingual('双人联机 · 世界合作', 'World co-op · Two players');
    intro.textContent = bilingual('和朋友在同一个大世界里并肩探索、战斗。一人开房间，把 5 位房间码或邀请链接发给对方即可。', 'Explore and fight the same World side by side. One player opens a room and sends the 5-letter code or invite link.');
    rules.replaceChildren(...[
      ['房主的世界负责敌人：两人看到同样的敌人、血量与攻击预警。', "The host's World runs the enemies: both see the same foes, health and attack tells."],
      ['敌人会攻击离自己更近的玩家；双方的伤害都会计入。', 'Enemies attack whichever player is nearer; both players’ damage counts.'],
      ['任务、碎片与解锁各自保存在自己的进度里。', 'Quests, shards and unlocks stay in each player’s own progress.'],
    ].map(([zh, en]) => { const li = document.createElement('li'); li.textContent = bilingual(zh, en); return li; }));
    const role = s.status === 'paired' ? bilingual(s.host ? ' · 你是房主' : ` · 房主：${s.partner}`, s.host ? ' · You host' : ` · Host: ${s.partner}`) : '';
    status.textContent = bilingual(...STATUS_TEXT[s.status]) + role + (note ? ` · ${note}` : '');
    code.textContent = live && s.code ? s.code : '';
    code.hidden = !code.textContent;
    create.textContent = bilingual('创建房间', 'Open a room'); create.hidden = live;
    copy.textContent = bilingual('复制邀请链接', 'Copy invite link'); copy.hidden = !(live && s.code);
    input.placeholder = bilingual('输入房间码', 'Room code'); join.textContent = bilingual('加入', 'Join'); joinRow.hidden = live;
    leave.textContent = bilingual('离开房间', 'Leave room'); leave.hidden = !live;
    close.textContent = bilingual('返回世界', 'Return to World');
  }
  create.onclick = () => { note = ''; options.join(newRoomCode()); render(); };
  join.onclick = () => {
    const room = normalizeRoomCode(input.value);
    if (!room) { note = bilingual('房间码是 5 位字母或数字', 'A room code is 5 letters or digits'); render(); input.focus(); return; }
    note = ''; options.join(room); render();
  };
  input.addEventListener('keydown', event => { event.stopPropagation(); if (event.key === 'Enter') join.click(); });
  input.addEventListener('keyup', event => event.stopPropagation());
  copy.onclick = async () => {
    const s = options.status(); if (!s.code) return;
    try { await navigator.clipboard.writeText(inviteLink(s.code)); note = bilingual('邀请链接已复制', 'Invite link copied'); }
    catch { note = inviteLink(s.code); }
    render();
  };
  leave.onclick = () => { note = ''; options.leave(); render(); };
  close.onclick = () => root.close();
  root.addEventListener('click', event => event.stopPropagation());
  const unsubscribe = onLanguageChange(() => { if (root.open) render(); });
  return {
    root, render,
    get open() { return root.open; },
    show() { if (!options.canOpen()) return false; note = ''; render(); root.showModal(); return true; },
    close() { if (root.open) root.close(); },
    dispose() { unsubscribe(); root.remove(); },
  };
}
