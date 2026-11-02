import { useMemo, useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { OperationalText as Text } from '../../ui/OperationalText';
import { useAppTheme } from '../../ui/app-theme';
import { useResponsiveLayout } from '../../ui/use-responsive-layout';
import { ResponsiveGrid } from '../../components/ui/ResponsiveGrid';
import { Pressable } from '../../ui/Pressable';
import { radius } from '../../theme/tokens';
import { scoutingWeightedMetric } from '../../core/scouting-rallies';
import type { ScoutingOverview } from '../../db/scouting-collection';
import { ScoutingMetrics } from './ScoutingMetrics';
import { ScoutingSelect } from './ScoutingNavigation';
import { amount, Copy, Link, shortDate } from './ScoutingUI';

const formatLabel=(format:string)=>format==='outro'?'Outro':format==='unknown'?'Não informado':format.replace('x',' × ');
export function scoutingPerformanceContexts(rows:ScoutingOverview[]) {
    const groups=new Map<string,ScoutingOverview[]>();
    for(const row of rows.filter(value=>value.session.status==='concluido')) {
        const key=row.session.format??'unknown';groups.set(key,[...(groups.get(key)??[]),row]);
    }
    return [...groups].map(([key,values])=>({key,label:formatLabel(key),rows:values,counts:values.flatMap(row=>row.counts)}))
        .sort((a,b)=>b.counts.reduce((sum,c)=>sum+c.count,0)-a.counts.reduce((sum,c)=>sum+c.count,0));
}
export function ScoutingPerformanceOverview({rows,ready,onReview}:{rows:ScoutingOverview[];ready:boolean;onReview:(id:string)=>void}) {
    const {colors}=useAppTheme(),{density,supportsSplitView}=useResponsiveLayout();
    const groups=useMemo(()=>scoutingPerformanceContexts(rows),[rows]);
    const [context,setContext]=useState(''),[details,setDetails]=useState(false),[criteria,setCriteria]=useState(false);
    const group=groups.find(value=>value.key===context)??groups[0];
    const completed=groups.flatMap(value=>value.rows),actions=completed.reduce((sum,row)=>sum+row.counts.reduce((n,c)=>n+c.count,0),0),points=completed.reduce((sum,row)=>sum+row.rallyStats.total,0);
    const samples=useMemo(()=>[...(group?.rows??[])].sort((a,b)=>a.session.date.localeCompare(b.session.date)||a.session.createdAt.localeCompare(b.session.createdAt))
        .map(row=>({row,value:scoutingWeightedMetric(row.counts,'recepcao').value})).filter((sample):sample is {row:ScoutingOverview;value:number}=>sample.value!==null).slice(-8),[group]);
    const panel={backgroundColor:colors.card,borderWidth:1,borderColor:colors.border,borderRadius:radius.card,padding:density.cardPadding,gap:16,flex:1} as const;
    return <View style={{gap:density.pageGap}}>
        <View accessibilityLabel="Resumo do scouting concluído" style={{flexDirection:'row',flexWrap:'wrap',gap:16,paddingVertical:16,borderTopWidth:1,borderBottomWidth:1,borderColor:colors.border}}>
            {[{value:completed.length,label:'análises concluídas'},{value:actions,label:'ações observadas'},{value:points,label:'pontos registrados'}].map(item=><View key={item.label} style={{flex:1,minWidth:100,gap:4}}><Text style={{fontSize:24,lineHeight:30,color:colors.text,fontWeight:'600'}}>{ready?item.value:'—'}</Text><Copy muted>{item.label}</Copy></View>)}
        </View>
        <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}><Copy title>Rendimento da turma</Copy>{groups.length>1?<ScoutingSelect label="Contexto do rendimento" value={group?.key??''} options={groups.map(value=>({value:value.key,label:value.label}))} onChange={setContext}/>:group?<Copy muted>{group.label}</Copy>:null}</View>
        {!ready?<Copy muted>Os indicadores estarão disponíveis após a atualização.</Copy>:!group?<Copy muted>Conclua uma análise com registros para acompanhar o rendimento.</Copy>:<>
            <ResponsiveGrid columns={{compact:'1',split:'6/6'}} splitEnabled={supportsSplitView}>
                <View style={panel}><View style={{flexDirection:'row',justifyContent:'space-between',gap:12}}><Copy title>Fundamentos</Copy><Copy muted>{amount(group.rows.length,'análise','análises')} · {group.label}</Copy></View>
                    {([{skill:'recepcao',label:'Recepção positiva'},{skill:'ataque',label:'Eficiência de ataque'},{skill:'saque',label:'Saque que dificultou ou pontuou'}] as const).map(item=>{
                        const metric=scoutingWeightedMetric(group.counts,item.skill);
                        return <View key={item.skill} accessibilityLabel={`${item.label}: ${metric.value===null?'sem registros':`${metric.value}%`}`} style={{gap:6}}><View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:10}}><Copy>{item.label}</Copy><Text style={{fontSize:12,color:colors.text,fontWeight:'600'}}>{metric.value===null?'—':`${metric.value}%`}</Text></View><View accessible={false} style={{height:5,borderRadius:3,overflow:'hidden',backgroundColor:colors.border}}><View style={{height:5,width:`${Math.max(0,Math.min(100,metric.value??0))}%`,backgroundColor:colors.primaryBg}}/></View></View>;
                    })}
                    <View style={{borderTopWidth:1,borderTopColor:colors.border,paddingTop:8,gap:4}}><Link label={details?'Recolher fundamentos':'Detalhar fundamentos'} onPress={()=>setDetails(value=>!value)}/><Copy muted>Coleta parcial · ausência de contato não significa erro.</Copy></View>
                </View>
                <View style={panel}><Copy title>Recepção por análise</Copy>{samples.length>=2?<>
                    <Svg width="100%" height={142} viewBox="0 0 400 142" accessibilityLabel="Recepção positiva nas análises do contexto selecionado">
                        {[20,60,100].map(y=><Line key={y} x1={20} x2={380} y1={y} y2={y} stroke={colors.border} strokeWidth={1}/>)}
                        <Polyline points={samples.map((sample,index)=>`${20+index*360/(samples.length-1)},${116-sample.value*.96}`).join(' ')} fill="none" stroke={colors.primaryBg} strokeWidth={2}/>
                        {samples.map((sample,index)=><ViewPoint key={sample.row.session.id} x={20+index*360/(samples.length-1)} y={116-sample.value*.96} value={sample.value} color={colors.primaryBg} background={colors.card}/>)}
                    </Svg>
                    {samples.slice(-3).map(sample=><Pressable key={sample.row.session.id} accessibilityRole="button" accessibilityLabel={`Revisar ${sample.row.session.title}, recepção ${sample.value}%`} onPress={()=>onReview(sample.row.session.id)} style={{flexDirection:'row',gap:12,alignItems:'center',padding:8,borderRadius:radius.internal}}><View style={{flex:1,gap:2}}><Text numberOfLines={1} style={{color:colors.text,fontSize:12}}>{sample.row.session.title}</Text><Copy muted>{shortDate(sample.row.session.date)}</Copy></View><Copy>{sample.value}% ›</Copy></Pressable>)}
                </>:<Copy muted>São necessárias duas análises com recepções registradas no mesmo contexto para mostrar a evolução.</Copy>}</View>
            </ResponsiveGrid>
            <View style={{...panel,display:details?'flex':'none'}}><View style={{flexDirection:'row',justifyContent:'space-between',gap:12}}><Copy title>Detalhes por fundamento</Copy><Link label="Critérios" onPress={()=>setCriteria(value=>!value)}/></View>
                {group.rows.some(row=>row.rallyStats.total>0)?<View style={{flexDirection:'row',flexWrap:'wrap',gap:24,paddingBottom:12,borderBottomWidth:1,borderBottomColor:colors.border}}>{(['receiving','serving'] as const).map(kind=>{
                    const total=group.rows.reduce((sum,row)=>sum+row.rallyStats[kind],0),won=group.rows.reduce((sum,row)=>sum+row.rallyStats[kind==='receiving'?'receivingWon':'servingWon'],0);
                    return <View key={kind} style={{gap:4}}><Copy>{kind==='receiving'?'Pontos recebendo · side-out':'Pontos sacando · break point'}</Copy><Copy title>{total?`${Math.round(won/total*100)}%`:'—'}</Copy><Copy muted>{won} de {total} jogadas registradas</Copy></View>;
                })}</View>:null}
                <ScoutingMetrics counts={group.counts}/>{criteria?<Copy muted>Recepção, saque e defesa: níveis 2 ou 3 sobre ações observadas. Ataque: pontos menos erros sobre ataques classificados. São resultados da coleta, separados por contexto.</Copy>:null}</View>
        </>}
    </View>;
}
function ViewPoint({x,y,value,color,background}:{x:number;y:number;value:number;color:string;background:string}) {
    return <><Circle cx={x} cy={y} r={4} fill={background} stroke={color} strokeWidth={2}/><SvgText x={x} y={Math.max(12,y-12)} fill={color} fontSize={11} textAnchor="middle">{value}%</SvgText></>;
}
