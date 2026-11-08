/** Identity-local presentation parameters. No simulation or global exposure changes. */
const STANDARD = Object.freeze({ hemisphere: 2.8, key: 3.5, rim: 3, bloomStrength: .75, bloomRadius: .48, bloomThreshold: .72 });
const SABER = Object.freeze({ hemisphere: 1.6, key: 2.4, rim: 1.5, bloomStrength: .28, bloomRadius: .30, bloomThreshold: .90 });
const MUSASHI = Object.freeze({ hemisphere: 1.1, key: 1.4, rim: .6, bloomStrength: .06, bloomRadius: .18, bloomThreshold: 1.15 });
const NAPOLEON = Object.freeze({ hemisphere: 1.0, key: 1.5, rim: .75, bloomStrength: .06, bloomRadius: .18, bloomThreshold: 1.15 });
export function ultimateReadability(identity: string) {
  return identity === 'saber' ? SABER : identity === 'musashi' ? MUSASHI : identity === 'napoleon' ? NAPOLEON : STANDARD;
}
