# Boss: design

| | |
|---|---|
| Status | Approved in brainstorm, awaiting implementation plan |
| Date | 2026-10-03 |
| Implements | RFC-0001 §6.4 plan stage (routing and budget), with the fast-LLM fallback from §6.8 |
| Defers | RFC §6.4 merge-stage dedupe, escalation round, and rollup pruning (self-improvement system) |
| Depends on | `@peons/core` `Planner` interface and `PathPlanner`; `@peons/schema` manifest; TypeSafe Jev API |

## 1. Purpose

The Boss decides which peons run for a change. Today the engine plans by path globs only. The Boss adds diff-signal triggers, an intent judgement from a decision model, hard rules that no model answer can override, and a peon-count budget. It is a second `Planner` implementation in a new package, `@peons/boss`, and the engine does not change.

Goals carried over from the RFC:

- Deterministic before probabilistic: paths, triggers, `always`, `never_skip` and the budget are code; the model is consulted only where globs cannot decide, and only when its answer can change the plan.
- Explain every decision: every planned, pruned or cut peon carries a reason string with the probability that produced it.
- Cheap enough for every agent iteration: one decision call of a few hundred tokens, skipped when the plan is already settled.
- No hard dependency on a single early-access vendor: Jev is one `DecisionProvider`; a fast LLM with forced structured output is another; the Boss works, degraded, with neither.

## 2. Decisions made in this brainstorm

| Decision | Choice | Why |
|---|---|---|
| Scope | Routing and budget only. Merge stays exact dedupe; no escalation round; no rollups. | Rollups belong to the deferred self-improvement system; escalation needs a security peon that does not exist. |
| Package | New `@peons/boss` implementing `Planner`, consumed by cli, mcp and action. | Core stays free of vendor SDKs; the seam built for this is used as intended. |
| Fallback | `DecisionProvider` interface with `JevDecisionProvider`, `LlmDecisionProvider` (Anthropic fast tier, forced tool) and `FakeDecisionProvider`. `auto` prefers Jev, falls through to the LLM once, then skips the decision step. | Intent routing survives a Jev outage; fixtures run against both so Jev's accuracy on routing is measured, not assumed (RFC Q6). |
| Triggers | Declared per peon in frontmatter as regexes over added lines. | Scales with the marketplace; a peon brings its own signals. |
| Questions | One Noul per peon plus one `risk` Score. No Choice questions. | Noul yields a probability that thresholds can use; Choice has a documented first-option bias in Jev 1.13. |
| State | File paths, statuses, added/removed line counts, trigger hits, intent text, peon catalog. Never file contents or diffs. | Keeps the state small and relevant, which Jev needs; sidesteps its counting weakness; bounds prompt-injection surface to the intent field. |
| Budget | `max_peons` count, not dollars. | A price table drifts; the count is what users reason about. |
| Intent source | `--intent` flag, else PR title and body (Action), else last commit message, else none. Truncated to 500 chars, redacted. | Agents know their intent and it is the highest-value signal. |

## 3. Jev facts the design relies on

From docs.typesafe.ai as of 2026-10-03:

- `POST https://api.typesafe.ai/v1/systemone`, `Authorization: Bearer <key>`. Body `{ state, model, questions }`; `state` is a string, object or array; `questions` is a map of id to `{ type, instructions, criteria? }`. All questions in a call are evaluated in parallel.
- Noul answer `{ type: "noul", noul: 0..1 }` with no confidence field. Score answer `{ type: "score", score, confidence, probabilities, legend }` over 2 to 10 ordered levels. Choice exists but is not used here.
- Model `jev-1.13.0`, aliases `jev-latest` and `jev-preview`. Limits: 32k tokens of state, 64k per request; input $0.042 per million tokens, output free; about 80 requests per second. JavaScript SDK `@typesafe-ai/sdk`, Node 20+, `TypeSafeClient`, `client.systemOne({ state, questions })`, key from `TYPESAFE_API_KEY`, SDK retries 429 and 529.
- Documented weaknesses: literal reading of instructions; cannot count or do arithmetic; accuracy falls with irrelevant state; adversarial text in state can steer answers; Choice leans to the first option; no text generation. Recommended confidence bands: act above about 0.85, confirm 0.6 to 0.85, do not act below 0.6.

