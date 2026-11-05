# New project guide

How to create and host another web app on the Arch Linux server (a 2011 MacBook Pro) with an agent's help. Give this
file to the agent at the start of the project.

This is the method used for ChatAppFriends, written generally. Replace `<app>`, `<port>` and `<server-hostname>`
with your own values.

## How to work with the agent

1. Describe the app, its features, its limits and who will use it.
2. Have the agent build and test the app locally first.
3. The agent usually has no access to the server, so it gives you commands to run over SSH. Run them one step at a
   time and paste back any errors.
4. Deploy the backend first and check its health endpoint before starting on the frontend.

## Project rules

### Repository

- Keep the frontend and backend in one repository, as npm workspaces named `client` and `server`.
- Add a root `package.json` where `npm run dev` starts both with `concurrently`.
- Add root scripts for `build`, `build:client`, `build:server` and `typecheck`.
- Use TypeScript in both.
- Never commit `.env` files, secrets, uploads or build output. Commit a `.env.example` instead.
- Check whether the repository is public before writing server details into its files.

### Backend folders

| Folder | Holds | Doesn't hold |
|---|---|---|
| `connections/` | Database and external client setup | Queries |
| `routes/` | URLs and which middleware applies | Logic |
| `controllers/` | Input validation, calling services, responses | Queries |
| `services/` | Business rules | HTTP details |
| `models/` | Database queries | Business rules |
| `middlewares/` | Auth, errors, upload handling | Feature logic |
| `utils/` | Small shared helpers | Anything tied to one feature |

Validate environment variables when the server starts, in a single `config.ts`.

### Frontend folders

| Folder | Holds |
|---|---|
| `api/` | HTTP calls, through one shared request function |
| `mappers/` | Converting API data to display data |
| `types/` | API and display types |
| `stores/` | Shared state |
| `services/` | Clients that aren't plain HTTP, such as sockets |
| `composables/` | Reusable component logic |
| `views/` | One component per page |
| `components/` | The pieces pages are built from |
| `utils/` | Small shared helpers |

### Clean code

- Don't repeat code. Search for an existing helper first, and move shared logic to the right folder.
- Use the existing folders for their purpose, and don't add new ones without a reason.
- Keep comments minimal: a short one to document a function, and otherwise only to explain why something unusual is
  needed.
- Prefer clear names and small functions.

### Project documents

Every project gets these four, without repeating each other's content:

| File | Contents |
|---|---|
| `README.md` | What it does, its features, local setup and the environment values to fill in |
| `DOCUMENTATION.md` | Structure, pages, and the endpoints each page uses |
| `CONTEXT.md` | Rules, production setup, known issues |
| `CONTEXT.local.md` | Real server values, gitignored |

## Server setup

Each app needs a backend port, a frontend route and a folder.

| Item | Rule |
|---|---|
| Frontend | Served by the shared nginx on 443, at `https://<server-hostname>/<app>/` |
| Backend | A systemd service on its own port. The first app uses 8443, so continue with 8444, 8445 and so on. |
| Certificates | Tailscale certificates, in `/var/lib/tailscale/certs/` |

Check that a port is free before using it:

```bash
ss -tlnp | grep ':<port> '
```

### 1. Set the frontend's base route

In `client/vite.config.ts`:

```ts
export default defineConfig({
  base: '/<app>/',
});
```

In the router:

```ts
createRouter({ history: createWebHistory(import.meta.env.BASE_URL), routes });
```

Use `import.meta.env.BASE_URL` for any other links to your own files.

To find the API, use the page's own hostname, so the frontend needs no `.env`:

```ts
export const API_URL = `${window.location.protocol}//${window.location.hostname}:<port>`;
```

### 2. Allow the frontend's origin in the backend

- Allow only `https://<server-hostname>` in CORS. An origin has no path, so leave `/<app>/` out.
- Use a session cookie name unique to this app. Cookies aren't separated by port, so every backend on this hostname
  receives them.

### 3. Prepare the databases

MariaDB:

```bash
mariadb -e "CREATE DATABASE <app> CHARACTER SET utf8mb4;
  CREATE USER '<app>'@'localhost' IDENTIFIED BY 'choose-a-password';
  CREATE USER '<app>'@'127.0.0.1' IDENTIFIED BY 'choose-a-password';
  GRANT ALL ON <app>.* TO '<app>'@'localhost';
  GRANT ALL ON <app>.* TO '<app>'@'127.0.0.1';"
```

MongoDB:

```bash
mongosh --eval "db.getSiblingDB('<app>').createUser({
  user: '<app>', pwd: 'choose-a-password', roles: [{ role: 'readWrite', db: '<app>' }]
})"
```

The MongoDB URI needs to name the database the user was created in:

```
mongodb://<app>:PASSWORD@127.0.0.1:27017/?authSource=<app>
```

