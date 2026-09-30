import { requestClassProfile, subscribeClassProfile } from "../class-pedagogical-profile";
import { getActiveOrganizationId, supabasePost } from "../../db/client";
import { assertSessionIdentity } from "../../auth/session";
jest.mock("../config", () => ({SUPABASE_URL:"https://test.invalid",SUPABASE_ANON_KEY:"public-test"}));
jest.mock("../../db/client", () => ({getActiveOrganizationId:jest.fn(),supabasePost:jest.fn()}));
jest.mock("../../auth/session", () => ({ getSessionIdentity: () => ({userId:"coach"}), getValidAccessToken: async () => "test-token", assertSessionIdentity:jest.fn() }));
const originalFetch = global.fetch;
beforeEach(() => { jest.clearAllMocks(); (getActiveOrganizationId as jest.Mock).mockResolvedValue("org"); (supabasePost as jest.Mock).mockResolvedValue(true); global.fetch=jest.fn(); });
afterAll(() => {global.fetch=originalFetch;});
test("a missing migration fails closed before sending data to a legacy assistant", async () => {
  (supabasePost as jest.Mock).mockRejectedValueOnce(new Error("missing function"));
  await expect(requestClassProfile("org","class",{action:"send",content:"Relato"})).rejects.toThrow("indisponível");
  expect(fetch).not.toHaveBeenCalled();
});
test("does not accept an ordinary assistant reply as a persistence confirmation", async () => {
  (fetch as jest.Mock).mockResolvedValue({ok:true,json:async () => ({reply:"Salvei!"})});
  await expect(requestClassProfile("org","class",{action:"load"})).rejects.toThrow("indisponível");
});
test("rejects wrong-scope responses before notifying subscribers", async () => {
  const listener=jest.fn(); const off=subscribeClassProfile(listener);
  (fetch as jest.Mock).mockResolvedValue({ok:true,json:async () => ({status:"saved",profile:{class_id:"other",organization_id:"org"},messages:[],revisions:[],suggestions:[]})});
  await expect(requestClassProfile("org","class",{action:"load"})).rejects.toThrow();
  expect(listener).not.toHaveBeenCalled(); off();
});
test("account and organization switches fence an in-flight response", async () => {
  (getActiveOrganizationId as jest.Mock).mockResolvedValueOnce("org").mockResolvedValueOnce("other");
  (fetch as jest.Mock).mockResolvedValue({ok:true,json:async () => ({status:"ready",profile:null,messages:[],revisions:[],suggestions:[]})});
  await expect(requestClassProfile("org","class",{action:"load"})).rejects.toThrow("organização mudou");
  expect(assertSessionIdentity).toHaveBeenCalled();
});
