import { useState } from "react";
import { useClassDiagnostic } from "../../../assistant/hooks/useClassDiagnostic";
import { Button } from "../../../ui/Button";
import { ClassProfileDetails } from "./ClassProfileDetails";

function OpenProfile({ organizationId, classId, onClose }: { organizationId: string; classId: string; onClose: () => void }) {
  const diagnostic = useClassDiagnostic(organizationId, classId);
  return <ClassProfileDetails visible onClose={onClose} diagnostic={diagnostic} organizationId={organizationId} classId={classId} />;
}
export function ClassProfileButton({ organizationId, classId }: { organizationId: string; classId: string }) {
  const [open, setOpen] = useState(false);
  return <>
    <Button label="Perfil da turma" variant="ghost" onPress={() => setOpen(true)} />
    {open ? <OpenProfile organizationId={organizationId} classId={classId} onClose={() => setOpen(false)} /> : null}
  </>;
}
