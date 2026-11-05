#!/usr/bin/env bash
# Reinstalls dependencies and builds the backend. Pull first, and restart the service afterwards.
cd "$(dirname "${BASH_SOURCE[0]}")"
source deploy/common.sh

reinstall_dependencies
npm run build:server

echo "Done. Now run: systemctl restart chatappdiscord.service"
