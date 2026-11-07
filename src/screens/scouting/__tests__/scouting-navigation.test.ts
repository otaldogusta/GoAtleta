import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ScoutingTabs } from '../ScoutingNavigation';

jest.mock('react-native', () => ({ View: jest.requireActual('react').forwardRef((props: any, ref: any) => jest.requireActual('react').createElement('view', { ...props, ref }, props.children)) }));
jest.mock('../../../ui/OperationalText', () => ({ OperationalText: (props: any) => jest.requireActual('react').createElement('text', props, props.children) }));
jest.mock('../../../ui/Pressable', () => ({ Pressable: (props: any) => jest.requireActual('react').createElement('pressable', props, typeof props.children === 'function' ? props.children({ hovered:false, pressed:false }) : props.children) }));
jest.mock('../../../ui/app-theme', () => ({ useAppTheme: () => ({ colors: { text:'#eee', muted:'#aaa', primaryBg:'#3ddc84', border:'#334' } }) }));
jest.mock('../../../theme/tokens', () => ({ compactUiMetrics: jest.requireActual('../../../theme/compact-ui-metrics').compactUiMetrics }));
jest.mock('../../../ui/icon-registry', () => ({ GoAtletaIcon: () => null }));
jest.mock('../../../ui/AnchoredDropdown', () => ({ AnchoredDropdown: () => null }));
jest.mock('../../../ui/AnchoredDropdownOption', () => ({ AnchoredDropdownOption: () => null }));

const items=[{value:'register',label:'Registrar',id:'register-tab',panelId:'register-panel'},{value:'video',label:'Revisar',id:'video-tab',panelId:'video-panel'}];
const originalDocument=Object.getOwnPropertyDescriptor(globalThis,'document');
let view:ReactTestRenderer|undefined, listener:((event:any)=>void)|undefined;
let buttons:{focus:jest.Mock;closest:()=>unknown}[];
const render=(segmented=false)=>{
    const onChange=jest.fn();
    act(()=>{view=create(createElement(ScoutingTabs,{value:'register',onChange,items,segmented}),{createNodeMock:()=>({addEventListener:(_name:string,callback:typeof listener)=>{listener=callback;},removeEventListener:()=>{listener=undefined;},querySelectorAll:()=>buttons})});});
    return onChange;
};
beforeEach(()=>{
    Object.defineProperty(globalThis,'document',{configurable:true,value:{}});
    buttons=[0,1].map(()=>{const button={focus:jest.fn(),closest:()=>button};return button;});
});
afterEach(()=>{act(()=>view?.unmount());view=undefined;listener=undefined;if(originalDocument)Object.defineProperty(globalThis,'document',originalDocument);else Reflect.deleteProperty(globalThis,'document');});

test('underlined tabs expose the selected panel and one keyboard entry point',()=>{
    render();const tabs=view!.root.findAllByType('pressable' as never);
    expect(tabs.map(tab=>[tab.props['aria-selected'],tab.props.tabIndex,tab.props['aria-controls']])).toEqual([[true,0,'register-panel'],[false,-1,'video-panel']]);
    expect(tabs.map(tab=>tab.props.accessibilityRole)).toEqual(['tab','tab']);
});

test('arrows wrap between tools, Home and End move focus, browser shortcuts stay available',()=>{
    const onChange=render(),preventDefault=jest.fn();
    listener!({key:'ArrowRight',target:buttons[0],preventDefault});
    expect(onChange).toHaveBeenLastCalledWith('video');expect(buttons[1].focus).toHaveBeenCalledTimes(1);
    listener!({key:'ArrowRight',target:buttons[1],preventDefault});
    expect(onChange).toHaveBeenLastCalledWith('register');
    listener!({key:'End',target:buttons[0],preventDefault});expect(onChange).toHaveBeenLastCalledWith('video');
    listener!({key:'Home',target:buttons[1],preventDefault});expect(onChange).toHaveBeenLastCalledWith('register');
    onChange.mockClear();preventDefault.mockClear();
    listener!({key:'Home',ctrlKey:true,target:buttons[1],preventDefault});
    expect(onChange).not.toHaveBeenCalled();expect(preventDefault).not.toHaveBeenCalled();
});

test('segmented controls keep button semantics without a tab keyboard listener',()=>{
    render(true);const controls=view!.root.findAllByType('pressable' as never);
    expect(listener).toBeUndefined();expect(controls.map(control=>control.props.accessibilityRole)).toEqual(['button','button']);
    expect(controls.map(control=>control.props['aria-pressed'])).toEqual([true,false]);
});
