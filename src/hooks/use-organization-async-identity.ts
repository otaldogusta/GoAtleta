import { useLayoutEffect, useRef, useState } from "react";

import {
  createOrganizationAsyncIdentity,
  invalidateOrganizationAsyncIdentity,
  rotateOrganizationAsyncIdentity,
  type OrganizationAsyncIdentity,
} from "../core/organization-async-identity";

export const useOrganizationAsyncIdentity = (organizationId: string) => {
  const [storedIdentity, setStoredIdentity] =
    useState<OrganizationAsyncIdentity>(() =>
      createOrganizationAsyncIdentity(organizationId),
    );
  const identity = rotateOrganizationAsyncIdentity(
    storedIdentity,
    organizationId,
  );

  if (identity !== storedIdentity) {
    setStoredIdentity(identity);
  }

  const identityRef = useRef(identity);
  useLayoutEffect(() => {
    identityRef.current = identity;
    return () => {
      identityRef.current = invalidateOrganizationAsyncIdentity(identity);
    };
  }, [identity]);

  return { identity, identityRef } as const;
};
