import { supabaseRestGet, supabaseRestPost } from "./rest";

export const setMyStudentPhoto = async (studentId: string, photoUrl: string | null) => {
  await supabaseRestPost("/rpc/set_my_student_photo", {
    p_student_id: studentId,
    p_photo_url: photoUrl,
  }, "return=minimal");
};

export const getStudentProfilePhoto = async (studentId: string, organizationId: string) => {
  const rows = await supabaseRestGet<{ photo_url: string | null }[]>(
    `/students?select=photo_url&id=eq.${encodeURIComponent(studentId)}&organization_id=eq.${encodeURIComponent(organizationId)}`
  );
  if (!rows.length) throw new Error("Student access unavailable");
  return rows[0].photo_url;
};
