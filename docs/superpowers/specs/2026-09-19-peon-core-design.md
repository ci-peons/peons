# Peon core: design

| | |
|---|---|
| Status | Approved in brainstorm, awaiting implementation plan |
| Date | 2026-09-19 |
| Supersedes | RFC-0001 sections 6.1, 6.2, 6.3 for v1 scope |
| Companion spec | `2026-09-19-registry-design.md` |

## 1. Purpose

Build the open source core of ci-peons: the peon package format, the engine that runs peons against a change set, the CLI, and the three surfaces that wrap it (GitHub Action, Claude Code skill, MCP server). This is rollout step 1 of RFC-0001 with the Boss, memory plane and hosted planes deferred.

Goals carried over from the RFC:

- G1. Identical results whether a peon runs in CI, in the CLI, or via MCP. One engine, three surfaces.
- G2. Targeted runs complete in under 60 seconds and cost cents on a fast-tier model.
- G3. No customer code leaves the machine except to the model provider, and secrets are redacted before that.
- G6. Third-party peons run with declared permissions enforced by the engine.

## 2. Decisions made in this brainstorm

| Decision | Choice | Why |
|---|---|---|
| Execution model | Single-shot: engine assembles a context pack, one model call, structured findings back. No tool loop. | Cheapest, fastest, deterministic inputs, fixture-testable. Permissions enforced at pack assembly. |
| Providers | Anthropic only in v1, behind a `Provider` interface. | Smallest surface. Interface exists so adapters can be added. |
| Runtime and distribution | TypeScript, Bun toolchain, published to npm, runs under Node 20+ or Bun. Static binary is a later packaging step. | `npx peons` is the lowest-friction install for humans, CI and agents. |
| Repo structure | One Bun-workspaces monorepo with a shared `schema` package. | CLI, registry API and website validate and render the same manifest definition. |
| Launch peons | `a11y` and `react`. | Two genuinely different concerns prove the format. The other three follow the template. |
| Surfaces | CLI, GitHub Action, Claude Code skill and slash command, MCP server. | All four are thin over `@peons/core`. |
| Boss | Out of scope. A `Planner` interface with one implementation, `PathPlanner`, is the seam. | No Jev access yet. |
| Journal | Written from the first run, read by nothing. | The self-improvement system later needs history that starts now. |
| Registry model | Hosted, npm-style, not git-native. | Founder decision; see companion spec. RFC 6.6 and the "storing peons in our registry" rejection in RFC 13 are superseded. |

## 3. Monorepo layout

```
peons/
  packages/
    schema/            # Zod schemas: PeonManifest, Finding, Plan, RunResult, journal events
    core/              # engine: config, changeset, planner, context, redact, provider, postfilter, merge, cache, format, journal
    registry-client/   # read and download from the registry (used by cli and core loader); see companion spec
    cli/               # `peons` binary: commander + Ink + @clack/prompts
    action/            # GitHub Action, imports core directly
    mcp/               # stdio MCP server, imports core directly
  apps/
    registry/          # Supabase project: migrations, edge functions (companion spec)
    web/               # Next.js site (companion spec)
  peons/
    a11y/              # launch peon, published to the registry as `a11y`
    react/             # launch peon, published as `react`
  docs/
```

Package names: `@peons/schema`, `@peons/core`, `@peons/registry-client`, `@peons/mcp`, and `peons` for the CLI. The Action is published to the GitHub Marketplace as `ci-peons/action`.

## 4. Peon package format

A peon is a directory containing `peon.md` and `fixtures/`. Nothing else is allowed in a published package.

```
a11y/
  peon.md
  fixtures/
    should-flag/
      img-missing-alt.tsx
      img-missing-alt.expect.yaml
    should-pass/
      img-with-alt.tsx
```

### 4.1 Frontmatter

```yaml
---
name: a11y                       # npm naming rules; unscoped (official) or @user/name
version: 1.0.0                   # semver
description: WCAG 2.2 AA checks for React and HTML in JSX
paths: ["**/*.{tsx,jsx,html}"]   # default scope; repo config may narrow or replace
severity:
  default: medium                # applied when the model omits severity
  block: high                    # exit 1 at or above this
permissions:
  read: ["**/*.{tsx,jsx,html,css}", "docs/a11y/**"]
context:
  docs: ["docs/a11y/**/*.md"]    # optional
  tests: ["**/*.test.{tsx,jsx}"] # optional
model:
  tier: fast                     # fast | balanced | deep
---
```

