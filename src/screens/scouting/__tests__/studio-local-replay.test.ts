import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { newVideoDocument, type VideoDocument } from '../../../core/scouting-video';
import { Studio } from '../video/ScoutingVideoStudio.web';
import { recordVideoClip, downloadVideoBlob } from '../video/video-media.web';
import { useVideoDraft } from '../video/use-video-draft';

import type { LocalStudioSource } from '../video/local-studio-types';
import { localStudioMediaRange } from '../video/local-studio-range';
import { StudioSelect } from '../video/StudioSelect.web';

jest.mock('../video/use-video-draft', () => ({ useVideoDraft: jest.fn() }));
jest.mock('../video/video-media.web', () => ({ inspectVideo: jest.fn(), recordVideoClip:jest.fn(), downloadVideoBlob:jest.fn() }));
jest.mock('../../../ui/app-theme', () => ({ useAppTheme: () => ({ colors: {} }) }));
jest.mock('../../../ui/icon-registry', () => ({ GoAtletaIcon: () => null }));
jest.mock('../../../observability/perf', () => ({ markRender: jest.fn() }));
jest.mock('../../../db/scouting-collection', () => ({ loadScoutingDetail: jest.fn() }));
jest.mock('../../../api/scouting-video-drive', () => ({ driveTrackingAvailable: () => false }));
jest.mock('../../../api/scouting-video-ai', () => ({ localVideoAiAvailable: () => false }));
jest.mock('../video/video-processing.web', () => ({ processScoutingVideo: jest.fn() }));
jest.mock('../video/studio-styles', () => ({ studioStyles: '' }));
jest.mock('../video/use-studio-interactions', () => ({ useStudioInteractions: jest.fn() }));
jest.mock('../video/StudioUI.web', () => ({
    StudioAction: (props: object) => jest.requireActual('react').createElement('button', props),
    StudioDialog: ({ children }: { children: unknown }) => children,
}));
jest.mock('../video/StudioPanel.web', () => ({ StudioPanel: ({ children }: { children: unknown }) => children }));
jest.mock('../video/StudioSelect.web', () => ({ StudioSelect: () => null }));
jest.mock('../video/VideoGallery.web', () => ({ VideoGallery: (props: object) => jest.requireActual('react').createElement('gallery', props) }));
jest.mock('../video/VideoTimeline.web', () => ({ VideoTimeline: (props:object) => jest.requireActual('react').createElement('timeline',props) }));
jest.mock('../video/VideoFrame.web', () => ({ VideoFrame: () => null }));
jest.mock('../video/VideoBufferStatus.web', () => ({ VideoBufferStatus: () => null }));
jest.mock('../video/VideoTrackingOverlay.web', () => ({ VideoTrackingOverlay: () => null }));
jest.mock('../video/VideoCorrectionLens.web', () => ({ VideoCorrectionLens: () => null }));
jest.mock('../video/YouTubeVideo.web', () => ({ YouTubeVideo: () => null }));
jest.mock('../video/VideoLinkField.web', () => ({ VideoLinkField: () => null }));
jest.mock('../video/VideoRallyRange.web', () => ({ VideoRallyRange: () => null }));
jest.mock('../video/YouTubeAnalysis.web', () => ({ YouTubeAnalysis: () => null }));
jest.mock('../video/YouTubeTrackingSetup.web', () => ({ YouTubeTrackingSetup: () => null }));
jest.mock('../video/DriveTrackingSetup.web', () => ({ DriveTrackingSetup: () => null }));
jest.mock('../video/YouTubeTrackingPanel.web', () => ({ YouTubeTrackingPanel: () => null }));
jest.mock('../video/VideoShareDialog.web', () => ({ VideoShareDialog: () => null }));
jest.mock('../video/VideoContactEditor.web', () => ({ VideoContactEditor: () => null }));



