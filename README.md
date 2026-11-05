# ChatAppFriends

Self-hosted voice, text and image chat for up to 20 friends, reachable over Tailscale.

- **Frontend:** Vue 3, TypeScript, Pinia, served by nginx on port 443 at `/chatappfriends/`
- **Backend:** Node.js, TypeScript, Express, Socket.IO, served over HTTPS on port 8443
- **Voice:** WebRTC through a mediasoup SFU, on port 40000 (UDP, with TCP as a fallback)
- **Data:** MariaDB for users and channels, MongoDB for messages, the disk for images

## Project layout

```
server/src/
  connections/   MariaDB, MongoDB, mediasoup and Socket.IO setup
  models/        Database access and schema
  services/      Business logic
  controllers/   HTTP and socket request handling
  routes/        URL definitions
  middlewares/   Auth, origin guard, uploads, errors
  utils/         Small shared helpers
client/src/
  api/           HTTP calls
  services/      Socket client and voice (WebRTC) client
  stores/        Pinia state
  mappers/       API data to display models
  composables/   Reusable component logic
  components/    UI pieces
  views/         Screens
  utils/, types/ Helpers and type definitions
deploy/          nginx, systemd and environment templates
deploy.sh        Builds and installs on the server
```

## Local development

Requires Node.js 22 or newer, plus MariaDB and MongoDB. To use the server's databases instead of installing
them locally, open a tunnel first:

```bash
ssh -N -L 3306:127.0.0.1:3306 -L 27017:127.0.0.1:27017 <your-server>
```

```bash
npm install
cp server/.env.example server/.env   # then fill in the secrets and database credentials
npm run dev
```

The app opens at http://localhost:5173/chatappfriends/ and the API runs on http://localhost:8443.

Firefox ignores loopback addresses for WebRTC. To test voice in it, set `MEDIA_LISTEN_IP` to your LAN or
Tailscale IP.

## Server setup (first deploy)

1. Install the requirements:

   ```bash
   sudo pacman -S --needed nodejs npm nginx git
   ```

2. Create the database and user (use your own password):

   ```bash
   sudo mariadb -e "CREATE DATABASE chatapp CHARACTER SET utf8mb4;
     CREATE USER 'chatapp'@'localhost' IDENTIFIED BY 'choose-a-password';
     CREATE USER 'chatapp'@'127.0.0.1' IDENTIFIED BY 'choose-a-password';
     GRANT ALL ON chatapp.* TO 'chatapp'@'localhost';
     GRANT ALL ON chatapp.* TO 'chatapp'@'127.0.0.1';"
   ```

   Tables, indexes and the starter channels are created automatically on first start.

3. Make sure the `http { ... }` block of `/etc/nginx/nginx.conf` contains:

   ```nginx
   include /etc/nginx/conf.d/*.conf;
   ```

4. Clone the repo on the server, then point the deploy at your certificates:

   ```bash
   cp deploy/deploy.env.example deploy/deploy.env
   nano deploy/deploy.env
   ```

5. Run the deploy. The first run creates `/etc/chatappfriends/server.env` with a generated secret and invite
   code, then stops so you can add the database password:

   ```bash
   ./deploy.sh
   sudo nano /etc/chatappfriends/server.env
   ./deploy.sh
   ```

6. If a firewall is enabled, allow these ports on `tailscale0`: 443/tcp, 8443/tcp, 40000/udp and 40000/tcp.

7. Share the invite code with your friends. They need it once, to register:

   ```bash
   sudo grep INVITE_CODE /etc/chatappfriends/server.env
   ```

## Hosting more sites on port 443

`deploy/nginx-server.conf` is the single HTTPS server, and it loads every file in `/etc/nginx/apps/`. To add a
site called `myapp`:

1. Build it for its route (for Vite, `base: '/myapp/'`) and copy the output to `/srv/http/myapp/`.
2. Copy `deploy/nginx-app.conf` to `/etc/nginx/apps/myapp.conf` and change the routes and security headers.
3. Run `sudo nginx -t && sudo systemctl reload nginx`.

All sites share one browser origin, so they share localStorage and can call each other's APIs. Only host sites
you trust here, or give a site its own hostname and `server` block.

## Updating

```bash
./deploy.sh            # pulls the current branch, rebuilds and restarts
./deploy.sh --no-pull  # deploys the code already on disk
```

## Operations

```bash
systemctl status chatappfriends
journalctl -u chatappfriends -f
```

- **Images** are stored in `/var/lib/chatappfriends/uploads`. Back this up along with both databases.
- **Disk space:** uploads are refused once free space drops below the maximum image size (1 GB).
- **Certificates:** Tailscale certificates last about 90 days. After renewing, run
  `sudo systemctl restart chatappfriends && sudo systemctl reload nginx`, because the backend loads them only
  at startup.
- **Friends on Tailscale:** each friend needs to reach this machine on your tailnet, either as a member or
  through node sharing. Voice connects to the server only, never directly between friends, so sharing this one
  node is enough.
