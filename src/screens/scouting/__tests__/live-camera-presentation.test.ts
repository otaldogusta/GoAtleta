import {liveCameraDetails,liveCameraSummary} from '../live/live-camera-presentation';

test('the studio translates browser labels without exposing camera numbers or guessing a main lens',()=>{
    expect(liveCameraSummary({label:'camera 0, facing back',zoom:1})).toBe('Câmera traseira · 1×');
    expect(liveCameraSummary({label:'camera 2, facing back',zoom:.6})).toBe('Câmera traseira · 0,6×');
    expect(liveCameraSummary({label:'Front Main Camera'})).toBe('Câmera frontal');
    expect(liveCameraSummary({label:'private hardware label'})).toBe('Câmera do celular');
    expect(liveCameraSummary({label:''})).toBe('Câmera do celular');
});

test('quality details distinguish source configuration from measured file frames and retain an honest fallback',()=>{
    expect(liveCameraDetails({label:'back',width:1920,height:1080,frameRate:29.97})).toBe('Full HD · 30 quadros/s configurados');
    expect(liveCameraDetails({label:'back',width:1920,height:1080,frameRate:59.94})).toBe('Full HD · 60 quadros/s configurados');
    expect(liveCameraDetails({label:'back',width:1080,height:1920})).toBe('Full HD');
    expect(liveCameraDetails({label:'back',width:1440,height:1080})).toBe('1440 × 1080');
    expect(liveCameraDetails({label:'back'})).toBe('Qualidade definida pelo celular');
});
