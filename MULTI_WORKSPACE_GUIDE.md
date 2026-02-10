# Multi-Workspace (Organizations) — GoAtleta

## Overview

GoAtleta now supports **multi-workspace (multi-tenant)** architecture. Each workspace is called an **Organization**, and users can belong to multiple organizations with different roles.

## Key Concepts

### Organization
- A workspace that owns all classes, students, training plans, events, etc.
- Example: "Rede Esportes Pinhais", "Gustavo - Projeto Social"
- Users can create or be invited to join organizations

### Membership & Roles
- **Admin (role_level = 50)**: Full control over org (invite users, delete data, manage classes)
- **Professor (role_level = 10)**: Can create/manage classes, students, attendance, reports
- **Estagiário (role_level = 5)**: Assistant role (view/assist classes, limited permissions)

### Active Organization
- User's currently selected workspace
- Stored in AsyncStorage (`active-org-id`)
- Persists across app restarts
- **All data queries filter by active organization ID**

## Architecture

```
User (auth.users)
  ├─ Organization A (Pinhais)
  │   ├─ Member: User + role_level 50 (admin)
  │   ├─ Classes → organization_id = A
  │   └─ Students → organization_id = A
  └─ Organization B (Projeto Social)
      ├─ Member: User + role_level 50 (admin)
      ├─ Classes → organization_id = B
      └─ Students → organization_id = B
```

**Data Isolation:** User in Org A never sees data from Org B (enforced by Supabase RLS).

## Usage

### 1. Creating an Organization

**Via RPC (Supabase SQL Editor):**
```sql
select create_organization_with_admin('My Organization Name');
```

This will:
1. Create the organization
2. Add the calling user as admin (role_level = 50)
3. Return the new organization UUID

**Via App (Future PR):**
- Admin screen with "Create Organization" button
- Form: Organization name → calls RPC → auto-selects new org

### 2. Inviting Users to Organization

**Current (PR 1):**
Manually via SQL:
```sql
insert into organization_members (organization_id, user_id, role_level)
values (
  'org-uuid-here',
  'user-uuid-here',
  10  -- 5=estagiário, 10=professor, 50=admin
);
```

**Future (PR 4):**
- Admin generates invite code with role
- User claims code → joins org with that role

### 3. Switching Organizations

**App UI:**
- If user has >1 org: Org selector card appears at top of home screen
- Tap org name to switch
- Active org persists in AsyncStorage

**Programmatically:**
```typescript
import { useOrganization } from '../src/providers/OrganizationProvider';

function MyComponent() {
  const { organizations, activeOrganization, setActiveOrganizationId } = useOrganization();

  const switchToOrg = (orgId: string) => {
    setActiveOrganizationId(orgId);
    // All subsequent queries will filter by new orgId
  };

  return (
    <View>
      {organizations.map(org => (
        <Button key={org.id} onPress={() => switchToOrg(org.id)}>
          {org.name}
        </Button>
      ))}
    </View>
  );
}
```

### 4. Querying Data (App Code)

**Always filter by `activeOrganizationId`:**

```typescript
import { useOrganization } from '../src/providers/OrganizationProvider';
import { supabase } from '../src/api/supabase';

async function fetchClasses() {
  const { activeOrganizationId } = useOrganization();

  if (!activeOrganizationId) {
    throw new Error('No active organization selected');
  }

  const { data, error } = await supabase
    .from('classes')
    .select('*')
    .eq('organization_id', activeOrganizationId)
    .order('name');

  if (error) throw error;
  return data;
}
```

**Note:** After PR 3, all core tables will have `organization_id` column.

## Security (RLS Policies)

### organizations Table
- **SELECT:** User is a member of the org
- **INSERT:** Authenticated users can create orgs (become admin automatically)
- **UPDATE/DELETE:** Only creator or admin (role_level ≥ 50)

### organization_members Table
- **SELECT:** Members of same org can see all members
- **INSERT/UPDATE/DELETE:** Only admin (role_level ≥ 50)

**Test RLS:**
```sql
-- As User A (should return only orgs where A is member):
select * from get_my_organizations();

-- Try to see all orgs (should be blocked by RLS):
select * from organizations; -- Returns only your orgs

-- Try to add yourself to another org (should fail):
insert into organization_members (organization_id, user_id, role_level)
values ('someone-elses-org-uuid', auth.uid(), 50);
-- Error: RLS policy blocks insert
```

## Data Migration (PR 3)

When PR 3 is applied:
1. All existing data will be assigned to a "Default Organization"
2. All existing trainers become admin (role_level = 50) of default org
3. All tables get `organization_id` column (nullable → migrated → NOT NULL)
4. RLS policies updated to check org membership instead of `owner_id`

**Migration is safe:**
- Uses `if not exists` / `if exists` for idempotency
- Old `owner_id` columns remain (not deleted)
- Rollback possible if needed

## Common Patterns

### Check if user is admin
```typescript
const { activeOrganization } = useOrganization();
const isAdmin = activeOrganization?.role_level >= 50;

if (isAdmin) {
  // Show admin UI (invite users, delete classes, etc.)
}
```

### Refresh organizations list
```typescript
const { fetchOrganizations } = useOrganization();

// After creating new org or accepting invite:
await fetchOrganizations();
```

### Handle no active org
```typescript
const { activeOrganizationId, organizations } = useOrganization();

if (organizations.length === 0) {
  return <NoOrganizationsPlaceholder />;
}

if (!activeOrganizationId) {
  return <Loading />; // Shouldn't happen if auto-select logic works
}
```

## Troubleshooting

### "useOrganization must be used within OrganizationProvider"
- Ensure `<OrganizationProvider>` wraps your component tree
- Check `app/_layout.tsx` → `BootstrapAuthProviders` function

### Active org not persisting after restart
- Check AsyncStorage key: `active-org-id`
- Clear app cache and re-login

### User sees orgs from other users
- RLS policy issue → check Supabase policies
- Ensure migration was applied correctly

### Org selector not showing (but user has >1 org)
- Check `organizations.length > 1` condition in `app/index.tsx`
- Verify `fetchOrganizations()` is being called

## Future PRs

- **PR 2:** Locations (physical courts) separate from orgs
- **PR 3:** Migrate all tables to `organization_id`
- **PR 4:** Invite codes by organization + role
- **PR 5:** Class staff (professor can have multiple classes)
- **PR 6:** Events/tournaments calendar
- **PR 7:** Audit trail + coordination reports
- **PR 8:** Multi-sport support

---

**Status:** PR 1 implemented ✅  
**Next:** Apply migration to Supabase, test on dev environment
