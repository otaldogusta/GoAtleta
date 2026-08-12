import type { ClassGroup } from "../../../core/models";

const normalizeIdentityPart = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();

const genderLabel: Record<ClassGroup["gender"], string> = {
  feminino: "Feminino",
  masculino: "Masculino",
  misto: "Misto",
};

export const isHomonymousClass = (
  target: ClassGroup,
  classes: ClassGroup[]
) => {
  const targetName = normalizeIdentityPart(target.name);
  const targetUnit = normalizeIdentityPart(target.unit || "Sem unidade");
  return classes.some(
    (item) =>
      item.id !== target.id &&
      normalizeIdentityPart(item.name) === targetName &&
      normalizeIdentityPart(item.unit || "Sem unidade") === targetUnit
  );
};

export const getClassIdentityLabel = (
  target: ClassGroup,
  classes: ClassGroup[]
) =>
  isHomonymousClass(target, classes)
    ? `${target.name} · ${genderLabel[target.gender]}`
    : target.name;
