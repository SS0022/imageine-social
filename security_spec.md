# Security Specification for ImaGenie

## 1. Data Invariants
- A **User** profile must belong to the authenticated user (`uid` matches `request.auth.uid`).
- A **Post** must be owned by a user (`userId` matches `request.auth.uid`).
- **Post status** can only transition through defined states. Once 'published' or 'failed', it should be immutable (except for system cleanup if applicable, but here we restrict user edits).
- **Timestamps** (`createdAt`, `updatedAt`, `scheduledAt`) must be valid. `createdAt` must match `request.time` on creation.
- **IDs** must be length-limited and follow specific patterns to prevent injection.

## 2. The "Dirty Dozen" Payloads (Red Team Test Cases)

1. **Identity Spoofing (Create User)**: Try to create a user profile with a different `uid` than the signed-in user.
2. **Identity Spoofing (Update Post)**: Try to change the `userId` of a post to a different user.
3. **Privilege Escalation**: Attempt to set an `isAdmin` field in the user profile (even though the app doesn't currently use it, we block it).
4. **State Shortcutting**: Change a post's status directly from `scheduled` to `published` without backend intervention (if we want to restrict this, though the app client-side does trigger it via backend).
5. **Timestamp Backdating**: Try to set a `createdAt` in the past manually.
6. **Resource Exhaustion (Large Content)**: Attempt to save a post with 1MB of text in the `content` field.
7. **Resource Poisoning (Invalid ID)**: Try to create a document with a 1KB string as the ID.
8. **Shadow Data Injection**: Add a field `verified: true` to a post document.
9. **Unauthorized List Query**: Attempt to query `posts` without a `where` clause for `userId`.
10. **Orphaned Record**: Create a post for a `userId` that doesn't have a matching user profile.
11. **PII Leak**: Attempt to read another user's profile (including email).
12. **Immutable Field Change**: Try to change the `createdAt` timestamp on an existing post.

## 3. Test Runner (Draft)
A `firestore.rules.test.ts` would normally be used with the Firebase Emulators. In this environment, we will apply the rules and trust the logic review.

