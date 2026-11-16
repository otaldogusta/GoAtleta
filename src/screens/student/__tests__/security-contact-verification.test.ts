import { act, renderHook, waitFor } from "@testing-library/react-native";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { useSecurityContactVerification } from "../useSecurityContactVerification";
import { securityContactVerification } from "../../../api/security-contact-verification";
jest.mock("../../../api/security-contact-verification", () => ({ securityContactVerification: jest.fn() }));
jest.mock("../../../ui/save-toast", () => ({ useSaveToast: () => ({ showSaveToast: jest.fn() }) }));
const api = jest.mocked(securityContactVerification);
const empty = { email: null, verifiedAt: null, pendingEmail: null, retryAt: null };
function deferredStatus() {
  let resolve!: (value: Awaited<ReturnType<typeof securityContactVerification>>) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<Awaited<ReturnType<typeof securityContactVerification>>>((done, fail) => {
    resolve = done; reject = fail;
  });
  return { promise, resolve, reject };
}

// Exercise the actual profile binding and leave callback without mounting unrelated integrations.
const profile = ts.createSourceFile("profile.tsx", readFileSync(resolve(__dirname, "../../../../app/profile.tsx"), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let securityBinding: ts.VariableDeclaration | undefined;
let leaveCallback: ts.Expression | undefined;
const visit = (node: ts.Node) => {
  if (ts.isVariableDeclaration(node)) {
    if (ts.isObjectBindingPattern(node.name) && node.name.elements.some(element => element.name.getText(profile) === "savingSecurityContact")) securityBinding = node;
    if (node.name.getText(profile) === "leaveMobileProfile") leaveCallback = node.initializer;
  }
  ts.forEachChild(node, visit);
};
visit(profile);
if (!securityBinding || !leaveCallback) throw new Error("Profile security navigation callback not found");
const leaveCode = ts.transpileModule(`const ${securityBinding.getText(profile)}; return (${leaveCallback.getText(profile)});`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;
function tryLeaving(securityContact: ReturnType<typeof useSecurityContactVerification>, dirty = false, savingPassword = false) {
  const navigate = jest.fn();
  const confirm = jest.fn().mockResolvedValue(true);
  const scope = { securityContact, savingMobileProfile: false, athleteModalities: { saving: false }, savingPassword,
    mobileHasUnsavedChanges: dirty, allowProfileNavigation: { current: false }, confirm };
  const leave = new Function(...Object.keys(scope), leaveCode)(...Object.values(scope));
  leave(navigate);
  return { navigate, confirm };
}

beforeEach(() => { api.mockReset(); api.mockResolvedValue(empty); });
it("auto-confirms a complete pasted code once and does not loop after errors", async () => {
  api.mockResolvedValueOnce({ ...empty, pendingEmail: "contact@example.com" });
  const { result } = renderHook(() => useSecurityContactVerification("u", "login@example.com"));
  await waitFor(() => expect(result.current.pending).toBe(true));
  act(() => result.current.completeCode("1234"));
  expect(api).toHaveBeenCalledTimes(1);
  api.mockRejectedValueOnce(new Error("Código inválido"));
  await act(async () => {
    result.current.completeCode("1234 5678");
    result.current.completeCode("1234 5678");
  });
  expect(api).toHaveBeenLastCalledWith("verify", "contact@example.com", "12345678");
  expect(api).toHaveBeenCalledTimes(2);
  act(() => result.current.completeCode("12345678"));
  expect(api).toHaveBeenCalledTimes(2);
  api.mockResolvedValueOnce({ ...empty, email: "contact@example.com", verifiedAt: new Date().toISOString() });
  await act(async () => { result.current.completeCode("12345679"); });
  expect(result.current.verified).toBe(true);
});
it("requires server confirmation and keeps drafts after wrong codes", async () => {
  const { result } = renderHook(() => useSecurityContactVerification("u", "login@example.com"));
  await waitFor(() => expect(result.current.status).not.toBeNull());
  act(() => result.current.setDraft("contact@example.com"));
  api.mockResolvedValueOnce({ ...empty, pendingEmail: "contact@example.com" });
  await act(async () => { await result.current.run("request"); });
  expect(result.current.pending).toBe(true);
  expect(result.current.verified).toBe(false);
  act(() => result.current.setCode("12345678"));
  api.mockRejectedValueOnce(new Error("Código inválido"));
  await act(async () => { await result.current.run("verify"); });
  expect(result.current.draft).toBe("contact@example.com");
  expect(result.current.error).toBe("Código inválido");
  expect(result.current.verified).toBe(false);
  api.mockResolvedValueOnce({ ...empty, email: "contact@example.com", verifiedAt: new Date().toISOString() });
  await act(async () => { await result.current.run("verify"); });
  expect(result.current.verified).toBe(true);
  expect(result.current.pending).toBe(false);
});
it("rejects malformed or login email before sending", async () => {
  const { result } = renderHook(() => useSecurityContactVerification("u", "login@example.com"));
  await waitFor(() => expect(result.current.status).not.toBeNull());
  act(() => result.current.setDraft("invalid"));
  await act(async () => { await result.current.run("request"); });
  expect(api).toHaveBeenCalledTimes(1);
  act(() => result.current.setDraft("login@example.com"));
  expect(result.current.canRequest).toBe(false);
});

it("keeps controls busy during status reads while allowing clean exit or the existing draft confirmation", async () => {
  const status = deferredStatus();
  api.mockReturnValueOnce(status.promise);
  const { result } = renderHook(() => useSecurityContactVerification("u", "login@example.com"));
  expect(result.current.busy).toBe(true);
  expect(result.current.mutating).toBe(false);
  expect(result.current.canRequest).toBe(false);
  await act(async () => { await result.current.run("request"); });
  expect(api).toHaveBeenCalledTimes(1);

  const clean = tryLeaving(result.current);
  expect(clean.navigate).toHaveBeenCalledTimes(1);
  expect(clean.confirm).not.toHaveBeenCalled();
  const dirty = tryLeaving(result.current, true);
  expect(dirty.navigate).not.toHaveBeenCalled();
  expect(dirty.confirm).toHaveBeenCalledWith(expect.objectContaining({
    title: "Sair sem salvar?", confirmLabel: "Descartar alterações", cancelLabel: "Continuar editando",
  }));
  await act(async () => { status.resolve(empty); await status.promise; });
  expect(result.current.busy).toBe(false);
});

it.each(["request", "verify", "remove"] as const)("blocks leaving and repeated actions during %s, then releases the mutation guard", async (action) => {
  const { result } = renderHook(() => useSecurityContactVerification("u", "login@example.com"));
  await waitFor(() => expect(result.current.status).not.toBeNull());
  act(() => result.current.setDraft("contact@example.com"));
  const response = deferredStatus();
  api.mockReturnValueOnce(response.promise);
  let operation!: Promise<void>;
  act(() => { operation = result.current.run(action); void result.current.run(action); });
  expect(result.current.busy).toBe(true);
  expect(result.current.mutating).toBe(true);
  expect(api).toHaveBeenCalledTimes(2);
  for (const dirty of [false, true]) {
    const exit = tryLeaving(result.current, dirty);
    expect(exit.navigate).not.toHaveBeenCalled();
    expect(exit.confirm).not.toHaveBeenCalled();
  }
  await act(async () => { response.resolve(empty); await operation; });
  expect(result.current.busy).toBe(false);
  expect(result.current.mutating).toBe(false);
});

it("releases the mutation guard after a removal error while preserving the error contract", async () => {
  const { result } = renderHook(() => useSecurityContactVerification("u", "login@example.com"));
  await waitFor(() => expect(result.current.status).not.toBeNull());
  const response = deferredStatus();
  api.mockReturnValueOnce(response.promise);
  let operation!: Promise<void>;
  act(() => { operation = result.current.run("remove"); });
  expect(result.current.mutating).toBe(true);
  await act(async () => {
    response.reject(new Error("Falha ao remover"));
    await expect(operation).rejects.toThrow("Falha ao remover");
  });
  expect(result.current.mutating).toBe(false);
  expect(result.current.busy).toBe(false);
});

it.each(["status", "request"] as const)("ignores the old account's pending %s after identity changes", async (action) => {
  const previous = deferredStatus();
  if (action === "status") api.mockReturnValueOnce(previous.promise);
  const { result, rerender } = renderHook(({ userId }) => useSecurityContactVerification(userId, "login@example.com"), { initialProps: { userId: "first" } });
  let operation: Promise<void> | undefined;
  if (action === "request") {
    await waitFor(() => expect(result.current.status).not.toBeNull());
    act(() => result.current.setDraft("first@example.com"));
    api.mockReturnValueOnce(previous.promise);
    act(() => { operation = result.current.run("request"); });
    expect(result.current.mutating).toBe(true);
  }
  const current = deferredStatus();
  api.mockReturnValueOnce(current.promise);
  rerender({ userId: "second" });
  expect(result.current.mutating).toBe(false);
  expect(result.current.busy).toBe(true);
  await act(async () => { previous.resolve({ ...empty, pendingEmail: "first@example.com" }); await operation; });
  expect(result.current.status).toBeNull();
  expect(result.current.draft).toBe("");
  expect(result.current.busy).toBe(true);
  expect(result.current.mutating).toBe(false);
  await act(async () => { current.resolve(empty); await current.promise; });
  act(() => result.current.setDraft("second@example.com"));
  await act(async () => { await result.current.run("request"); });
  expect(api).toHaveBeenLastCalledWith("request", "second@example.com", "");
});

it("still blocks profile exit while the password is being saved", async () => {
  const { result } = renderHook(() => useSecurityContactVerification("u", "login@example.com"));
  await waitFor(() => expect(result.current.status).not.toBeNull());
  const exit = tryLeaving(result.current, false, true);
  expect(exit.navigate).not.toHaveBeenCalled();
  expect(exit.confirm).not.toHaveBeenCalled();
});
