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
| Databases | MariaDB (`users`, `channels`) and MongoDB (`messages`), both database and user named `chatapp` |

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
the nginx app config. The shared steps are in `deploy/common.sh`.

- **Server lockfile:** the regenerated `package-lock.json` differs from the committed one, which can block the next
  pull. If it does, run `git checkout package-lock.json` and pull again.
- **Shared dependencies:** both apps use the same `node_modules`, so `deploy-client.sh` also replaces the backend's
  packages. The running backend isn't restarted, so it picks them up at its next restart, possibly at newer versions.
- **mediasoup version:** it's pinned to an exact version in `server/package.json`, to match the compiled worker. To
  change it, compile the new worker using the [guide's pitfalls](NEW_PROJECT_GUIDE.md#pitfalls-on-this-server), update
  `MEDIASOUP_WORKER_BIN` in the service, and run `systemctl daemon-reload`.

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

- **New members:** each friend needs access to this machine on the tailnet, either as a member or through node
  sharing, plus the `INVITE_CODE`.

### Adding another site on port 443

Follow [the guide](NEW_PROJECT_GUIDE.md#6-serve-the-frontend). All sites on this hostname share one browser origin,
so only host sites you trust. A page from any of them can read the others' localStorage and call this app's API as
a signed-in user. Give anything less trusted its own hostname and `server` block.

## Known issues

- **The image limit is defined in three places.** To change it, update `MAX_IMAGE_BYTES` in `server/.env`, the same
  constant in `client/src/utils/images.ts`, and the messages in `client/src/utils/images.ts` and
  `server/src/middlewares/errorHandler.ts`.
- **No automated tests in the repository.** Run `npm run typecheck` and test changes by hand, including voice from
  two devices.
- **Unmeasured:** 20 people in voice at once on this CPU.
