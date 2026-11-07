import { useEffect, useId, useMemo, useRef, useState, type PropsWithChildren } from "react";
import { Platform, ScrollView, View, useWindowDimensions } from "react-native";
import { OperationalText as Text } from "../../ui/OperationalText";
import { Pressable } from "../../ui/Pressable";
import { AnchoredDropdown } from "../../ui/AnchoredDropdown";
import { GoAtletaIcon } from "../../ui/icon-registry";
import { useAppTheme } from "../../ui/app-theme";
import { compactUiMetrics as metrics, radius, spacing } from "../../theme/tokens";
import type { Student } from "../../core/models";
import { Copy, Input, ScoutingModal } from "./ScoutingUI";

export function shortScoutingAthleteName(name:string) {
  const parts=name.trim().split(/\s+/).filter(Boolean);
  return parts.length>1 ? `${parts[0]} ${parts[parts.length-1]}` : parts[0]??"";
}
const normalize=(value:string)=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase().trim();
export const collectorAthleteColumns=(availableWidth:number)=>availableWidth>=760?6:3;

/** First/last names are presentation only; the full name and real jersey stay accessible. */
export function CollectorAthlete({ student, jersey, selected, disabled, onPress, fullName=false }: { student:Student;jersey?:string;selected:boolean;disabled:boolean;onPress:()=>void;fullName?:boolean }) {
  const {colors}=useAppTheme();
  const anchor=useRef<View>(null),tooltipId=useId(),generation=useRef(0),hovered=useRef(false),focused=useRef(false),closeTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const context=useMemo(()=>({disabled,id:student.id,name:student.name}),[disabled,student.id,student.name]);
  const [tip,setTip]=useState<{context:typeof context;layout:{x:number;y:number;width:number;height:number}}|null>(null);
  const keep=()=>{if(closeTimer.current)clearTimeout(closeTimer.current);closeTimer.current=null;};
  const hide=()=>{generation.current++;keep();setTip(null);};
  const show=()=>{if(Platform.OS!=="web"||disabled)return;keep();const token=++generation.current;anchor.current?.measureInWindow((x,y,width,height)=>{if(token===generation.current)setTip({context,layout:{x,y,width,height}});});};
  const leave=()=>{if(hovered.current||focused.current)return;generation.current++;keep();closeTimer.current=setTimeout(()=>{closeTimer.current=null;setTip(null);},140);};
  useEffect(()=>()=>{generation.current++;hovered.current=false;focused.current=false;if(closeTimer.current)clearTimeout(closeTimer.current);},[context]);
  const layout=tip?.context===context?tip.layout:null,visible=!!layout&&!disabled;
  return <><View ref={anchor} collapsable={false} style={{width:"100%"}}><Pressable accessibilityRole="button" accessibilityLabel={jersey?`Camisa ${jersey}: ${student.name}`:student.name} aria-describedby={visible?tooltipId:undefined} aria-pressed={selected} accessibilityState={{selected,disabled}} disabled={disabled} onPress={onPress}
    onHoverIn={()=>{hovered.current=true;show();}} onHoverOut={()=>{hovered.current=false;leave();}} onFocus={()=>{focused.current=true;show();}} onBlur={()=>{focused.current=false;leave();}}
    style={{height:metrics.touchTarget,minHeight:metrics.touchTarget,paddingHorizontal:spacing.xs,borderRadius:radius.internal,borderWidth:1,borderColor:selected?colors.primaryBg:colors.border,backgroundColor:selected?colors.surfaceElevated:colors.backgroundSubtle,flexDirection:"row",alignItems:"center",gap:spacing.xs,opacity:disabled ? .55 : 1}}>
    <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{width:24,height:24,borderRadius:12,backgroundColor:selected?colors.secondaryBg:colors.inputBg,alignItems:"center",justifyContent:"center",flexShrink:0}}>{jersey ? <Text style={{fontSize:metrics.metadataFontSize,color:selected?colors.text:colors.muted,textAlign:"center",fontVariant:["tabular-nums"]}}>{jersey}</Text> : <GoAtletaIcon name="profile" size={metrics.secondaryIconSize} color={colors.muted}/>}</View>
    <Text numberOfLines={1} ellipsizeMode="tail" style={{flex:1,minWidth:0,fontSize:metrics.bodyFontSize,lineHeight:metrics.bodyLineHeight,color:colors.text,textAlign:"left"}}>{fullName?student.name:shortScoutingAthleteName(student.name)}</Text>
  </Pressable></View><AnchoredDropdown visible={visible} layout={layout} container={null} animationStyle={{}} zIndex={16000} maxHeight={120} nestedScrollEnabled fitContent preferredWidth={280} density="popover" interactiveRefs={[anchor]} onRequestClose={hide} surface="solid" portalToBodyOnWeb>
    <View nativeID={tooltipId} role="tooltip" onPointerEnter={()=>{hovered.current=true;keep();}} onPointerLeave={()=>{hovered.current=false;leave();}} style={{paddingHorizontal:spacing.sm,paddingVertical:spacing.xs}}><Copy>{student.name}</Copy></View>
  </AnchoredDropdown></>;
}

