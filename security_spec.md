# Security Specification — Un Millón de Piratas: Grand Line

## 1. Data Invariants
1. Every document ID in `users`, `pirates`, `worldEvents`, and `chatMessages` must match `^[a-zA-Z0-9_-]+$` and be <= 128 chars.
2. Private `users/{userId}` documents can only be read or written by the verified owner (`request.auth.uid == userId && request.auth.token.email_verified == true`).
3. Pirates in `/pirates/{pirateId}` must belong to the creator (`ownerId == request.auth.uid`), have `isPublic == true`, bounded stats (`1 <= strength, agility, cunning <= 20`), bounded strings/colors (`hatColor`, `accessoryColor`, `capeColor`), and immutable `ownerId`, `id`, `createdAt`, `race`, `hairStyle`, `hairColor`, `skinTone`, and `bodyBuild`.
4. World events in `/worldEvents/{eventId}` and chat messages in `/chatMessages/{messageId}` must have `authorId == request.auth.uid`, `isPublic == true`, `createdAt == request.time`, and are immutable after creation (except owner deletion).
5. All writes require verified authentication (`request.auth != null && request.auth.token.email_verified == true`).

## 2. Dirty Dozen Attack Payloads (Expected: PERMISSION_DENIED)
1. Unauthenticated write to `/pirates/p1`
2. Unverified email write to `/pirates/p1`
3. Shadow field `isAdmin: true` injected on `/pirates/p1` create
4. Identity spoofing `ownerId: "victim-uid"` on `/pirates/p1` create
5. Over-length `name` (33+ chars) or `dream` (121+ chars) on `/pirates/p1`
6. Invalid path ID `/pirates/bad$id`
7. Client-forged `createdAt` timestamp on `/pirates/p1`
8. Updating immutable `ownerId` on `/pirates/p1`
9. Updating another user's `/pirates/p1`
10. Blanket read of `/users/other-uid`
11. Modifying `/worldEvents/e1` after creation
12. Over-length `text` (281+ chars) in `/chatMessages/m1`
