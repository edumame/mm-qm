const participantsByThread = new Map<string, string[]>();

export function ownerOfWebThread(threadRef: string): string | null {
  if (!threadRef.startsWith("web:")) return null;
  const rest = threadRef.slice("web:".length);
  const i = rest.indexOf(":");
  return i > 0 ? rest.slice(0, i) : null;
}

export function rememberThreadParticipants(threadRef: string, participants: unknown): string[] {
  const known = Array.isArray(participants) ? participants.filter((p): p is string => typeof p === "string") : [];
  if (known.length) participantsByThread.set(threadRef, known);
  return threadAudience(threadRef);
}

export function threadAudience(threadRef: string): string[] {
  const audience = new Set(participantsByThread.get(threadRef) ?? []);
  const owner = ownerOfWebThread(threadRef);
  if (owner) audience.add(owner);
  return [...audience];
}
