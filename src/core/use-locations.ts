import { useEffect, useState } from "react";
import { getUnitsByOrg } from "../db/sqlite";
import type { Unit } from "./models";

/**
 * Hook to fetch locations/units for the current organization
 */
export function useLocations(organizationId: string | undefined) {
  const [locations, setLocations] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!organizationId) {
      setLocations([]);
      setLoading(false);
      return;
    }

    let alive = true;
    setLoading(true);

    (async () => {
      try {
        const units = await getUnitsByOrg(organizationId);
        if (!alive) return;
        setLocations(
          units.map((u) => ({
            id: u.id,
            name: u.name,
            organizationId: u.organizationId,
            address: u.address ?? "",
            notes: u.notes ?? "",
            createdAt: u.createdAt,
          }))
        );
      } catch (error) {
        console.error("Error loading locations:", error);
        if (!alive) return;
        setLocations([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [organizationId]);

  return { locations, loading };
}
