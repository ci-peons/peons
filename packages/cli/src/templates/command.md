---
description: Run peons on staged changes and fix the findings
---
Run `peons run --scope staged --format agent` with Bash. If there are no staged changes, stage the files you changed first. Read every finding, fix the ones at or above the block severity, re-stage, and re-run until the exit code is 0. Report remaining lower-severity findings to the user.
