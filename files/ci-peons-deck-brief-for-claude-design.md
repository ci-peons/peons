# ci-peons pitch deck: brief for Claude Design

Paste this whole file as the brief. Build a 12-slide, 16:9 investor deck. Every number below is final; do not invent new ones. Copy is final unless marked "tighten if needed". Presenter notes go in the notes field, not on the slide.

## 1. Context

ci-peons is an open source platform for specialised, testable AI code reviewers ("peons"). A peon is a markdown file scoped to paths, loaded with the team's context, shipped with test fixtures. Peons run as a GitHub Action, as a CLI, and as a tool coding agents call mid-task. A "Boss" routes each change to the right peons and learns from outcomes. Open source and bring-your-own-API-key; revenue from private registries, org standards and insights.

Audience: seed-stage investors who fund bottom-up developer tools, plus framework vendors we want as partners. They read on a phone first, in about two minutes. Decision happens in the first four slides.

Presenter: Dan Neciu, Engineering Manager and Staff Engineer at Perk, author of Real-World Next.js, organiser of ReactJS Barcelona.

## 2. Design direction

Tone: a serious engineering tool, not a consumer app. Confident, plain, dense with evidence. It should look like something a Staff Engineer made for a partner meeting, not a startup template.

Palette (use exactly these, no gradients):
- Paper: #FFFFFF slide background, #F1F3F5 for panels and code blocks
- Ink: #10202F for all text
- Muted: #5B6B7A for secondary text and axis labels
- Amber: #D9981F for the one accent (rules, highlighted row, chart bars). Amber text on white uses #7A5200 for contrast
- Teal: #2A8F86 as a second data colour only where two categories must be told apart (peon boxes in the flow diagram, second series in a table)
- Amber soft fill #FBF1DC and teal soft fill #E3F2F0 for highlighted cells and boxes

Typography:
- IBM Plex Sans for everything, weights 400, 500, 600. No other display face.
- IBM Plex Mono only for actual code, file paths, commands and terminal output. Never for labels or numbers in tables.
- Headline: one full sentence, sentence case, 30 to 34px on a 1280x720 canvas, max two lines, left aligned.
- Body 15 to 17px. Table 14px. Footnote 12.5 to 13.5px muted.
- Numbers in tables right aligned with tabular figures.

Layout:
- 1280x720 canvas, 64px side margins, 48px top and bottom.
- Top-left: section name in muted 14px. Top-right: slide number "n / 12".
- A 4px amber progress bar across the very top whose width grows with slide number.
- Left aligned throughout. Two-column grids use 7/5 or 5/7 splits, not 6/6, unless content is symmetric.
- Whitespace is fine. Do not fill empty space with decoration.

Do not use:
- Icons, illustrations, stock photos, mascots, emoji, gradients, drop shadows, rounded cards with identical radii, all-caps labels, numbered "01 02 03" markers, middle-dot separators, arrows appended to text, italic or coloured single words inside headlines.
- Any accent colour other than amber and teal.
- Filler phrases. Every sentence on a slide is either a fact, a claim with a number, or an instruction.

Charts and diagrams: flat, single colour, labelled directly (no legends where labels fit), thin #D3DAE0 axis lines only. The flow diagram on slide 5 uses rectangles with 3px radius, 1px borders, and thin grey arrows.

Deliverables: the deck in the editor, plus a PDF export. Speaker notes attached to each slide.

## 3. Slide by slide

### Slide 1, Cover
Section label: "Seed narrative, September 2026"
Left column (5/12):
- Title: "ci-peons" as the largest text on the deck (72px).
- Subtitle, muted, 22px: "Specialised code reviewers your team writes as files, runs in CI, and lets coding agents call."
- Four small lines: Dan Neciu / Engineering Manager and Staff Engineer, Perk / Author, Real-World Next.js / Organiser, ReactJS Barcelona
Right column (7/12): a terminal block in Plex Mono, #F1F3F5 background, 4px amber left border. Content exactly:

