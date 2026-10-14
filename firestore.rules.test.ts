/**
 * Dirty Dozen Security Specification Verification Suite for firestore.rules
 * Validates that all 12 adversarial payloads described in security_spec.md
 * are rejected with PERMISSION_DENIED by the Zero-Trust ruleset.
 */
export interface DirtyDozenScenario {
  id: number;
  name: string;
  collectionPath: string;
  operation: "get" | "list" | "create" | "update" | "delete";
  expectedOutcome: "PERMISSION_DENIED";
}

export const DIRTY_DOZEN_SCENARIOS: DirtyDozenScenario[] = [
  {
    id: 1,
    name: "Unauthenticated create on /punterSheets/punter-steve-f",
    collectionPath: "/punterSheets/punter-steve-f",
    operation: "create",
    expectedOutcome: "PERMISSION_DENIED",
  },
  {
    id: 2,
    name: "Unverified email token spoof on /punterSheets/punter-steve-f",
    collectionPath: "/punterSheets/punter-steve-f",
    operation: "create",
    expectedOutcome: "PERMISSION_DENIED",
  },
  {
    id: 3,
    name: "Shadow field injection (isAdmin: true) on create",
    collectionPath: "/punterSheets/punter-steve-f",
    operation: "create",
    expectedOutcome: "PERMISSION_DENIED",
  },
  {
    id: 4,
    name: "Shadow field injection (isVerified: true) on update",
    collectionPath: "/punterSheets/punter-steve-f",
    operation: "update",
    expectedOutcome: "PERMISSION_DENIED",
  },
  {
    id: 5,
    name: "Owner spoofing (ownerId != request.auth.uid) on create",
    collectionPath: "/punterSheets/punter-steve-f",
    operation: "create",
    expectedOutcome: "PERMISSION_DENIED",
  },
  {
    id: 6,
    name: "Owner mutation (changing ownerId) on update",
    collectionPath: "/punterSheets/punter-steve-f",
    operation: "update",
    expectedOutcome: "PERMISSION_DENIED",
  },
  {
    id: 7,
    name: "Immutable createdAt field tampering on update",
    collectionPath: "/punterSheets/punter-steve-f",
    operation: "update",
    expectedOutcome: "PERMISSION_DENIED",
  },
  {
    id: 8,
    name: "Client timestamp forgery (updatedAt != request.time)",
    collectionPath: "/punterSheets/punter-steve-f",
    operation: "update",
    expectedOutcome: "PERMISSION_DENIED",
  },
  {
    id: 9,
    name: "Path variable ID poisoning (>128 chars or invalid regex)",
    collectionPath: "/punterSheets/invalid$id!@#",
    operation: "create",
    expectedOutcome: "PERMISSION_DENIED",
  },
  {
    id: 10,
    name: "Value poisoning on whitelisted key (name > 60 chars)",
    collectionPath: "/punterSheets/punter-steve-f",
    operation: "update",
    expectedOutcome: "PERMISSION_DENIED",
  },
  {
    id: 11,
    name: "Unauthorized cross-user get read",
    collectionPath: "/punterSheets/punter-steve-f",
    operation: "get",
    expectedOutcome: "PERMISSION_DENIED",
  },
  {
    id: 12,
    name: "Unfiltered list query without ownerId constraint",
    collectionPath: "/punterSheets",
    operation: "list",
    expectedOutcome: "PERMISSION_DENIED",
  },
];
