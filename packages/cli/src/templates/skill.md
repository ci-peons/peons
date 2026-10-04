---
name: peons
description: Run specialised code reviewers (peons) on your changes. Use after editing files, before committing, or when asked to review.
---

# Peons

Peons are specialised reviewers configured in `peons.yaml`. Run them on staged changes and fix what they find before a human sees the PR.

## When to run
- After finishing an edit and staging it, before committing.
- When the user asks for a review or asks "is this ok".
- After fixing findings, re-run until exit code 0 or the user decides to stop.

## How to run
```bash
git add -A && peons run --scope staged --format agent
```
Only some peons: `peons run a11y react --scope staged --format agent`.
See what would run without calling a model: `peons plan --scope staged`.
When the repository has the Boss enabled or you pass --auto, add --intent "one line on what you changed" so routing can use it: peons run --auto --intent "Add idempotency key to booking creation" --scope staged --format agent.

## Reading the output
Each finding block is `[SEVERITY] file:line · peon/check`, the message, the offending lines, and a `Fix:` suggestion when present.
Exit code 0 means nothing blocking. Exit 1 means at least one finding meets the block severity: fix those first. Exit 2 means the engine failed: read the Peons line in the footer and tell the user.
Do not suppress or argue with findings; fix them or report them to the user with the peon's reasoning.
