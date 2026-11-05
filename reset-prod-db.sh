#!/usr/bin/env bash
# Backs up and then empties production, for a clean start. Everyone has to sign up again.
# Don't run this as part of normal deploys: it deletes all accounts and messages.
DB=chatapp
SERVICE=chatappdiscord.service
BACKUP_DIR="/root/chatapp-backups/$(date +%Y%m%d-%H%M%S)"
cd "$(dirname "${BASH_SOURCE[0]}")"
source deploy/database.sh

# Reads the upload folder from server/.env, relative to server/ like the app does.
upload_dir() {
  local dir
  dir="$(grep -E '^UPLOAD_DIR=' server/.env | cut -d= -f2- | tr -d '"' || true)"
  dir="${dir:-./uploads}"
  [[ "$dir" == /* ]] && echo "$dir" || echo "$PWD/server/$dir"
}

count_accounts() {
  mariadb -N -e "SELECT COUNT(*) FROM \`$DB\`.users" 2>/dev/null || echo "none"
}

command -v mongodump >/dev/null || { echo "ERROR: mongodump is not installed, so MongoDB can't be backed up. Nothing was changed." >&2; exit 1; }

echo "This deletes PRODUCTION: all accounts, messages, roles and images."
echo "Accounts in the database: $(count_accounts)"
echo "A backup goes to $BACKUP_DIR first."
confirm "delete production"
ask_mongo_admin

systemctl stop "$SERVICE"

install -d -m 700 "$BACKUP_DIR"
mariadb-dump --single-transaction --databases "$DB" > "$BACKUP_DIR/mariadb.sql"
echo "Enter the MongoDB password for the backup:"
mongodump "${MONGO_AUTH[@]}" --db "$DB" --out "$BACKUP_DIR/mongodb"
uploads="$(upload_dir)"
if [[ -d "$uploads" ]]; then
  mv "$uploads" "$BACKUP_DIR/uploads"
fi
echo "Backup saved to $BACKUP_DIR"

drop_databases "$DB"

echo "Done. $SERVICE is stopped. Deploy with ./deploy-server.sh and ./deploy-client.sh, then run:"
echo "  systemctl start $SERVICE"
echo "  systemctl reload nginx.service"
