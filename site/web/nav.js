// Loaded only by the unified local server; standalone map projects stay untouched.
if (!document.getElementById('parhelion-home-nav')) {
  const nav = document.createElement('nav');
  nav.id = 'parhelion-home-nav';
  nav.setAttribute('aria-label', 'Parhelion 导航');
  const home = document.createElement('a');
  home.href = '/';
  home.textContent = '← 返回首页';
  home.setAttribute('aria-label', '离开当前游戏，返回 Parhelion 首页');
  const label = document.createElement('span');
  label.textContent = 'PARHELION';
  nav.append(home, label);
  document.body.append(nav);

  // Native navigation unloads the map, renderer and WebSocket rather than keeping
  // either game running behind the launcher. Never hijack Escape or game controls.
  const update = () => { nav.hidden = Boolean(document.pointerLockElement); };
  document.addEventListener('pointerlockchange', update);
  window.addEventListener('pageshow', update);
  nav.addEventListener('click', event => event.stopPropagation());
  nav.addEventListener('pointerdown', event => event.stopPropagation());
  update();
}

// The unified server hosts Colyseus on this same origin. The original Arena
// client still works standalone; only this injected navigation layer supplies
// its local endpoint. An explicit ?server= remains an intentional override.
if (!new URLSearchParams(location.search).has('server')) {
  const useLocalServer = () => {
    const input = document.getElementById('server');
    if (input instanceof HTMLInputElement) input.value = location.origin.replace(/^http/, 'ws');
  };
  useLocalServer();
  // All module dependencies and the lobby's stored settings finish before load.
  if (document.readyState !== 'complete') window.addEventListener('load', useLocalServer, { once: true });
}

{
// Preserve the original matchmaker while making its bot-fill limitation clear.
const explainLocalPlay = () => {
  const input = document.getElementById('server');
  if (input?.parentElement && !document.getElementById('parhelion-online-note')) {
    const note = document.createElement('small');
    note.id = 'parhelion-online-note';
    note.textContent = '本机服务器 · 多人同房请关闭“空位用 Bot 补齐”';
    input.parentElement.append(note);
  }
};
explainLocalPlay();
if (document.readyState !== 'complete') window.addEventListener('load', explainLocalPlay, { once: true });
}
