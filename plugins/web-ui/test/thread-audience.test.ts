import { test } from "node:test";
import assert from "node:assert/strict";
import { ownerOfWebThread, rememberThreadParticipants, threadAudience } from "../server/thread-audience.ts";

test("a web thread's owner is always in its audience", () => {
  assert.equal(ownerOfWebThread("web:alice:t1"), "alice");
  assert.equal(ownerOfWebThread("webhook:wh1:d1"), null);
  assert.deepEqual(threadAudience("web:alice:t1"), ["alice"]);
});

test("participants learned from session-state frames route nudges for webhook and cron threads", () => {
  assert.deepEqual(threadAudience("webhook:wh1:d1"), []);
  assert.deepEqual(new Set(rememberThreadParticipants("webhook:wh1:d1", ["alice", "bob"])), new Set(["alice", "bob"]));
  assert.deepEqual(new Set(threadAudience("webhook:wh1:d1")), new Set(["alice", "bob"]));
  assert.deepEqual(new Set(rememberThreadParticipants("web:alice:t2", ["bob"])), new Set(["alice", "bob"]));
});

test("a frame without participants keeps what was learned before", () => {
  rememberThreadParticipants("cron:c1:f1", ["carol"]);
  assert.deepEqual(rememberThreadParticipants("cron:c1:f1", undefined), ["carol"]);
  assert.deepEqual(rememberThreadParticipants("cron:c1:f1", [42]), ["carol"]);
});