## 4. Configuration

### 4.1 Peon frontmatter

One optional field, validated by `@peons/schema`:

```yaml
triggers: ["dangerouslySetInnerHTML", "\\bexec\\(", "process\\.env\\."]
```

Rules: each entry must compile as a JavaScript regular expression with no flags; at most 32 entries; each at most 200 characters; a regex that fails to compile is a manifest error. Matching is against added lines only (lines starting with `+` in a hunk, excluding the `+++` header), case-sensitive, one match per file is enough.

The existing `description` field is the text the decision model reads to judge relevance. The spec for peon authors: write it as what the reviewer catches, in one sentence.

### 4.2 Repo configuration

`peons.yaml` gains a `boss` block, all fields optional:

```yaml
boss:
  enabled: false                     # true: `peons run` behaves as `peons run --auto`
  provider: auto                     # auto | jev | llm
  model: jev-latest                  # Jev model id or alias
  budget: { max_peons: 4 }           # default 5
  always: [security]                 # added if configured; never pruned or cut
  never_skip: ["apps/billing/**"]    # a peon with a file under these globs cannot be pruned or cut
  thresholds: { dispatch: 0.7, prune: 0.15 }   # defaults shown
```

Validation: `dispatch` in (0.5, 1], `prune` in [0, 0.5), `max_peons` a positive integer, `always` names must be configured peons (else `CONFIG_INVALID`), `never_skip` globs follow the same containment rule as peon globs.

## 5. Decision state and questions

### 5.1 State

Built in code from the change set and config. Never contains file contents.

```json
{
  "intent": "Add idempotency key to booking creation",
  "files": [
    { "path": "apps/events/api/createBooking.ts", "status": "modified", "added": 31, "removed": 4 }
  ],
  "triggers_hit": [
    { "peon": "security", "pattern": "process\\.env\\.", "file": "apps/events/api/createBooking.ts" }
  ],
  "reviewers": [
    { "name": "a11y", "description": "WCAG 2.2 AA checks for React and HTML in JSX" },
    { "name": "react", "description": "React correctness and best practices for function components and hooks" }
  ]
}
```

- `intent`: resolved in order from `--intent`, the Action's PR title plus body, the last commit message (`git log -1 --format=%B`), else omitted. Passed through core's `redactText`, then truncated to 500 characters.
- `files`: every file in the change set, with `added` and `removed` counted in code from hunks. Capped at 200 files; beyond that the list is truncated to the 200 largest by `added + removed` and a `files_truncated: true` field is set.
- `reviewers`: every enabled configured peon, name and description only.
- The serialised state must stay under 8k tokens (estimated at 4 chars per token); if it does not after truncation, the decision step is skipped with reason `state too large`.

### 5.2 Questions

Sent in one call:

- For each enabled configured peon `P`, a Noul with id `peon:<name>`:
  - instructions: `Would the "<name>" reviewer find issues worth a human's time in this change? Judge only from the file paths, change sizes, triggers and intent. Reviewer: <description>.`
  - criteria: `true`: `The change plausibly touches what this reviewer checks.` / `false`: `The change is unrelated to what this reviewer checks, or touches only files it would not read.`
- One Score with id `risk`, instructions `How risky is this change if reviewed by nobody?`, criteria in order: `Docs, comments, tests or formatting only`, `Ordinary feature or fix in application code`, `Shared library, build, dependency or configuration change`, `Auth, payments, data deletion, secrets or infrastructure`.

`risk.score` is recorded in the plan for the user and the journal. It never adds or removes a peon, and it is not a tie-breaker: it is one value per change, identical for every peon, so it cannot separate two peons.

## 6. Plan algorithm

`BossPlanner.plan(config, changes, opts)` returns the same `Plan` type as `PathPlanner`, with a reason per file and a `reasons` summary per peon. Steps run in this order:

