import {createElement} from 'react';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import {ScoutingWorkspaceMenu} from '../ScoutingWorkspaceMenu.web';

let mockAvailable=true;
const mockOpen=jest.fn(),mockFocus=jest.fn();
jest.mock('react-native',()=>({View:jest.requireActual('react').forwardRef((props:any,ref:any)=>jest.requireActual('react').createElement('div',{...props,ref},props.children))}));
jest.mock('../../../ui/OperationalText',()=>({OperationalText:(props:any)=>jest.requireActual('react').createElement('span',props,props.children)}));
jest.mock('../../../copilot/CopilotProvider',()=>({useOptionalCopilot:()=>mockAvailable?{open:mockOpen}:null}));
jest.mock('../../../ui/app-theme',()=>({useAppTheme:()=>({colors:{text:'#fff'}})}));
jest.mock('../../../ui/icon-registry',()=>({GoAtletaIcon:()=>null}));
jest.mock('../../../ui/AnchoredDropdown',()=>({AnchoredDropdown:({visible,children}:any)=>visible?jest.requireActual('react').createElement('menu',null,children):null}));
jest.mock('../../../ui/AnchoredDropdownOption',()=>({AnchoredDropdownOption:(props:any)=>jest.requireActual('react').createElement('button',props,props.children)}));
jest.mock('../video/StudioUI.web',()=>({StudioAction:(props:any)=>jest.requireActual('react').createElement('button',props)}));
let view:ReactTestRenderer;
const button=(label:string)=>view.root.findAllByType('button').find(node=>(node.props.label??node.props.accessibilityLabel)===label)!;
beforeEach(()=>{mockAvailable=true;jest.clearAllMocks();});
afterEach(()=>{if(view)act(()=>view.unmount());});
const mount=(extra:Partial<Parameters<typeof ScoutingWorkspaceMenu>[0]>={})=>act(()=>{view=create(createElement(ScoutingWorkspaceMenu,{canCreate:true,disabled:false,canFinish:true,onCreate:jest.fn(),onFinish:jest.fn(),...extra}),{createNodeMock:()=>({measureInWindow:(callback:Function)=>callback(0,0,44,44),querySelector:()=>({focus:mockFocus})})});});

test('the studio offers the same chat from its menu and closes the menu before opening it',()=>{
  mount();act(()=>button('Opções do Estúdio').props.onPress());
  expect(button('Abrir chat do estúdio')).toBeDefined();
  act(()=>button('Abrir chat do estúdio').props.onPress());
  expect(mockOpen).toHaveBeenCalledTimes(1);
  expect(view.root.findAllByType('menu')).toHaveLength(0);
  expect(mockFocus).toHaveBeenCalled();
});

test('without the assistant provider no dead entry or launcher-suppression marker is offered',()=>{
  mockAvailable=false;mount();act(()=>button('Opções do Estúdio').props.onPress());
  expect(button('Abrir chat do estúdio')).toBeUndefined();
  expect(view.root.findAll(node=>node.props.nativeID==='scouting-chat-entry')).toHaveLength(0);
});

test('one menu groups video and analysis actions, closes before dispatch and preserves disabled capabilities',()=>{
  const tools=jest.fn(),download=jest.fn(),onVideoAction=jest.fn((action:()=>void)=>action());
  mount({onSources:jest.fn(),onVideoAction,videoActions:[
    {id:'tools',group:'Vídeo',label:'Ferramentas do vídeo',icon:'options',onPress:tools},
    {id:'download',group:'Vídeo',label:'Baixar vídeo completo',icon:'download',disabled:true,onPress:download},
    {id:'select',group:'Rallies',label:'Selecionar rallies',icon:'checkbox',onPress:jest.fn()},
    {id:'export',group:'Análise',label:'Exportar análise',icon:'download',onPress:jest.fn()},
  ]});
  act(()=>button('Opções do Estúdio').props.onPress());
  expect(button('Fonte do vídeo e gravações')).toBeDefined();
  expect(button('Selecionar rallies')).toBeDefined();
  expect(button('Exportar análise')).toBeDefined();
  expect(button('Baixar vídeo completo').props.disabled).toBe(true);
  act(()=>button('Baixar vídeo completo').props.onPress());expect(download).not.toHaveBeenCalled();
  expect(view.root.findAllByType('menu')).toHaveLength(1);
  act(()=>button('Ferramentas do vídeo').props.onPress());
  expect(onVideoAction).toHaveBeenCalledWith(tools);expect(tools).toHaveBeenCalledTimes(1);
  expect(view.root.findAllByType('menu')).toHaveLength(0);expect(mockFocus).toHaveBeenCalled();
});
