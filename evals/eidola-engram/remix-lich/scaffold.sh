#!/usr/bin/env bash
# Marks the run's workspace as an eval's: scripts/engram-home.mjs then refuses
# the real ~/.claude/eidola when no home is given (EVAL_EIDOLA_HOME missing),
# and reads the case's relative EVAL_EIDOLA_HOME (eidola-home) from here.
set -euo pipefail
printf 'eidola eval workspace: the Engram home is ./eidola-home\n' > .eidola-eval
