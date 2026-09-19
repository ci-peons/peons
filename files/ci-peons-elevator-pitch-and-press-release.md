# ci-peons: elevator pitch and press release

## Elevator pitch

**Ten seconds**
ci-peons is npm for code reviewers. Small, specialised AI reviewers you install per folder, test like code, run in CI, and let your coding agents call directly.

**Thirty seconds**
Teams are shipping AI-written code faster than they can review it, and every AI reviewer on the market is one generic pass over the diff: noisy out of the box, blind to the team's history, or $20 a PR. ci-peons splits review into peons: reviewer files scoped to paths, loaded with the team's ADRs, incidents and review history, and shipped with fixtures that measure their precision. A Boss routes each change to the right peons and learns from what the team accepts and dismisses. Peons run as a GitHub Action, as a CLI, and as a tool coding agents call mid-task for cents. Open source, bring your own key. We make money on private registries, org-wide standards and insights.

**Two minutes, for a meeting**
Code review is now the bottleneck. At Anthropic, engineers ship eight times the code they did before agents, and Claude writes 80% of it. AI-assisted PRs carry about 10.8 issues each against 6.5 for human code, and 41% of new code is AI-generated. GitHub metered Copilot review in June 2026. Anthropic's own reviewer costs $15 to $25 per PR on enterprise plans. Review stopped being free at the same moment the volume exploded.

Every tool in the category runs one generic pass over the diff. The result is noise that teams tune for weeks and then learn to ignore, and a reviewer that never knows which team owns the folder, which incident shaped it, or what the tests already cover. For a coding agent that wants one opinion on one concern mid-task, the shape is wrong too: full review, 7 to 30 minutes, no way to ask for just accessibility.

A peon is a reviewer as a markdown file. It declares its paths, its permissions, its context (team, ADRs, incidents, review history) and its checks, and it ships with should-flag and should-pass fixtures so precision is a number, not an opinion. The Boss routes each change to the right peons using path rules first and a small model only for intent and budget, merges the findings, and reads a journal of outcomes so it stops dispatching rules the team keeps dismissing. A markdown vault, one note per module built from the TypeScript compiler API and CODEOWNERS, gives peons context without crawling the repo and lets the Boss compute blast radius.

One engine runs everywhere: GitHub Action for the gate, CLI for humans and agents, MCP for agents that prefer tools. An agent runs `peons run --auto` on staged changes, gets one or two relevant peons back in seconds for three cents, and fixes the finding before a human sees the PR.

The core is MIT and bring-your-own-key, so the free tier costs us nothing and the paid tiers run above 80% gross margin. Team at $15 per developer adds private registries, org-wide peon inheritance, the hosted journal and cross-repo insights. Enterprise at $40 adds SSO, audit and self-hosting. Framework vendors pay for verified listings because an official peon puts their best practices into their users' CI.

We launch with five frontend peons through channels I already own: ReactJS Barcelona, the Señors @ Scale podcast, Real-World Next.js readers and the conference circuit. Year one is bootstrapped with twelve months of numeric gates. If we hit 5,000 repos, 50 paying teams and three vendor commitments by Q4 2027, we raise $1.5M to reach 1,000 teams and breakeven by 2029.

**One line for a developer**
`peons run a11y --scope staged` and your agent fixes the findings before you open the PR.

---

## Press release

**ci-peons launches: open source, specialised AI code reviewers that teams write as files and coding agents can call themselves**

BARCELONA, [date]. ci-peons today released an open source toolkit that replaces the single generic AI code reviewer with a set of small, specialised reviewers called peons. A peon is a markdown file: it declares what it checks, which folders it applies to, what team and feature context it should read, and it ships with test fixtures that prove it flags the right things and stays quiet on the rest.

Peons run in three places with one engine. As a GitHub Action, they gate pull requests. As a CLI, engineers run them against staged changes before committing. And because the CLI is designed for machines first, coding agents such as Claude Code, Cursor and Codex can call a single peon mid-task, get an answer in seconds for a few cents, and fix the finding before a human ever sees the PR.

A component called the Boss decides which peons a change needs. It routes on file paths first, uses a small model only for intent and budget, merges the results, and prints its reasoning so every decision can be audited. The Boss reads a journal of past outcomes, so a rule the team keeps dismissing gets demoted and a peon whose finding preceded a revert gets re-run.

"Every reviewer on the market runs one big pass over the diff and then asks you to tune YAML until it stops being noisy," said Dan Neciu, creator of ci-peons and author of Real-World Next.js. "We wanted a reviewer that knows this folder belongs to the events team, that there was a double-booking incident in July, and that a test already covers the thing it was about to flag. And we wanted an agent to be able to ask for just the accessibility reviewer, not the whole committee."

ci-peons launches with five peons for frontend teams: accessibility, React best practices, Next.js App Router, Core Web Vitals and TypeScript strictness. Any GitHub repository can publish a peon, and `peons add github:org/repo/name` installs one with a content hash pinned in a lockfile and its requested permissions printed on install. Teams can generate a first draft of their own peon from six months of their existing pull request review comments with `peons create --from-reviews`, and `peons test` reports each peon's precision against its fixtures.

The core is MIT licensed and bring-your-own-API-key, and works with Anthropic, OpenAI, Google and OpenAI-compatible providers. A paid Team tier adds private registries, organisation-wide peon inheritance, hosted run history and cross-repository insights.

ci-peons is available today at [url]. Documentation, the public registry and the launch peons are at [url].

**About ci-peons**
ci-peons is built in Barcelona by Dan Neciu, Engineering Manager and Staff Engineer, author of Real-World Next.js (Packt), organiser of the 2,000-member ReactJS Barcelona community and host of the Señors @ Scale podcast.

Contact: [email]
