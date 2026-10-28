/** Court-only density: keep the shared Studio Scouting dialog unchanged. */
export const courtSharingStyles = `
.sv-dialog.sv-share.sv-court-share{width:min(440px,calc(100vw - 24px));max-height:calc(100dvh - 32px);overflow:auto;overscroll-behavior:contain}
@media(max-width:700px){
  .sv-dialog.sv-share.sv-court-share{padding:14px;border-radius:16px;font-size:11px}
  .sv-court-share.sv-share>.sv-row{gap:4px;margin-bottom:16px;align-items:center}
  .sv-court-share.sv-share>.sv-row h2{font-size:14px;font-weight:500;line-height:1.35;padding:0 6px 0 0;margin:0}
  .sv-court-share .sv-action{font-size:11px;min-width:0}
  .sv-court-share .sv-action>[role=button]{min-height:34px!important;min-width:32px!important;padding:6px 8px!important;gap:5px!important}
  .sv-court-share>.sv-row>.sv-action>[role=button]{height:32px!important;min-height:32px!important;width:32px!important;padding:6px!important}
  .sv-court-share svg{width:16px;height:16px;flex-shrink:0}
  .sv-court-share .sv-action [aria-hidden=true],.sv-court-share .sv-share-settings>summary [aria-hidden=true]{font-size:16px!important}
  .sv-court-share.sv-share h3{font-size:11px;margin:0 0 8px}
  .sv-court-share .sv-share-people{margin-bottom:16px}
  .sv-court-share .sv-share-person{grid-template-columns:28px minmax(0,1fr);gap:2px 8px;min-height:0}
  .sv-court-share .sv-share-avatar{grid-row:1/span 2;width:28px;height:28px;font-size:12px}
  .sv-court-share .sv-share-person>div{min-width:0}
  .sv-court-share .sv-share-person b{font-size:11px;line-height:1.4}
  .sv-court-share .sv-share-person small{font-size:10px;line-height:1.4;margin-top:1px}
  .sv-court-share .sv-share-person-role{grid-column:2;font-size:10px;white-space:normal;line-height:1.4}
  .sv-court-share .sv-share-access-row{grid-template-columns:28px minmax(0,1fr) auto;gap:6px;padding:10px 14px;margin:0 -14px}
  .sv-court-share .sv-share-access-icon{width:28px;height:28px}
  .sv-court-share .sv-share-audience b{font-size:11px;line-height:1.4}
  .sv-court-share .sv-share-audience small{font-size:10px;line-height:1.4;padding-left:0;margin-top:2px}
  .sv-court-share .sv-share-select-label{font-size:11px}
  .sv-court-share .sv-share-select [role=button]{min-height:32px!important;padding:5px 6px!important;gap:4px!important}
  .sv-court-share .sv-share-settings>summary{width:32px;height:32px}
  .sv-court-share .sv-share-settings-menu{top:36px;min-width:160px;max-width:calc(100vw - 56px);gap:2px;padding:4px;border-radius:10px}
  .sv-court-share .sv-share-settings-menu .sv-action{display:block}
  .sv-court-share.sv-share p{font-size:10px;line-height:1.45;margin:10px 0}
  .sv-court-share .sv-share-actions{gap:8px;margin-top:16px}
  .sv-court-share .sv-share-actions>.sv-action{flex:1;min-width:0}
  .sv-court-share .sv-share-actions>.sv-action>[role=button]{min-height:34px!important;padding-left:8px!important;padding-right:8px!important;border-radius:18px!important;white-space:nowrap}
  .sv-court-share .sv-field{font-size:10px;margin:10px 0}
  .sv-court-share .sv-field input{min-height:34px;font-size:11px}
}
`;
