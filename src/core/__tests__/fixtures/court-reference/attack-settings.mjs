const limit=(n,min,max)=>Math.max(min,Math.min(max,n));
const scalar=(v,min,max,fallback)=>Number.isFinite(v)?limit(v,min,max):fallback;
const pair=(p,xMin,xMax,zMin,zMax)=>Array.isArray(p)&&p.length===2&&Number.isFinite(p[0])&&Number.isFinite(p[1])?[limit(p[0],xMin,xMax),limit(p[1],zMin,zMax)]:null;
const angles=value=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.entries(value).filter(([key,angle])=>['1','2','5'].includes(key)&&Number.isFinite(angle)).map(([key,angle])=>[key,limit(angle,-65,65)])):{};
export function normalizeAttackSettings(value){const v=value&&typeof value==='object'?value:{};return {
 targetOverride:pair(v.targetOverride,-9,9,-12,-.75),
 hitOverride:pair(v.hitOverride,-4.3,4.3,.2,4.5),
 setHeight:scalar(v.setHeight,.15,5,null),passHeight:scalar(v.passHeight,.4,4,2.1),
 blockAngle:scalar(v.blockAngle,-65,65,0),
 blockAngles:angles(v.blockAngles),
 manualBlockers:Array.isArray(v.manualBlockers)?[...new Set(v.manualBlockers.filter(i=>[1,2,5].includes(i)))]:[],
};}
