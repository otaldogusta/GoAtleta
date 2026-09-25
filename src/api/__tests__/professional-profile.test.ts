import { supabaseRestPost } from "../rest";
import { getMyProfessionalProfile, saveMyProfessionalProfile } from "../professional-profile";

jest.mock("../rest", () => ({ supabaseRestPost: jest.fn() }));

const post = jest.mocked(supabaseRestPost);

beforeEach(() => post.mockReset());

it("maps the authenticated professional profile without exposing the full CPF", async () => {
  post.mockResolvedValueOnce([{ birth_date: "1990-05-12", cpf_masked: "***.***.***-09", rg: "123", address: "Rua A", gender_identity: "Homem" }]);
  await expect(getMyProfessionalProfile()).resolves.toEqual({
    birthDate: "1990-05-12",
    cpfMasked: "***.***.***-09",
    rg: "123",
    address: "Rua A",
    genderIdentity: "Homem",
  });
});

it("preserves the encrypted CPF when the masked value was not edited", async () => {
  post.mockResolvedValueOnce(null);
  await saveMyProfessionalProfile({ birthDate: "1990-05-12", cpfInput: null, rg: "123", address: "Rua A", genderIdentity: "Homem" });
  expect(post).toHaveBeenCalledWith("/rpc/save_my_professional_profile", {
    p_birth_date: "1990-05-12",
    p_cpf_input: null,
    p_rg: "123",
    p_address: "Rua A",
    p_gender_identity: "Homem",
  }, "return=minimal");
});
