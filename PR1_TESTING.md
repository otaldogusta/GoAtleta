# PR 1 — Multi-Workspace Foundation: Manual Testing Guide

## Prerequisites
- Supabase project with migration applied
- App built and running (web or mobile)
- At least 2 test users (or ability to create them)

## Test Scenarios

### ✅ Scenario 1: First-time User (No Organizations)

**Steps:**
1. Sign up a new user (User A)
2. Login with User A

**Expected Result:**
- User sees home screen with no organization selector
- `organizations` array is empty
- `activeOrganizationId` is null
- No errors in console

---

### ✅ Scenario 2: Create First Organization (Auto-select)

**Steps:**
1. User A logged in (from Scenario 1)
2. Open Supabase SQL Editor and run:
   ```sql
   select create_organization_with_admin('Rede Esportes Pinhais');
   ```
   (Replace with user A's auth.uid() or use RPC via app later)
3. Pull down to refresh app OR force-restart app

**Expected Result:**
- `organizations` array contains 1 org: "Rede Esportes Pinhais"
- `activeOrganizationId` is auto-set to that org's ID
- AsyncStorage key `active-org-id` contains the org UUID
- No org selector visible (only 1 org = auto-selected)
- Home screen loads normally

**Validation (Dev Tools):**
```javascript
// In console:
import AsyncStorage from '@react-native-async-storage/async-storage';
AsyncStorage.getItem('active-org-id').then(console.log); // Should print org UUID
```

---

### ✅ Scenario 3: Create Second Organization (Multi-select appears)

**Steps:**
1. User A still logged in
2. Create second org via RPC:
   ```sql
   select create_organization_with_admin('Gustavo - Projeto Social');
   ```
3. Refresh app (pull-to-refresh or restart)

**Expected Result:**
- `organizations` array contains 2 orgs
- Org selector card appears at top of home screen:
  - Shows: "Rede Esportes Pinhais" (or current active org name)
  - Shows: "Você tem acesso a 2 workspace(s). Toque para alternar."
  - Horizontal scroll with 2 buttons: one highlighted (active)
- Active org persists after restart

---

### ✅ Scenario 4: Switch Organization

**Steps:**
1. User A sees 2 orgs in selector
2. Tap on the non-active org button (e.g., "Gustavo - Projeto Social")
3. Observe UI changes

**Expected Result:**
- Selected org button becomes highlighted (primary color)
- `activeOrganizationId` updates immediately
- AsyncStorage updates with new org ID
- (In future PRs: classes/students lists will filter by new org)
- **No page reload** — context update is instant

**Validation:**
- Force-kill app and reopen
- Active org persists (same org selected)

---

### ✅ Scenario 5: Multi-User Isolation (Different Orgs)

**Steps:**
1. Create User B (sign up new account)
2. Create org for User B:
   ```sql
   select create_organization_with_admin('Org do User B');
   ```
3. Login as User B on different device/browser
4. Fetch orgs via RPC:
   ```sql
   select * from get_my_organizations() where user_id = auth.uid();
   ```

**Expected Result:**
- User B sees only their own org ("Org do User B")
- User B **cannot** see User A's orgs (Pinhais, Social)
- `get_my_organizations()` for User B returns only 1 row

---

### ✅ Scenario 6: RLS Policy Validation (Security)

**Steps:**
1. Login as User A
2. Try to query all organizations directly (via Supabase client or SQL):
   ```sql
   select * from organizations;
   ```

**Expected Result:**
- Query returns **only** orgs where User A is a member (2 orgs)
- Does NOT return User B's org
- RLS policy `organizations select member` is working

**Direct RLS Test (Supabase Dashboard):**
```sql
-- As User A:
select * from organization_members where user_id = auth.uid();
-- Should return 2 rows (role_level = 50 for both orgs)

-- Try to insert member for org you don't own (should fail):
insert into organization_members (organization_id, user_id, role_level)
values ('some-other-org-uuid', auth.uid(), 10);
-- Expected: RLS policy blocks (only admin role_level>=50 can insert)
```

---

### ✅ Scenario 7: Role Levels

**Preparation:**
1. User A has 2 orgs, both with role_level = 50 (admin)
2. Manually update one membership to role_level = 10 (professor):
   ```sql
   update organization_members
   set role_level = 10
   where organization_id = 'org-uuid-for-pinhais'
     and user_id = 'user-a-uuid';
   ```
3. Refresh app

**Expected Result:**
- User A still sees both orgs in selector
- `organizations` array includes `role_level` field
- User A can still switch between orgs
- (In future PRs: admin actions will be restricted if role < 50)

---

### ✅ Scenario 8: Offline → Online (AsyncStorage Persistence)

**Steps:**
1. User A logged in with active org = "Pinhais"
2. Enable airplane mode (or disable network)
3. Force-kill app
4. Reopen app (offline)
5. Re-enable network

**Expected Result:**
- App loads with active org = "Pinhais" (from AsyncStorage)
- Once online, `fetchOrganizations()` refreshes data
- No org switch happened due to network issues

---

### ✅ Scenario 9: Edge Case — Delete Organization

**Steps:**
1. User A has 2 orgs
2. Admin deletes one org via SQL:
   ```sql
   delete from organizations where id = 'org-uuid-to-delete';
   ```
3. User A refreshes app

**Expected Result:**
- `organizations` array now has 1 org
- If deleted org was active: app auto-selects the remaining org
- Org selector card disappears (only 1 org left)

---

### ✅ Scenario 10: Check Console for Errors

**Steps:**
1. Navigate through all previous scenarios
2. Monitor browser/device console

**Expected Result:**
- No React errors
- No "useOrganization must be used within OrganizationProvider" errors
- No uncaught promise rejections
- Fetch calls to `/rpc/get_my_organizations` succeed (201 or 200)

---

## Rollback Plan

If migration causes issues:

1. **Revert migration:**
   ```sql
   drop function if exists create_organization_with_admin(text);
   drop function if exists get_my_organizations();
   drop table if exists organization_members cascade;
   drop table if exists organizations cascade;
   ```

2. **Remove provider from app:**
   - Remove `<OrganizationProvider>` wrap in `app/_layout.tsx`
   - Remove import in `app/index.tsx`
   - Commit rollback

---

## Success Criteria (DoD)

- ✅ User can have 2+ workspaces and toggle between them
- ✅ Active org saved to AsyncStorage (survives app restart)
- ✅ Org selector shows on home if >1 org
- ✅ RLS blocks cross-org data leaks
- ✅ No console errors
- ✅ Provider wraps correctly (no context undefined errors)

---

## Next Steps (PR 2)

After PR 1 is stable:
- Add Locations table (physical courts)
- Assign locations to classes
- Keep org-level isolation intact
