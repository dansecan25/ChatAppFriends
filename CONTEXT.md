# Project context

Read this before changing the project. It covers the rules to follow and how production runs. For the code itself,
see [DOCUMENTATION.md](DOCUMENTATION.md).

The repository is public, so this file uses placeholders such as `<server-hostname>`. The real values are in
`CONTEXT.local.md`, which is gitignored and only exists on the owner's machine. Never commit hostnames, IPs, secrets
or `.env` contents.

## Rules

### Structure

- Keep both apps in this repository, with a root `package.json` that runs them together using `concurrently`.
- The frontend is Vue and the backend is Node.js, both in TypeScript.
- Use the existing folders for their stated purpose, as described in
  [DOCUMENTATION.md](DOCUMENTATION.md#project-structure). Don't add a new top-level folder when one of these fits.

| Backend code | Goes in |
|---|---|
| Database or external client setup | `connections/` |
| URLs | `routes/` |
| Input validation and responses | `controllers/` |
| Business rules and broadcasts | `services/` |
| Queries | `models/` |
| Small shared helpers | `utils/` |

| Frontend code | Goes in |
|---|---|
| HTTP calls | `api/` |
| Converting API data to display data | `mappers/` |
| Shared state | `stores/` |
| Reusable component logic | `composables/` |
| Small shared helpers | `utils/` |

### Clean code

- **No code repetition.** Before writing something, search for an existing helper and reuse it. If two places need
  the same logic, move it to the right shared folder.
- **Keep layers separate.** Controllers don't query databases, models hold no business rules, and components call
  stores rather than `fetch`.
- **Keep comments minimal.** Use a short comment to document a function, and only add others to explain why
  something unusual is needed.
- **Keep code understandable.** Prefer clear names and small functions.

### Product limits

- Up to 20 people.
- Images up to 1 GB.
- Voice chat and creating multiple channels are core features.
- Servers and codes are defined by hand. `INVITE_CODE` holds the codes, and `server/src/serverDefinitions.ts` lists the
  servers in the same order, so code `[0]` is Leonas and code `[1]` is SufriTEC. Users can't create servers.
- A code's users only see that server, unless they join another with its code under server settings.
- Any member can rename their own server.
- Revoking a code only blocks new use of it. People who already joined keep their access.
- Removing a member is the way to take someone's access away. It replaces the server key, but they can rejoin with the
  code until it's revoked and replaced.
- The owner uses the master code, belongs to every server and sees the server tabs.
- The owner must not be able to read DMs, or role-limited channels unless they hold the role. Don't add any bypass,
  backdoor or key escrow for this.

### Encryption

- Message content, filenames and keys must only be handled unencrypted in the browser. The server stores them opaquely.
- Check access in `services/accessService.ts`, and send socket events only to those allowed.
- Be accurate about what's protected. [DOCUMENTATION.md](DOCUMENTATION.md#what-encryption-protects) lists the limits.

### Git

- Commit messages start with a tag, such as `[ADD] ...` or `[UPDATE] ...`.
- The branches are `main` and `develop`.

## Production setup

| Item | Value |
|---|---|
| Server | MacBook Pro 2011 running Arch Linux, accessed over SSH |
| Network | Tailscale, which also provides the HTTPS certificates |
| Frontend URL | `https://<server-hostname>/chatappfriends/` |
| Backend URL | `https://<server-hostname>:8443`, health check at `/api/health` |
| Voice port | 40000, UDP and TCP |
| Backend service | `chatappdiscord.service`, at `/etc/systemd/system/` |
| Backend code | A git clone at `<repo-path>` on the server, run from `<repo-path>/server` |
| Backend settings | `<repo-path>/server/.env` |
| mediasoup worker | `/opt/mediasoup/3.32.2/mediasoup-worker`, set through `MEDIASOUP_WORKER_BIN` |
| Frontend files | `/srv/http/chatappfriends/` |
| nginx server block | `/etc/nginx/conf.d/https-server.conf`, from `deploy/nginx-server.conf` |
| nginx app routes | `/etc/nginx/apps/chatappfriends.conf`, from `deploy/nginx-app.conf` |
| Databases | MariaDB (accounts, servers, roles, channels, keys) and MongoDB (`messages`), both database and user named `chatapp` |

The server's CPU doesn't support AVX2, so it can't run mediasoup's prebuilt worker. The worker was compiled on the
server, which took about 30 minutes, and saved outside `node_modules` so it survives reinstalls.

Port 443 is shared. Each frontend gets a route and a folder, and the bare hostname redirects to
`/chatappfriends/`.

Other services run on this server too, so check a port is free before using it.

### Production `server/.env` values

These differ from the local defaults:

```bash
HOST=<tailscale-ip>
PORT=8443
CLIENT_ORIGIN=https://<server-hostname>
MEDIA_LISTEN_IP=<tailscale-ip>
MASTER_INVITE_CODE=<generated>
INVITE_CODE=<leonas-code>,<sufritec-code>
DATA_ENCRYPTION_KEY=<generated>
```

`CLIENT_ORIGIN` has no path, because a browser origin never includes the `/chatappfriends/` route.

### Updating production

On the server, as root, from the repository. Pull first, because the scripts don't.

If only the backend changed:

```bash
git pull
./deploy-server.sh
systemctl restart chatappdiscord.service
```

If only the frontend changed:

```bash
git pull
./deploy-client.sh
systemctl reload nginx.service
```

Both scripts delete `node_modules` and `package-lock.json`, then install fresh ones. `deploy-server.sh` then builds
the backend. `deploy-client.sh` builds the frontend, copies it to `/srv/http/chatappfriends/`, and updates and tests
the nginx app config. The shared steps are in `deploy/common.sh`, which runs `regenerate-packages.sh`.

- **Server lockfile:** the regenerated `package-lock.json` differs from the committed one, which can block the next
  pull. If it does, run `git checkout package-lock.json` and pull again.
- **Shared dependencies:** both apps use the same `node_modules`, so `deploy-client.sh` also replaces the backend's
  packages. The running backend isn't restarted, so it picks them up at its next restart, possibly at newer versions.
- **mediasoup version:** it's pinned to an exact version in `server/package.json`, to match the compiled worker. To
  change it, compile the new worker using the [guide's pitfalls](NEW_PROJECT_GUIDE.md#pitfalls-on-this-server), update
  `MEDIASOUP_WORKER_BIN` in the service, and run `systemctl daemon-reload`.

### Starting production fresh

Use this instead of the migration below if nothing in production is worth keeping. It deletes all accounts and messages,
and everyone signs up again, so only do it once.

1. Merge to `main`, and on the server add `MASTER_INVITE_CODE`, `INVITE_CODE` and `DATA_ENCRYPTION_KEY` to `server/.env`.
2. Run `git pull`, then `./reset-prod-db.sh`. It backs up to `/root/chatapp-backups/` first and stops the service.
3. Run `./deploy-server.sh` and `./deploy-client.sh`.
4. Run `systemctl start chatappdiscord.service` and `systemctl reload nginx.service`.
5. Sign up with your `MASTER_INVITE_CODE`, then send each group its code.

Normal updates to `main` only need the deploy scripts. Don't run `reset-prod-db.sh` for them.

To reset the test databases used by `npm run dev`, stop it and run `./reset-test-db.sh` on your laptop, without `sudo`.
Then clear the site's data in your browsers. It refuses to run unless `server/.env` points at `chatapp-test-env`.

### Moving to the encrypted version

The app refuses to start on an old database until it's migrated, and `npm run dev` on any machine with an old database
stops the same way. The migration changes the schema and can't be undone, except by restoring a backup. Its SQL has only
been reviewed, not run, so try it on a copy first.

1. Add `MASTER_INVITE_CODE`, `INVITE_CODE` and `DATA_ENCRYPTION_KEY` to `server/.env`, generated as the
   [README](README.md) describes. Keep a separate backup of `DATA_ENCRYPTION_KEY`, because usernames and open channels
   can't be read without it.
2. Back up both databases and the uploads folder, and stop the service.
3. Try the migration on a copy of the databases by overriding `MARIADB_DATABASE` and `MONGODB_DATABASE` for that one
   command, after building with `npm run build:server`:

   ```bash
   MARIADB_DATABASE=<copy> MONGODB_DATABASE=<copy> npm run migrate -w server
   ```

4. If that works, run `npm run migrate -w server` on the real databases, then deploy both apps.
5. Sign in with your existing account, save the recovery key, and enter your `MASTER_INVITE_CODE` on the join page. That
   makes you the owner, in every server. Existing channels go to the first server in the list.
6. Send each group its code. Existing friends sign in as usual, save their recovery key and enter the code. New friends
   sign up with it.

If the database does have old messages, they stay readable and marked "Not encrypted". To permanently delete them and
their images, run `npm run migrate -w server -- --purge-old-messages`.

### Adding a server or replacing a code

To add a server:

1. Add a code to the end of `INVITE_CODE` in `server/.env`.
2. Add a line to the end of the list in `server/src/serverDefinitions.ts`. Never reorder this list, because a server is
   tied to its position.
3. Deploy the backend and restart it. The server is created at startup, and the app won't start if the two lists have
   different lengths.

To replace a code:

1. In server settings, enter the old code under **Revoke an invite code**. That adds it to the blacklist right away.
2. Put a new code in the same position in `INVITE_CODE`, and restart the backend. Until then, nobody new can join that
   server.

### Operations

```bash
systemctl status chatappdiscord.service
journalctl -u chatappdiscord.service -f
systemctl status nginx.service
```

- **Backups:** back up MariaDB, MongoDB and the `UPLOAD_DIR` folder together.
- **Disk space:** uploads are refused once free space drops below `MAX_IMAGE_BYTES`.
- **Certificates:** Tailscale certificates last about 90 days, and nothing in this project renews them. Both programs
  only load them at startup, so after a renewal run:

  ```bash
  systemctl restart chatappdiscord.service
  systemctl reload nginx.service
  ```

- **After removing someone:** they can still rejoin with the code, so replace it if they shouldn't.
- **New members:** each friend needs access to this machine on the tailnet, either as a member or through node
  sharing, plus their server's code from `INVITE_CODE`.

### Adding another site on port 443

Follow [the guide](NEW_PROJECT_GUIDE.md#6-serve-the-frontend). All sites on this hostname share one browser origin,
so only host sites you trust. A page from any of them can read the others' localStorage and call this app's API as
a signed-in user. Give anything less trusted its own hostname and `server` block.

## Known issues

- **The image limit is defined in several places.** To change it, update `MAX_IMAGE_BYTES` in `server/.env`, the same
  constant in `client/src/utils/images.ts`, and the messages in `client/src/utils/images.ts` and
  `server/src/services/fileService.ts`. The 4 MB chunk size is also set in both `fileService.ts` and
  `client/src/services/crypto/fileCrypto.ts`.
- **The SQL hasn't been run.** Tests used an in-memory stand-in for the databases, so `models/*.ts` and
  `models/migrate.ts` need a first run on a copy.
- **No automated tests in the repository.** Run `npm run typecheck` and test changes by hand, including voice from
  two devices.
- **Unmeasured:** 20 people in voice at once on this CPU.
