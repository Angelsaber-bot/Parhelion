/** Identity-local presentation parameters. No simulation or global exposure changes. */
const STANDARD = Object.freeze({ hemisphere: 2.8, key: 3.5, rim: 3, bloomStrength: .75, bloomRadius: .48, bloomThreshold: .72 });
const SABER = Object.freeze({ hemisphere: 1.6, key: 2.4, rim: 1.5, bloomStrength: .28, bloomRadius: .30, bloomThreshold: .90 });
const MUSASHI = Object.freeze({ hemisphere: 1.6, key: 2.4, rim: 1.5, bloomStrength: .24, bloomRadius: .28, bloomThreshold: .92 });
export function ultimateReadability(identity: string) {
  return identity === 'saber' ? SABER : identity === 'musashi' ? MUSASHI : STANDARD;
}
