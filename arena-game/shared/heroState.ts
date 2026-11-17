import type { AbilityId, Team } from './content.ts';
import type { Vec3 } from './map.ts';

export interface AbilityState {
  phase: 'idle' | 'windup' | 'guard' | 'channel' | 'return' | 'recovery';
  readyAt: number; castSeq: number; startTick: number; endTick: number; lockUntil: number;
  target?: Vec3; dodgeTarget?:Vec3; yaw: number; guardBudget: number; returnId?: number;
  failure: string; failureUntil: number;
  /** Swallow cut: enemies already struck by this cast. */
  struck?: string[];
}
export const freshAbility = (): AbilityState => ({ phase:'idle', readyAt:0, castSeq:0, startTick:0, endTick:0, lockUntil:0, yaw:0, guardBudget:0, failure:'', failureUntil:0 });
export interface TacticalEntity {
  id: number; kind: AbilityId; owner: string; lifeId: number; team: Team; castSeq: number;
  x:number; y:number; z:number; yaw:number; hp:number; hp2?:number; created:number; expires:number;
  pulse:number; commandedAt?:number; travelled:number; char:number; weapon:number; name:string; shownHp:number;
  /** Cannonball and hook: unit flight direction and launch point. */
  dx?:number; dy?:number; dz?:number; ox?:number; oy?:number; oz?:number;
  /** Hook: the enemy it caught and is dragging. */
  victim?:string;
}
export interface ReconMark { id:string; source:number; team:Team; victim:string; lifeId:number; x:number; y:number; z:number; expires:number }
export interface HeroEvent { t:'ability'; id:string; castSeq:number; kind:AbilityId; action:'accepted'|'spawn'|'break'|'pulse'|'cancel'|'heal'|'trigger'|'blocked'; at:Vec3; amount?:number }
