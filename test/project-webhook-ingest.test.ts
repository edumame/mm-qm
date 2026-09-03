import "./support/auto-fake-sprites.ts";

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { createServer } from "../src/api/server.ts";
import { signRequest } from "../src/auth/source-auth.ts";
import { buildApp } from "../src/wiring.ts";
import { settle } from "./support/settle.ts";
import { testConfig } from "./support/test-config.ts";

const SECRET = "core-signing-secret".repeat(3);
const TOKEN = "project-ingest-token";

function sign(method: string, pathWithQuery: string, body: string): Record<string, string> {
  const ts = Math.floor(Date.now() / 1000);
  return {
    "content-type": "application/json",
    "x-timestamp": String(ts),
    "x-signature": signRequest(SECRET, ts, `${method}\n${pathWithQuery}\n${body}`),
  };
}

test("an outside service writes into a project through a bearer webhook that every member can open", async () => {
  const built = buildApp(testConfig({ dataDir: mkdtempSync(join(tmpdir(), "project-ingest-")) }));
  const server = createServer(built.app, { signingSecret: SECRET, webhookReceiver: built.webhookReceiver });
  server.listen(0);
  const base = `http://localhost:${(server.address() as AddressInfo).port}`;
  try {
    await built.app.upsertDirectory([
      { principalId: "owner", displayName: "Owner", type: "internal" },
      { principalId: "member", displayName: "Member", type: "internal" },
      { principalId: "outsider", displayName: "Outsider", type: "internal" },
    ]);
    const project = await built.app.createProject("owner", "Data review");
    assert.ok(project);
    assert.equal((await built.app.addProjectMember(project.id, "owner", "member")).status, "ok");

    const register = (owner: string, extra: Record<string, unknown> = {}) =>
      JSON.stringify({
        ownerScopeId: project.scopeId,
        owner,
        createdBy: owner,
        action: "Summarize the submitted data for the team.",
        verification: { scheme: "bearer", secret: TOKEN },
        ...extra,
      });
    const registerAs = (body: string) =>
      fetch(`${base}/v1/webhooks`, { method: "POST", headers: sign("POST", "/v1/webhooks", body), body });
    assert.equal((await registerAs(register("outsider"))).status, 403);
    assert.equal((await registerAs(register("member", { ownerConsentedAt: 1 }))).status, 400);
    assert.equal((await registerAs(register("member", { createdBy: "outsider" }))).status, 400);
    assert.equal((await registerAs(register("outsider", { createdBy: "member" }))).status, 403);
    assert.equal((await registerAs(register("member", { verification: { scheme: "bearer", secret: "short" } }))).status, 400);
    assert.equal((await built.app.listWebhooks()).length, 0);

    const created = await registerAs(register("member"));
    assert.equal(created.status, 200);
    const { webhook } = (await created.json()) as { webhook: { id: string; ownerScopeId: string } };
    assert.equal(webhook.ownerScopeId, project.scopeId);

    const payload = JSON.stringify({ experiment: "exp-42", accuracy: 0.913, notes: "candidate for release" });
    const post = (authorization?: string, idempotencyKey?: string) =>
      fetch(`${base}/v1/webhooks/incoming/${webhook.id}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(authorization ? { authorization } : {}),
          ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
        },
        body: payload,
      });
    assert.equal((await post()).status, 401);
    assert.equal((await post("Bearer wrong-token")).status, 401);
    assert.equal((await post(`Bearer ${TOKEN}`, "run-17")).status, 202);

    const projectSessions = async () =>
      (await built.sessions.listAll()).filter((session) => session.scopeId === project.scopeId);
    await settle(async () => (await projectSessions()).length === 1);
    const [session] = await projectSessions();
    assert.ok(session);
    assert.match(session.threadRef, new RegExp(`^webhook:${webhook.id}:`));
    assert.deepEqual(new Set(await built.sessions.participantsOf(session.id)), new Set(["owner", "member"]));
    const transcript = JSON.stringify(await built.sessions.getEntries(session.id));
    assert.match(transcript, /exp-42/);
    assert.match(transcript, /candidate for release/);
    assert.ok((await built.app.listSessions("owner")).some((candidate) => candidate.id === session.id));
    assert.ok((await built.app.listSessions("member")).some((candidate) => candidate.id === session.id));
    assert.ok(!(await built.app.listSessions("outsider")).some((candidate) => candidate.id === session.id));

    assert.equal((await post(`Bearer ${TOKEN}`, "run-17")).status, 200);
    assert.equal((await projectSessions()).length, 1);

    const discussion = await built.app.turn({
      surface: "web",
      actor: { externalId: "owner" },
      conversation: {
        kind: "group",
        channelRef: project.scopeId.slice("group:".length),
        threadRef: session.threadRef,
        audience: [],
      },
      text: "Looks like a real lift over baseline — anyone see a reason not to ship?",
    });
    assert.equal(discussion.status, "ok");
    assert.equal((await projectSessions()).length, 1);
    assert.match(JSON.stringify(await built.sessions.getEntries(session.id)), /reason not to ship/);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
});