Validation rules, enforced by `@peons/schema` at load and at publish:

- `name` follows npm rules: lowercase, URL-safe, at most 214 characters, optional `@scope/` prefix.
- `version` is strict semver.
- `paths`, `permissions.read`, `context.docs`, `context.tests` are non-empty arrays of globs (picomatch syntax).
- Every glob in `context.docs` and `context.tests` must be matched by at least one glob in `permissions.read`. Concretely: the loader checks that each context glob, treated as a literal path pattern, is a sub-pattern of some permission glob using picomatch's `scan` and prefix comparison; where that is undecidable the loader falls back to requiring the context glob to appear verbatim in `permissions.read`.
- `severity.block` is at or above `severity.default`.
- `model.tier` is one of `fast`, `balanced`, `deep`.

Severity scale: `info`, `low`, `medium`, `high`, `critical`.

### 4.2 Body

Markdown. Everything before `## Checks` is guidance the model sees verbatim. Under `## Checks`, each `### <id>` heading defines one check; the heading text is the check id and the prose beneath it is the check description.

```markdown
Guidance prose. Team conventions, what not to flag.

## Checks

### img-alt
Every `<img>` has a meaningful `alt`, or `alt=""` when decorative. Cite WCAG 1.1.1.

### interactive-name
Buttons and links have an accessible name from content, `aria-label` or `aria-labelledby`.
```

Rules:

- Check ids are `[a-z0-9-]+`, unique within the peon.
- A peon must have at least one check.
- Content after the last check that is not a `###` heading belongs to that check.

### 4.3 Fixtures

- `fixtures/should-flag/<case>.<ext>` plus `fixtures/should-flag/<case>.expect.yaml`:

  ```yaml
  checks: [img-alt]          # every listed check must fire at least once
  ```

- `fixtures/should-pass/<case>.<ext>`: the peon must produce zero findings.
- Fixtures are run as if the file were newly added at its fixture path, with no docs or tests context.
- A peon with no fixtures is valid for local use but `peons publish` refuses it unless `--allow-no-fixtures` is passed, and the website shows "untested".

### 4.4 Repo configuration

`peons.yaml` at the repo root:

```yaml
provider: anthropic                # v1: only value
model:                             # optional tier overrides
  fast: claude-haiku-4-5-20251001
  balanced: claude-sonnet-5
  deep: claude-opus-5
budget:
  tokens_per_peon: 60000           # context pack cap; default shown
peons:
  - use: a11y                      # installed package, pinned in peons.lock
    paths: ["apps/web/**"]         # replaces the peon's default paths
  - use: react
    severity: { block: critical }  # overrides
  - use: "@dan/events-domain"      # a scoped third-party package
  - use: ./peons/events-domain     # local directory in the same format
    enabled: false
    reason: "Pending rewrite"
```

Resolution: a `use:` value starting with `./` or `/` is a local directory. Anything else is a registry package name that must have an entry in `peons.lock` and a matching directory under `.peons/installed/<name>/<version>/`. Missing lock entry or hash mismatch is exit 2 with an instruction to run `peons add`.

Provider key: `PEONS_API_KEY`, falling back to `ANTHROPIC_API_KEY`. Missing key is exit 2 before any work.

## 5. Engine pipeline

`@peons/core` exports `run(options): Promise<RunResult>` and `test(options): Promise<TestResult>`, each composed of stage functions with typed inputs and outputs. Stages are modules with their own tests.

