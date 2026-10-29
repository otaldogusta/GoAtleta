/** Redraw the retained scene after browser suspension or GPU restoration. */
export function bindRendererLifecycle({canvas,document,window,onSuspend,onResume}){
 let contextLost=false,pageHidden=false;
 const isSuspended=()=>contextLost||pageHidden||document.hidden;
 const resume=()=>{if(!isSuspended())onResume();};
 const visibility=()=>{if(document.hidden)onSuspend();else resume();};
 const hide=()=>{pageHidden=true;onSuspend();};
 const show=()=>{pageHidden=false;resume();};
 const lost=event=>{event.preventDefault();contextLost=true;onSuspend();};
 const restored=()=>{contextLost=false;resume();};
 const listeners=[[document,'visibilitychange',visibility],[window,'pagehide',hide],[window,'pageshow',show],[canvas,'webglcontextlost',lost],[canvas,'webglcontextrestored',restored]];
 for(const [target,type,listener]of listeners)target.addEventListener(type,listener);
 return {isSuspended,dispose(){for(const [target,type,listener]of listeners)target.removeEventListener(type,listener);}};
}
