// Local fit to the 15 Oct 2026 reference capture, not recovered engine constants.
// Observed: ~4.4 s cycle; spike near phase .758; ~30 m/s launch;
// small upward block response, near-zero vertical mesh response, floor bounce.
// Normal/tangential retentions remain inferred fitting parameters. See the
// comparison record in docs/ui/QUADRA_PERSPECTIVA_MOCKUP_2026-10-15.md.
export const indoorContactProfile=Object.freeze({
 speed:30,launchMode:'target',
 block:Object.freeze({tangentRetention:.10,normalRestitution:.01,verticalSpeed:.75}),
 net:Object.freeze({tangentRetention:.04,normalRestitution:.07,verticalSpeed:.15}),
 tape:Object.freeze({tangentRetention:.55,normalRestitution:.10,verticalSpeed:.25}),
 floorBounce:Object.freeze({count:1,normalRestitution:.58,tangentRetention:.8}),
});