| # | Stage | Input | Output |
|---|---|---|---|
| 1 | `loadConfig` | repo root | `ResolvedConfig`: peons with manifest, body, checks, source (local or installed), effective paths and severity |
| 2 | `changeSet` | scope option | `ChangeSet`: files with status, unified hunks, full post-change content |
| 3 | `plan` | config, change set | `Plan`: per peon, the matched files and a reason string per file |
| 4 | `buildContextPack` | one planned peon, change set, repo | `ContextPack`: files, hunks, docs, tests, peon body, hash |
| 5 | `redact` | pack | pack with secrets replaced |
| 6 | `callProvider` | pack, model | raw findings |
| 7 | `postFilter` | raw findings, pack, manifest | validated `Finding[]` with fingerprints |
| 8 | `merge` | all peons' findings | deduplicated, sorted `Finding[]` |
| 9 | `cache` | wraps 5 to 7 | hit or miss |
| 10 | `format` | `RunResult`, format name | string |
| 11 | `journal` | events | appended jsonl |

### 5.1 Change set scopes

- `staged`: `git diff --cached` against HEAD. Untracked files are excluded unless staged.
- `branch`: `git diff <base>...HEAD` where base defaults to the repo's default branch and can be set with `--base`.
- `files`: explicit paths, treated as fully changed with the whole file as one hunk. Used by fixtures and by agents that know what they touched.

Deleted files are excluded. Binary files are excluded. Files above 200 KB are excluded with a warning.

### 5.2 Planner

```ts
interface Planner {
  plan(config: ResolvedConfig, changes: ChangeSet): Promise<Plan>;
}
```

v1 ships `PathPlanner`: for each enabled peon, match each changed file against effective `paths`. A peon with no matches is not in the plan. When the caller names peons explicitly, only those peons are considered but path matching still applies; `--all-files` bypasses path matching for named peons.

The Boss is a future second implementation. Nothing else in the engine may depend on how the plan was produced.

### 5.3 Context pack

Per planned peon, in this order, each item checked against `permissions.read` before inclusion:

1. Peon body (guidance and checks).
2. For each matched changed file: path, status, full post-change content, unified hunks.
3. `context.docs` matches from the repo, up to 20 files, sorted by path.
4. `context.tests` matches that share a directory with a changed file, or whose basename minus `.test`/`.spec` equals a changed file's basename. Up to 10.

A file that fails the permission check is not skipped; the run fails with exit 2 naming the peon and the file, because a silently skipped file would make results depend on permissions in a way the author cannot see.

Token budget: estimated at 4 characters per token. When the pack exceeds `budget.tokens_per_peon`, drop in order: docs (largest first), tests (largest first), then full file contents degrade to hunks only (largest file first). The peon body and hunks are never dropped. The pack records what was dropped so the output can say so.

The pack hash is sha256 over the ordered, redacted contents.

### 5.4 Redaction

Runs before caching and before any provider call. Detectors: a fixed list of known key formats (AWS access key ids and secrets, GitHub tokens, Slack tokens, Stripe keys, Google API keys, private key PEM blocks, generic `Bearer` tokens, JWT shape) plus a Shannon-entropy check on quoted strings of 20 or more characters that also match assignment to a name containing `key`, `secret`, `token` or `password`. Matches are replaced with `<REDACTED:kind>`. Redaction counts appear in the run output.

### 5.5 Provider call

```ts
interface Provider {
  review(input: { system: string; user: string; tier: ModelTier; schema: JsonSchema }): Promise<{ findings: unknown; usage: Usage }>;
}
```

Anthropic implementation:

- System prompt is two blocks: a fixed engine preamble (role, output rules, injection guidance) and the peon body. The peon body block carries a cache control breakpoint so repeated runs of the same peon reuse the prefix.
- User message is the context pack rendered as tagged sections: `<file path=... status=...>`, `<hunks>`, `<doc path=...>`, `<test path=...>`.
- A single tool `report_findings` is defined with the `Finding[]` JSON schema and `tool_choice` forces it. There is no free-text parsing.
- Tier map default: fast is `claude-haiku-4-5-20251001`, balanced is `claude-sonnet-5`, deep is `claude-opus-5`. Overridable in `peons.yaml`.
- Temperature 0. Max output tokens 4096.
- Retries: three attempts with exponential backoff on 429, 5xx and network errors. Other errors fail immediately.

### 5.6 Finding

