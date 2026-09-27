import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FLOODGATE_PROMPTS } from "../src/floodgate-card.ts";

// Floodgate is Chinat's River-trained decision model, shipped to agents as the `floodgate` skill
// (python3 skills/floodgate/floodgate.py). The web UI surfaces it on the welcome screen.

test("offers one-click Floodgate prompts that route through the floodgate skill", () => {
  assert.ok(FLOODGATE_PROMPTS.length >= 3);
  for (const p of FLOODGATE_PROMPTS) {
    assert.ok(p.label.length > 0 && p.label.length <= 40, `short button label: ${p.label}`);
    assert.match(p.prompt, /floodgate/i, "prompt must ask the agent to use the floodgate skill");
    assert.doesNotMatch(p.prompt, /Bearer|token|ngrok/i, "no secrets or endpoints in the browser bundle");
  }
  const labels = FLOODGATE_PROMPTS.map((p) => p.label.toLowerCase()).join(" | ");
  assert.match(labels, /draft/, "check a draft (say the right thing)");
  assert.match(labels, /on task/, "is this page on task");
});

test("welcome screen renders the Floodgate card", () => {
  const chat = readFileSync(new URL("../src/chat.ts", import.meta.url), "utf8");
  assert.match(chat, /floodgateCard\(/, "chat.ts must render floodgateCard() in the welcome view");
  const css = readFileSync(new URL("../src/shell.css", import.meta.url), "utf8");
  assert.match(css, /\.floodgate-card\b/, "shell.css must style .floodgate-card");
});

test("the Floodgate card shows on every empty chat, not only for brand-new users", () => {
  const chat = readFileSync(new URL("../src/chat.ts", import.meta.url), "utf8");
  const draw = chat.match(/function drawActiveChat\([^]*?\n  \}\n/)?.[0] ?? "";
  assert.ok(draw.length > 0, "drawActiveChat found");
  const emptyBranch = draw.slice(draw.indexOf("} else if (isNewUser)"), draw.indexOf("const tier"));
  assert.match(emptyBranch, /\} else \{[^]*floodgateCard\(/, "returning users with an empty chat must also get the card");
});
