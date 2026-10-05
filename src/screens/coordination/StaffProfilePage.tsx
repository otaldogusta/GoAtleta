import { useEffect, useState } from "react";
import { getInstitutionLocation, getMemberJoinedAt } from "../../api/staff-profile-meta";
import { PersonProfilePage, type PersonProfilePageProps } from "../profiles/PersonProfilePage";

type Props = PersonProfilePageProps & {
  organizationId?: string;
  userId?: string;
};

export function StaffProfilePage({ organizationId, userId, ...props }: Props) {
  const [location, setLocation] = useState<string | null>(null);
  const [memberJoinedAt, setMemberJoinedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!organizationId) return;
    let current = true;
    void getInstitutionLocation(organizationId)
      .then(value => { if (current) setLocation(value); })
      .catch(() => { if (current) setLocation(null); });
    if (!props.joinedAt && userId) {
      void getMemberJoinedAt(organizationId, userId)
        .then(value => { if (current) setMemberJoinedAt(value); })
        .catch(() => { if (current) setMemberJoinedAt(null); });
    }
    return () => { current = false; };
  }, [organizationId, userId, props.joinedAt]);

  return <PersonProfilePage {...props} locationLabel={location} joinedAt={props.joinedAt ?? memberJoinedAt ?? undefined} />;
}