```
$ peons run --auto --scope staged --format agent

Boss: 2 of 5 peons dispatched (events-domain, a11y). est. $0.04

events-domain  apps/events/api/createBooking.ts:41  critical
  This write bypasses the idempotency key introduced after the
  July double-booking incident (docs/incidents/2026-07-double-booking.md)
  Wrap the insert in withIdempotency(req.headers['idempotency-key']).

a11y           apps/events/ui/BookingForm.tsx:88   medium
  Submit renders as <div onClick>. Use <button type="submit"> so
  it is keyboard reachable and announced as a button.

2 findings, 1 critical, 14s, $0.03. Exit 1.
```
Colour "events-domain" and "critical" amber, "a11y" and "medium" teal, the "$", "Boss:" line and last line muted.
Notes: Open on the terminal, not the tagline. The first finding is the whole pitch. Ask whether their reviewer could write that line. Then read the last line: 14 seconds, three cents, an exit code an agent can act on.

### Slide 2, Why now
Headline: "Code review became the bottleneck in 2026, and the free options started metering it."
Three stat blocks in a row, each with a 2px amber top rule, big number 44px, one-line explanation, one-line source in 12px muted:
1. "8x" / more code shipped per engineer per quarter at Anthropic versus 2021 to 2025; Claude authors 80% of it / Anthropic, September 2026
2. "10.8 vs 6.5" / issues per pull request, AI-assisted versus human-authored; 41% of new code is now AI-generated / CodeRabbit Series C materials, August 2026
3. "June 2026" / GitHub Copilot code review moved to usage billing and started consuming Actions minutes on private repos / GitHub changelog
Below, two panels side by side (amber left border, teal left border):
- "The volume signal": CodeRabbit runs more than two million reviews a week for 17,000 customers with revenue up five times year on year. Review is now a paid, high-volume workload, not a nice-to-have.
- "The shape change": Agents open many small PRs, overnight and at weekends. Anthropic's CI load rose 25x in six months. Review tooling built for one big human PR a day is the wrong shape for this.
Notes: Review is no longer bundled and free. GitHub metered it. Anthropic prices its own at $15 to $25 a PR. Whoever wins the cheap, high-volume end wins the agent era.

### Slide 3, Problem
Headline: "Every AI reviewer on the market is one generic pass over the diff. Teams pay for it three times."
Three columns, each a bold 17px title and a 15px paragraph:
- "In noise": Out of the box they are too chatty. Teams spend weeks tuning YAML, then developers learn to scroll past the bot. Independent reviews of CodeRabbit, Copilot and Bugbot all reach this conclusion.
- "In missing context": The reviewer does not know which team owns the folder, what the ADR decided, which incident shaped this code, or that a test already covers the thing it is about to flag. Most "false positives" are this.
- "In the wrong shape for agents": A coding agent mid-task wants one opinion on one concern in seconds. Today's CLIs run the full review in 7 to 30 minutes, and the deepest option costs $15 to $25 per PR on enterprise plans only.
Full-width panel at the bottom, max 900px wide: bold "The sentence no reviewer can write today:" then "This bypasses the idempotency key the events team introduced after the July double-booking incident." Not because models can't reason, but because nobody gives them the team's history in a form they can use.
Notes: The three costs map to what we build: narrow testable peons, the vault, and the CLI-first shape. Let the closing sentence land; it sets up slide 4.

