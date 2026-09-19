# peons

Peons are specialized, testable AI code reviewers. This is the open source core of ci-peons: the peon package format, the engine that runs peons against a change set, the CLI, and the three surfaces that wrap it (GitHub Action, Claude Code skill, MCP server). The same engine produces identical results whether a peon runs in CI, in the CLI, or via MCP: one context pack, one model call, structured findings back.

## Commands

```bash
peons init                 # create peons.yaml and .peons/
peons run --scope staged   # run configured peons against the staged change set
peons test                 # run each peon's fixtures and report recall/precision
```

## GitHub Action

```yaml
- uses: actions/checkout@v4
  with: { fetch-depth: 0 }
- uses: ci-peons/action@v1
  with: { api-key: ${{ secrets.PEONS_API_KEY }} }
```

`fetch-depth: 0` is required so the action can resolve the default-branch scope.

## Claude Code

`peons init --claude` installs a Claude Code skill and a `/peons` slash command alongside `peons.yaml`.

## MCP server

Add to your MCP client config:

```json
{ "command": "npx", "args": ["-y", "@peons/mcp"] }
```

## Design

- [Peon core design](docs/superpowers/specs/2026-09-19-peon-core-design.md)
- [Registry design](docs/superpowers/specs/2026-09-19-registry-design.md)
