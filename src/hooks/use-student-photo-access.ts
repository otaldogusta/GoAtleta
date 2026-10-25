import { useCallback, useEffect, useMemo, useState } from "react";

import { getStudentPhotoAccessUrl, getStudentPhotoObjectPath } from "../api/student-photo-storage";
import { getSessionIdentity } from "../auth/session";
import type { Student } from "../core/models";
import { getReadCacheGeneration } from "../db/client";

type PhotoStudent = Pick<Student, "id" | "photoUrl">;
type RequestedPhotoStudent = Pick<Student, "id" | "photoUrl" | "organizationId">;
type PhotoAccess = { sourceUrl: string; accessUrl: string | null };

// Callers supply only the current page/viewable cards and any open profile.
export function useStudentPhotoAccess(students: readonly RequestedPhotoStudent[], organizationId: string | null | undefined) {
  const identity = getSessionIdentity();
  const scope = JSON.stringify([identity.userId, identity.generation, getReadCacheGeneration(), organizationId]);
  const requestedSources = useMemo(() => new Map(students.filter((student) => student.organizationId === organizationId).map((student) => [student.id, student.photoUrl?.trim()])), [students, organizationId]);
  const [resolved, setResolved] = useState<{ scope: string; photos: Record<string, PhotoAccess> }>({ scope: "", photos: {} });

  useEffect(() => {
    if (!organizationId || !identity.userId) return;
    const controller = new AbortController();
    const candidates = students.filter((student) => student.organizationId === organizationId && student.photoUrl?.trim());
    let next = 0;
    const work = async () => {
      while (!controller.signal.aborted && next < candidates.length) {
        const student = candidates[next++];
        const sourceUrl = student.photoUrl!.trim();
        let accessUrl: string | null = null;
        try {
          accessUrl = await getStudentPhotoAccessUrl(sourceUrl, { organizationId, signal: controller.signal });
        } catch {
          // The initials remain usable when a single photo cannot be authorized.
        }
        if (controller.signal.aborted) return;
        setResolved((current) => ({
          scope,
          photos: {
            ...(current.scope === scope ? Object.fromEntries(Object.entries(current.photos).filter(([id, photo]) => requestedSources.get(id) === photo.sourceUrl)) : {}),
            [student.id]: { sourceUrl, accessUrl },
          },
        }));
      }
    };
    for (let worker = 0; worker < Math.min(6, candidates.length); worker += 1) void work();
    return () => controller.abort();
  }, [students, organizationId, scope, identity.userId, requestedSources]);

  const resolvePhotoUrl = useCallback((student: PhotoStudent) => {
    const sourceUrl = student.photoUrl?.trim();
    if (!sourceUrl) return null;
    if (requestedSources.get(student.id) !== sourceUrl) return null;
    if (!getStudentPhotoObjectPath(sourceUrl)) return sourceUrl;
    const photo = resolved.scope === scope ? resolved.photos[student.id] : null;
    return photo?.sourceUrl === sourceUrl ? photo.accessUrl : null;
  }, [resolved, scope, requestedSources]);

  const isPhotoResolving = useCallback((student: PhotoStudent) => {
    const sourceUrl = student.photoUrl?.trim();
    return Boolean(sourceUrl && getStudentPhotoObjectPath(sourceUrl) &&
      (resolved.scope !== scope || resolved.photos[student.id]?.sourceUrl !== sourceUrl));
  }, [resolved, scope]);

  return { resolvePhotoUrl, isPhotoResolving };
}
