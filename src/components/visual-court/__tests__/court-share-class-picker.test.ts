import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { supabaseRestGet } from '../../../api/rest';
import type { SessionIdentity } from '../../../auth/session';
import { CourtShareClassPicker } from '../CourtShareClassPicker.web';

let mockUser: string | null, mockOrg: string | null, mockEpoch: number;
jest.mock('../../../auth/auth', () => ({ useAuth: () => ({ session: mockUser ? { user: { id: mockUser } } : null, loading: false }) }));
jest.mock('../../../auth/session', () => ({
  getSessionIdentity: () => ({ userId: mockUser ?? '', generation: mockEpoch }),
  isSessionIdentityCurrent: (id: SessionIdentity) => id.userId === mockUser && id.generation === mockEpoch,
}));
jest.mock('../../../db/client', () => ({ getReadCacheGeneration: () => 1 }));
jest.mock('../../../api/rest', () => ({ supabaseRestGet: jest.fn() }));
jest.mock('../../../providers/organization-context', () => ({
  useOptionalOrganization: () => mockOrg ? { activeOrganization: { id: mockOrg }, activeOrganizationId: mockOrg } : null,
}));
jest.mock('../../../ui/app-theme', () => ({ useAppTheme: () => ({ colors: {} }) }));
jest.mock('../../../screens/scouting/video/StudioUI.web', () => ({ StudioAction: 'StudioAction', StudioDialog: 'StudioDialog' }));
jest.mock('react-dom', () => ({ createPortal: (children: React.ReactNode) => children }));

const read = jest.mocked(supabaseRestGet);
const props = { onSelect: jest.fn(), onDownload: jest.fn(), onClose: jest.fn() };
const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
let tree: TestRenderer.ReactTestRenderer;
const refresh = async () => {
  await act(async () => {
    const element = React.createElement(CourtShareClassPicker, props);
    if (tree) tree.update(element);
    else tree = TestRenderer.create(element);
  });
};
const action = (label: string) => tree.root.findByProps({ label });
const choose = (value: string) => act(() => tree.root.findByType('select').props.onChange({ target: { value } }));
const press = (label: string) => act(async () => { action(label).props.onPress(); });

beforeEach(() => {
  mockUser = 'coach'; mockOrg = 'my-org'; mockEpoch = 0;
  read.mockReset(); jest.clearAllMocks();
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { body: {} } });
});
afterEach(() => {
  act(() => { tree.unmount(); });
  tree = undefined!;
  if (documentDescriptor) Object.defineProperty(globalThis, 'document', documentDescriptor);
  else Reflect.deleteProperty(globalThis, 'document');
});

it('offers a local download when the preview has no session or organization, without reading classes', async () => {
  mockUser = null; mockOrg = null;
  await refresh();
  expect(tree.root.findByProps({ role: 'status' }).children.join('')).toContain('Entre no Go Atleta');
  await press('Baixar jogada');
  expect(props.onDownload).toHaveBeenCalledTimes(1);
  expect(read).not.toHaveBeenCalled();
});

it('reads only the names and IDs in the active organization and checks one chosen class before continuing', async () => {
  read.mockResolvedValueOnce([{ id: 'access/a', name: 'Sub-18' }, { id: 'read-only', name: 'Sub-15' }])
    .mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  await refresh();
  expect(read).toHaveBeenCalledTimes(1);
  expect(read).toHaveBeenCalledWith('/classes?select=id,name&organization_id=eq.my-org&order=name.asc,id.asc&limit=250&offset=0', expect.any(Function));
  expect(action('Continuar').props.disabled).toBe(true);
  choose('read-only'); await press('Continuar');
  expect(props.onSelect).not.toHaveBeenCalled();
  expect(tree.root.findByProps({ role: 'alert' }).children).toContain('Você não tem permissão para compartilhar nesta turma.');
  expect(tree.root.findAllByProps({ value: 'read-only' })).toHaveLength(0);
  choose('access/a'); await press('Continuar');
  expect(read).toHaveBeenLastCalledWith('/rpc/court_share_can_manage?p_org=my-org&p_class=access%2Fa', expect.any(Function));
  expect(props.onSelect).toHaveBeenCalledTimes(1);
  expect(props.onSelect).toHaveBeenCalledWith({ org: 'my-org', classId: 'access/a' });
});

it('offers a retry for a failed read and a download for an empty organization', async () => {
  read.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([]);
  await refresh();
  expect(tree.root.findByProps({ role: 'alert' }).children).toContain('Não foi possível carregar as turmas.');
  await press('Tentar novamente');
  expect(tree.root.findByProps({ role: 'status' }).children).toContain('Nenhuma turma disponível nesta organização.');
  await press('Baixar jogada');
  expect(props.onDownload).toHaveBeenCalledTimes(1);
});

it.each(['organization', 'session generation'])('discards permission returned after the %s changes', async change => {
  let finish!: (value: boolean) => void;
  read.mockResolvedValueOnce([{ id: 'old-class', name: 'Turma anterior' }])
    .mockReturnValueOnce(new Promise<boolean>(resolve => { finish = resolve; })).mockResolvedValueOnce([]);
  await refresh();
  choose('old-class'); await press('Continuar');
  if (change === 'organization') { mockOrg = 'new-org'; await refresh(); }
  else mockEpoch++;
  await act(async () => { finish(true); });
  expect(props.onSelect).not.toHaveBeenCalled();
});
