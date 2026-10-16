/** Approved simulation camera baselines; user orbit/zoom are separate state. */
export function simulationCameraDistance(mode,view,compact){
 return compact?40:view==='front'?(mode==='attack'?21.024:28.6373):25.138;
}

/** Preserve the user's distance relative to the selected view on breakpoint changes. */
export function resizedSimulationCameraDistance(distance,mode,view,previousCompact,nextCompact){
 if(previousCompact===nextCompact)return distance;
 return distance*simulationCameraDistance(mode,view,nextCompact)/simulationCameraDistance(mode,view,previousCompact);
}
