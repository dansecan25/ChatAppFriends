# ChatAppFriends

A self-hosted voice, text and image chat for a small group of friends. Think of a small private Discord that
runs on your own server.

## Features

- **Servers:** each invite code leads to one server, and members only see theirs. Anyone in a server can rename it, and
  anyone with another server's code can join that one too.
- **End-to-end encryption:** messages and images in channels and DMs are encrypted in the browser, so the database and
  disk only hold ciphertext. See [what this does and doesn't protect](DOCUMENTATION.md#what-encryption-protects).
- **Direct messages:** private conversations that only the two people in them can read, not even the owner.
- **Roles:** admins create roles, and a channel can be limited to chosen roles. Its encryption key only goes to those
  people.
- **Mentions:** type `@` for people and `#` for channels, with suggestions as you type. Mentions of you are highlighted.
- **Notifications:** browser notifications for DMs, mentions and new messages while a tab is open. Each channel can be
  muted, which still lets mentions of you through.
- **Member list:** each channel shows who can use it, with a green bubble for those online.
- **Profiles:** everyone can set a profile picture, and a nickname for each server. Account names can't change.
- **Voice chat:** mute, deafen and speaking indicators, with audio routed through the server.
- **Images up to 1 GB:** upload progress and cancel. PNG, JPEG, GIF, WebP, AVIF and BMP are accepted, and images over
  25 MB load only when asked.
- **Removing members:** admins can remove someone from a server. Its encryption key is replaced, so that person can't
  read anything new.
- **Owner tools:** the owner belongs to every server, switches between them from a tab bar, and can revoke invite codes.
- **Account recovery:** a recovery key saved at signup restores access after a forgotten password.

## Run it locally

### 1. Install the requirements

- Node.js 22 or newer
- MariaDB and MongoDB, either local or reachable over the network

### 2. Install the dependencies

```bash
npm install
```

The voice engine (mediasoup) ships a prebuilt binary that needs an AVX2 CPU. On older CPUs, `npm install` compiles
it instead, which needs Python with pip and a C++ toolchain and can take a long time.

### 3. Create the database users

Choose your own passwords.

MariaDB:

```bash
sudo mariadb -e "CREATE DATABASE chatapp CHARACTER SET utf8mb4;
  CREATE USER 'chatapp'@'localhost' IDENTIFIED BY 'choose-a-password';
  CREATE USER 'chatapp'@'127.0.0.1' IDENTIFIED BY 'choose-a-password';
  GRANT ALL ON chatapp.* TO 'chatapp'@'localhost';
  GRANT ALL ON chatapp.* TO 'chatapp'@'127.0.0.1';"
```

MongoDB, only if authentication is enabled:

```bash
mongosh --eval "db.getSiblingDB('chatapp').createUser({
  user: 'chatapp', pwd: 'choose-a-password', roles: [{ role: 'readWrite', db: 'chatapp' }]
})"
```

### 4. Fill in the environment values

```bash
cp server/.env.example server/.env
```

You need to provide these in `server/.env`:

| Variable | What to enter |
|---|---|
| `JWT_SECRET` | A random secret of at least 32 characters. Generate one with `openssl rand -hex 32`. |
| `MASTER_INVITE_CODE` | The code that creates the owner account, once. Generate one with `openssl rand -hex 16`. |
| `INVITE_CODE` | One code per server, separated by commas, in the same order as `server/src/serverDefinitions.ts`. Generate each with `openssl rand -hex 8`. |
| `DATA_ENCRYPTION_KEY` | Encrypts usernames and server keys in the database. Generate one with `openssl rand -hex 32`, and back it up: losing it makes usernames and open channels unreadable. |
| `MARIADB_PASSWORD` | The MariaDB password from step 3. |
| `MONGODB_URI` | With authentication: `mongodb://chatapp:PASSWORD@127.0.0.1:27017/?authSource=chatapp`. Without it, keep the default. |

These already have working defaults for local use:

| Variable | Default | When to change it |
|---|---|---|
| `NODE_ENV` | `development` | Leave it. The production service sets its own. |
| `HOST`, `PORT` | `127.0.0.1`, `8443` | The API address. If you change the port, also set `VITE_API_URL` in `client/.env`. |
| `CLIENT_ORIGIN` | `http://localhost:5173` | The frontend address. Other origins are rejected. |
| `MAX_USERS` | `20` | The member limit per server, also used as the limit per voice channel. |
| `MARIADB_HOST`, `MARIADB_PORT` | `127.0.0.1`, `3306` | Your database is elsewhere. |
| `MARIADB_USER`, `MARIADB_DATABASE` | `chatapp` | You chose different names in step 3. |
| `MONGODB_DATABASE` | `chatapp` | You chose a different name in step 3. |
| `UPLOAD_DIR` | `./uploads` | You want images stored elsewhere. |
| `MAX_IMAGE_BYTES` | `1073741824` (1 GB) | See the image limit note in [CONTEXT.md](CONTEXT.md#known-issues). |
| `MEDIA_LISTEN_IP` | `127.0.0.1` | You test voice in Firefox or from another device. Use your LAN or Tailscale IP. |
| `MEDIA_PORT` | `40000` | The port is taken. |
| `TLS_CERT_PATH`, `TLS_KEY_PATH` | empty | Leave empty to use plain HTTP locally. |

The frontend needs no `.env` file. It finds the API on port 8443 of the host that served the page.

### 5. Start the app

```bash
npm run dev
```

Open http://localhost:5173/chatappfriends/ and create the owner account with your `MASTER_INVITE_CODE`. Other people sign
up with the code for their server. Encryption needs a secure page, so use
`localhost` or HTTPS, not a plain `http://` LAN address.

The first start creates the tables and indexes in whichever databases `server/.env` points at. A database from before
this version is refused until you migrate it, as described in [CONTEXT.md](CONTEXT.md#moving-to-the-encrypted-version).

## More documentation

- [DOCUMENTATION.md](DOCUMENTATION.md): project structure, pages, API and socket events
- [CONTEXT.md](CONTEXT.md): how production is set up, and the project's rules
- [NEW_PROJECT_GUIDE.md](NEW_PROJECT_GUIDE.md): how to set up another project on the same server
