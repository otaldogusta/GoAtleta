import { afterScoutingPoint, contactOutcome, getCaptureResultOptions, nextCaptureFundamental, parseScoutingRallyOutcome, rallyOutcomeWinner, scoutingCaptureExtendedRubricVersion, scoutingCaptureRubricVersion, scoutingRallyFaultReasons, scoutingRallyOutcomeLabel, scoutingSkillMetric, scoutingWeightedMetric, validateRallyContacts, validateScoutingRally } from "../scouting-rallies";
import { getScoutingResultOptions } from "../scouting";
import type { ScoutingAction, ScoutingContact, ScoutingMatchState, ScoutingRallyOutcome, ScoutingSide } from "../models";

const contact = (fundamental: ScoutingContact["fundamental"], resultKey: string): ScoutingContact => ({ fundamental, resultKey, phase: "side_out" });
const state: ScoutingMatchState = { setNumber: 1, scoreUs: 12, scoreThem: 10, serve: "them", rotation: 1, recoveredDraft: [] };
test("closes exactly one point and rotates only when recovering serve", () => {
  const won = afterScoutingPoint(state, "us");
  expect(won).toMatchObject({ scoreUs: 13, scoreThem: 10, rotation: 6, serve: "us" });
  expect(afterScoutingPoint(won, "us").rotation).toBe(6);
  expect(afterScoutingPoint(state, "them")).toMatchObject({ scoreUs: 12, scoreThem: 11, rotation: 1 });
  expect(afterScoutingPoint({ ...state, rotation: null }, "us").rotation).toBeNull();
});
test("partial capture is allowed, contradictions and invalid results are rejected", () => {
  expect(validateRallyContacts([], "us")).toBeNull();
  expect(validateRallyContacts([contact("ataque", "ponto")], "them")).not.toBeNull();
  expect(validateRallyContacts([contact("ataque", "ponto"), contact("defesa", "defesa_boa")])).not.toBeNull();
  expect(validateRallyContacts([contact("ataque", "unknown")])).not.toBeNull();
  expect(validateRallyContacts([{ ...contact("recepcao", "b_medio"), zone: 7 }])).not.toBeNull();
  expect(validateRallyContacts([contact("recepcao", "b_medio"), contact("levantamento", "organizou"), contact("ataque", "ponto")], "us")).toBeNull();
});
test("does not reinterpret historical block evaluations", () => {
  expect(contactOutcome(contact("ataque", "bloqueado"))).toBeNull();
  expect(contactOutcome(contact("ataque", "bloqueio_ponto"))).toBe("them");
  expect(contactOutcome(contact("bloqueio", "tocou"))).toBeNull();
  expect(getCaptureResultOptions("ataque")[1]).toMatchObject({ key: "bloqueio_ponto", level: 0 });
  const actions = ["ponto", "erro", "bloqueio_ponto", "bloqueado"].map((resultKey) => ({ fundamental: "ataque", resultKey, resultLevel: 0 }) as ScoutingAction);
  expect(scoutingSkillMetric(actions, "ataque")).toMatchObject({ total: 4, denominator: 3, excluded: 1, value: -33 });
});
test("suggestions change only the next fundamental, never create a contact", () => {
  expect(nextCaptureFundamental(undefined, "us")).toBe("saque");
  expect(nextCaptureFundamental(contact("recepcao", "b_medio"))).toBe("levantamento");
  expect(nextCaptureFundamental(contact("levantamento", "organizou"))).toBe("ataque");
});

test('outcome parsing preserves absence and copies only the explicit ending fields',()=>{
  expect(parseScoutingRallyOutcome(undefined)).toBeNull();expect(parseScoutingRallyOutcome(null)).toBeNull();
  const source={kind:'ace' as const,team:'us' as const},parsed=parseScoutingRallyOutcome(source);
  expect(parsed).toEqual(source);expect(parsed).not.toBe(source);
  expect(rallyOutcomeWinner(undefined)).toBeNull();expect(rallyOutcomeWinner(null)).toBeNull();
});

test('outcome labels name the actor team without inventing an athlete',()=>{
  expect(scoutingRallyOutcomeLabel(null)).toBe('');
  expect(scoutingRallyOutcomeLabel({kind:'ace',team:'us'})).toBe('Ace nosso');
  expect(scoutingRallyOutcomeLabel({kind:'ace',team:'them'})).toBe('Ace adversário');
  expect(scoutingRallyOutcomeLabel({kind:'falta',team:'us',reason:'rede'})).toBe('Falta nossa · Rede');
  expect(scoutingRallyOutcomeLabel({kind:'falta',team:'them',reason:'dois_toques'})).toBe('Falta adversária · Dois toques');
});