let view:ReactTestRenderer;
let nodes:HTMLVideoElement[];
const savedDocument=globalThis.document;
const props={org:'org',userId:'user',classId:'class',sessionId:'session',teamName:'Equipe',students:[],embedded:true,onClose:jest.fn(),session:{title:'Ao vivo',opponent:'Adversário',status:'em_andamento' as const}};
function draft(doc:VideoDocument|null){return {doc,history:doc?{present:doc,past:[],future:[]}:null,dirty:true,saving:false,loading:false,syncStatus:'synced',conflict:null,error:'',open:jest.fn(),save:jest.fn().mockResolvedValue(true),change:jest.fn(),undo:jest.fn(),setError:jest.fn(),retrySync:jest.fn(),resolveConflict:jest.fn(),ranges:{r1:[2005,2015]},sourceContacts:[{id:'official',rallyId:'r1',time:2008,skill:'Comunicação',result:'Boa',athlete:'Ana',detail:'Coleta original',uncertaintyMs:40}],pendingCount:0,resizeRally:jest.fn(),splitRally:jest.fn(),mergeRally:jest.fn(),importLocal:jest.fn().mockResolvedValue(true),exportLocal:jest.fn().mockReturnValue('{"kind":"goatleta-live-video-draft"}')};}
function localSource(){const doc=newVideoDocument({fingerprint:'local:capture',name:'Ao vivo',duration:2050,width:1280,height:720},'r1');doc.rallies[0].start=2005;doc.rallies[0].pointTime=2013;return {identity:'recording-a',draft:draft(doc),source:'blob:a',blob:{} as Blob,file:{name:'gravacao.webm'} as File,offsetSeconds:2000,availableUntilSeconds:2030,original:false,loading:false,error:'',message:'Prévia local',revision:1,selectRally:jest.fn(),playbackState:jest.fn(),exportState:jest.fn(),onMetadata:jest.fn(),mediaError:jest.fn(),refresh:jest.fn(),onOtherVideos:jest.fn(),recordings:[{value:'a',label:'Hoje 12:00'}],recordingId:'a',selectRecording:jest.fn()} as unknown as LocalStudioSource;}
function render(local:LocalStudioSource,extra:Partial<Parameters<typeof Studio>[0]>={}){act(()=>{view=create(createElement(Studio,{...props,localReplay:local,...extra}),{createNodeMock:element=>{if(element.type!=='video')return null;const node={currentTime:0,duration:30,videoWidth:1280,videoHeight:720,paused:true,readyState:1,playbackRate:1,pause:jest.fn(function(this:{paused:boolean}){this.paused=true;}),play:jest.fn(function(this:{paused:boolean}){this.paused=false;return Promise.resolve();})} as unknown as HTMLVideoElement;nodes.push(node);return node;}});});}
function button(label:string){return view.root.findAllByType('button').find(node=>node.props.label===label)!;}
beforeEach(()=>{jest.clearAllMocks();nodes=[];globalThis.document={getElementById:()=>null,activeElement:null,body:{style:{overflow:''}}} as unknown as Document;window.addEventListener=jest.fn();window.removeEventListener=jest.fn();(useVideoDraft as jest.Mock).mockReturnValue(draft(null));jest.mocked(recordVideoClip).mockResolvedValue({type:'video/webm'} as Blob);});
afterEach(()=>{act(()=>view?.unmount());globalThis.document=savedDocument;});

test('uses canonical Rallies with the local draft and never opens or changes a legacy draft',async()=>{
 const local=localSource(),legacy=(useVideoDraft as jest.Mock).getMockImplementation()!();render(local);
 expect(jest.mocked(useVideoDraft).mock.calls.at(-1)?.[5]).toBe(false);
 const gallery=view.root.findByType('gallery' as never);expect(gallery.props.doc).toBe(local.draft.doc);expect(gallery.props.rangeResolver(local.draft.doc,'r1')).toEqual([2005,2015]);expect(gallery.props.canDownloadOriginal).toBe(false);
 expect(view.root.findAllByProps({label:'Adicionar vídeo'})).toHaveLength(0);expect(view.root.findAllByType('timeline' as never)[0].props.sourceContacts[0].skill).toBe('Comunicação');
 await act(async()=>{button('Salvar rascunho').props.onPress();});expect(local.draft.save).toHaveBeenCalledTimes(1);
 const input=view.root.findAllByType('input').find(node=>node.props.accept==='application/json,.json')!;
 await act(async()=>input.props.onChange({target:{files:[{size:20,text:async()=>'local envelope'}],value:'selected'}}));expect(local.draft.importLocal).toHaveBeenCalledWith('local envelope');
 expect(legacy.open).not.toHaveBeenCalled();expect(legacy.change).not.toHaveBeenCalled();expect(legacy.save).not.toHaveBeenCalled();
});

