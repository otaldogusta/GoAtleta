type CameraInfo={label:string;width?:number;height?:number;frameRate?:number;zoom?:number};

/** Browser device numbers are not lens identities; show only the facing we know. */
export function liveCameraSummary(info:CameraInfo){
    const label=info.label.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    const name=/front|frontal|facetime|selfie|\buser\b/.test(label)?'Câmera frontal'
        :/back|rear|traseir|environment/.test(label)?'Câmera traseira':'Câmera do celular';
    return name+(typeof info.zoom==='number'&&Number.isFinite(info.zoom)?` · ${info.zoom.toLocaleString('pt-BR',{maximumFractionDigits:1})}×`:'');
}

/** Technical details stay behind the camera disclosure. */
export function liveCameraDetails(info:CameraInfo){
    const values:string[]=[];
    if(info.width&&info.height){
        const longest=Math.max(info.width,info.height),shortest=Math.min(info.width,info.height);
        values.push(longest===3840&&shortest===2160?'4K':longest===1920&&shortest===1080?'Full HD':longest===1280&&shortest===720?'HD':`${info.width} × ${info.height}`);
    }
    if(info.frameRate)values.push(`${Math.round(info.frameRate)} quadros/s configurados`);
    return values.join(' · ')||'Qualidade definida pelo celular';
}
