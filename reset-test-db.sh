#!/usr/bin/env bash
# Empties the test databases, so the next npm run dev starts fresh. Uses the logins in server/.env, and stop npm run dev first.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

echo "This deletes everything in the chatapp-test-env MariaDB and MongoDB databases."
read -rp "Type 'reset test' to continue: " answer
[[ "$answer" == "reset test" ]] || { echo "Cancelled. Nothing was changed."; exit 1; }

npm run --silent reset:test -w server
echo "Done. Clear this site's data in your browsers, then run npm run dev."