test.each(scoutingRallyFaultReasons)('a %s fault belongs to its committing team and awards only its opponent',reason=>{
  for(const team of ['us','them'] as const){
    const outcome:ScoutingRallyOutcome={kind:'falta',team,reason};const winner=team==='us'?'them':'us';
    expect(parseScoutingRallyOutcome(outcome)).toEqual(outcome);expect(rallyOutcomeWinner(outcome)).toBe(winner);
    expect(validateScoutingRally([],winner,outcome)).toBeNull();expect(validateScoutingRally([],team,outcome)).not.toBeNull();
  }
});

test.each([
  false,0,'ace',[],{},
  {kind:'ace'}, {kind:'ace',team:'other'}, {kind:'ace',team:'us',reason:'rede'},
  {kind:'ace',team:'us',athleteName:'Inventado'}, {kind:'ace',team:'us',studentId:'athlete'},
  {kind:'falta',team:'them'}, {kind:'falta',team:'them',reason:'unknown'},
  {kind:'falta',team:'them',reason:'rede',extra:true},
])('rejects malformed or athlete-attributed outcome %#',raw=>{
  expect(()=>parseScoutingRallyOutcome(raw)).toThrow();
  expect(validateScoutingRally([],undefined,raw as ScoutingRallyOutcome)).not.toBeNull();
});

test('strict outcome shape also rejects inherited-only and symbol fields',()=>{
  expect(()=>parseScoutingRallyOutcome(Object.create({kind:'ace',team:'us'}))).toThrow();
  expect(()=>parseScoutingRallyOutcome({kind:'ace',team:'us',[Symbol('extra')]:true})).toThrow();
});

test.each<ScoutingSide>(['us','them'])('an ace is won by %s only when that team served if serving is known',team=>{
  const outcome:ScoutingRallyOutcome={kind:'ace',team},other=team==='us'?'them':'us';
  expect(rallyOutcomeWinner(outcome)).toBe(team);
  expect(validateScoutingRally([],team,outcome,team)).toBeNull();
  expect(validateScoutingRally([],undefined,outcome,team)).toBeNull();
  expect(validateScoutingRally([],team,outcome)).toBeNull();
  expect(validateScoutingRally([],other,outcome,team)).not.toBeNull();
  expect(validateScoutingRally([],team,outcome,other)).toContain('sacou');
});

test('the outcome implied winner checks partial contacts even before the point winner is selected',()=>{
  const ours:ScoutingRallyOutcome={kind:'ace',team:'us'},theirs:ScoutingRallyOutcome={kind:'ace',team:'them'};
  expect(validateScoutingRally([contact('ataque','ponto')],undefined,theirs,'them')).not.toBeNull();
  expect(validateScoutingRally([contact('recepcao','erro')],undefined,ours,'us')).not.toBeNull();
  expect(validateScoutingRally([contact('recepcao','erro')],undefined,theirs,'them')).toBeNull();
  expect(validateScoutingRally([contact('saque','ace')],'us',ours,'us')).toBeNull();
  expect(validateScoutingRally([contact('ataque','ponto')],undefined,{kind:'falta',team:'us',reason:'rede'})).not.toBeNull();
  expect(validateScoutingRally([contact('ataque','ponto'),contact('defesa','defesa_boa')],undefined,ours,'us')).not.toBeNull();
});

test.each([
  [contact('recepcao','b_medio')],
  [contact('levantamento','organizou')],
  [contact('ataque','erro')],
  [contact('recepcao','b_medio'),contact('levantamento','organizou'),contact('ataque','erro')],
  [contact('recepcao','erro'),contact('levantamento','organizou')],
].map(contacts=>({contacts})))('an opponent ace rejects incompatible observed sequence %# even when the point winner agrees',({contacts})=>{
  const outcome:ScoutingRallyOutcome={kind:'ace',team:'them'};
  expect(validateScoutingRally(contacts,'them',outcome,'them')).toContain('somente recepção com erro');
  expect(validateScoutingRally(contacts,undefined,outcome,'them')).not.toBeNull();
});

test('aces allow only their directly corresponding single contact or no contact without inventing observations',()=>{
  const ours:ScoutingRallyOutcome={kind:'ace',team:'us'},theirs:ScoutingRallyOutcome={kind:'ace',team:'them'};
  const receiver=[contact('recepcao','erro')],server=[contact('saque','ace')],before=JSON.stringify({receiver,server});
  expect(validateScoutingRally([],'them',theirs,'them')).toBeNull();expect(validateScoutingRally(receiver,'them',theirs,'them')).toBeNull();
  expect(validateScoutingRally([],'us',ours,'us')).toBeNull();expect(validateScoutingRally(server,'us',ours,'us')).toBeNull();
  expect(validateScoutingRally([contact('ataque','ponto')],'us',ours,'us')).toContain('somente saque com ace');
  expect(validateScoutingRally([contact('saque','entrou')],'us',ours,'us')).not.toBeNull();
  expect(validateScoutingRally([...server,contact('ataque','ponto')],'us',ours,'us')).not.toBeNull();
  expect(JSON.stringify({receiver,server})).toBe(before);
});

