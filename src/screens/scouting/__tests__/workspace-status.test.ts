import { workspaceCaptureLabel, workspaceCaptureTone, workspaceVideoLabel } from '../workspace-status';
import type { ScoutingLiveWorkspaceStatus } from '../live/workspace-camera-presentation';

const status=(overrides:Partial<ScoutingLiveWorkspaceStatus>):ScoutingLiveWorkspaceStatus=>({state:'idle',label:'Conectar câmera',tone:'neutral',elapsedMs:null,copyPercent:null,receiving:false,connected:false,error:null,sourceLabel:null,...overrides});

test('recording and paused clocks do not borrow the progress of another video copy',()=>{
    const recording=status({state:'recording',label:'Gravando',elapsedMs:34000,copyPercent:13,receiving:true,connected:true});
    expect(workspaceCaptureLabel(recording)).toBe('Gravando 00:34');expect(workspaceVideoLabel(recording)).toBe('Ao vivo');
    expect(workspaceCaptureLabel({...recording,state:'paused',label:'Pausada'})).toBe('Pausada 00:34');expect(workspaceVideoLabel({...recording,state:'paused'})).toBe('Pausada');
    expect(workspaceCaptureLabel({...recording,state:'finalizing',label:'Finalizando'})).toBe('Finalizando 00:34');
});

test.each([
    {state:'copying',label:'Copiando original',percent:13,capture:'Copiando original 13%',video:'13%'},
    {state:'error',label:'Cópia pendente',percent:13,capture:'Não conectada',video:'13%'},
    {state:'disconnected',label:'Conexão interrompida',percent:13,capture:'Não conectada',video:'13%'},
    {state:'saved',label:'Original salvo',percent:100,capture:'Não conectada',video:'Original salvo'},
] as const)('$state presents only its own state and copy progress',({state,label,percent,capture,video})=>{
    const input=status({state,label,copyPercent:percent,elapsedMs:34000});
    expect(workspaceCaptureLabel(input)).toBe(capture);expect(workspaceVideoLabel(input)).toBe(video);
});

test('unknown duration or copy size does not invent zero time or a completed video',()=>{
    expect(workspaceCaptureLabel(null)).toBe('Não conectada');expect(workspaceVideoLabel(null)).toBe('Vídeo');
    expect(workspaceCaptureLabel(status({state:'recording',label:'Gravando'}))).toBe('Gravando');
    expect(workspaceVideoLabel(status({state:'copying',label:'Copiando original'}))).toBe('Copiando');
    expect(workspaceVideoLabel(status({state:'error',label:'Câmera com aviso'}))).toBe('Aviso');
});


test.each(['idle','connecting','preview','saved','stopped','disconnected','error'] as const)('camera header reflects peer connectivity for %s independently of historical errors',state=>{
    const input=status({state,label:'Câmera com aviso',tone:'danger',error:'Serviço indisponível',copyPercent:13});
    expect(workspaceCaptureLabel(input)).toBe('Não conectada');
    expect(workspaceCaptureTone(input)).toBe('neutral');
    expect(workspaceCaptureLabel({...input,connected:true})).toBe('Conectada');
    expect(workspaceCaptureTone({...input,connected:true})).toBe('success');
    expect(input.error).toBe('Serviço indisponível');
});
