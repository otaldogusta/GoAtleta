const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

// Shared by the main-court handle, mini court and saved local configurations.
export function normalizeReceiveTarget(value){
  if(!value||typeof value!=='object'||Array.isArray(value)||!Number.isFinite(value.x)||!Number.isFinite(value.z))return null;
  return {x:clamp(value.x,-4.5,4.5),z:clamp(value.z,0,9)};
}