test.each<ScoutingSide>(['us','them'])('a serve-line fault can belong only to the %s serving team when known',team=>{
  const outcome:ScoutingRallyOutcome={kind:'falta',team,reason:'linha_saque'},winner=team==='us'?'them':'us';
  expect(validateScoutingRally([],winner,outcome,team)).toBeNull();
  expect(validateScoutingRally([],winner,outcome,winner)).toContain('equipe que sacou');
  expect(validateScoutingRally([],winner,outcome)).toBeNull();
  expect(validateScoutingRally([],winner,{...outcome,reason:'dois_toques'},winner)).toBeNull();
});

test('explicit outcome does not fabricate a receiver or mutate historical partial contacts',()=>{
  const contacts:ScoutingContact[]=[];const ending:ScoutingRallyOutcome={kind:'ace',team:'them'};
  const before=JSON.stringify({contacts,ending});expect(validateScoutingRally(contacts,'them',ending,'them')).toBeNull();
  expect(JSON.stringify({contacts,ending})).toBe(before);expect(contacts).toEqual([]);
  expect(validateScoutingRally([contact('ataque','continuidade')],'us',null)).toBeNull();
  expect(getScoutingResultOptions('ataque').find(option=>option.key==='bloqueado')).toMatchObject({level:1,label:'Bloqueado'});
});

test('version 2 capture stays available without admitting version 3 result keys',()=>{
  expect(scoutingCaptureRubricVersion).toBe(2);expect(scoutingCaptureExtendedRubricVersion).toBe(3);
  expect(getCaptureResultOptions('ataque',2).map(option=>option.key)).toEqual(['erro','bloqueio_ponto','continuidade','ponto']);
  expect(getCaptureResultOptions('ataque')).toEqual(getCaptureResultOptions('ataque',3));
  expect(getCaptureResultOptions('ataque',3)).toEqual(expect.arrayContaining([
    expect.objectContaining({key:'freeball_devolvida',level:1}),expect.objectContaining({key:'bloqueio_continua',level:2}),
  ]));
  expect(getCaptureResultOptions('recepcao',2)).toEqual(getCaptureResultOptions('recepcao',3));
});

test('freeball and covered block are nonterminal, and coverage suggestion creates no observed action',()=>{
  const blocked=contact('ataque','bloqueio_continua'),freeball=contact('ataque','freeball_devolvida');
  const sequence=[blocked,contact('cobertura','recuperou'),contact('levantamento','organizou'),freeball],before=JSON.stringify(sequence);
  expect(contactOutcome(blocked)).toBeNull();expect(contactOutcome(freeball)).toBeNull();
  expect(nextCaptureFundamental(blocked)).toBe('cobertura');expect(nextCaptureFundamental(sequence[1])).toBe('levantamento');
  expect(nextCaptureFundamental(sequence[2])).toBe('ataque');expect(validateScoutingRally(sequence,'us')).toBeNull();
  expect(nextCaptureFundamental(contact('ataque','continuidade'))).toBe('defesa');
  expect(JSON.stringify(sequence)).toBe(before);expect(sequence).toHaveLength(4);
});

test('attack efficiency excludes freeball and legacy ambiguity but counts continued blocks as attempts',()=>{
  const counts=[
    ['ponto',3,1],['erro',0,1],['bloqueio_ponto',0,1],['continuidade',2,1],
    ['bloqueio_continua',2,1],['freeball_devolvida',1,1],['bloqueado',1,1],
  ].map(([result_key,result_level,count])=>({fundamental:'ataque' as const,result_key:result_key as string,result_level:result_level as number,count:count as number}));
  expect(scoutingWeightedMetric(counts,'ataque')).toMatchObject({total:7,denominator:5,excluded:2,points:1,errors:2,numerator:-1,value:-20});
  expect(scoutingSkillMetric([{fundamental:'ataque',resultKey:'freeball_devolvida',resultLevel:1} as ScoutingAction],'ataque')).toMatchObject({total:1,denominator:0,excluded:1,value:null});
});

test('a full six-rotation cycle advances only on side-out and clears recovered outcome once',()=>{
  const original:ScoutingMatchState={...state,recoveredOutcome:{kind:'falta',team:'them',reason:'rede'},recoveredDraft:[contact('recepcao','b_medio')]};
  let current=original;
  const initial=JSON.stringify(current),rotations:number[]=[];
  for(let i=0;i<6;i++){
    current=afterScoutingPoint(current,'us');rotations.push(current.rotation!);
    expect(current.recoveredOutcome).toBeNull();expect(current.recoveredDraft).toEqual([]);
    const held=afterScoutingPoint(current,'us');expect(held.rotation).toBe(current.rotation);
    if(i<5)current=afterScoutingPoint(current,'them');
  }
  expect(rotations).toEqual([6,5,4,3,2,1]);expect(current).toMatchObject({rotation:1,scoreUs:18,scoreThem:15});
  expect(JSON.stringify(original)).toBe(initial);
  expect(afterScoutingPoint({...state,rotation:null},'us').rotation).toBeNull();
});