### Slide 4, Solution
Headline: "A peon is a reviewer as a file: scoped to paths, loaded with the team's context, shipped with its own tests."
Left (5/12), code block:
```
# peons/events-domain.md
name: events-domain
paths: ["apps/events/**"]
severity: { block: critical }
permissions: { read: ["apps/events/**", "docs/**"] }
context:
  team: events
  docs: ["docs/adr/00*-events-*.md"]
  incidents: ["docs/incidents/*.md"]
  history: { prs: 20, since: 90d }
fixtures: ./fixtures        # should-flag, should-pass

## Checks
- Every write to bookings goes through withIdempotency.
- Event mutations emit an audit entry.
- No direct Stripe calls outside apps/events/billing.
```
Right (7/12), five bullets, bold lead-in then plain text:
- One engine, three surfaces. GitHub Action gates the PR. CLI serves humans and agents. MCP serves agents that prefer tools. Identical results in all three, or agents stop trusting the local run.
- Narrow by design. An agent calls one peon, gets one concern answered in seconds for cents, and fixes it before a human sees the PR.
- Measured, not argued about. `peons test` runs each peon against its should-flag and should-pass fixtures and reports precision. Noise becomes a number the team can fix.
- Drafted from the team's own reviews. `peons create --from-reviews` clusters six months of their PR comments into a checklist with real fixtures.
- Bring your own key. MIT core. No inference cost on our side, no lock-in on theirs.
Notes: Point at the permissions line. Third-party reviewers with file access are a supply-chain risk; we treat peons like packages: manifest, lockfile with content hashes, printed on install.

### Slide 5, Product flow
Headline: "The Boss routes each change to the right peons, merges their findings, and never reviews code itself."
Full-width flow diagram, left to right:
- Box "Change" (sub: PR, staged diff, or agent call) →
- Amber box "Boss: plan" (sub lines: path routing, deterministic / small model for intent and budget / reads the rollup) → fans out to three boxes stacked vertically:
  - Teal box "events-domain"
  - Teal box "a11y"
  - Dashed grey box "security (on escalation)"
- All three → Amber box "Boss: merge" (sub: dedupe, rank by severity / one escalation round max / append to journal) →
- Box "Output" (sub: PR review comments / agent fix instructions / SARIF to code scanning / exit code gate)
Below the diagram, two short muted paragraphs side by side:
- Bold "Every decision is explained." `peons plan` prints which peons run and why: "a11y: BookingForm.tsx changed, form markup in diff. react: skipped, 3 lines, no hooks." Teams pin `always:` and `never_skip:` so hard rules cannot be routed around.
- Bold "Agents get it for free." A shipped Claude Code skill, Cursor rule and Stop hook run `peons run --auto` on staged changes. The agent never needs to know the catalog; the Boss picks.
Notes: The Boss only sees file list, diff stats, PR text, team map and peon descriptions. If it read the whole diff with a big model we would have rebuilt CodeRabbit with extra steps. Escalation capped at one round.

### Slide 6, Compounding
Headline: "It gets better per repository the way test selection does: journal, rollup, selector."
Left (7/12):
- Intro paragraph: Anthropic scaled test impact analysis to a 25x CI load by moving state out of the process: workers append results to a journal, a consumer rolls it up per test, a selector reads the rollup. Peon memory has the same shape with findings instead of test results.
- Two panels side by side:
  - "Journal and rollup": Every run appends peon, path, finding, severity, outcome. Outcomes come free from git and the PR: accepted, dismissed, suppressed, reverted. Rolled up per peon and path into precision, dismiss rate, last clean commit.
  - "Boss as selector": Skip peons that are clean on unchanged surface. Demote a rule the team dismisses 80% of the time (the flaky-test equivalent). Re-run a peon whose finding preceded a revert.
- Footnote: Local journal in `.peons/journal/` for one repo. Cross-repo, cross-team history for an organisation is the hosted store, which is the technical basis of the Team tier. The CLI stays stateless; journal is append-only, rollup and vault are rebuildable from git.
Right (5/12), code block then a footnote:
```
# .peons/vault/apps/events/api/createBooking.md
owners: [events]
imports: [[withIdempotency]], [[BookingRepo]]
imported_by: [[BookingForm]], [[waitlistWorker]]
tests: [[createBooking.test]]
adrs: [[adr-007-idempotent-writes]]
incidents: [[2026-07-double-booking]]
findings: 3 accepted, 1 dismissed
```
Bold "The vault" is one markdown note per module, built from the TypeScript compiler API and CODEOWNERS, rebuilt incrementally on merge. Peons read it instead of crawling the repo; the Boss walks `imported_by` for blast radius. Humans and agents can read and correct it, which a vendor's embedding index never allows.
Notes: Why not embeddings like early Cursor: expensive, stale within a day under agent merge volume, opaque. A symbol graph in the repo is enough for JS/TS. Embeddings over vault notes are a later optional layer.

