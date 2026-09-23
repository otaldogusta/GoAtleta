import type { ClassResponsible } from "../../../../api/class-responsibles";
import type { OrgMember } from "../../../../api/members";
import {
  applyMemberIdentitiesToClassStaff,
  applyMemberNamesToClassResponsibles,
  reconcileClassResponsiblesWithStaff,
} from "../class-responsible-identity";

const responsible: ClassResponsible = {
  classId: "class-1",
  userId: "user-1",
  className: "Hipopótamos",
  unit: "Capão da Imbuia",
  displayName: "Professor responsável",
  email: null,
  photoUrl: null,
};

const member: OrgMember = {
  organizationId: "org-1",
  userId: "user-1",
  roleLevel: 10,
  createdAt: "2026-08-20T00:00:00.000Z",
  displayName: "Gustavo Ribeiro",
  email: "gustavo@example.com",
  lastAccessAt: null,
};

describe("class responsible identity", () => {
  it("replaces the generic RPC fallback with the organization member name", () => {
    expect(applyMemberNamesToClassResponsibles([responsible], [member])).toEqual([
      { ...responsible, displayName: "Gustavo Ribeiro" },
    ]);
  });

  it("does not repeat the role label as a person's name when identity is missing", () => {
    expect(applyMemberNamesToClassResponsibles([responsible], [])).toEqual([
      { ...responsible, displayName: "Nome não informado" },
    ]);
  });

  it("keeps a resolved RPC identity instead of replacing it with a login fallback", () => {
    expect(
      applyMemberNamesToClassResponsibles(
        [{ ...responsible, displayName: "Gustavo Ribeiro" }],
        [{ ...member, displayName: "gustavorsantos753" }]
      )
    ).toEqual([{ ...responsible, displayName: "Gustavo Ribeiro" }]);
  });

  it("replaces an email-derived teacher login with the neutral missing-name label", () => {
    expect(
      applyMemberNamesToClassResponsibles(
        [
          {
            ...responsible,
            displayName: "brabinha123",
            email: "brabinha123@gmail.com",
          },
        ],
        [
          {
            ...member,
            displayName: "brabinha123",
            email: "brabinha123@gmail.com",
          },
        ]
      )
    ).toEqual([
      {
        ...responsible,
        displayName: "Nome não informado",
        email: "brabinha123@gmail.com",
      },
    ]);
  });

  it("hydrates support staff names from the member directory and reuses known photos", () => {
    expect(
      applyMemberIdentitiesToClassStaff({
        assignments: [
          {
            classId: "class-1",
            userId: "user-1",
            staffRole: "intern",
            displayName: "Estagiário(a)",
            photoUrl: null,
          },
        ],
        members: [member],
        responsibles: [{ ...responsible, photoUrl: "https://example.com/gustavo.jpg" }],
      })
    ).toEqual([
      {
        classId: "class-1",
        userId: "user-1",
        staffRole: "intern",
        displayName: "Gustavo Ribeiro",
        photoUrl: "https://example.com/gustavo.jpg",
      },
    ]);
  });

  it("keeps a resolved staff identity instead of replacing it with a login fallback", () => {
    expect(
      applyMemberIdentitiesToClassStaff({
        assignments: [
          {
            classId: "class-1",
            userId: "user-1",
            staffRole: "intern",
            displayName: "Ana Júlia",
            photoUrl: null,
          },
        ],
        members: [{ ...member, displayName: "anajulia123" }],
        responsibles: [],
      })
    ).toEqual([
      {
        classId: "class-1",
        userId: "user-1",
        staffRole: "intern",
        displayName: "Ana Júlia",
        photoUrl: null,
      },
    ]);
  });

  it("uses a neutral label for support staff whose only identity is the email login", () => {
    expect(
      applyMemberIdentitiesToClassStaff({
        assignments: [
          {
            classId: "class-1",
            userId: "user-1",
            staffRole: "intern",
            displayName: "brabinha123",
            photoUrl: null,
          },
        ],
        members: [
          {
            ...member,
            displayName: "brabinha123",
            email: "brabinha123@gmail.com",
          },
        ],
        responsibles: [],
      })
    ).toEqual([
      expect.objectContaining({ displayName: "Nome não informado" }),
    ]);
  });

  it("does not reuse a generic responsible label to name a staff card", () => {
    expect(
      applyMemberIdentitiesToClassStaff({
        assignments: [{
          classId: "class-1",
          userId: "user-1",
          staffRole: "head",
          displayName: "Professor responsável",
          photoUrl: null,
        }],
        members: [],
        responsibles: [responsible],
      })
    ).toEqual([
      expect.objectContaining({ displayName: "Nome não informado" }),
    ]);
  });

  it("keeps the identified head and demotes only a generic duplicate", () => {
    const genericHead = {
      classId: "class-1",
      userId: "legacy-head",
      staffRole: "head" as const,
      displayName: "Professor responsável",
      photoUrl: null,
    };
    const identifiedHead = {
      classId: "class-1",
      userId: "andre",
      staffRole: "head" as const,
      displayName: "André Muniz",
      photoUrl: null,
    };

    expect(applyMemberIdentitiesToClassStaff({
      assignments: [genericHead, identifiedHead],
      members: [],
      responsibles: [],
    })).toEqual([
      expect.objectContaining({ userId: "legacy-head", displayName: "Nome não informado", staffRole: "assistant" }),
      expect.objectContaining({ userId: "andre", displayName: "André Muniz", staffRole: "head" }),
    ]);
  });

  it("prefers one identified responsible over a generic duplicate in class summaries", () => {
    expect(applyMemberNamesToClassResponsibles([
      responsible,
      { ...responsible, userId: "andre", displayName: "André Muniz" },
    ], [])).toEqual([
      { ...responsible, userId: "andre", displayName: "André Muniz" },
    ]);
  });

  it("uses the reconciled current staff head in the class summary", () => {
    expect(reconcileClassResponsiblesWithStaff({
      responsibles: [{ ...responsible, displayName: "Nome não informado" }],
      assignments: [{
        classId: "class-1",
        userId: "staff-profile:andre",
        staffProfileId: "andre",
        isPlaceholder: true,
        staffRole: "head",
        displayName: "André Muniz",
        photoUrl: null,
      }],
      classes: [{ id: "class-1", name: "Hipopótamos", unit: "Capão da Imbuia" }],
    })).toEqual([{
      classId: "class-1",
      userId: "staff-profile:andre",
      className: "Hipopótamos",
      unit: "Capão da Imbuia",
      displayName: "André Muniz",
      email: null,
      photoUrl: null,
    }]);
  });
});