```ts
type Finding = {
  peon: { name: string; version: string; hash: string };
  check: string;                       // check id from the peon body
  file: string;
  range: [number, number];             // 1-based inclusive lines in the post-change file
  severity: Severity;
  message: string;                     // one to three sentences
  evidence: string[];                  // the offending lines, verbatim, at most 8
  fix?: string;                        // suggested change, prose or a short snippet
  fingerprint: string;                 // sha256(check + normalised evidence)
};
```

### 5.7 Post-filter

Drop, with a logged reason, any raw finding that: cites a check id not in the peon; cites a file not in the pack; has a range outside the file; or has a message matching the injection patterns (instructions to run commands, edit files outside the change set, visit URLs, or ignore prior instructions). Clamp missing severity to `severity.default`. Trim evidence to 8 lines. Compute the fingerprint from check id plus evidence with whitespace collapsed.

### 5.8 Merge

Across all peons: two findings are duplicates when file, check id and overlapping range match. Keep the higher severity. Sort by severity descending, then file, then range start.

### 5.9 Cache

`.peons/cache/<sha256>.json` keyed by sha256 of (peon content hash, pack hash, resolved model id). A hit returns stored findings and marks the peon as cached in the output. `--no-cache` bypasses. Cache holds redacted content only.

### 5.10 RunResult and exit code

```ts
type RunResult = {
  plan: Plan;
  findings: Finding[];
  peons: Array<{ name: string; status: "ok" | "cached" | "error" | "skipped"; error?: string; usage?: Usage; durationMs: number }>;
  redactions: number;
  dropped: Array<{ peon: string; item: string; reason: string }>;
  exit: 0 | 1 | 2;
};
```

Exit 2 if any peon has status `error`, or on any engine error before provider calls. Otherwise exit 1 if any finding's severity is at or above its peon's effective `block` (or the `--fail-on` override). Otherwise 0.

### 5.11 Journal

Append to `.peons/journal/<yyyy-mm>.jsonl`, one JSON object per line, using the RFC 7.1 event shapes for `plan`, `finding` and `run_complete`, with `RunRef.tenant` set to `"local"` and `surface` set by the caller (`cli`, `ci`, `mcp`). Disabled with `journal: false` in `peons.yaml`. Nothing reads the journal in v1.

## 6. Output formats

- **`agent`**: markdown. Header line with peon count and duration. One block per finding: `[SEVERITY] file:start-end · peon/check`, then message, then evidence in a fenced block, then `Fix:` when present. Footer: counts by severity, cached and errored peons, redaction count, and the sentence "Exit code N: <meaning>". Stable ordering as in 5.8. This is the machine contract; changes are breaking.
- **`json`**: `RunResult` serialised.
- **`sarif`**: SARIF 2.1.0. One `tool.driver.rules` entry per (peon, check). `partialFingerprints.primary` set to the finding fingerprint.
- **`github-review`**: a structure the Action turns into one pull request review with inline comments; not printed by the CLI.

## 7. CLI

Built with commander. Presentation split by mode:

- **TTY mode** (stdout is a TTY and no `--format`): `run` and `test` render an Ink view with one row per peon showing spinner, elapsed time, token count and finding count, then the findings list in place. `init`, `login` and `publish` use `@clack/prompts`. Severity colours: critical red, high orange, medium yellow, low blue, info dim. picocolors elsewhere.
- **Plain mode** (piped, CI, or `--format` given): Ink never mounts. Formatter output on stdout, progress lines on stderr. Formatters are the single source of truth; Ink is a view over the same `RunResult`.

Commands in this spec:

| Command | Behaviour |
|---|---|
| `peons init [--claude]` | Writes `peons.yaml` and `.peons/.gitignore` (cache, journal). With `--claude`, writes `.claude/skills/peons/SKILL.md` and `.claude/commands/peons.md`. Prompts for provider key handling advice only; never writes keys. |
| `peons list` | Table: name, version, source, hash prefix, effective paths, enabled. |
| `peons plan [--scope] [--base] [--format json]` | Prints the plan with reasons. Makes no provider calls. |
| `peons run [names...] [--scope staged\|branch\|files] [--base ref] [--format agent\|json\|sarif] [--fail-on sev] [--all-files] [--no-cache]` | Full pipeline. Names restrict to those peons. `--scope files` takes remaining positional paths after `--`. |
| `peons test [names...] [--runs N] [--min-precision f] [--min-recall f]` | Runs every fixture through the engine with `--scope files`. Per check: recall is the fraction of should-flag cases expecting it where it fired; precision is fired-where-expected over fired-anywhere across all fixtures. With `--runs N`, each fixture runs N times and a check counts as fired when it fires in the majority. Exit 1 below thresholds. Defaults: precision 0.85, recall 0.7. |