### Slide 7, Unit economics
Headline: "Targeted reviews cost cents on the customer's key. The category's cost structure works against the incumbents."
Left (7/12), table with columns Option / Scope per run / Cost per PR / Latency / Availability. Rows:
- Anthropic Code Review / Full, multi-agent / $15 to $25 / ~20 min / Team, Enterprise
- Cursor Bugbot / Full, bug-focused / $1 to $1.50 / minutes / GitHub only
- GitHub Copilot review / Full / metered / minutes / GitHub only
- CodeAnt AI / Full / $24 per user, flat / minutes / Hosted
- ci-peons, targeted (highlight row, amber soft fill) / 1 to 3 peons, changed surface / $0.03 to $0.10 / 15 to 60 s / Any CI, any provider
Footnote: ci-peons cost assumes a Sonnet-class model on the customer's key and a rollup-pruned dispatch. A full-catalog run on a large PR is roughly $0.50. Competitor figures from vendor pricing pages and published reviews, mid-2026.
Right (5/12), three stat blocks stacked:
- ">80%" gross margin on Team and Enterprise tiers, because inference runs on the customer's key
- "100 to 500x" cheaper per targeted review than the managed multi-agent option, which is why agents can call peons on every iteration, not once per PR
- "$0" infrastructure cost for the free tier: the Action runs on the customer's runner, the registry is git
Notes: This answers "why won't CodeRabbit add this". Hosted full pass priced per seat or per review versus BYO key on a targeted pass. They cannot match the price without breaking their margin, and cannot ship an open registry without giving up the review as their product.

### Slide 8, Market
Headline: "The category is funded and growing fast. Our plan needs well under 1% of it."
Left: sub-heading "Named comparables, 2026" and a two-column table Company / Signal:
- CodeRabbit / $143M Series C at $1.5B, August 2026. 17,000 customers, 2M reviews a week, revenue up 5x
- Greptile / Series A at $180M valuation, Benchmark
- Qodo / $121M raised across rounds to March 2026
- Graphite / $81M raised, acquired by Cursor
- Anthropic, GitHub, Cursor / Each shipped a first-party reviewer; GitHub metered it in June
Footnote: Pure-play AI code review grew from $180M ARR in 2025 to $420M in 2026. AI code tools overall: $7.3B in 2025, projected above $29B at about 26% CAGR.
Right: sub-heading "Bottom-up, not top-down", three bullets:
- Who. Engineering teams of 5 to 500 in JavaScript and TypeScript shops that already run a coding agent. This is the population our five launch peons serve best and where the founder has distribution.
- Calibration. CodeRabbit alone has 17,000 paying customers. Our 2029 target is 1,000 paying teams, about 6% of that one competitor's base, at an average contract of roughly $3,900 a year.
- Expansion. GitLab support and the vault for other languages open the rest of the segment in 2028. Vendor peons (Vercel, Tailwind, Playwright, Sentry, TanStack) bring their user bases with them.
Amber panel: bold "Why the open layer is empty." Dozens of BYO-key review Actions exist; the two closest to us (nitpik, lupe) have single-digit stars. Nobody has combined a registry, evals, and context in one open tool. That is the gap, and it needs distribution more than capital.
Notes: Bottom-up with named comparables. The 1,000-team target is deliberately modest. This is a distribution race and the founder has the distribution.

