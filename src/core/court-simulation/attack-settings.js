const limit=(n,min,max)=>Math.max(min,Math.min(max,n));
// Sideline (4.5 m) plus the 1.75 m extension of the attack line.
export const ATTACK_APPROACH_MAX_X=6.25;
export const BACK_ROW_TAKEOFF_DEPTH=3.45;
export const BACK_ROW_JUMP_ADVANCE=1.9;
export const CHINA_JUMP_ADVANCE=.55;
// The setter occupies zone 2. The other two front players and the right back can finish.
export const SIX_ZERO_ATTACK_PRESETS=['4','1','fundo-1'];
export const isBackRowAttack=preset=>preset==='pipe'||preset==='bic'||preset==='fundo-1';
export const isMiddleAttack=preset=>['1','2','31','tempo-costas','china','metro'].includes(preset);
export const middleAttackColor=(simulation,actorId)=>simulation?.mode==='attack'&&simulation.system!=='6-0'&&simulation.actorIds?.[3]===actorId&&isMiddleAttack(simulation.preset)?'#8b5cf6':undefined;
const scalar=(v,min,max,fallback)=>Number.isFinite(v)?limit(v,min,max):fallback;
const pair=(p,xMin,xMax,zMin,zMax)=>Array.isArray(p)&&p.length===2&&Number.isFinite(p[0])&&Number.isFinite(p[1])?[limit(p[0],xMin,xMax),limit(p[1],zMin,zMax)]:null;
const angles=value=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.entries(value).filter(([key,angle])=>['1','2','5'].includes(key)&&Number.isFinite(angle)).map(([key,angle])=>[key,limit(angle,-65,65)])):{};
export function normalizeAttackSettings(value){const v=value&&typeof value==='object'?value:{};return {
 targetOverride:pair(v.targetOverride,-9,9,-12,-.75),
 hitOverride:pair(v.hitOverride,-ATTACK_APPROACH_MAX_X,ATTACK_APPROACH_MAX_X,.2,4.5),
 setHeight:scalar(v.setHeight,.15,5,null),attackArc:scalar(v.attackArc,.03,4,null),passHeight:scalar(v.passHeight,.4,4,2.1),
 blockAngle:scalar(v.blockAngle,-65,65,0),
 blockAngles:angles(v.blockAngles),
 manualBlockers:Array.isArray(v.manualBlockers)?[...new Set(v.manualBlockers.filter(i=>[1,2,5].includes(i)))]:[],
};}