test('preserves the explicit contact capture clock across new source metadata and an Infinity probe',()=>{
 const local=localSource();render(local);act(()=>view.root.findByType('video').props.onLoadedMetadata());
 act(()=>view.root.findByType('gallery' as never).props.onFocus('r1'));
 act(()=>view.root.findByType('timeline' as never).props.onSeek(2008));expect(nodes.at(-1)!.currentTime).toBe(8);
 const next={...local,source:'blob:b',offsetSeconds:2002};act(()=>view.update(createElement(Studio,{...props,localReplay:next})));
 act(()=>view.root.findByType('video').props.onLoadedMetadata());expect(nodes.at(-1)!.currentTime).toBe(6);
 const last={...next,source:'blob:c'};act(()=>view.update(createElement(Studio,{...props,localReplay:last})));nodes.at(-1)!.duration=Infinity;
 act(()=>view.root.findByType('video').props.onLoadedMetadata());expect(nodes.at(-1)!.currentTime).toBe(1e10);
 nodes.at(-1)!.duration=30;act(()=>view.root.findByType('video').props.onDurationChange());expect(nodes.at(-1)!.currentTime).toBe(6);expect(local.onMetadata).toHaveBeenLastCalledWith({durationSeconds:30,width:1280,height:720});
});

test('exports a covered local rally with native offset and isolated busy state',async()=>{
 const local=localSource();render(local);await act(async()=>{await view.root.findByType('gallery' as never).props.onDownload(['r1']);});
 expect(recordVideoClip).toHaveBeenCalledWith('blob:a',5,15,expect.any(Function),expect.any(AbortSignal));expect(local.exportState).toHaveBeenNthCalledWith(1,true);expect(local.exportState).toHaveBeenLastCalledWith(false);expect(downloadVideoBlob).toHaveBeenCalled();
});

test('revoked local media aborts an export and late completion cannot download',async()=>{
 let finish!:(value:Blob)=>void;jest.mocked(recordVideoClip).mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));const local=localSource();render(local);
 let job!:Promise<void>;act(()=>{job=view.root.findByType('gallery' as never).props.onDownload(['r1']);});
 const signal=jest.mocked(recordVideoClip).mock.calls[0][4]!;act(()=>view.update(createElement(Studio,{...props,localReplay:{...local,source:'',blob:null,file:null}})));expect(signal.aborted).toBe(true);
 await act(async()=>{finish({type:'video/webm'} as Blob);await job;});expect(downloadVideoBlob).not.toHaveBeenCalled();expect(view.root.findAllByType('video')).toHaveLength(0);
});

test('only a final original can clamp padding at EOF while preserving all gesture times',()=>{
 const local=localSource(),doc=local.draft.doc!;const resolve=()=>[2005,2015] as const;
 expect(localStudioMediaRange(doc,'r1',{...local,original:true,availableUntilSeconds:2013.5},resolve)).toEqual({start:2005,end:2013.5,complete:true});
 expect(localStudioMediaRange(doc,'r1',{...local,original:false,availableUntilSeconds:2013.5},resolve).complete).toBe(false);
 expect(localStudioMediaRange(doc,'r1',{...local,original:true,availableUntilSeconds:2012},resolve).complete).toBe(false);
});


test('native play and pause report media ownership synchronously before effects',()=>{
 const local=localSource();render(local);
 act(()=>{view.root.findByType('video').props.onPlay();expect(local.playbackState).toHaveBeenLastCalledWith(true);});
 act(()=>{view.root.findByType('video').props.onPause();expect(local.playbackState).toHaveBeenLastCalledWith(false);});
});

test('local cuts keep the explicitly selected rally and never use contiguous legacy mutations',()=>{
 const local=localSource();render(local);act(()=>view.root.findByType('gallery' as never).props.onFocus('r1'));
 act(()=>button('Scouting').props.onPress());act(()=>button('Ver contatos anotados no vídeo').props.onPress());
 act(()=>button('Iniciar rally aqui').props.onPress());expect(local.draft.splitRally).toHaveBeenCalledWith(2005,'r1');expect(local.draft.change).not.toHaveBeenCalled();
});

test('awaiting a first local chunk keeps the capture empty state and has no media import path',()=>{
 const local=localSource();local.draft.doc=null;local.source='';local.blob=null;local.file=null;render(local);
 expect(view.root.findAllByType('p').map(node=>node.children.join(''))).toContain('Aguardando trecho da gravação.');expect(view.root.findAllByType('h2').map(node=>node.children.join(''))).not.toContain('Seu jogo começa aqui');expect(view.root.findAllByProps({label:'Adicionar vídeo'})).toHaveLength(0);
});


