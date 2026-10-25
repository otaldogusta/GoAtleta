import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";
import { parse } from "@babel/parser";

// Real installed reducers/linking/history, with only browser APIs and the
// navigator's state-event boundary supplied by this fixture. POP must trigger
// onStateChange too: checking only the URL misses lost route identities.
const sdkRequire=createRequire(path.join(process.cwd(),"package.json"));
const build=path.join(process.cwd(),"node_modules/expo-router/build");
const {TabRouter}=sdkRequire(path.join(build,"react-navigation/routers/TabRouter.js"));
const {StackRouter}=sdkRequire(path.join(build,"react-navigation/routers/StackRouter.js"));
const parser=sdkRequire(path.join(build,"react-navigation/core/getStateFromPath.js"));
const serializer=sdkRequire(path.join(build,"react-navigation/core/getPathFromState.js"));
const actions=sdkRequire(path.join(build,"react-navigation/core/getActionFromState.js"));
const focused=sdkRequire(path.join(build,"react-navigation/core/findFocusedRoute.js"));
const random=sdkRequire("nanoid/non-secure");
function extract(file:string,names:string[],listen=false){
  const source=readFileSync(path.join(build,file),"utf8");const found=new Map<string,string>();
  const walk=(node:any)=>{
    if(!node||typeof node!=="object")return;
    if(node.type==="VariableDeclarator"&&names.includes(node.id?.name))found.set(node.id.name,`const ${node.id.name}=${source.slice(node.init.start,node.init.end)};`);
    if(node.type==="FunctionDeclaration"&&names.includes(node.id?.name))found.set(node.id.name,source.slice(node.start,node.end));
    if(listen&&node.type==="CallExpression"&&node.callee?.object?.name==="history"&&node.callee?.property?.name==="listen")found.set("linkingListener",`const linkingListener=${source.slice(node.arguments[0].start,node.arguments[0].end)};`);
    for(const value of Object.values(node)){if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==="object")walk(value);}
  };
  walk(parse(source,{sourceType:"unambiguous"}));
  for(const name of[...names,...(listen?["linkingListener"]:[])])assert.ok(found.has(name),`Review installed SDK function ${file}:${name}`);
  return[...found.values()].join("\n");
}
const functions=extract("fork/createMemoryHistory.js",["createMemoryHistory"])+"\n"+extract("fork/useLinking.js",["findMatchingState","onStateChange"],true);
const config={screens:{prof:{path:"prof",screens:{profile:{path:"profile",screens:{index:"",settings:"settings"}},calendar:"calendar",home:"home"}}}};
const tabOptions={routeNames:["home","profile","calendar"],routeParamList:{},routeGetIdList:{}};
const rootOptions={routeNames:["prof"],routeParamList:{},routeGetIdList:{}};
const profileOptions={routeNames:["index","settings"],routeParamList:{},routeGetIdList:{}};
function browserBoundary(initial:string){
  const listeners=new Set<()=>void>(),entries:{path:string;state:any}[]=[{path:initial,state:null}];let index=0;
  const location={pathname:"",search:"",hash:""};
  const update=()=>{const value=new URL(entries[index].path,"http://fixture.local");Object.assign(location,{pathname:value.pathname,search:value.search,hash:value.hash});};
  const history={
    get state(){return entries[index].state;},
    pushState(state:object,_title:string,href:string){entries.splice(index+1);entries.push({path:href,state});index++;update();},
    replaceState(state:object,_title:string,href:string){entries[index]={path:href,state};update();},
    go(amount:number){
      const target=Math.max(0,Math.min(entries.length-1,index+amount));if(target===index)return;
      index=target;update();queueMicrotask(()=>{for(const listener of[...listeners])listener();});
    },
  };
  const win={history,location,document:{title:"Go Atleta SDK fixture"},
    addEventListener:(name:string,listener:()=>void)=>{assert.equal(name,"popstate");listeners.add(listener);},
    removeEventListener:(_name:string,listener:()=>void)=>listeners.delete(listener)};
  update();return{win,entries,get index(){return index;},get path(){return entries[index].path;}};
}
function fixture(backBehavior?:"fullHistory",unsynchronizedReference=false){
  const tabRouter=TabRouter({initialRouteName:"home",...(backBehavior?{backBehavior}:{})});
  const rootRouter=StackRouter({initialRouteName:"prof"});const profileRouter=StackRouter({initialRouteName:"index"});
  const hydrate=(raw:any)=>{
    const parent=rootRouter.getRehydratedState(raw,rootOptions);
    return{...parent,routes:parent.routes.map((route:any)=>{
      if(route.name!=="prof")return route;const state=tabRouter.getRehydratedState(route.state??{routes:[]},tabOptions);
      return{...route,state:{...state,routes:state.routes.map((child:any)=>child.name==="profile"?{...child,state:profileRouter.getRehydratedState(child.state??{routes:[]},profileOptions)}:child)}};
    })};
  };
  let tab=tabRouter.getInitialState(tabOptions);
  tab=tabRouter.getStateForAction(tab,{type:"NAVIGATE",payload:{name:"profile"}},tabOptions);
  tab={...tab,routes:tab.routes.map((route:any)=>route.name==="profile"?{...route,state:profileRouter.getInitialState(profileOptions)}:route)};
  let current=rootRouter.getRehydratedState({routes:[{name:"prof",state:tab}]},rootOptions);
  const initialPath=serializer.getPathFromState(current,config);const browser=browserBoundary(initialPath);let flush=Promise.resolve();
  const context:any={window:browser.win,location:browser.win.location,setTimeout,clearTimeout,non_secure_1:random,native_1:focused,enabled:true,
    previousStateRef:{current},previousIndexRef:{current:0},pendingPopStatePathRef:{current:undefined},configRef:{current:config},
    getStateFromPathRef:{current:parser.getStateFromPath},getActionFromStateRef:{current:actions.getActionFromState},
    validateRoutesNotExistInRootState:()=>false,onUnhandledLinking:()=>{},
    getPathForRoute:(_route:any,state:any)=>serializer.getPathFromState(state,config),store:{get state(){return current;}}};
  // The negative control restores only the original missing synchronization;
  // it still executes the real SDK's other functions and reactive POP path.
  const executed=unsynchronizedReference?functions.replace(/\bindex\s*=\s*history\.index\s*;/,""):functions;
  const sdk=vm.runInNewContext(`${executed}\n({createMemoryHistory,onStateChange,linkingListener});`,context);
  const update=(next:any)=>{current=next;flush=flush.then(()=>sdk.onStateChange());};
  context.ref={current:{getRootState:()=>current,resetRoot:(state:any)=>update(hydrate(state)),dispatch:(action:any)=>{
    if(action.type==="RESET"){update(hydrate(action.payload));return;}
    const active=current.routes[0];const raw=action.payload?.name==="prof"?action.payload.params:action.payload;
    const next=tabRouter.getStateForAction(active.state,{...action,type:action.type==="REPLACE"?"REPLACE":"NAVIGATE",target:undefined,payload:{name:raw?.screen??raw?.name,params:raw?.params}},tabOptions);
    assert.ok(next);update({...current,routes:[{...active,state:next}]});
  }}};
  context.history=sdk.createMemoryHistory();context.history.replace({path:initialPath,state:current});context.history.listen(sdk.linkingListener);
  const snapshot=()=>({url:browser.path,activeTab:current.routes[0].state.routes[current.routes[0].state.index].name,
    ids:browser.entries.map(entry=>entry.state?.id),memoryIndex:context.history.index,nativeIndex:browser.index,
    rootKey:current.key,tabKey:current.routes[0].state.key,profileLeafKey:current.routes[0].state.routes.find((route:any)=>route.name==="profile").state.routes[0].key,
    memoryIds:[0,1,2,3].map(index=>context.history.get(index)).filter(Boolean).map((record:any)=>record.id)});
  const settle=async()=>{for(let index=0;index<12;index++){await Promise.resolve();const previous=flush;await flush;await Promise.resolve();if(previous===flush&&index>=3)break;}};
  return{snapshot,navigate:async(name:string)=>{
    const active=current.routes[0];const next=tabRouter.getStateForAction(active.state,{type:"NAVIGATE",payload:{name}},tabOptions);assert.ok(next);
    update({...current,routes:[{...active,state:next}]});await settle();return snapshot();
  },back:async()=>{browser.win.history.go(-1);await settle();return snapshot();},forward:async()=>{browser.win.history.go(1);await settle();return snapshot();}};
}

