import * as T from 'three';
/** Isolated sampled quaternion-Hermite bridge for the unarmed elbow's one-key reset.
 * The final existing keys still interpolate with piecewise slerp, not globally C1.
 * Source weapon/spine/root channels and the authoritative contact clock are untouched. */
export function freeArmCandidate(source:T.AnimationClip,identity:string){
 if(identity!=='blackbeard'||source.name!=='Attack')return source;
 const windows=[[17/30-.075,17/30+.075],[source.duration-.24,source.duration]];
 const tracks=source.tracks.map(track=>{if(!/^(UpperArmL|ForearmL|HandL)\.quaternion$/.test(track.name))return track.clone();const result=track.clone(),sample=(track as T.KeyframeTrack&{createInterpolant():T.Interpolant}).createInterpolant();
  const at=(t:number,reference?:T.Quaternion)=>{const q=new T.Quaternion().fromArray(sample.evaluate(Math.max(0,Math.min(source.duration,t)))).normalize();if(reference&&reference.dot(q)<0)q.set(-q.x,-q.y,-q.z,-q.w);return q;};
  const derivative=(t:number,q:T.Quaternion)=>{if(t<=0||t>=source.duration)return[0,0,0,0];const h=1/6000,a=at(t-h,q).toArray(),b=at(t+h,q).toArray(),v=b.map((x,i)=>(x-a[i])/(2*h)),values=q.toArray(),radial=v.reduce((n,x,i)=>n+x*values[i],0);return v.map((x,i)=>x-radial*values[i]);};
  for(const[a,b]of windows){const q0=at(a),q1=at(b,q0),p=q0.toArray(),q=q1.toArray(),d0=derivative(a,q0),d1=derivative(b,q1),duration=b-a;for(let i=0;i<result.times.length;i++){const t=result.times[i];if(t<a||t>b)continue;const u=(t-a)/duration,u2=u*u,u3=u2*u,h00=2*u3-3*u2+1,h10=u3-2*u2+u,h01=-2*u3+3*u2,h11=u3-u2;new T.Quaternion(...p.map((x,k)=>h00*x+h10*duration*d0[k]+h01*q[k]+h11*duration*d1[k]) as [number,number,number,number]).normalize().toArray(result.values,i*4);}}
  return result;});return new T.AnimationClip(source.name,source.duration,tracks);
}
