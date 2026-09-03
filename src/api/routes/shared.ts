import { orgId as configOrgId, orgScope as configOrgScope } from "../../config.ts";
import type { Principal, ScopeId } from "../../types.ts";
import type { App } from "../app.ts";
import type { AuditEvent } from "../../audit/audit-log.ts";
import { adminStatusFromGrants } from "../../admin/admin-service.ts";
import type { ServerDeps } from "../deps.ts";
import type { ApiCtx } from "./route.ts";
import { headerValue, sendJson } from "../http.ts";

export const orgScope = (_deps?: unknown): string => configOrgScope();

export const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

export async function triggerHomeRefusal(
  app: Pick<App, "membershipControlsScope" | "managesScope">,
  input: { ownerScopeId: ScopeId; owner: string; ownerConsentedAt?: number },
): Promise<{ status: number; error: string; message: string } | null> {
  if (input.ownerConsentedAt !== undefined) {
    return { status: 400, error: "bad_request", message: "ownerConsentedAt is not accepted on this route" };
  }
  if (!(await app.membershipControlsScope(input.ownerScopeId))) return null;
  if (await app.managesScope(input.owner, input.ownerScopeId)) return null;
  return { status: 403, error: "forbidden", message: "the owner is not a member of that context" };
}

export function audit(deps: ServerDeps, e: Omit<AuditEvent, "at">): void {
  deps.auditLog?.record({ at: Date.now(), ...e });
}

export function adminActorFrom(ctx: Pick<ApiCtx, "req" | "deps" | "capability" | "actor">): Principal | null {
  if (ctx.capability) return { id: ctx.capability.actorId, type: "internal" };
  if (ctx.actor)
    return ctx.deps.admin?.resolveActor(`${ctx.actor.p}@${configOrgId()}`) ?? { id: ctx.actor.p, type: "internal" };
  return ctx.deps.admin?.resolveActor(headerValue(ctx.req, "x-admin-actor")) ?? null;
}

export async function authorizeAdmin(
  ctx: Pick<ApiCtx, "req" | "res" | "deps" | "capability" | "actor">,
  _scope: string,
): Promise<Principal | null> {
  const { res, deps } = ctx;
  if (!deps.admin) {
    sendJson(res, 404, { error: "not_found" });
    return null;
  }
  const grants = await deps.admin.listGrants();
  const actor = adminActorFrom(ctx);
  if (actor && adminStatusFromGrants(grants, actor.id).isAdmin) return actor;
  sendJson(res, 403, { error: "forbidden", message: "admin grant required for this scope" });
  return null;
}

export async function requireScopedAdmin(
  ctx: Pick<ApiCtx, "req" | "res" | "deps" | "capability" | "actor" | "url">,
): Promise<{ actor: Principal; scope: string } | null> {
  const scope = ctx.url.searchParams.get("scope") ?? "";
  if (!scope) {
    sendJson(ctx.res, 400, { error: "bad_request", message: "scope required" });
    return null;
  }
  const actor = await authorizeAdmin(ctx, scope);
  return actor ? { actor, scope } : null;
}

export { resolveCapabilityDestination } from "../capability-destination.ts";
