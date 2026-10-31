import type { Object3D } from 'three';
/** Asset-authored socket-space tip; older approved assets retain their original tip. */
export function saberBladeTip(socket?: Object3D) {
  const tip = socket?.userData.saberBladeTip;
  return typeof tip === 'number' && Number.isFinite(tip) && tip >= 1 && tip <= 2 ? tip : 1.647;
}
