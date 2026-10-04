# peons

Peons are specialized, testable AI code reviewers. This is the open source core of ci-peons: the peon package format, the engine that runs peons against a change set, the CLI, and the three surfaces that wrap it (GitHub Action, Claude Code skill, MCP server). The same engine produces identical results whether a peon runs in CI, in the CLI, or via MCP: one context pack, one model call, structured findings back.

## Install

Nothing is published yet. `npx peons`, `npx -y @peons/mcp` and `ci-peons/action@v1` all become available with the first release; until then the only supported install is a clone of this repository:

```bash
git clone https://github.com/ci-peons/peons
cd peons
bun install
bun packages/cli/src/index.ts --help   # or: bun run peons --help
```

Requirements: [Bun](https://bun.sh) 1.1+ to run from source, and Node 20 or newer for the built bundles (`bun run build`).

Set your Anthropic key before the first run:

```bash
export PEONS_API_KEY=sk-ant-...        # ANTHROPIC_API_KEY also works
```

There is no registry yet, so `peons add <name>` does not exist. Point each entry in `peons.yaml` at a local peon directory instead:

```yaml
peons:
  - use: ./peons/a11y
```

This repository ships two example peons you can copy or reference directly: `peons/a11y` and `peons/react`.

Prompt caching only kicks in once a peon's body plus the shared preamble is longer than the model's minimum cacheable prefix (4096 tokens on Haiku 4.5), so a small peon will report `0 cached` however often you run it.

## Commands

Run these as `bun run peons <command>` from the repo root until the CLI is published.

```bash
peons init                 # create peons.yaml and .peons/
peons list                 # show configured peons, their paths and read permissions
peons run --scope staged   # run configured peons against the staged change set
peons test                 # run each peon's fixtures and report recall/precision
```

## Boss (unreleased, needs an API key)

By default every configured peon runs on every file within its configured paths. The Boss is an
optional routing layer that looks at the changed files, trigger patterns, and (optionally) your
commit/PR intent, and decides which configured peons actually need to run on top of that — useful
once you have more peons registered than any single change calls for.

Turn it on for one run with `--auto` (`peons plan --auto --intent "..."`, `peons run --auto`), with
`auto: true` on the MCP `plan`/`run_peons` tools, or with the Action's `auto` input; or make it the
default for every run by adding a `boss:` block to `peons.yaml`:

```yaml
boss:
  enabled: true
  budget: { max_peons: 5 }
  always: [a11y]          # peons that always run when configured, decision or no decision
  never_skip: ["db/**"]   # paths the Boss is never allowed to prune a deterministically planned peon off
  thresholds: { dispatch: 0.7, prune: 0.15 }   # dispatch an unplanned peon at/above 0.7, prune a planned one at/below 0.15
```

`always` names must be configured peons; an unknown name is a config error. `never_skip` holds path globs, not peon names.
The Action's `auto` input follows `boss.enabled` when left unset; `auto: "true"` or `auto: "false"`
overrides it, and any other value fails the step.

The Boss calls a routing model ("Jev") to score which peons are relevant to the files, triggers and
intent it can't already decide from paths alone; set `TYPESAFE_API_KEY` to use it. Without that key
it falls back to asking your normal review model the same questions, using whichever of
`PEONS_API_KEY`/`ANTHROPIC_API_KEY` you already have set. With neither key configured, or when the
plan is already settled by paths and triggers, the Boss skips the decision step and the run is
unaffected other than a `boss` block in the plan noting why.

Routing fixtures for `.peons/boss-fixtures/` (one YAML file per scenario, with the changed files and
which peons should and should not be dispatched) let you score the Boss's own accuracy:

```bash
peons boss-test
```

This calls the real routing model (or review model, as a fallback), so it is a live check against
an external API, not a unit test — run it manually, not on every push. The `peons-fixtures` CI job
runs it on manual dispatch (`workflow_dispatch`) given `TYPESAFE_API_KEY`/`PEONS_API_KEY` secrets.

## GitHub Action (unreleased)

`ci-peons/action@v1` is not tagged yet. Once it is:

```yaml
- uses: actions/checkout@v4
  with: { fetch-depth: 0 }
- uses: ci-peons/action@v1
  with: { api-key: ${{ secrets.PEONS_API_KEY }} }
```

`fetch-depth: 0` is required so the action can resolve the default-branch scope. The action accepts `scope: branch` (the default) or `scope: staged`. Add `auto: "true"` to let the Boss choose peons from the change set, triggers and the PR title/body — see [Boss](#boss-unreleased-needs-an-api-key).

## Claude Code (available today)

`peons init --claude` installs a Claude Code skill and a `/peons` slash command alongside `peons.yaml`.

## MCP server (unreleased)

`@peons/mcp` is not published yet. Once it is, add to your MCP client config:

```json
{ "command": "npx", "args": ["-y", "@peons/mcp"] }
```

From a clone, point your client at the source instead:

```json
{ "command": "bun", "args": ["<path-to-clone>/packages/mcp/src/index.ts"] }
```

## Design

- [Peon core design](docs/superpowers/specs/2026-09-19-peon-core-design.md)
- [Registry design](docs/superpowers/specs/2026-09-19-registry-design.md)
