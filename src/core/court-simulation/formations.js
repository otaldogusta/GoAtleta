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
// The six jerseys keep their identities; the athlete occupying zone 2 sets.
const sixZeroOpeningZones=[4,3,2,5,6,1];
const sixZeroSlotZones=[2,1,3,4,6,5];
export function sixZeroZone(teamIndex,rotation){
  return (sixZeroOpeningZones[teamIndex]-1-rotation+6)%6+1;
}
// Each shape is in simulation slot order (setter, right back, middle,
// left front, middle back, left back), looking from the endline at the net.
const sixZeroReceiveShape=[[1.62,.76],[3.25,3.12],[-.2,3.12],[-3.25,3],[1.55,6.62],[-1.9,6.62]];
const sixZeroRelease=[[1.62,.76],[4.1,5.1],[-.25,3],[-4.9,3.3],[1.4,6.6],[-1.9,6.6]];
// Slot zero always performs the second touch. The two-setter systems reuse
// the three front-row (4–2) or back-row (6–2) choreographies respectively.
export function effectiveRotation(system,rotation){
  if(system==='4-2')return 3+rotation%3;
  if(system==='6-2')return rotation%3;
  return rotation;
}
export function receptionTeamOrder(system,rotation){
  if(system==='6-0')return sixZeroSlotZones.map(zone=>sixZeroOpeningZones.findIndex((_,i)=>sixZeroZone(i,rotation)===zone));
  // Opposite setters and outside hitters exchange their court jobs after
  // three rotations. Middle and libero already come from the active lineup.
  return effectiveRotation(system,rotation)===rotation?[0,1,2,3,4,5]:[1,0,2,5,4,3];
}
export function receptionFormation(system,rotation){
  if(system==='6-0')return sixZeroReceiveShape.map(([x,z])=>[x,0,z]);
  return reception51[effectiveRotation(system,rotation)].map(([x,z])=>[x,0,z]);
}
export function receptionDestinations(system,rotation){
  if(system==='6-0')return sixZeroRelease.map(([x,z])=>[x,z]);
  const r=effectiveRotation(system,rotation),frontOutside=[5,3,3,3,5,5][r];
  const positions=[[1.62,.76],r===0?[-4.96,3.28]:r<3?[4.94,3.28]:[4.575,6.925],[-.296,2.791],[.706,6.925],[-1.407,5.354],[.706,6.925]];
  positions[frontOutside]=[r===0?4.94:-4.96,3.28];
  if(system==='4-2')positions[1]=[3.1,5.8]; // Back-row setter covers behind the attack.
  return positions;
}
export function receptionReceiver(positions,landing,system='5-1'){
  const passers=system==='6-0'?[1,2,3,4,5]:[3,4,5];
  return passers.reduce((best,i)=>{
    const distance=j=>(positions[j][0]-landing[0])**2+(positions[j][2]-landing[1])**2;
    // Keep the libero on an exact seam tie; do not let float roundoff pick a wing.
    return distance(i)<distance(best)-1e-6?i:best;
  },4);
}