### Slide 9, Competition
Headline: "Hosted and generic is crowded. Open, specialised and agent-callable has no owner."
Left (7/12): a 2x2 grid with axis labels. Horizontal axis: "Generic, one pass" (left) to "Specialised, many narrow reviewers" (right). Vertical axis: "Hosted, vendor-owned" (top) to "Open, in the customer's repo" (bottom). Cells:
- Top-left "Hosted, generic": CodeRabbit, Greptile, Copilot review, Bugbot, CodeAnt, DeepSource. Per-seat or per-review. Path-scoped prompts at best. Well funded, feature-complete, and structurally unable to go cheap or open.
- Top-right "Hosted, multi-agent": Anthropic Code Review. The right architecture at the wrong price and shape: $15 to $25 per PR, 20 minutes, Team and Enterprise only, cannot be asked for one concern.
- Bottom-left "Open, BYO key, one pass": lupe, nitpik, and dozens of small GitHub Actions. No registry, no evals, no context model, no memory. Proof the demand exists; none has broken out.
- Bottom-right "ci-peons" (amber soft fill): Open registry of narrow reviewers with fixtures, team and feature context in the repo, a Boss that routes and learns from outcomes, and a CLI built for agents first.
Right (5/12): two lists.
"What they would have to give up to copy us":
- Their margin. BYO key at three cents a run breaks a per-seat or per-review hosted model.
- Their product. An open registry means the reviewer is no longer the thing they sell.
- Their data position. Context and memory that live in the customer's repo remove the vendor's lock-in.
"What we still have to prove":
- Frontend teams adopt a free Action at meetup scale, then org scale.
- Fixture-tested peons measurably beat generic passes on precision.
- Two or more framework vendors ship an official peon.
Notes: Investors trust a competition slide that names what is unproven. Registry, evals and context are ecosystem assets, not features.

### Slide 10, Business model and go-to-market
Headline: "Free where value is created, paid where organisations need trust and control. One wedge, with evidence."
Left: table Tier / What it adds / Price:
- Open source / CLI, Action, MCP, public registry, local journal, BYO key, unlimited / Free
- Team / Private registry, org peon inheritance, hosted journal and cross-repo insights, Slack summaries / $15 per dev per month
- Enterprise / SSO, audit log, self-hosted registry and store, SLA / $40 per dev per month
- Verified vendor / Certified listing with published eval reports / $1,000 per month
Footnote: Hosted-key runs on Team are billed as pass-through plus 20%. Expected mix by 2029: 85% Team and Enterprise seats, 10% vendor, 5% hosted inference.
Right: sub-heading "The wedge: frontend teams, through channels the founder already owns", bullets:
- Five launch peons the generic tools do worst: accessibility, React, Next.js App Router, Core Web Vitals, TypeScript strictness.
- Distribution in hand: ReactJS Barcelona (2,000 members, public beta cohort), the Señors @ Scale podcast (engineering leaders, our buyer), Real-World Next.js readers, the Lizard to Wizard workshop, and the 2027 conference calendar.
- Every peon launch is an article with its eval numbers. Precision figures are the hook nobody else can post.
Sub-heading "Then two expansion loops", bullets:
- Vendor peons. Framework teams own an official peon because it enforces their best practices in customers' CI.
- Team to org. Land with one team on free; the platform group buys Team when they want a shared standard across repos. Org inheritance is the switching cost.
Notes: One wedge with evidence beats a list of channels. First ten paying teams should come from podcast guests' companies; name them once you have them.

