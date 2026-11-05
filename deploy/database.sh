# Used by reset-prod-db.sh. Must run from the repo root, as root, on the server.
set -euo pipefail

[[ $EUID -eq 0 ]] || { echo "ERROR: run this as root, on the server" >&2; exit 1; }

MONGO_AUTH=()

# Asks for the MongoDB admin user once. mongosh and mongodump then ask for its password themselves, so it never
# appears in the process list. Leave it empty if MongoDB has no authentication.
ask_mongo_admin() {
  local admin
  read -rp "MongoDB admin user (empty if none): " admin
  if [[ -n "$admin" ]]; then MONGO_AUTH=(-u "$admin" --authenticationDatabase admin); fi
}

# Stops unless the user types the exact phrase.
confirm() {
  local answer
  read -rp "Type '$1' to continue: " answer
  [[ "$answer" == "$1" ]] || { echo "Cancelled. Nothing was changed."; exit 1; }
}

# Empties both databases. Users and their passwords live outside them, so logins keep working.
drop_databases() {
  mariadb -e "DROP DATABASE IF EXISTS \`$1\`; CREATE DATABASE \`$1\` CHARACTER SET utf8mb4;"
  echo "Enter the MongoDB password to drop '$1':"
  mongosh --quiet "${MONGO_AUTH[@]}" --eval "db.getSiblingDB('$1').dropDatabase()"
}