Registry commands are specified in the companion spec.

## 8. Surfaces

### 8.1 GitHub Action

`ci-peons/action@v1`, a Node 20 JavaScript action bundled with the core library, so nothing is installed on the runner.

Inputs: `scope` (default `branch`), `base` (default the PR base ref), `peons` (optional names), `fail-on`, `sarif` (boolean), `soft-fail` (boolean), `api-key` (required, from a secret). Behaviour: runs the engine, posts one review on the PR with inline comments for findings whose ranges fall inside the diff and a summary comment for the rest, uploads SARIF when asked, and sets the step outcome from the exit code. With `soft-fail`, exit 2 becomes success with a warning annotation. On a re-run for a new push, findings already commented on the PR, matched by fingerprint in a hidden HTML marker, are not posted again.

### 8.2 Claude Code

`peons init --claude` writes:

- `.claude/skills/peons/SKILL.md`: when to run peons (after editing, before committing, when asked to review), the exact command, how to read the agent format, and the rule to fix then re-run until exit 0 or the user decides otherwise.
- `.claude/commands/peons.md`: runs `peons run --scope staged --format agent` and passes the output to the model.

The docs include an optional Stop hook snippet that runs the same command; it is not installed automatically.

### 8.3 MCP server

`@peons/mcp` over stdio. Tools:

- `list_peons()` returns the `peons list` data as JSON.
- `plan({ scope?, base?, files? })` returns the `Plan`.
- `run_peons({ names?, scope?, base?, files?, failOn? })` returns `{ text: <agent format>, result: <RunResult> }`.

The server calls core functions directly and sets `surface: "mcp"` in the journal. Run in the target repo's working directory, which the client configures.

## 9. Launch peons

`a11y` and `react`, each with at least six should-flag and six should-pass fixtures, published to the registry as unscoped official names. Both use `model.tier: fast`. Fixture thresholds must pass in CI with a live key before release. Their authoring is part of the implementation plan; their checks are a content decision made when writing them, guided by the founder's expertise, not fixed in this spec.

## 10. Testing strategy

- `@peons/schema`: valid and invalid manifests, body parsing edge cases, the context-subset-of-permissions rule.
- `@peons/core`: each stage in isolation with a `FakeProvider` that returns scripted findings. Golden files for the `agent`, `json` and `sarif` formatters. Redaction detector tests with positive and negative samples. Cache hit and miss. Budget truncation order.
- Surface parity: one test runs the same fixture through the CLI (`--format json`) and the MCP `run_peons` tool with `FakeProvider` and asserts identical findings JSON.
- Anthropic provider: recorded responses for the unit suite; one live smoke test skipped without a key.
- Launch peons: `peons test` in CI with a live key at the default thresholds.
- CLI: snapshot tests for plain-mode output; Ink views are not tested beyond rendering without throwing.

## 11. Errors and safety

- Exit codes are 0, 1, 2 as in 5.10, on every surface.
- Provider failure after retries marks that peon `error`; other peons complete; exit is 2.
- Permission violation, invalid manifest, lock mismatch and missing key are exit 2 with a specific message naming the peon and the file or field.
- File contents are data. The post-filter drops instruction-shaped findings.
- Secrets are redacted before caching and before any network call.
- The engine makes no network calls other than to the provider and, through the registry client during `add`, to the registry.

## 12. Out of scope for this spec

Boss and Jev routing, journal readers and rollups, vault, org inheritance, hosted runs, providers other than Anthropic, GitLab, tool-loop peons, the remaining three launch peons, static binary packaging. The registry service, website and registry CLI commands are in the companion spec.
