import type { Student } from "../../core/models";
import { supabasePost } from "../../db/client";
import { saveMyStudentProfile } from "../student-self-profile";

jest.mock("../../db/client", () => ({ supabasePost: jest.fn() }));
const post = jest.mocked(supabasePost);
const student = { id: "athlete", organizationId: "org", name: " Ana ",
  birthDate: "2008-01-01", cpfMasked: "***.***.***-25", classId: "class",
  membershipStatus: "active", financialStatus: "paid", studentUserId: "user",
  phone: "5511999990000", positionPrimary: "indefinido", positionSecondary: "indefinido",
} as Student;
beforeEach(() => post.mockReset());

it("projects only self-editable data and preserves a masked CPF", async () => {
  post.mockResolvedValue({ student_id: "athlete", organization_id: "org" });
  await saveMyStudentProfile(student);
  const body = post.mock.calls[0][1] as { p_profile: Record<string, unknown> };
  expect(body.p_profile.name).toBe("Ana");
  for (const key of ["classid", "organization_id", "student_user_id", "membership_status", "financial_status", "cpf_input"]) {
    expect(body.p_profile).not.toHaveProperty(key);
  }
});

it.each([null, [], {}, { student_id: "other", organization_id: "org" }, { student_id: "athlete", organization_id: "other" }])(
  "rejects success without the matching persisted receipt: %p", async receipt => {
    post.mockResolvedValue(receipt);
    await expect(saveMyStudentProfile(student)).rejects.toThrow("Não foi possível salvar");
  },
);

it("does not fall back to an unrestricted PATCH when the RPC fails", async () => {
  post.mockRejectedValue(new Error("STUDENT_SELF_ACCESS_DENIED"));
  await expect(saveMyStudentProfile(student)).rejects.toThrow("STUDENT_SELF_ACCESS_DENIED");
  expect(post).toHaveBeenCalledTimes(1);
});
