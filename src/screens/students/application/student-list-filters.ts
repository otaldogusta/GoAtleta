import type { ClassGender, ClassGroup, Student } from "../../../core/models";

export type StudentProfileFilter = "regular" | "experimental";
export type StudentContactFilter = "with" | "without";
export type StudentMembershipScope = "active" | "inactive" | "all";

export const matchesStudentMembershipScope = (
  student: Student,
  scope: StudentMembershipScope,
) => scope === "all" || student.membershipStatus === scope;

export type StudentFilterExclusions = {
  profiles: StudentProfileFilter[];
  memberships: Student["membershipStatus"][];
  financials: Student["financialStatus"][];
  genders: ClassGender[];
  classes: string[];
  contacts: StudentContactFilter[];
};

export const createEmptyStudentFilterExclusions = (): StudentFilterExclusions => ({
  profiles: [],
  memberships: [],
  financials: [],
  genders: [],
  classes: [],
  contacts: [],
});

export const toggleStudentFilterExclusion = <T extends string>(
  values: T[],
  value: T,
) =>
  values.includes(value)
    ? values.filter((current) => current !== value)
    : [...values, value];

export const countStudentFilterExclusions = (
  exclusions: StudentFilterExclusions,
) =>
  Object.values(exclusions).reduce(
    (total, values) => total + values.length,
    0,
  );

export const matchesStudentFilterExclusions = (params: {
  student: Student;
  classGroup?: ClassGroup;
  exclusions: StudentFilterExclusions;
}) => {
  const { student, classGroup, exclusions } = params;
  const profile: StudentProfileFilter = student.isExperimental
    ? "experimental"
    : "regular";
  if (exclusions.profiles.includes(profile)) return false;
  if (exclusions.memberships.includes(student.membershipStatus)) return false;
  if (exclusions.financials.includes(student.financialStatus)) return false;
  if (
    exclusions.genders.length > 0 &&
    (!classGroup?.gender || exclusions.genders.includes(classGroup.gender))
  ) {
    return false;
  }
  if (exclusions.classes.includes(student.classId)) return false;

  const hasContact = Boolean(student.guardianPhone || student.phone);
  const contact: StudentContactFilter = hasContact ? "with" : "without";
  return !exclusions.contacts.includes(contact);
};
