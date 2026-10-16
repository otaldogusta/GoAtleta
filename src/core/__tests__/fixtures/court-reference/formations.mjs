// Coordinates read from the reference's visible mini court (15 October 2026).
// Stable actor order: setter, opposite, middle, outside A, libero, outside B.
// These are reception presets, not six interchangeable official-zone slots.
export const reception51 = [
  [[3.6,7.6],[-3,1.2],[0,.8],[-2.9,6.6],[0,6.7],[2.8,5.8]],
  [[1.6,2.2],[2.4,1],[3.7,3.2],[-2.8,5.6],[0,6.1],[3,5.8]],
  [[-1.2,3],[3.4,2],[-3.6,1.2],[-2.6,5.4],[2.8,5.8],[0,6.2]],
  [[-3.9,.6],[3.9,8],[-3,1.4],[-2.2,5.2],[2.8,5.8],[.4,6.2]],
  [[1.6,.8],[1.5,8.2],[3.5,2],[2.9,5.8],[0,6.2],[-2.9,5.6]],
  [[2.2,.8],[-1.4,8],[-3.5,1.2],[0,6],[2.8,5.8],[-2.6,5.2]],
];
export const effectiveRotation=(system,rotation)=>system==='6-2'?rotation%3:rotation;
export function receptionFormation(system,rotation){
  return reception51[effectiveRotation(system,rotation)].map(([x,z])=>[x,0,z]);
}
export function receptionDestinations(system,rotation){
  const r=effectiveRotation(system,rotation),frontOutside=[5,3,3,3,5,5][r];
  const positions=[[1.62,.76],r===0?[-4.96,3.28]:r<3?[4.94,3.28]:[4.575,6.925],[-.296,2.791],[.706,6.925],[-1.407,5.354],[.706,6.925]];
  positions[frontOutside]=[r===0?4.94:-4.96,3.28];
  return positions;
}
export function receptionReceiver(positions,landing){
  return [3,4,5].reduce((best,i)=>{
    const distance=j=>(positions[j][0]-landing[0])**2+(positions[j][2]-landing[1])**2;
    // Keep the libero on an exact seam tie; do not let float roundoff pick a wing.
    return distance(i)<distance(best)-1e-6?i:best;
  },4);
}