test('bench keeps source ownership during replay and passive revisions, then explicitly returns to live',()=>{
 const local=localSource(),onBenchReplayChange=jest.fn(),onReturnToLive=jest.fn();
 const extra={bench:true,keyboardActive:false,onBenchReplayChange,onReturnToLive};render(local,extra);
 expect(view.root.findByType('gallery' as never).props.bench).toBe(true);
 expect(view.root.findAllByProps({label:'Salvar rascunho'})).toHaveLength(0);
 expect(onBenchReplayChange.mock.calls).toEqual([[false]]);
 act(()=>view.root.findByType('gallery' as never).props.onFocus('r1'));
 expect(onBenchReplayChange.mock.calls).toEqual([[false],[true]]);
 act(()=>view.update(createElement(Studio,{...props,...extra,localReplay:{...local,revision:2}})));
 expect(onBenchReplayChange).toHaveBeenCalledTimes(2);
 expect(view.root.findByType('video').props.src).toBe('blob:a');
 act(()=>button('Voltar ao vivo').props.onPress());
 expect(onReturnToLive).toHaveBeenCalledTimes(1);expect(onBenchReplayChange).toHaveBeenLastCalledWith(false);
 expect(local.draft.change).not.toHaveBeenCalled();expect(local.selectRally).toHaveBeenCalledWith('r1');
});

test('bench tools retain editing and official contacts stay read-only',()=>{
 const local=localSource();render(local,{bench:true});
 act(()=>view.root.findByType('gallery' as never).props.onOpenTools());
 expect(button('Salvar rascunho')).toBeDefined();expect(button('Histórico de alterações')).toBeDefined();
 act(()=>button('Scouting').props.onPress());
 const official=button('Comunicação · Ana · Boa · 33:28.000');
 expect(official).toBeDefined();act(()=>official.props.onPress());
 expect(local.draft.change).not.toHaveBeenCalled();expect(view.root.findAllByType('video')).toHaveLength(1);
});

test('starting a bench export closes the tools sheet before its progress dialog opens',async()=>{
 let finish!:(value:Blob)=>void;jest.mocked(recordVideoClip).mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
 const local=localSource();render(local,{bench:true});
 act(()=>view.root.findByType('gallery' as never).props.onOpenTools());expect(button('Salvar rascunho')).toBeDefined();
 let exporting!:Promise<void>;act(()=>{exporting=view.root.findByType('gallery' as never).props.onDownload(['r1']);});
 expect(button('Salvar rascunho')).toBeUndefined();expect(local.exportState).toHaveBeenLastCalledWith(true);
 await act(async()=>{finish({type:'video/webm'} as Blob);await exporting;});
 expect(local.exportState).toHaveBeenLastCalledWith(false);expect(downloadVideoBlob).toHaveBeenCalledTimes(1);
});

test('live preview makes only the covered player inert while rally selection remains available',()=>{
 const local=localSource(),onBenchReplayChange=jest.fn();
 const extra={bench:true,benchPreviewActive:true,onBenchReplayChange};render(local,extra);
 const player=()=>view.root.findAllByType('div').find(node=>typeof node.props.className==='string'&&node.props.className.startsWith('sv-player'))!;
 expect(player().props.inert).toBe(true);expect(player().props['aria-hidden']).toBe(true);
 const gallery=view.root.findByType('gallery' as never);expect(gallery.parent?.props.inert).not.toBe(true);
 act(()=>gallery.props.onFocus('r1'));expect(onBenchReplayChange).toHaveBeenLastCalledWith(true);
 act(()=>view.update(createElement(Studio,{...props,...extra,benchPreviewActive:false,localReplay:local})));
 expect(player().props.inert).toBeUndefined();expect(player().props['aria-hidden']).toBeUndefined();
 expect(view.root.findAllByType('video')).toHaveLength(1);expect(local.draft.change).not.toHaveBeenCalled();
});

test('bench source navigation closes its tools sheet and delegates through the existing callbacks with the dirty draft preserved',()=>{
 const local=localSource();local.recordings=[{value:'a',label:'Primeira'},{value:'b',label:'Segunda'}];
 const before=JSON.stringify(local.draft.doc);render(local,{bench:true});
 act(()=>view.root.findByType('gallery' as never).props.onOpenTools());
 act(()=>button('Abrir outros vídeos').props.onPress());
 expect(button('Salvar rascunho')).toBeUndefined();expect(local.onOtherVideos).toHaveBeenCalledTimes(1);
 expect(local.draft.dirty).toBe(true);expect(local.draft.change).not.toHaveBeenCalled();
 act(()=>view.root.findByType('gallery' as never).props.onOpenTools());
 const recordings=view.root.findAllByType(StudioSelect).find(node=>node.props.label==='Gravação ao vivo')!;
 act(()=>recordings.props.onChange('b'));
 expect(button('Salvar rascunho')).toBeUndefined();expect(local.selectRecording).toHaveBeenCalledWith('b');
 expect(JSON.stringify(local.draft.doc)).toBe(before);expect(view.root.findByType('video').props.src).toBe('blob:a');
});