1. **Paths.** Delegate to `PathPlanner` with the same `names` and `allFiles` options. Reasons unchanged (`matched <glob>`).
2. **Triggers.** For every enabled peon with `triggers`, test each regex against each added line of each changed file's hunks. On the first match per file, add the peon with that file (if not already present) with reason `trigger /<pattern>/ matched <file>:<line>`.
3. **Decision.** Made only if at least one condition holds: some enabled configured peon is not yet planned; or the planned count exceeds `max_peons`. Otherwise skipped with reason `decision skipped: plan settled`. When made:
   - Unplanned peon with `peon:<name>` probability `p >= dispatch`: added with all changed files, reason `intent p=<p>`.
   - Planned peon with `p <= prune`: removed with reason `pruned p=<p>`, unless protected (step 4).
   - Otherwise no change; the probability is still recorded for the budget step and the plan output.
4. **Hard rules.** Every `always` peon is present (added with all changed files, reason `always`) when the change set is non-empty; a plan never contains a peon with no files. A peon is protected if it is in `always`, or if it was planned by paths or triggers (steps 1 and 2) and any of those planned files matches a `never_skip` glob. A peon dispatched by the decision step is protected only by `always`, because it is planned with every changed file and would otherwise be protected by any `never_skip` file in the change, letting the model bypass the budget. Protected peons are never pruned in step 3 and never cut in step 5.
5. **Budget.** If the plan holds more than `max_peons` peons: keep protected peons; rank the rest by probability descending, with peons that have no probability (decision skipped) ranked after those that do, ties broken by name; cut the remainder with reason `over budget (max <n>), p=<p>`.

Provider failure: if the decision provider throws after its own retries, step 3 is skipped with reason `decision unavailable: <message>` and steps 4 and 5 still run. An empty change set skips step 3 as settled. When step 5 cuts a peon that has no probability (the decision step did not run), the reason is `over budget (max <n>)` without a probability clause. The Boss never causes exit 2.

Output additions: `Plan.skipped` entries carry the prune or budget reason; a new optional `Plan.boss` field records `{ provider: "jev" | "llm" | "none", model?: string, risk?: number, probabilities: Record<string, number>, intent?: string, decisionSkipped?: string }`. This field is additive; `PathPlanner` leaves it undefined and nothing in core reads it.

## 7. Decision providers

```ts
type DecisionQuestion =
  | { type: "noul"; instructions: string; criteria?: { true: string; false: string } }
  | { type: "score"; instructions: string; criteria: string[] };
type DecisionAnswer =
  | { type: "noul"; noul: number }
  | { type: "score"; score: number; confidence: number; probabilities: Record<string, number> };
interface DecisionProvider {
  readonly kind: "jev" | "llm" | "fake";
  decide(state: unknown, questions: Record<string, DecisionQuestion>): Promise<{ answers: Record<string, DecisionAnswer>; model: string; usage: { inputTokens: number } }>;
}
```

- **`JevDecisionProvider`**: `@typesafe-ai/sdk` `TypeSafeClient`, key from `TYPESAFE_API_KEY` (constructor option for tests), `client.systemOne({ state, model, questions })`. Answers are validated with Zod and mapped to `DecisionAnswer`; a missing or malformed answer for a question id is a provider error. Accepts an injected client for tests.
- **`LlmDecisionProvider`**: core's Anthropic provider interface on the `fast` tier. One user message carrying the JSON state and the questions; a forced tool `report_answers` whose input schema is `{ answers: Record<id, DecisionAnswer> }` with `probabilities` required for scores; `confidence` is computed in code from the probabilities as `1 - normalisedEntropy`, matching the direction of Jev's definition (1 when all mass on one level, 0 when uniform). Accepts an injected client for tests.
- **`FakeDecisionProvider`**: scripted answers, records calls.
- **Selection** (`boss.provider`): `jev` or `llm` use that provider only. `auto` uses Jev when `TYPESAFE_API_KEY` is set; if Jev throws, it tries the LLM once; if that throws, the decision step is skipped. Missing Anthropic key with `provider: llm` or in the fallback path is a provider error, handled as above, not exit 2.

## 8. Surfaces

