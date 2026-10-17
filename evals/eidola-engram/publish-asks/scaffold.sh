#!/usr/bin/env bash
# Marks the run's workspace as an eval's (.eidola-eval: the Engram home
# script then refuses the real ~/.claude/eidola if EVAL_EIDOLA_HOME is
# missing), makes an Engram the person made earlier (pub-mote, from the
# starter) in the run's Engram home, and a local bare git repo standing in
# for GitHub. Nothing here reaches a real remote.
set -euo pipefail
CASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOD="$(cd "$CASE_DIR/../../.." && pwd)"
printf 'eidola eval workspace: the Engram home is ./eidola-home\n' > .eidola-eval
node "$MOD/scripts/engram-home.mjs" new pub-mote --home eidola-home --name "Pub Mote" --author "Eval Tester" --description "A small mote of light, ready to share."
git init --bare --quiet remote.git
