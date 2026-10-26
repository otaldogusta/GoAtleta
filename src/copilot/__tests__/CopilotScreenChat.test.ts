import { act, fireEvent, render } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createElement, useEffect } from 'react';
import { UnifiedAssistantProvider, useUnifiedAssistant } from '../../assistant/UnifiedAssistantProvider';
import { requestAssistantConversation } from '../../api/ai';
import { buildOperationalContext } from '../operational-context';
import { CopilotScreenChat } from '../components/CopilotScreenChat';

let mockUser = 'coach';
let mockOrg = 'org';
let mockRole = 50;
let sequence = 0;
const mockRouter = { push: jest.fn(), replace: jest.fn() };
const mockConfirm = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, usePathname: () => '/classes' }));
jest.mock('../../auth/auth', () => ({ useAuth: () => ({ session: { user: { id: mockUser } } }) }));
jest.mock('../../providers/organization-context', () => ({ useOrganization: () => ({
  activeOrganization: { id: mockOrg, role_level: mockRole },
  organizations: [{ id: mockOrg, role_level: mockRole }], isLoading: false,
}) }));
jest.mock('../../ui/confirm-dialog', () => ({ useConfirmDialog: () => ({ confirm: mockConfirm }) }));
jest.mock('../../api/ai', () => ({ requestAssistantConversation: jest.fn() }));
jest.mock('../../db/seed', () => ({ getClasses: jest.fn(async () => []) }));
jest.mock('../../ui/app-theme', () => ({ useAppTheme: () => ({ colors: {
  text: '#111827', primaryText: '#ffffff', primaryBg: '#0f172a', card: '#ffffff',
  background: '#ffffff', border: '#e5e7eb', muted: '#64748b',
} }) }));
jest.mock('../../assistant/components/AssistantComposer', () => ({ AssistantComposer: (props: { value: string; onChangeText: (value: string) => void }) =>
  jest.requireActual('react').createElement(jest.requireActual('react-native').TextInput, { accessibilityLabel: 'Mensagem', value: props.value, onChangeText: props.onChangeText }),
}));
jest.mock('../../assistant/components/AssistantConversationScroll', () => ({ AssistantConversationScroll: ({ children }: { children: unknown }) => children }));
jest.mock('../../assistant/components/AttendanceDestinationDialog', () => ({ AttendanceDestinationDialog: () => null }));
jest.mock('../../assistant/components/AssistantClassSelector', () => ({ AssistantClassSelector: () => null }));
jest.mock('../../assistant/components/AssistantHistory', () => ({ AssistantHistory: () => null }));
jest.mock('../../assistant/components/AssistantPending', () => ({ AssistantPending: () => null }));
jest.mock('../../assistant/components/AssistantTrainingDraftCard', () => ({ AssistantTrainingDraftCard: () => null }));
jest.mock('../../assistant/components/AssistantWelcome', () => ({ AssistantWelcome: () => null }));