export function CollectorRosterPicker({ students, jerseys, selectedId, disabled, onSelect, onClose }: {students:Student[];jerseys?:ReadonlyMap<string,string>;selectedId:string|null;disabled:boolean;onSelect:(id:string)=>void;onClose:()=>void}) {
  const [query,setQuery]=useState("");
  const {height}=useWindowDimensions();
  const terms=normalize(query).split(/\s+/).filter(Boolean);
  const filtered=students.filter(student=>terms.every(term=>normalize(`${student.name} ${jerseys?.get(student.id)??""}`).includes(term)));
  return <ScoutingModal compact title="Escolher atleta" onClose={onClose} overlayZIndex={15000}>
    <Input label="Buscar nome ou camisa" value={query} onChangeText={setQuery} autoFocus autoCorrect={false}/>
    <ScrollView accessibilityLabel="Atletas do elenco" nestedScrollEnabled style={{maxHeight:Math.min(360,height*.45)}} contentContainerStyle={{gap:spacing.xs,paddingBottom:spacing.xs}} keyboardShouldPersistTaps="handled">
      {filtered.map(student=><CollectorAthlete key={student.id} fullName student={student} jersey={jerseys?.get(student.id)} selected={student.id===selectedId} disabled={disabled} onPress={()=>{if(!disabled){onSelect(student.id);onClose();}}}/>)}
      {!filtered.length ? <Copy muted>Nenhum atleta encontrado.</Copy> : null}
    </ScrollView>
  </ScoutingModal>;
}

/** Shared floating primitive: the help never changes the collector's height. */
export function CollectorHelp({label,children,disabled=false}:PropsWithChildren<{label:string;disabled?:boolean}>) {
  const {colors}=useAppTheme();
  const anchor=useRef<View>(null),id=useId();
  const [layout,setLayout]=useState<{x:number;y:number;width:number;height:number}|null>(null);
  const [open,setOpen]=useState(false);
  const close=()=>{setOpen(false);(anchor.current as unknown as HTMLElement|null)?.querySelector?.<HTMLElement>('[role="button"]')?.focus();};
  return <>
    <View ref={anchor} collapsable={false}><Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{expanded:open,disabled}} disabled={disabled} aria-describedby={open?id:undefined} onPress={()=>{if(disabled)return;if(open)close();else anchor.current?.measureInWindow((x,y,width,height)=>{setLayout({x,y,width,height});setOpen(true);});}}
      style={{width:metrics.touchTarget,height:metrics.touchTarget,justifyContent:"center",alignItems:"center",borderRadius:radius.internal}}><GoAtletaIcon name="info" size={metrics.secondaryIconSize} color={colors.muted}/></Pressable></View>
    <AnchoredDropdown visible={open} layout={layout} container={null} animationStyle={{}} zIndex={16000} maxHeight={280} nestedScrollEnabled fitContent preferredWidth={300} density="popover" interactiveRefs={[anchor]} onRequestClose={close} surface="solid">
      <View nativeID={id} role="tooltip" style={{padding:spacing.sm,gap:spacing.xs}}>{children}</View>
    </AnchoredDropdown>
  </>;
}