test("fullHistory and the installed SDK preserve active screens, identities, unique IDs and indices through seven reactive steps",async()=>{
  const h=fixture("fullHistory");const initial=h.snapshot();
  const stages=[await h.navigate("calendar"),await h.back(),await h.forward(),await h.navigate("profile"),await h.navigate("calendar"),await h.back(),await h.forward()];
  expect(stages.map(value=>value.activeTab)).toEqual(["calendar","profile","calendar","profile","calendar","profile","calendar"]);
  expect(stages.map(value=>value.url)).toEqual(["/prof/calendar","/prof/profile","/prof/calendar","/prof/profile","/prof/calendar","/prof/profile","/prof/calendar"]);
  for(const stage of stages){
    expect([stage.rootKey,stage.tabKey,stage.profileLeafKey]).toEqual([initial.rootKey,initial.tabKey,initial.profileLeafKey]);
    expect(stage.memoryIndex).toBe(stage.nativeIndex);expect(new Set(stage.ids).size).toBe(stage.ids.length);expect(new Set(stage.memoryIds).size).toBe(stage.memoryIds.length);
  }
});
test("the original unsynchronized SDK control loses the Profile identity after reactive Back/Forward",async()=>{
  const h=fixture("fullHistory",true);const initial=h.snapshot();await h.navigate("calendar");await h.back();const forward=await h.forward();
  expect(forward.activeTab).toBe("calendar");expect(forward.profileLeafKey).not.toBe(initial.profileLeafKey);
});
test("the unchanged native firstRoute default alone does not create a browser entry for a sibling tab",async()=>{
  const h=fixture();const next=await h.navigate("calendar");expect(next.ids).toHaveLength(1);
});
