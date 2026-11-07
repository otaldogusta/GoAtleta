import { createElement } from 'react';
import { act, create, type ReactTestRenderer, type ReactTestInstance } from 'react-test-renderer';
import { CollectorAthlete } from '../ScoutingCollectionParts';
import type { Student } from '../../../core/models';

jest.mock('react-native',()=>{
  const React=jest.requireActual<typeof import('react')>('react');
  return {Platform:{OS:'web',select:(options:Record<string,unknown>)=>options.web},View:React.forwardRef(function MockAnchor(props:object,ref){return React.createElement('anchor-view',{...props,ref});}),ScrollView:'scroll-view',useWindowDimensions:()=>({width:390,height:844})};
});
jest.mock('../../../ui/OperationalText',()=>({OperationalText:(props:object)=>jest.requireActual('react').createElement('text',props)}));
jest.mock('../ScoutingUI',()=>({Copy:(props:object)=>jest.requireActual('react').createElement('copy',props),Input:()=>null,ScoutingModal:()=>null}));
jest.mock('../../../ui/app-theme',()=>({useAppTheme:()=>({colors:{}})}));
jest.mock('../../../ui/icon-registry',()=>({GoAtletaIcon:()=>null}));
jest.mock('../../../ui/Pressable',()=>({Pressable:(props:object)=>jest.requireActual('react').createElement('button',props)}));
jest.mock('../../../ui/AnchoredDropdown',()=>({AnchoredDropdown:(props:Record<string,unknown>)=>jest.requireActual('react').createElement('anchored-tooltip',props,props.visible?props.children:null)}));

const student={id:'athlete',name:'Patrícia Gabriela de Albuquerque'} as Student;
let view:ReactTestRenderer|undefined,measured:((x:number,y:number,width:number,height:number)=>void)|undefined;
const props={student,jersey:'77',selected:false,disabled:false,onPress:jest.fn()};
const tooltip=()=>view!.root.findAllByType('anchor-view' as never).find(node=>node.props.role==='tooltip');
const card=()=>view!.root.findByType('button');
const popup=()=>view!.root.findByType('anchored-tooltip' as never);
const nodeText=(node:ReactTestInstance):string=>node.children.map(child=>typeof child==='string'?child:nodeText(child)).join('');
function mount(immediate=true){act(()=>{view=create(createElement(CollectorAthlete,props),{createNodeMock:node=>node.type==='anchor-view'?{measureInWindow:(callback:typeof measured)=>{measured=callback;if(immediate)callback!(30,100,120,44);}}:null});});}
beforeEach(()=>{jest.clearAllMocks();jest.useFakeTimers();measured=undefined;});
afterEach(()=>{act(()=>{view?.unmount();view=undefined;});jest.useRealTimers();});

test('full names use a portaled hover/focus tooltip, remain while focused and dismiss without selecting',()=>{
  mount();act(()=>card().props.onFocus());expect(tooltip()).toBeDefined();expect(nodeText(tooltip()!)).toBe(student.name);
  expect(popup().props).toMatchObject({portalToBodyOnWeb:true,visible:true});expect(card().props['aria-describedby']).toBe(tooltip()!.props.nativeID);
  act(()=>card().props.onHoverOut());act(()=>jest.advanceTimersByTime(200));expect(tooltip()).toBeDefined();
  act(()=>card().props.onBlur());act(()=>jest.advanceTimersByTime(140));expect(tooltip()).toBeUndefined();
  act(()=>card().props.onHoverIn());expect(tooltip()).toBeDefined();act(()=>popup().props.onRequestClose());expect(tooltip()).toBeUndefined();expect(props.onPress).not.toHaveBeenCalled();
  act(()=>card().props.onFocus());act(()=>view!.update(createElement(CollectorAthlete,{...props,disabled:true})));act(()=>view!.update(createElement(CollectorAthlete,props)));expect(tooltip()).toBeUndefined();
});

test('a delayed hover measurement cannot reopen a name after pointer exit',()=>{
  mount(false);act(()=>card().props.onHoverIn());expect(measured).toBeDefined();act(()=>card().props.onHoverOut());act(()=>measured!(30,100,120,44));expect(tooltip()).toBeUndefined();
});
