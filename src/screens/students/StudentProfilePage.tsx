import { Text, View } from "react-native";
import type { ClassGroup, Student } from "../../core/models";
import { useAppTheme } from "../../ui/app-theme";
import { PersonProfilePage } from "../profiles/PersonProfilePage";
import { StudentFinanceTab } from "./StudentFinanceTab";
import { studentProfileAge } from "./application/student-profile";
import { getStudentMembershipStatusLabel } from "./application/student-operational-status";

type Props = {
  student: Student;
  classGroup: ClassGroup | null;
  organizationName: string;
  organizationId: string;
  canViewFinance: boolean;
  photoUri: string | null;
  onBack: () => void;
  onEdit: () => void;
  onEditPhoto: () => void;
  onMessage: () => void;
  onManageClass: () => void;
  onOpenFinance?: () => void;
};

export function StudentProfilePage({ student, classGroup, organizationName, organizationId, canViewFinance, photoUri, onBack, onEdit, onEditPhoto, onMessage, onManageClass, onOpenFinance }: Props) {
  const { colors } = useAppTheme();
  const age = studentProfileAge(student);
  const status = getStudentMembershipStatusLabel(student.membershipStatus);
  const fields = [
    { label: "Instituição", value: organizationName },
    { label: "Unidade", value: classGroup?.unit },
    { label: "Idade", value: age === null ? undefined : `${age} anos` },
    { label: "Responsável", value: student.guardianName || "Não informado" },
    { label: "Parentesco", value: student.guardianRelation },
    { label: "Contato do responsável", value: student.guardianPhone },
    { label: "Contato do atleta", value: student.phone },
  ];
  return <PersonProfilePage
    testID="student-profile"
    name={student.name}
    role="Atleta"
    context="Atletas"
    organizationName={organizationName}
    photoUri={photoUri}
    joinedAt={student.createdAt}
    joinedLabel="Atleta desde"
    classes={classGroup ? [classGroup] : []}
    onBack={onBack}
    onEditProfile={onEdit}
    onEditPhoto={onEditPhoto}
    onMessage={onMessage}
    aboutItems={fields}
    financeContent={canViewFinance ? <StudentFinanceTab organizationId={organizationId} studentId={student.id} onOpenFinance={onOpenFinance} /> : undefined}
    summary={<View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 20, marginTop: 20 }}>
      <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>{status}</Text>
      {age !== null ? <Text style={{ color: colors.muted, fontSize: 12 }}><Text style={{ color: colors.text, fontWeight: "700", fontSize: 18 }}>{age}</Text> anos</Text> : null}
      {classGroup ? <Text style={{ color: colors.muted, fontSize: 12 }}>{classGroup.name}</Text> : null}
    </View>}
    onManageClasses={onManageClass}
  />;
}
