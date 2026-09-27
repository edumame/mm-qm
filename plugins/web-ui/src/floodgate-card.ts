// Floodgate: Chinat's own decision model (an open Jev trained on River). Agents reach it through the
// `floodgate` skill (python3 skills/floodgate/floodgate.py); this card surfaces it on the welcome screen.
// Prompts only name the skill; the endpoint and token live with the skill, never in the browser bundle.
import { html, type TemplateResult } from "lit";

export interface FloodgatePrompt {
  label: string;
  prompt: string;
}

export const FLOODGATE_PROMPTS: readonly FloodgatePrompt[] = [
  {
    label: "Should I send this article to them?",
    prompt:
      "Use the floodgate skill (send) to decide whether I should send this article to Aditya. First run the floodgate status check. Article: SemIf: run Jev-style typed decisions fully in the browser with WebGPU, no server (https://github.com/TheoLeeCJ/SemIf-OpenJev). Person: Aditya, ML engineer on my hackathon team, building the Floodgate Chrome extension, which currently needs my laptop as a server. My reason: it could let the extension run the model without my laptop. Report SEND / HOLD / DON'T SEND with each probability and the model used, and if SEND, draft a one-line note to Aditya saying why it's relevant to him.",
  },
  {
    label: "Check a draft before I send it",
    prompt:
      "Use the floodgate skill to check whether this draft says the right thing for my goal. Goal: <what I want the message to achieve>. Draft: \"<paste the message>\". Ask one yes/no question per concern (on goal? unsupported claims? warm tone?), report each probability, then suggest a better version if needed.",
  },
  {
    label: "Is this page on task?",
    prompt:
      "Use the floodgate skill (distraction) to check whether this page is a distraction from my task. Page: <title or URL>. Task: <what I'm working on>. Report P(distraction) and what I should do.",
  },
  {
    label: "Pick the right option",
    prompt:
      "Use the floodgate skill (choice) to pick the best option. Context: <situation>. Question: <what to decide>. Options: <option 1>, <option 2>, <option 3>. Report the probability for each.",
  },
];

export function floodgateCard(onPick: (prompt: string) => void): TemplateResult {
  return html`
    <section class="floodgate-card" aria-label="Floodgate">
      <div class="floodgate-card-head">
        <span class="floodgate-card-mark" aria-hidden="true">⛩</span>
        <div>
          <div class="floodgate-card-title">Floodgate</div>
          <div class="floodgate-card-sub">Should I send this article to them? Your own judgment model, trained on River, answers with calibrated probabilities.</div>
        </div>
      </div>
      <div class="floodgate-card-actions">
        ${FLOODGATE_PROMPTS.map(
          (p) => html`<button type="button" class="floodgate-chip" @click=${() => onPick(p.prompt)}>${p.label}</button>`,
        )}
      </div>
    </section>
  `;
}
