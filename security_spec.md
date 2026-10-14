# Security Specification (`security_spec.md`)

## 1. Data Invariants
1. **Default-Deny Global Catch-All**: All paths not explicitly matched (`/{document=**}`) deny all reads and writes (`allow read, write: if false;`).
2. **Verified Identity Invariant**: Every write (`create`, `update`, `delete`) to `/punterSheets/{sheetId}` requires an authenticated user (`request.auth != null`) with a verified email (`request.auth.token.email_verified == true`) or bootstrapped admin (`BobbyDazzler83@gmail.com`).
3. **Path Variable Hardening (`isValidId`)**: `sheetId` must be a valid string matching `^[a-zA-Z0-9_\-]+$` with length `<= 128`.
4. **Strict Schema & Anti-Update-Gap (`isValidPunterSheet`)**:
   - Required & allowed keys on `create`: `['punterId', 'name', 'role', 'ownerId', 'selectionsMap', 'jokerMap', 'createdAt', 'updatedAt']` enforced with both `.hasAll(...)` and `.hasOnly(...)`.
   - On `update`, `isValidPunterSheet(incoming())` wraps the entire update block, `affectedKeys().hasOnly(['name', 'role', 'selectionsMap', 'jokerMap', 'updatedAt'])` restricts mutable fields, and immutable fields (`punterId`, `ownerId`, `createdAt`) must remain unchanged (`incoming().ownerId == existing().ownerId && incoming().punterId == existing().punterId && incoming().createdAt == existing().createdAt`).
5. **Temporal Integrity**: `createdAt == request.time` on `create` and `updatedAt == request.time` on `create` and `update`.
6. **Query Enforcer (No Blanket Reads)**: `get` and `list` require `isSignedIn() && (resource.data.ownerId == request.auth.uid || isAdmin())`.

## 2. The "Dirty Dozen" Payloads
1. **Unauthenticated Write**: `auth = null` attempting `create` on `/punterSheets/punter-steve-f` -> `PERMISSION_DENIED`.
2. **Unverified Email Spoof**: `auth = { uid: 'u1', token: { email: 'BobbyDazzler83@gmail.com', email_verified: false } }` -> `PERMISSION_DENIED`.
3. **Shadow Field Injection on Create**: Payload includes extra key `isAdmin: true` -> `PERMISSION_DENIED` via `hasOnly`.
4. **Shadow Field Injection on Update**: Update modifies `isVerified: true` -> `PERMISSION_DENIED` via `affectedKeys().hasOnly(...)`.
5. **Owner Spoofing on Create**: `incoming().ownerId = 'other-uid'` when `request.auth.uid = 'u1'` -> `PERMISSION_DENIED`.
6. **Owner Mutation on Update**: Changing `ownerId` during `update` -> `PERMISSION_DENIED`.
7. **Immutable `createdAt` Tampering**: Changing `createdAt` on `update` -> `PERMISSION_DENIED`.
8. **Client Timestamp Forgery**: Setting `updatedAt` to a client string or past timestamp instead of `request.time` -> `PERMISSION_DENIED`.
9. **ID Poisoning**: Creating document with 200-char or special-char `sheetId` -> `PERMISSION_DENIED` via `isValidId(sheetId)`.
10. **Value Poisoning on Whitelisted Key**: Updating `name` with a 10,000-char string or boolean -> `PERMISSION_DENIED` via `isValidPunterSheet(incoming())`.
11. **Unauthorized Cross-User Read (`get`)**: Authenticated user `'u2'` reading document owned by `'u1'` -> `PERMISSION_DENIED`.
12. **Unfiltered `list` Query**: Authenticated user `'u2'` listing `/punterSheets` without `where('ownerId', '==', 'u2')` -> `PERMISSION_DENIED`.

## 3. Red Team Conflict Report
- **Identity Spoofing**: Blocked (`incoming().ownerId == request.auth.uid` on create; `existing().ownerId == request.auth.uid` and `incoming().ownerId == existing().ownerId` on update).
- **State Shortcutting**: Blocked via strict key allowlists and immutable field checks.
- **Resource Poisoning**: Blocked (`isValidId` <= 128 chars, `name` <= 60 chars, `role` <= 80 chars, `selectionsMap.size()` <= 100, `jokerMap.size()` <= 100).
- **Value Poisoning**: Blocked because `isValidPunterSheet(incoming())` wraps the entire `allow update` expression.
