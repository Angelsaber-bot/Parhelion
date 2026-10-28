// Built into arena/ and world/ index.html so the public site has the same home link.
// The local server additionally injects nav.js, whose guard then skips a second button.
if (!document.getElementById('parhelion-home-nav')) {
  const nav = document.createElement('nav');
  nav.id = 'parhelion-home-nav';
  nav.setAttribute('aria-label', 'Parhelion 导航');
  const home = document.createElement('a');
  home.href = '/';
  // Follows the shared language choice (i18n keeps <html lang> current).
  const label_ = () => {
    const en = document.documentElement.lang === 'en';
    home.textContent = en ? '← Home' : '← 返回首页';
    home.setAttribute('aria-label', en ? 'Leave the game and return to the Parhelion home page' : '离开当前游戏，返回 Parhelion 首页');
    nav.setAttribute('aria-label', en ? 'Parhelion navigation' : 'Parhelion 导航');
  };
  label_();
  new MutationObserver(label_).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  const label = document.createElement('span');
  label.textContent = 'PARHELION';
  nav.append(home, label);
  document.body.append(nav);

  // Native navigation unloads the map, renderer and WebSocket. Never hijack Escape or game controls.
  const update = () => { nav.hidden = Boolean(document.pointerLockElement); };
  document.addEventListener('pointerlockchange', update);
  window.addEventListener('pageshow', update);
  nav.addEventListener('click', event => event.stopPropagation());
  nav.addEventListener('pointerdown', event => event.stopPropagation());
  update();
}
