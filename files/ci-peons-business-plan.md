# ci-peons

Press release, elevator pitch and business plan. September 2026. Draft, numbers are assumptions unless sourced.

---

## Press release

**ci-peons launches: open source, specialised AI code reviewers that teams write as files and coding agents can call themselves**

BARCELONA, [date]. ci-peons today released an open source toolkit that replaces the single generic AI code reviewer with a set of small, specialised reviewers called peons. A peon is a markdown file: it declares what it checks, which folders it applies to, what team and feature context it should read, and it ships with test fixtures that prove it flags the right things and stays quiet on the rest.

Peons run in three places with one engine. As a GitHub Action, they gate pull requests. As a CLI, engineers run them against staged changes before committing. And because the CLI is designed for machines first, coding agents such as Claude Code, Cursor and Codex can call a single peon mid-task, get an answer in seconds for a few cents, and fix the finding before a human ever sees the PR.

"Every reviewer on the market runs one big pass over the diff and then asks you to tune YAML until it stops being noisy," said Dan Neciu, creator of ci-peons and author of Real-World Next.js. "We wanted a reviewer that knows this folder belongs to the events team, that there was a double-booking incident in July, and that a test already covers the thing it was about to flag. And we wanted an agent to be able to ask for just the accessibility reviewer, not the whole committee."

ci-peons launches with five peons for frontend teams: accessibility, React best practices, Next.js App Router, Core Web Vitals and TypeScript strictness. Any GitHub repository can publish a peon, and `peons add github:org/repo/name` installs one with a content hash pinned in a lockfile. Teams can generate a first draft of their own peon from six months of their existing pull request review comments with `peons create --from-reviews`.

The core is MIT licensed and bring-your-own-API-key. A paid Team tier adds private registries, organisation-wide peon inheritance, hosted runs and cross-repository insights.

ci-peons is available today at [url]. Documentation, the public registry and the launch peons are at [url].

Contact: [email]

---

## Elevator pitch

**Ten seconds.** ci-peons is npm for code reviewers. Small, specialised AI reviewers you install per folder, test like code, run in CI, and let your coding agents call directly.

**Thirty seconds.** Teams are shipping AI-written code faster than they can review it, and every AI reviewer on the market is one generic pass that is either noisy or costs $20 a PR. ci-peons splits review into peons: reviewer files scoped to paths, loaded with the team's ADRs, incidents and review history, and shipped with fixtures that measure their precision. They run as a GitHub Action, as a CLI, and as a tool coding agents call mid-task for cents. It is open source and bring-your-own-key. We make money on private registries, org-wide standards and insights.

**One line for a developer.** `peons run a11y --scope staged` and your agent fixes the findings before you open the PR.

---

## Business plan

### 1. Summary

ci-peons is an open source platform for specialised, testable AI code review. The core (CLI, GitHub Action, public registry) is free and uses the customer's own model API key. Revenue comes from a Team tier for private registries, organisation inheritance, hosted execution and insights, an Enterprise tier, and verified listings for tool vendors. Year one is bootstrapped inside Venceda SL. A $1.5M seed is raised at the end of 2027 only if the open source funnel hits 5,000 repositories and 50 paying teams.

### 2. Problem

- 41% of new code is AI-generated and AI-assisted PRs carry roughly 10.8 issues each against 6.5 for human-written code (CodeRabbit Series C materials, August 2026).
- Hosted reviewers (CodeRabbit, Greptile, GitHub Copilot review, Cursor Bugbot) run one generic pass over the diff. Independent evaluations consistently report that all of them are too chatty out of the box and need weeks of configuration.
- Anthropic's Code Review runs specialised agents in parallel but costs $15 to $25 per PR, takes around 20 minutes, and is limited to Team and Enterprise plans.
- None of the reviewers carry team or feature context: who owns the folder, which incident shaped it, what the ADR decided, what the tests already cover. That gap is the root cause of most noise.
- Coding agents need a reviewer they can call for one concern, quickly and cheaply, while working. The existing CLIs run the full review and take 7 to 30 minutes.

### 3. Product

**Peon.** A markdown file with frontmatter: name, description, default path globs, severity policy, permissions (which tools and globs it may read), a context declaration (team, docs, incidents, review history, tests) and a checklist. Ships with `fixtures/should-flag` and `fixtures/should-pass`.

**Engine.** One TypeScript core: peon loading, path scoping, context assembly per changed-file cluster, provider adapters (Anthropic, OpenAI, Google, OpenRouter, local), output formatters (agent markdown, JSON, SARIF, GitHub review comments). Content-hash caching so re-runs are free.

**Surfaces.**
- CLI: `peons list`, `peons run [names] --scope staged|branch --format agent|json|sarif`, `peons test`, `peons create --from-reviews`, `peons init`, `peons add`.
- GitHub Action: wraps the CLI, posts inline review comments and SARIF to the code scanning tab, exit code gates the PR.
- Agent integration: shipped Claude Code skill and slash command, Cursor rule, Claude Code Stop hook, optional MCP server exposing `list_peons` and `run_peon`.

