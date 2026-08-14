type MemberIdentity = {
  userId: string;
  displayName: string;
};

export const getMemberDisplayLabel = (
  member: MemberIdentity,
  currentUserId: string | null | undefined
) => (currentUserId && member.userId === currentUserId ? "Você" : member.displayName);