const snapshot = buildOperationalContext({
  screen: 'classes', contextTitle: 'Turmas', contextSubtitle: '', signals: [], selectedSignalId: null,
  regulationUpdates: [], regulationRuleSets: [], history: [],
  operationalFacts: [{ key: 'class_records_pending', label: 'Relatórios pendentes', value: 3 }],
}).snapshot;
let current!: NonNullable<ReturnType<typeof useUnifiedAssistant>>;
const noAction = () => undefined;
function Capture() {
  const value = useUnifiedAssistant()!;
  useEffect(() => { current = value; }, [value]);
  return null;
}
function Fixture({ revision = 0 }: { revision?: number }) {
  void revision;
  return createElement(UnifiedAssistantProvider, {
    key: JSON.stringify([mockUser, mockOrg]), userId: mockUser, organizationId: mockOrg,
    snapshot, lesson: null, open: true, toggle: noAction,
  }, createElement(Capture), createElement(CopilotScreenChat, {
    snapshot, modelPreference: 'auto', onModelPreferenceChange: noAction,
    onBusyChange: noAction, onClose: noAction, historyOpen: false, onCloseHistory: noAction,
  }));
}
const settle = async () => { await act(async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); }); };
const mount = async () => {
  const screen = render(createElement(Fixture));
  await settle();
  act(() => current.chat.restore({ messages: [
    { role: 'user', content: 'O que devo revisar?' },
    { role: 'assistant', content: '- Revisar relatórios pendentes' },
  ], input: 'Texto inicial' }));
  await settle();
  return screen;
};
const openConfirmation = (screen: Awaited<ReturnType<typeof mount>>) => {
  fireEvent.press(screen.getByText('Revisar relatórios pendentes'));
  expect(mockConfirm).toHaveBeenCalledTimes(1);
  return mockConfirm.mock.calls[0][0].onConfirm as () => void;
};
beforeEach(async () => {
  jest.clearAllMocks(); await AsyncStorage.clear();
  mockUser = `coach-${++sequence}`; mockOrg = `org-${sequence}`; mockRole = 50;
});

test('confirmation remembers the latest typed draft and selected history after rerenders', async () => {
  const screen = await mount();
  const confirm = openConfirmation(screen);
  const previousHistory = current.history.id;
  fireEvent.changeText(screen.getByLabelText('Mensagem'), 'Texto atualizado');
  fireEvent.changeText(screen.getByLabelText('Mensagem'), 'Texto mais recente');
  act(() => current.history.newConversation());
  await settle();
  expect(current.history.id).not.toBe(previousHistory);
  const remember = jest.spyOn(current.chat, 'remember');
  act(() => confirm());
  expect(remember).toHaveBeenCalledWith(current.history.id);
  expect(current.chat.input).toBe('Texto mais recente');
  expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/coord/management', params: {
    assistantSection: 'reports', assistantVisit: expect.any(String),
  } });
});

test('busy replies disable new navigation and an older confirmation cannot remember or navigate', async () => {
  const screen = await mount();
  const confirm = openConfirmation(screen);
  let finish!: (value: unknown) => void;
  jest.mocked(requestAssistantConversation).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  let pending!: Promise<void>;
  act(() => { pending = current.chat.send('Revisar agora'); });
  expect(current.chat.busy).toBe(true);
  mockConfirm.mockClear();
  fireEvent.press(screen.getByText('Revisar relatórios pendentes'));
  expect(mockConfirm).not.toHaveBeenCalled();
  const remember = jest.spyOn(current.chat, 'remember');
  act(() => confirm());
  expect(remember).not.toHaveBeenCalled(); expect(mockRouter.push).not.toHaveBeenCalled();
  await act(async () => { finish({ reply: 'Concluído' }); await pending; });
});

test.each(['permission', 'unmount'] as const)('a pending confirmation keeps the %s guard', async mode => {
  const screen = await mount();
  const confirm = openConfirmation(screen);
  if (mode === 'permission') { mockRole = 10; screen.rerender(createElement(Fixture, { revision: 1 })); await settle(); }
  else screen.unmount();
  const remember = jest.spyOn(current.chat, 'remember');
  act(() => confirm());
  expect(remember).not.toHaveBeenCalled(); expect(mockRouter.push).not.toHaveBeenCalled();
});

test.each(['user', 'organization'] as const)('changing %s isolates the draft and invalidates an older navigation confirmation', async scope => {
  const screen = await mount();
  const confirm = openConfirmation(screen);
  fireEvent.changeText(screen.getByLabelText('Mensagem'), 'Texto privado');
  if (scope === 'user') mockUser = `other-${mockUser}`;
  else mockOrg = `other-${mockOrg}`;
  screen.rerender(createElement(Fixture, { revision: 1 }));
  await settle();
  expect(current.chat.messages).toEqual([]); expect(current.chat.input).toBe('');
  act(() => confirm());
  expect(mockRouter.push).not.toHaveBeenCalled();
});