**Registry.** Git-native. Any repository is a source, namespaced by GitHub owner, pinned by content hash in `peons.lock`. The public index at the website is search and curation over those repositories, with verified badges for peons whose fixture suites pass on our infrastructure. Organisations can `extends:` a shared peon set and override severity or scope per repository.

**Team peons.** `peons create --from-reviews` clusters recurring review comments from the team's own PR history into a draft checklist with fixtures pulled from the PRs where the comments appeared. `peons create --from CLAUDE.md` turns an existing guidelines file into checks.

**Boss.** A router and merger, never a reviewer. It sees the file list, diff stats, PR title and body, the team map and each peon's description, and decides which peons to dispatch. Path routing from `peons.yaml` is deterministic and covers most PRs; a small model handles what globs cannot express (intent in the description, new endpoints or raw SQL in the diff, budget decisions on tiny changes). Teams pin `always:` and `never_skip:` so hard rules cannot be routed around. On the way back the Boss dedupes overlapping findings, ranks by severity, and can call one escalation round (a critical on a request-handling file triggers the security peon). `peons plan` prints the dispatch decision with a reason per peon; `peons run --auto` is the same decision applied to staged changes, which is what coding agents call.

**Memory.** Modelled on the test impact analysis architecture Anthropic described in September 2026: state out of the process, an append-only journal, a rollup, a selector that reads the rollup.
- Journal: every run appends peon, path, finding hash, severity, commit, PR and outcome. Outcomes are derived from git and the PR: accepted (line changed in the next push), dismissed (thumbs down or resolved without change), suppressed, reverted (the PR was later reverted).
- Rollup: per peon and path, precision, dismiss rate, last clean commit, findings that recurred.
- The Boss reads the rollup: skip a peon that has been clean on a path for N merges when nothing in its covered surface changed; demote a rule whose findings on a path are dismissed most of the time (the flaky-test equivalent); re-run a peon whose finding preceded a revert.
- Locally the journal lives in `.peons/journal/` and rolls up per repo. Cross-repo, cross-team history for an organisation is the hosted store, which is the technical basis of the Team tier.

**Vault.** A markdown index of the codebase in `.peons/vault/`, one note per module, in the style of an Obsidian vault: owners from CODEOWNERS, imports and dependents from the TypeScript compiler API, tests, linked ADRs and incidents, finding history. Rebuilt incrementally on merge for touched files and their dependents. Peons read the vault instead of crawling the repository; the Boss walks `imported_by` for blast radius. Because it is plain markdown in the repo, humans and coding agents can read and correct it. Embeddings over vault notes are an optional later layer for retrieving similar past bugs; full-code embeddings are not planned, they go stale under agentic merge volume and the graph is enough for the JS/TS wedge.

**Statelessness rule.** The CLI holds no state between runs. The journal is append-only, the rollup is derived and rebuildable, the vault is regenerable from git. This is the design constraint that lets the hosted service scale horizontally when agents open many small PRs overnight.

### 4. Market

