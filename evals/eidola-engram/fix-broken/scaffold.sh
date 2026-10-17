#!/usr/bin/env bash
# Marks the run's workspace as an eval's (.eidola-eval: the Engram home
# script then refuses the real ~/.claude/eidola if EVAL_EIDOLA_HOME is
# missing), puts the broken Engram fixture in the run's Engram home
# (./eidola-home), and lists it in the home's marketplace, as if the person
# had made it earlier.
set -euo pipefail
CASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOD="$(cd "$CASE_DIR/../../.." && pwd)"
printf 'eidola eval workspace: the Engram home is ./eidola-home\n' > .eidola-eval
mkdir -p eidola-home/engrams
cp -R "$CASE_DIR/fixture/broken-moth" eidola-home/engrams/broken-moth
node "$MOD/scripts/engram-home.mjs" sync --home eidola-home
