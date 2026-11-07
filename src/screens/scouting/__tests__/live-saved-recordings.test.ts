import {createElement} from 'react';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import LiveSavedRecordings,{type IntegratedLiveScouting} from '../live/LiveSavedRecordings.web';
import type {LiveHostSession} from '../live/live-storage';
import type {LiveVideoStatus} from '../live/live-video-storage';
jest.mock('../../../ui/app-theme',()=>({useAppTheme:()=>({colors:{muted:'#8fa1ba'}})}));
jest.mock('../../../ui/icon-registry',()=>({GoAtletaIcon:(props:object)=>jest.requireActual('react').createElement('icon',props)}));
jest.mock('../video/StudioUI.web',()=>({StudioAction:(props:object)=>jest.requireActual('react').createElement('button',props)}));
const session=(id:string,points=0,ended=true):LiveHostSession=>({version:1,id,scope:{userId:'user',org:'org',classId:'class'},recordingId:`recording-${id}`,createdAt:'2026-11-04T12:00:00Z',updatedAt:'2026-11-04T12:00:00Z',setNumber:1,className:'Team',points:Array.from({length:points},()=>({})) as LiveHostSession['points'],gaps:[],mimeType:'video/mp4',ended});
const ready=(item:LiveHostSession):LiveVideoStatus=>({sessionId:item.id,recordingId:item.recordingId,state:'ready',mimeType:'video/mp4',receivedBytes:10,totalBytes:10,nextPart:1,partCount:1});
let view:ReactTestRenderer;
const callbacks=()=>({onReview:jest.fn(),onDownload:jest.fn(),onRequest:jest.fn(),onRemove:jest.fn(),canRemove:jest.fn(()=>true)});
const integration=(items:{recordingId:string;clipCount:number}[]):IntegratedLiveScouting=>({recordings:items,onRegister:jest.fn(),onReview:jest.fn()});
const captions=()=>view.root.findAllByType('small').map(node=>node.children.join(''));
afterEach(()=>{if(view)act(()=>view.unmount());});

test('linked recordings show canonical singular/plural lances while unlinked recordings keep legacy point captions',()=>{
    const items=[session('one'),session('zero',3),session('legacy',2)],handlers=callbacks(),integratedScouting=integration([{recordingId:items[0].recordingId,clipCount:1},{recordingId:items[1].recordingId,clipCount:0}]);
    act(()=>{view=create(createElement(LiveSavedRecordings,{sessions:items,...handlers,integratedScouting}));});
    expect(captions().filter(text=>text.endsWith('1 lance'))).toHaveLength(1);expect(captions().filter(text=>text.endsWith('0 lances'))).toHaveLength(1);expect(captions().filter(text=>text.endsWith('2 pontos'))).toHaveLength(1);
    const linked=view.root.findAllByType('button').filter(node=>node.props.label?.startsWith('Ver lances da gravação'));
    act(()=>linked[0].props.onPress());expect(integratedScouting.onReview).toHaveBeenCalledWith(items[0].recordingId);expect(handlers.onReview).not.toHaveBeenCalled();
    const legacy=view.root.findAllByType('button').find(node=>node.props.label?.startsWith('Rever vídeo ao vivo'));
    act(()=>legacy!.props.onPress());expect(handlers.onReview).toHaveBeenCalledWith(items[2]);
});

test('a linked unfinished recording can open DVR lances while an unlinked unfinished recording keeps its review disabled',()=>{
    const items=[session('linked',0,false),session('legacy',0,false)],handlers=callbacks(),integratedScouting=integration([{recordingId:items[0].recordingId,clipCount:2}]);
    act(()=>{view=create(createElement(LiveSavedRecordings,{sessions:items,...handlers,integratedScouting}));});
    const linked=view.root.findAllByType('button').find(node=>node.props.label?.startsWith('Ver lances da gravação'))!,legacy=view.root.findAllByType('button').find(node=>node.props.label?.startsWith('Rever vídeo ao vivo'))!;
    expect(linked.props.disabled).toBe(false);expect(legacy.props.disabled).toBe(true);
    act(()=>linked.props.onPress());expect(integratedScouting.onReview).toHaveBeenCalledWith(items[0].recordingId);
});

test('integrated captions preserve the existing original download and delete actions and receiving guards',()=>{
    const item=session('linked'),handlers=callbacks(),integratedScouting=integration([{recordingId:item.recordingId,clipCount:1}]),props={sessions:[item],...handlers,integratedScouting,videoStatuses:{[item.id]:ready(item)}};
    act(()=>{view=create(createElement(LiveSavedRecordings,props));});
    const action=(prefix:string)=>view.root.findAllByType('button').find(node=>node.props.label?.startsWith(prefix))!;
    act(()=>{action('Baixar vídeo de ').props.onPress();action('Excluir registros do notebook de ').props.onPress();});
    expect(handlers.onDownload).toHaveBeenCalledWith(item);expect(handlers.onRemove).toHaveBeenCalledWith(item);expect(integratedScouting.onReview).not.toHaveBeenCalled();
    act(()=>view.update(createElement(LiveSavedRecordings,{...props,connected:true,videoStatuses:{[item.id]:{...ready(item),state:'receiving'}}})));
    expect(action('Salvando vídeo de ').props.disabled).toBe(true);expect(action('Excluir registros do notebook de ').props.disabled).toBe(true);expect(captions().some(text=>text.endsWith('1 lance'))).toBe(true);
});

test('an active local import reports saving while disconnected and keeps download and deletion guarded',()=>{
    const item=session('partial'),handlers=callbacks(),partial=Object.freeze({...ready(item),state:'receiving' as const,receivedBytes:3,totalBytes:100});
    act(()=>{view=create(createElement(LiveSavedRecordings,{sessions:[item],...handlers,connected:false,videoStatuses:{[item.id]:partial}}));});
    expect(captions()).toContain('Salvando no PC · 3%');expect(captions()).not.toContain('Envio pausado · 3%');
    expect(view.root.findAllByType('button').find(node=>node.props.label?.startsWith('Salvando vídeo de '))!.props.disabled).toBe(true);
    expect(view.root.findAllByType('button').find(node=>node.props.label?.startsWith('Excluir registros do notebook de '))!.props.disabled).toBe(true);
    expect(handlers.onDownload).not.toHaveBeenCalled();expect(handlers.onRemove).not.toHaveBeenCalled();expect(handlers.onRequest).not.toHaveBeenCalled();expect(partial.receivedBytes).toBe(3);
});

test('without integration every card preserves the legacy caption and review route',()=>{
    const item=session('legacy',1),handlers=callbacks();act(()=>{view=create(createElement(LiveSavedRecordings,{sessions:[item],...handlers}));});
    expect(captions().some(text=>text.endsWith('1 ponto'))).toBe(true);
    act(()=>view.root.findAllByType('button').find(node=>node.props.label?.startsWith('Rever vídeo ao vivo'))!.props.onPress());expect(handlers.onReview).toHaveBeenCalledWith(item);
});