- AI code tools overall: $7.3B in 2025, projected to exceed $29B at roughly 26% CAGR (industry estimates cited in CodeRabbit's Series C coverage).
- Pure-play AI code review: $180M ARR in 2025 to $420M in 2026.
- Signals of category strength: CodeRabbit $143M Series C at $1.5B (August 2026), 17,000 customers, 2M reviews per week, revenue up 5x year on year; Greptile Series A at $180M valuation; Qodo $121M raised; Graphite acquired by Cursor; GitHub moved Copilot review to usage billing in June 2026.
- Serviceable segment: engineering teams of 5 to 500 in JavaScript and TypeScript shops that already use a coding agent. Bottom-up target of 1,000 paying teams by end of 2029, which is well under 1% of GitHub organisations on paid plans.

### 5. Competition and positioning

| | Hosted generic (CodeRabbit, Greptile, Copilot, Bugbot) | Hosted multi-agent (Anthropic) | Open BYO-key actions (lupe, nitpik, dozens of small actions) | ci-peons |
|---|---|---|---|---|
| Pricing | Per seat or per review | $15 to $25 per PR | Free | Free core, $15 to $40 per dev for org features |
| Scoping | Path instructions, one reviewer | Fixed agents | None or basic profiles | Peons per path with context |
| Evals | Vendor benchmarks | Internal | None | Fixtures per peon, `peons test` |
| Agent callable | Full review via CLI, slow | No | Sometimes | Single peon, seconds, cents |
| Registry | No | No | No | Git-native, verified tier |
| Learns from outcomes | Learnings on paid tiers, vendor-hosted | No | No | Journal and rollup, in the repo or the org store |
| Codebase index | Vendor-hosted, opaque | Vendor-hosted | None | Markdown vault in the repo, readable by agents |

Defensibility comes from four things the hosted players are structurally unlikely to copy: an open registry that vendors and communities publish to, an eval standard for reviewers, a context model (vault) that lives in the customer's repository rather than on a vendor's server, and a finding journal whose outcomes make routing better per repository over time.

### 6. Go to market

1. **Frontend wedge.** Launch with five peons for a11y, React, Next.js App Router, Core Web Vitals and TypeScript strictness. Distribution through ReactJS Barcelona (2,000 members), the Señors @ Scale podcast, Real-World Next.js readers, the Lizard to Wizard workshop and the 2027 conference calendar.
2. **Vendor peons.** Recruit five framework or tooling teams (targets: Vercel, Tailwind, Playwright, Sentry, TanStack) to own an official peon. Their incentive is enforcing their best practices in customers' CI. Verified vendor listings become a revenue line in 2028.
3. **Team adoption.** The from-reviews generator and org inheritance are the wedge into companies of 20 to 500 engineers. Land with one team on the free tier, expand to a Team plan when the platform group wants a shared standard.
4. **Content.** Every peon launch is an article, a reel and a podcast segment. The eval numbers give each one a hook.

### 7. Business model

| Tier | Includes | Price |
|---|---|---|
| Open source | CLI, Action, public registry, BYO key, unlimited | Free |
| Team | Private registry, org inheritance, hosted runs, cross-repo insights, Slack summaries | $15 per developer per month |
| Enterprise | SSO, audit log, self-hosted registry, SLA, procurement | $40 per developer per month |
| Verified vendor | Certified listing, eval reports, placement | $1,000 per month |

Because inference runs on the customer's key on the core tiers, gross margin is above 80%. Hosted-key runs on Team are billed as pass-through plus 20%.

### 8. Financial model (assumptions)

| | 2027 | 2028 | 2029 |
|---|---|---|---|
| Repositories on the OSS action (exit) | 3,000 | 12,000 | 30,000 |
| Paying teams (exit) | 50 | 350 | 1,000 |
| Average seats per team | 12 | 15 | 18 |
| Blended price per seat | $15 | $16 | $18 |
| Verified vendors (exit) | 2 | 10 | 25 |
| MRR (exit) | $11k | $94k | $349k |
| ARR run-rate (exit) | $0.13M | $1.1M | $4.2M |
| Revenue recognised | $45k | $550k | $2.4M |
| Headcount (exit) | 1.5 | 4 | 9 |
| Operating cost | $150k | $600k | $1.6M |
| Net | −$105k | −$50k | +$0.8M |

Key assumptions: roughly 3% of organisations that adopt the free action convert to Team within 12 months; monthly logo churn starts at 5% and falls to 2% as org inheritance creates switching cost; infrastructure stays under $2k per month until hosted runs matter; salaries at Barcelona and remote-Europe rates.

Sensitivity: the model is most sensitive to OSS adoption, not price. Halving repositories in 2028 pushes breakeven to mid-2030. Halving price only delays it two quarters.

### 9. Roadmap

- **Q4 2026.** Core engine, CLI, GitHub Action, five launch peons with fixtures, Claude Code skill and Cursor rule. Public beta with ReactJS Barcelona members.
- **Q1 2027.** Public launch. `peons init`, `peons test`, git-native registry with lockfile. First vendor conversations.
- **Q2 2027.** `peons create --from-reviews`. Org inheritance. Boss with deterministic routing and `peons plan`. Local journal and rollup. Team tier private beta.
- **H2 2027.** Vault (`peons index`) for TypeScript projects. Boss LLM routing, escalation and outcome-based demotion. Team tier GA with the hosted journal, insights and Slack summaries. MCP server. Verified programme. Seed decision.
- **2028.** Enterprise tier, GitLab support, hosted execution, first three official vendor peons.

### 10. Team

Dan Neciu, founder. Engineering Manager and Staff Engineer at Perk, previously Staff Engineer at Rover on a multi-brand microfrontend platform, senior roles at Glovo and AdoreMe, technical co-founder at CareerOS. Author of Real-World Next.js, organiser of ReactJS Barcelona, host of Señors @ Scale, speaker at React Summit, React Alicante, JSHeroes and others. First hire: one contract engineer in 2027. Seed hires: three engineers and one DevRel.

### 11. Risks

- **Platform absorption.** GitHub or Anthropic could ship scoped, testable reviewers natively. Mitigation: provider-agnostic, works on GitLab, and the registry plus evals are an ecosystem asset rather than a feature.
- **OSS funnel does not convert.** Mitigation: the seed is conditional on conversion numbers; the company stays part-time inside Venceda SL until then.
- **Supply-chain risk in third-party peons.** A malicious peon with file tools could exfiltrate secrets. Mitigation: permissions manifest in frontmatter, enforced by the runner, printed on install, lockfile hashes.
- **Founder time.** Full-time day job. Mitigation: scope year one to what one person and a contractor can ship; the launch peons are in the founder's core expertise.
- **Memory volume.** Agentic teams open many small PRs, so journal writes grow faster than headcount. Mitigation: the stateless design from day one, append-only journal, derived rollup, and a hosted store sized for 10 to 20x the initial load, as Anthropic's CI post recommends.
- **Naming.** "Minions" is a Universal trademark. ci-peons is a generic word and clear.

### 12. The ask

Not raising today. If the year-one gates are hit (5,000 repositories on the action, 50 paying teams, three vendor commitments), raise $1.5M at the end of 2027 to fund three engineers and one DevRel hire through 2029 breakeven.