### Slide 11, Plan and financials
Headline: "Twelve months of gates before any raise. Each gate is a number."
Top: four columns with a 2px amber top rule, each a quarter. Gate text in amber-ink colour.
- Q4 2026: Engine, CLI, Action, five peons with fixtures, Claude Code skill. Gate: 20 beta repos from the meetup, precision above 80% on fixtures.
- Q1 2027: Public launch, `peons init`, `peons test`, git registry with lockfile. Gate: 1,500 repos, 3 vendor conversations open.
- Q2 2027: From-reviews generator, org inheritance, deterministic Boss, local journal. Team tier private beta. Gate: 3,000 repos, 10 paying teams.
- Q3 to Q4 2027: Vault for TypeScript, Boss learning from outcomes, Team GA with hosted journal, MCP server. Gate to raise: 5,000 repos, 50 paying teams, 3 vendor commitments.
Bottom left (7/12), table with columns 2027 / 2028 / 2029:
- Repos on the OSS action, year end: 3,000 / 12,000 / 30,000
- Paying teams, year end: 50 / 350 / 1,000
- Seats per team, blended price: 12 at $15 / 15 at $16 / 18 at $18
- ARR run-rate, year end: $0.13M / $1.1M / $4.2M
- Revenue recognised: $45k / $550k / $2.4M
- Headcount and operating cost: 1.5, $150k / 4, $600k / 9, $1.6M
- Net: −$105k / −$50k / +$0.8M
Bottom right (5/12): a three-bar amber chart of ARR run-rate ($0.13M, $1.1M, $4.2M), values labelled directly above each bar, no y-axis. Footnote: Assumes about 3% of organisations on the free Action convert to Team within 12 months, logo churn from 5% monthly falling to 2%, and inference on customers' keys. Most sensitive to OSS adoption, not price: halving 2028 repos pushes breakeven to mid-2030; halving price delays it two quarters.
Notes: Gates are the plan. The table is what happens if the gates hold. Say that out loud.

### Slide 12, Team, ask, risks
No headline. Three equal columns, each with a bold 17px title.
"Dan Neciu, founder":
- Engineering Manager and Staff Engineer at Perk, leading Perk Events.
- Staff Engineer at Rover: microfrontend architecture across three brands in a 1,000-engineer org; launched a multi-tier system in the US and Canada.
- Glovo: took Core Web Vitals from 50% to 90% green.
- Technical co-founder, CareerOS: led build and scaling of the main app.
- Author of Real-World Next.js (Packt). Organiser of ReactJS Barcelona. Host of Señors @ Scale. Speaker at React Summit, React Alicante, JSHeroes and others.
Footnote: First hire, 2027: one contract engineer. Seed hires: three engineers, one DevRel.
"The ask":
- Not raising today. Year one runs inside Venceda SL, bootstrapped.
- If the Q4 2027 gate is hit (5,000 repos, 50 paying teams, 3 vendor commitments): $1.5M seed (bold) for 24 months of runway.
- Sub-heading "What it buys, by date": Q2 2028 Enterprise tier and GitLab support shipped / Q3 2028 three official vendor peons live / Q4 2028 350 paying teams, $1.1M ARR run-rate / Q4 2029 breakeven at 1,000 teams.
"Risks we are planning around":
- Platform absorption. GitHub or Anthropic ship scoped, testable reviewers natively. Answer: provider-agnostic, GitLab, and a registry plus evals that are ecosystem assets, not features.
- Funnel does not convert. Answer: the raise is conditional on the numbers; the company stays part-time until they exist.
- Supply chain in third-party peons. Answer: permissions manifest enforced by the runner, lockfile hashes, printed on install.
- Founder time. Answer: year one is scoped to what one person and a contractor ship, inside the founder's core expertise.
Notes: Close on the gate, not the vision: "Come back in Q4 2027 and we will show you the numbers on this slide, or we will not be raising."

## 4. Quality checks before export

- Every slide readable at phone width when the PDF is zoomed to fit: nothing below 12.5px, no more than about 90 words of body text per column.
- No orphaned single words on headline line two.
- Tables: numbers right aligned, units in the header not the cells, highlighted row only on slide 7.
- Exactly one accent colour per slide except slides 5 and 9 where teal marks the second category.
- Presenter notes present on all 12 slides.
- Export a PDF and check that the terminal block on slide 1 has not wrapped.
