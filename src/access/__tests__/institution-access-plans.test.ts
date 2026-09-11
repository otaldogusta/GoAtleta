import { getPreviewAccessOrganizations, getPreviewInstitutionAccessPlans, getPreviewInstitutionModalities } from "../institution-access-plans";

describe("institution access plan preview catalog", () => {
  it("keeps institution-owned plans outside the screen", () => {
    const plans = getPreviewInstitutionAccessPlans("Rede Esportes Pinhais");
    expect(plans).toHaveLength(3);
    expect(plans[0]).toMatchObject({ billingDay: 10, lateFeePercent: 2, modalities: ["Vôlei de quadra"] });
  });

  it("does not invent plans for institutions without a configured preview", () => {
    expect(getPreviewInstitutionAccessPlans("Outra instituição")).toEqual([]);
  });

  it("shows the local institution catalog on focus and filters it by query", () => {
    expect(getPreviewAccessOrganizations("")).toHaveLength(3);
    expect(getPreviewAccessOrganizations("rede")).toEqual([
      expect.objectContaining({ name: "Rede Esportes Pinhais" }),
    ]);
  });

  it("shows modalities configured by each institution without inferring them from plan names", () => {
    expect(getPreviewInstitutionModalities("Rede Esportes Pinhais")).toEqual([
      "Vôlei de quadra",
      "Vôlei de praia",
    ]);
  });
});