- **CLI**: `peons plan --auto [--intent <text>]` and `peons run --auto [--intent <text>]`. `boss.enabled: true` implies `--auto`; `--no-auto` disables it for one run. Plain `plan` output lists per peon: planned or skipped, files, reason, probability when present, and a footer `Boss: provider=jev model=jev-1.13.0 risk=1.30 decision=made|skipped (<reason>)`. The Ink run view shows the same footer line under the peon rows. The `agent` format is unchanged.
- **MCP**: `plan` and `run_peons` gain `auto?: boolean` and `intent?: string`.
- **Action**: input `auto`, tri-state: unset follows `boss.enabled` in `peons.yaml`, `"true"` or `"false"` override; intent is `<PR title>\n\n<PR body>`, routed through the same redaction and truncation as the CLI.
- **Skill template**: add one sentence: pass `--intent` with a one-line description of what you changed.
- **Journal**: the existing `plan` event's `reasons` already carry the reason strings; add `boss` (the `Plan.boss` object) to the event payload.

## 9. Boss fixtures and `peons boss-test`

Fixtures live in the repo at `.peons/boss-fixtures/<case>.yaml` and run against the repo's configured peons:

```yaml
intent: "Add alt text to hero image"
files:
  - { path: "apps/web/components/Hero.tsx", status: modified, added: 3, removed: 1 }
  - { path: "apps/web/lib/html.ts", status: added, added: 12, removed: 0,
      added_lines: ["el.innerHTML = raw"] }     # optional: lets step 2 (triggers) run
expect: [a11y]
reject: [react]
```

`peons boss-test [--provider jev|llm] [--runs N] [--min-precision f] [--min-recall f]` builds a synthetic change set from each fixture (no file contents, hunks synthesised so step 2 can run when a fixture provides `added_lines: [...]`), runs `BossPlanner`, and scores: recall is the fraction of `expect` peons planned; precision is planned peons that are in `expect` over all planned peons not in `always`; `reject` peons that were planned count as false positives. Defaults 0.85 and 0.7, exit 1 below. Output lists each fixture with planned peons and reasons. Running once per provider is how Jev's routing accuracy is compared with the LLM's.

A fixture may override `boss.max_peons` for its run (`boss: { max_peons: 1 }`), which is how a budget cut is exercised in a repo with few peons.

The repo ships six Boss fixtures covering: an a11y-only change (an `.html` file, so `react` is unplanned and the decision step runs), a react-only change (a `.ts` hook file reached by trigger), both, docs-only (expect none), a trigger hit outside paths, and a change that exceeds the budget (`max_peons: 1` with a react-specific intent, so the model must rank `react` above `a11y`). A fixture that exercises a pure prune is not reachable with two configured peons, because the decision step only runs when some peon is unplanned or the budget is exceeded; it will be added when a third launch peon exists.

## 10. Testing

- Schema: `triggers` validation (compiles, limits), `boss` block validation including `always` naming unknown peons.
- Boss package, all with `FakeDecisionProvider`: each of the five steps in isolation; decision call skipped when settled and made when not; dispatch and prune thresholds; `always` and `never_skip` protecting against prune and cut; budget ranking and tie-breaks; provider failure degrading to a deterministic plan; state construction (counts, truncation, redacted intent, token cap); question text for a known catalog.
- Jev adapter: injected client pins the exact `systemOne` argument (state, model, question map) and the answer mapping; malformed answer is an error.
- LLM adapter: injected Anthropic client pins the forced tool schema and the entropy-based confidence.
- Live smoke tests for both adapters, skipped without the respective key.
- Surface tests: `peons plan --auto` plain output with a fake provider; MCP `plan` with `auto`; the Action's intent assembly as a pure function.
- Boss fixtures: `peons boss-test` with the fake provider in the unit suite; live runs against Jev and the LLM are manual (`workflow_dispatch`), consistent with the no-cost CI rule.

## 11. Safety and cost

- The Boss only chooses which peons run. `always` and `never_skip` bound its worst case; it cannot read files, change findings or alter exit codes.
- `intent` is the only attacker-writable text in the state: redacted, truncated to 500 characters, placed as a fixed JSON field. File paths are also attacker-controlled in a PR but are names, not instructions.
- Cost: a few hundred state tokens plus one Noul per peon; at Jev prices thousandths of a cent per call; the LLM fallback under a cent. The call is skipped when it cannot change the plan.
- Rate limits: one call per run; no retries beyond the SDK's own.

## 12. Out of scope

Jev-assisted merge dedupe and ranking, the escalation round, rollup-based pruning (self-improvement system), per-repo threshold learning, hosted Boss workers, provider quotas, a `security` launch peon, Choice-based depth selection.