### 4. Clone and build on the server

```bash
git clone <repo-url>
cd <repo-folder>
npm ci
cp server/.env.example server/.env
nano server/.env
npm run build:server
```

Set `HOST` to the server's Tailscale IP (`tailscale ip -4`), so the backend is only reachable over Tailscale. Set the
port and the production origin as well.

### 5. Create the backend service

Run this from the repository root, after replacing the placeholders:

```bash
cat > /etc/systemd/system/<app>.service <<EOF
[Unit]
Description=<app> backend
After=network-online.target tailscaled.service mariadb.service mongodb.service
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=$PWD/server
ExecStart=/usr/bin/node dist/index.js
Environment=NODE_ENV=production
LoadCredential=tls.crt:/var/lib/tailscale/certs/<server-hostname>.crt
LoadCredential=tls.key:/var/lib/tailscale/certs/<server-hostname>.key
Environment=TLS_CERT_PATH=%d/tls.crt
Environment=TLS_KEY_PATH=%d/tls.key
Restart=always
RestartSec=5
LimitNOFILE=65536
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=full

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now <app>.service
systemctl status <app>.service --no-pager
curl https://<server-hostname>:<port>/api/health
```

- `LoadCredential` lets the service read the private key without changing the key's permissions.
- With no `User=` line, the service runs as root, which means a bug in the app could affect the whole server. To avoid
  that, create a dedicated user, keep the clone outside `/root`, give that user ownership of the clone, and add
  `User=<app>`.

### 6. Serve the frontend

The shared server block already exists at `/etc/nginx/conf.d/https-server.conf` and loads every file in
`/etc/nginx/apps/`, so a new app only adds its own file. Don't add another `server` block for port 443 on this
hostname.

Build the frontend and copy it where nginx can read it. nginx can't read `/root`:

```bash
npm run build:client
rm -rf /srv/http/<app>
cp -r client/dist /srv/http/<app>
chmod -R a+rX /srv/http/<app>
```

Create `deploy/nginx-app.conf` in the project:

```nginx
location = /<app> {
    return 301 /<app>/;
}

location /<app>/ {
    # nginx drops inherited add_header lines once a block has its own, so each app lists them all.
    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "same-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://__HOSTNAME__:<port>; connect-src 'self' https://__HOSTNAME__:<port> wss://__HOSTNAME__:<port>; object-src 'none'; base-uri 'self'; frame-ancestors 'none'" always;

    expires -1;
    try_files $uri /<app>/index.html;

    location /<app>/assets/ {
        expires 1y;
        try_files $uri =404;
    }
}
```

Adjust the permissions and security policy for what the app needs. For example, voice needs `microphone=(self)`.

Install it on the server and reload nginx:

```bash
sed -e 's|__HOSTNAME__|<server-hostname>|g' deploy/nginx-app.conf > /etc/nginx/apps/<app>.conf
nginx -t
systemctl reload nginx.service
```

Test it from another device:

```bash
curl -I https://<server-hostname>/<app>/
```

To make the new app open at the bare hostname, change the `location = /` redirect in `https-server.conf`.

### 7. Check the finished app

- Sign in and use every main feature from a real browser, not just `curl`.
- If a firewall is enabled, allow the app's ports on `tailscale0`.
- Check that signing in works, because a wrong origin setting won't show up in the health check.

## Pitfalls on this server

**Prebuilt native packages may not run.** The CPU is a 2011 Sandy Bridge without AVX2, so binaries built for
x86-64-v3 fail. Other Node apps can run fine at the same time, because this only affects packages that ship such a
binary.

To check a binary:

```bash
readelf -n <binary> | grep -i 'x86 ISA needed'
```

**Compiling on this machine is slow.** mediasoup took about 30 minutes. Run long builds in tmux at low priority, so
a dropped SSH connection doesn't stop them and other services keep running:

```bash
pacman -S --needed python-pip base-devel tmux
tmux
nice -n 19 npm ci
```

Then save the compiled file outside `node_modules`, or the next install compiles it again. For mediasoup:

```bash
install -D -m 755 node_modules/mediasoup/worker/out/Release/mediasoup-worker /opt/mediasoup/<version>/mediasoup-worker
```

Point the service at it with `Environment=MEDIASOUP_WORKER_BIN=/opt/mediasoup/<version>/mediasoup-worker`, and set the
same variable when running `npm ci`.

**Build dependencies need matching versions.** Check a tool's supported versions before upgrading. For example,
`vue-tsc` didn't support TypeScript 7, so the project stayed on 6.

**A healthy backend doesn't prove the app works.** The health endpoint doesn't test the origin setting, signing in
or real database queries.

**Firefox ignores loopback for WebRTC.** When testing voice locally, use a LAN or Tailscale IP.

**Certificates expire after about 90 days.** Restart the service and reload nginx after renewing them.
