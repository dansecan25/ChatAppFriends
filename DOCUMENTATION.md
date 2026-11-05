# Documentation

How the code is organised, what each page does, and which endpoints it uses. For local setup, see the
[README](README.md).

## Architecture

```
Browser ── HTTPS :443 ──────────────► nginx (static frontend, /chatappfriends/)
   │
   ├────── HTTPS and WSS :8443 ─────► Node.js backend ──┬─► MariaDB: users, channels
   │                                   Express          ├─► MongoDB: messages
   │                                   Socket.IO        └─► Disk: image files
   │                                   mediasoup
   │   (messages, images and keys are encrypted in the browser before they're sent)
   └────── WebRTC UDP/TCP :40000 ───► mediasoup worker
```

- **Frontend:** Vue 3, TypeScript, Pinia, vue-router, mediasoup-client and Vite.
- **Backend:** Node.js, TypeScript, Express 5, Socket.IO, mediasoup and zod.
- **Voice:** every participant sends audio to the server, which forwards it to the others (an SFU). Participants
  never connect to each other directly.
- **Workspaces:** `client` and `server` are npm workspaces under the root `package.json`.

## Scripts

Run these from the repository root.

| Command | What it does |
|---|---|
| `npm run dev` | Starts the backend and frontend together with hot reload |
| `npm run install:all` | Runs `npm install` for the root, client and server |
| `./regenerate-packages.sh` | Deletes all `node_modules` and package locks, then runs `install:all` |
| `./reset-test-db.sh` | Empties the test databases, using the logins in `server/.env` |
| `./reset-prod-db.sh` | On the server: backs up and empties production |
| `npm run build` | Builds both |
| `npm run build:server` | Compiles the backend to `server/dist` |
| `npm run build:client` | Type-checks the frontend and builds it to `client/dist` |
| `npm run typecheck` | Type-checks both |

The repository has no automated test suite yet.

## Project structure

```
client/src/         Vue frontend
server/src/         Node.js backend
deploy/             nginx and systemd templates, and the deploy scripts' shared code
deploy-client.sh    Rebuilds and installs the frontend on the server
deploy-server.sh    Rebuilds the backend on the server
```

### Backend: `server/src`

A request travels `routes → middlewares → controllers → services → models`.

| Path | Responsibility |
|---|---|
| `index.ts` | Startup order and shutdown; HTTPS when certificates are configured |
| `app.ts` | Builds the Express app and its global middleware |
| `serverDefinitions.ts` | The list of servers, matched by position to the codes in `INVITE_CODE` |
| `config.ts` | Loads and validates environment variables with zod |
| `connections/` | Clients for MariaDB, MongoDB, mediasoup and Socket.IO |
| `routes/` | URL definitions, plus which middleware applies to each |
| `middlewares/` | `auth` (sessions), `originGuard`, `rateLimits`, `errorHandler` |
| `controllers/` | Validate input with zod, call a service, send the response. `socketController` does this for socket events. |
| `services/` | Business rules: `access` (who may do what), `auth`, `invite`, `server`, `role`, `channel`, `dm`, `message`, `file`, `voice`, `realtime` (socket rooms), `presence` (who's online) |
| `models/` | Database queries, one file per area. `schema.ts` creates tables, and `migrate.ts` upgrades an old database. |
| `utils/` | Small helpers: `httpError`, `password`, `token`, `fieldCrypto` (encrypted usernames) |

### Frontend: `client/src`

Data travels `api → mappers → stores → views and components`.

| Path | Responsibility |
|---|---|
| `api/` | HTTP calls. `http.ts` is the shared request function. |
| `mappers/` | Convert API data (`types/dto.ts`) into display models (`types/models.ts`) |
| `services/` | `socketClient`, `voiceClient` (WebRTC), `keySharing` (shares and replaces channel keys), `notifications` (browser notifications), `install` (installing as an app) |
| `services/crypto/` | `primitives` (WebCrypto wrappers), `identity` (account keys on this device), `keyring` (server, channel and DM keys), `messageCrypto`, `fileCrypto` |
| `stores/` | Pinia state: `authStore`, `serverStore`, `channelStore`, `dmStore`, `messageStore`, `voiceStore`, `notificationStore` |
| `composables/` | `useRealtime` (socket events into stores), `useImageUploads` (upload progress and cancel), `useMentionPicker` (`@` and `#` suggestions), `useNotificationOpens` (going to a clicked notification's message) |
| `router/` | Routes and the login guard |
| `views/` | The pages: `LoginView`, `RecoverView`, `JoinView`, `ChatView` |
| `components/` | The pieces those pages are built from |
| `utils/` | Helpers: `env`, `format`, `avatar`, `errors`, `images`, `mentions`, `links` (clickable links and which ones get a preview) |
| `styles/main.css` | Global styles |

`client/public/` is copied into the build as is:

- `sw.js`: a service worker that only handles clicks on notifications. It has no fetch handler, so it never sees or caches
  app traffic.
- `manifest.webmanifest` and `icons/`: let the app be installed to a home screen. Its paths are relative, so they follow
  the base route. `services/install.ts` keeps the browser's install offer for the button in `ProfileDialog`.

## Pages

The app is served under `/chatappfriends/`, so the paths below come after that prefix. On each page load, the router
guard calls `GET /api/auth/me` once to restore the session. Signed-out visitors go to `/login`, and a session without
this device's keys has to sign in again. Signed-in people with no server go to `/join`, then `GET /api/servers` loads
and unlocks their servers. Unknown paths redirect to the chat page.

### Login: `/login` (`views/LoginView.vue`)

Switches between signing in and creating an account with an invite code. The password stays in the browser, which
derives a login key from it.

| Action | Endpoints |
|---|---|
| Sign in | `POST /api/auth/prelogin`, `POST /api/auth/login` |
| Sign in to an account from before encryption | `POST /api/auth/prelogin`, `POST /api/auth/login` with the password once, `POST /api/auth/upgrade` |
| Create an account | `POST /api/auth/register` |

After signup or upgrade, `RecoveryKeyDialog` shows the recovery key once.

### Recover: `/recover` (`views/RecoverView.vue`)

Sets a new password using a recovery key, keeping access to all messages. It uses `POST /api/auth/recovery-key`, then
`POST /api/auth/recover`.

### Join: `/join` (`views/JoinView.vue`)

For accounts with no server, such as those from before servers existed, or someone removed from their only server. It
uses `POST /api/invites/redeem`.

### Chat: `/channels/:channelId?` and `/dms/:dmId` (`views/ChatView.vue`)

The main screen: the sidebar, the open channel or DM, and the message box. Without a valid thread in the URL, it opens
the first text channel. It connects the socket while open.

| Part | What it does | Endpoints and events |
|---|---|---|
| `ChatView` | Loads the server, conversations and messages. Shows the safety number in a DM. | `GET /api/dms`, `GET /api/servers/:id/channels`, `/members` and `/roles`, `GET .../messages` |
| `useRealtime` | Connects the socket and updates the stores from server events | All server events except `voice:newProducer` and `voice:consumerClosed` |
| `ServerSwitcher` | The tab bar for switching servers, shown to the owner and anyone in two or more | None |
| `ServerSettingsDialog` | Renames the server and joins another with a code. Admins manage roles, members and restricted channels, and the owner revokes codes. | `PATCH /api/servers/:id`, `POST /api/invites/redeem`, role and member role endpoints, `DELETE /api/servers/:id/members/:userId`, `PUT /api/channels/:id/roles`, `POST /api/invites/revoke` |
| `ChannelSidebar` | Lists channels and DMs, opens them, joins voice, deletes channels, signs out | `POST /api/dms`, `DELETE /api/channels/:id`, `POST /api/auth/logout`, `voice:leave` |
| `CreateChannelDialog` | Creates a channel, optionally limited to roles | `POST /api/servers/:id/channels` |
| `VoiceControls` | Shows the voice connection, with mute, deafen and leave | `voice:setState`, `voice:leave` |
| `MemberList` | Lists who can use the open channel, split into online and offline. Hidden in DMs, and behind a button on small screens. | `GET /api/servers/:id/members`, `presence:changed` |
| `MessageList`, `MessageItem` | Show messages and load older ones, with edit and delete buttons for those allowed. Old unencrypted messages are marked, and mentions of you are highlighted. | `GET .../messages?before=<id>`, `DELETE .../messages/:id` |
| `YouTubeEmbed`, `TweetEmbed` | Preview YouTube videos and X posts linked in a message, loaded by the browser straight from those sites. A video's player only loads on play. | None |
| `MessageEditor`, `MentionTextarea` | Edit a message in place, re-encrypting it in the browser. The text box and its `@` and `#` suggestions are shared with `MessageComposer`. | `PATCH .../messages/:id` |
| `ImageAttachment` | Downloads and decrypts an image, with a load button over 25 MB | `GET /api/attachments/:id`, or `GET /api/images/:id` for old images |
| `MessageComposer` | Encrypts and sends text and images, suggesting people and channels for `@` and `#` | `POST .../messages`, `POST .../uploads`, `PUT /api/uploads/:id/chunks/:index`, `DELETE /api/uploads/:id` |
| `keySharing` | Shares restricted channel keys with newly allowed members, and replaces them after someone loses access | `GET /api/servers/:id/key-work`, `POST /api/channels/:id/keys`, `POST /api/channels/:id/rotate` |
| `voiceClient` (via `voiceStore`) | Runs the WebRTC voice session | All other `voice:*` events; see [Voice connection](#voice-connection) |
| `ProfileDialog` | Sets the profile picture and this server's nickname, installs the app, and turns notifications on or off | `PUT` and `DELETE /api/users/me/avatar`, `PUT /api/servers/:id/nickname` |
| `NotificationPrompt`, `notificationStore` | Offers to turn notifications on, keeps each browser's choices and channel mutes, and decides what notifies | `message:new` |
| `UserAvatar` | Shows a profile picture, or initials without one | `GET /api/avatars/:id` |
| `AppIcon`, `RecoveryKeyDialog` | Display only | None |

## REST API

The base URL is `<host>:8443/api`. Errors are JSON in the form `{ "error": "message" }`. Endpoints need the
`chatapp_session` cookie unless marked public. Something a user may not see returns `404`, as if it didn't exist.

| Method and path | Who | Input | Success |
|---|---|---|---|
| `GET /health` | Public | | `200 { status: "ok" }` |
| `POST /auth/prelogin` | Public | `{ username }` | `200 { salt, legacy }` |
| `POST /auth/register` | Public, with an invite | `{ username, authKey, keys, inviteCode }` | `201` profile, sets the cookie |
| `POST /auth/login` | Public | `{ username, authKey }`, or `{ username, password }` for an old account | `200 { user, keys }`, sets the cookie |
| `POST /auth/upgrade` | Old account | `{ authKey, keys }` | `204` |
| `POST /auth/recovery-key` | Public | `{ username, verifier }` | `200 { recoveryWrappedPrivateKey }` |
| `POST /auth/recover` | Public | `{ username, verifier, authKey, kdfSalt, wrappedPrivateKey }` | `200 { user, keys }`, sets the cookie |
| `POST /auth/logout` | Public | | `204`, clears the cookie |
| `GET /auth/me` | Signed in | | `200` profile |
| `POST /invites/redeem` | Signed in | `{ code }` | `204`, joins that code's server |
| `POST /invites/revoke` | Owner | `{ code }` | `204`, adds it to the blacklist |
| `GET /servers` | Signed in | | `200` the user's servers, with their keys for open channels |
| `PATCH /servers/:serverId` | Member | `{ name }` | `204` |
| `GET /servers/:serverId/members` | Member | | `200` members with public keys, role ids and online status |
| `DELETE /servers/:serverId/members/:userId` | Admin. Not yourself or the owner. | | `204`, replaces the server key |
| `PUT /servers/:serverId/members/:userId/roles` | Admin | `{ roleIds }` | `204` |
| `GET /servers/:serverId/roles` | Member | | `200` roles |
| `POST /servers/:serverId/roles` | Admin | `{ name }` | `201` role |
| `DELETE /servers/:serverId/roles/:roleId` | Admin | | `204` |
| `GET /servers/:serverId/channels` | Member | | `200` channels this user may see |
| `POST /servers/:serverId/channels` | Member | `{ name, type, roleIds?, envelopes? }` | `201` channel |
| `GET /servers/:serverId/key-work` | Member | | `200 { grants, rotations }` |
| `DELETE /channels/:channelId` | Creator or admin | | `204` |
| `PUT /channels/:channelId/roles` | Creator or admin | `{ roleIds }` | `200` channel |
| `GET /channels/:channelId/keys` | Allowed members | | `200 { keyVersion, envelopes }` |
| `POST /channels/:channelId/keys` | Allowed members | `{ envelopes }` | `204` |
| `POST /channels/:channelId/rotate` | Allowed members | `{ version, envelopes }` | `204`, or `409` if already replaced |
| `GET /channels/:channelId/messages`, `GET /dms/:dmId/messages` | Allowed members | Query: `limit` (1-100, default 50), `before` (message id) | `200` messages, oldest first |
| `POST /channels/:channelId/messages`, `POST /dms/:dmId/messages` | Allowed members | `{ ciphertext, keyVersion, uploadId? }` | `201` message, or `409` if the channel's key changed |
| `PATCH /channels/:channelId/messages/:messageId`, `PATCH /dms/:dmId/messages/:messageId` | The author | `{ ciphertext, keyVersion }` | `200` message, or `409` if the channel's key changed |
| `DELETE /channels/:channelId/messages/:messageId`, `DELETE /dms/:dmId/messages/:messageId` | The author, or a server admin who can see that channel. DMs have no admin exception. | | `204` |
| `POST /channels/:channelId/uploads`, `POST /dms/:dmId/uploads` | Allowed members | | `201 { uploadId }` |
| `PUT /uploads/:uploadId/chunks/:index` | The uploader | Raw encrypted bytes, up to 4 MB plus 16 bytes | `204` |
| `DELETE /uploads/:uploadId` | The uploader | | `204` |
| `GET /attachments/:attachmentId` | Allowed members | Supports `Range` | `200` or `206` encrypted bytes |
| `GET /images/:imageId` | Allowed members | Old images only. Query: `download` | `200` image bytes |
| `PUT /users/me/avatar` | Signed in | Raw PNG, JPEG or WebP, up to 2 MB | `200 { avatarId }` |
| `DELETE /users/me/avatar` | Signed in | | `204` |
| `GET /avatars/:avatarId` | Its owner, or anyone sharing a server with them | | `200` image |
| `PUT /servers/:serverId/nickname` | Member | `{ nickname }`, empty to clear | `204` |
| `GET /dms` | Signed in | | `200` the user's conversations |
| `POST /dms` | Signed in, sharing a server | `{ userId, wrappedKeySelf, wrappedKeyOther }` | `201` conversation |

Prelogin, register, login, recovery and invite endpoints together allow 30 attempts per client every 15 minutes.
Response shapes are defined in `client/src/types/dto.ts`.

## Socket events

Sockets connect to the same host and port as the API. The handshake needs the session cookie and an `Origin` equal
to `CLIENT_ORIGIN`.

### Client to server

Each of these takes an acknowledgement, which replies `{ ok: true, data }` or `{ ok: false, error }`.

| Event | Payload | Reply data |
|---|---|---|
| `voice:join` | `{ channelId }` | `{ routerRtpCapabilities, producers }` |
| `voice:createTransport` | `{ direction: "send" \| "recv" }` | Transport options |
| `voice:connectTransport` | `{ transportId, dtlsParameters }` | None |
| `voice:produce` | `{ transportId, rtpParameters }` | `{ id }` |
| `voice:consume` | `{ producerId, rtpCapabilities }` | Consumer options |
| `voice:resume` | `{ consumerId }` | None |
| `voice:setState` | `{ muted, deafened }` | None |
| `voice:leave` | `{}` | None |

### Server to client

| Event | Payload | Sent to |
|---|---|---|
| `message:new` | Encrypted message | Those allowed in that channel or DM |
| `message:updated` | Encrypted message, after an edit | Those allowed in that channel or DM |
| `message:deleted` | `{ id, channelId, dmId }` | Those allowed in that channel or DM |
| `channel:created` | Channel | Those allowed in it |
| `channel:deleted` | `{ id, serverId }` | Those allowed in it |
| `server:renamed` | `{ id, name }` | That server |
| `roles:changed` | `{ serverId }` | That server |
| `access:changed` | `{ serverId }` | People whose channel access or keys changed |
| `keys:needed` | `{ serverId }` | That server, so a browser with the keys can share them |
| `dm:created` | `{ id }` | The other person |
| `dm:updated` | `{}` | DM partners, when someone's picture changes |
| `presence:changed` | `{ serverId, userId, online }` | Each server that person is in |
| `server:keyChanged` | `{ serverId }` | That server |
| `member:removed` | `{ serverId }` | The person removed |
| `voice:rosters` | List of `{ channelId, participants }` it may see | The socket that just connected |
| `voice:roster` | `{ channelId, participants }` | Those allowed in that channel |
| `voice:speaking` | `{ channelId, userIds }` | That voice channel |
| `voice:newProducer` | `{ producerId, userId }` | That voice channel, except the sender |
| `voice:consumerClosed` | `{ consumerId }` | The affected listener |
| `voice:kicked` | `{ reason }` | The removed listener |

### Voice connection

1. `voice:join` returns the server's audio capabilities and the people already sending audio.
2. `voice:createTransport` and `voice:connectTransport` set up one sending and one receiving connection.
3. `voice:produce` starts sending the microphone.
4. For each person sending audio, `voice:consume` then `voice:resume` starts receiving them.
5. `voice:newProducer` announces anyone who starts later, and step 4 runs for them.

The app waits for the connection to be up before showing voice as connected. Joining from a second window removes
the first with `voice:kicked`.

## Encryption

Messages are encrypted and decrypted in the browser with WebCrypto, so the database and disk only hold ciphertext. DMs and
role-limited channels are end-to-end encrypted. Open channels are encrypted too, but the server holds their key.

| Key | Protects | How people get it |
|---|---|---|
| Password-derived key | The account's private key. Only a separate login key reaches the server. | Derived with PBKDF2 (600,000 rounds) from the password |
| Recovery key | A second copy of the private key | Shown once at signup |
| Account key pair (ECDH P-256) | Everything wrapped for this person | Created at signup. The private key is kept non-extractable on each device and removed on sign-out. |
| Server key | Channels with no role limit, which each get a key derived from it | Created by the backend, stored encrypted with `DATA_ENCRYPTION_KEY`, and sent to members over HTTPS. Members get every version, so they can read history. |
| Restricted channel key | One role-limited channel | Created by its creator and wrapped for each allowed member. An online member's browser shares it with new ones. |
| DM key | One conversation | Created by the person who starts it and wrapped for both |
| File key | One image | Random, inside the encrypted message. Files are encrypted in 4 MB chunks. |

- **Message binding:** each message is bound to its thread, author and key version, so the server can't move it or
  reassign it without decryption failing.
- **Losing access:** when someone loses a role, the channel's key is replaced before new messages can be sent. They keep
  whatever they already had, but can't read what comes next.
- **Removing a member:** their account stays, but they lose the server. The backend replaces the server key straight away,
  and browsers replace their restricted channel keys. DMs with them stop accepting new messages unless they still share a
  server. They can rejoin with the same code until it's revoked and replaced.
- **Key checks:** browsers remember each person's public key and refuse to share with a different one. The safety number
  in a DM lets two people confirm no keys were swapped.
- **Old messages:** those from before encryption stay readable and are marked "Not encrypted" until they're purged.

### Mentions and notifications

The server can't read messages, so mentions and notifications are handled entirely in each browser after decrypting.
Mentions travel inside the encrypted text as `<@userId|name>` and `<#channelId>`. Channels carry no name, so someone who
can't see a restricted channel only sees `#private-channel`.

A notification appears unless you sent the message, or you're looking at that thread with the window focused:

| Message | Notifies when |
|---|---|
| DM | Always |
| Mentions you with `@` | Always, even if the channel is muted |
| Mentions a `#channel` | You can see that channel and haven't muted it, even if the channel it was sent in is muted |
| Anything else in a channel | The channel isn't muted |

Permissions, on/off and mutes are stored per browser, in `localStorage`. Notifications need an open tab with a live socket:
there's no push service, because it would need a server able to read or relay message content. Phones usually suspend
background tabs, and iPhones don't offer notifications to browser tabs at all.

### What encryption protects

**Protected from anyone reading the database or disk, including the owner:** DMs, and role-limited channels they don't
belong to, with their images and filenames.

**Protected from someone with only the database or disk, but not from whoever also has `server/.env`:** open channels. The
owner belongs to every server and can read those anyway.

**Not protected:**

- **The app's code:** the server delivers the code running in each browser, so whoever controls the server could ship a
  version that steals keys. Encryption stops casual or after-the-fact reading, but friends still have to trust the
  person running the server not to change the code.
- **Voice:** it's encrypted on the way to the server, but the server could technically listen.
- **Profile pictures:** they aren't end-to-end encrypted, so they're readable on the server's disk.
- **Notifications:** they show the decrypted text through the browser and operating system, so it can appear on a lock
  screen.
- **Edits and deletions, from whoever controls the server:** the database keeps only the latest version, but the server
  could hide an edit, restore an earlier version or remove a message. Deleted text may also remain in database backups, and
  in anything people already saved.
- **Link previews:** each browser fetches previews straight from YouTube and X, so those sites see who views which
  linked video or post, and the server's hostname. They never see other messages.
- **Metadata:** who sent what and when, who talks to whom, sizes, and server, channel and role names.
- **Usernames, from the server's operator:** they're encrypted with `DATA_ENCRYPTION_KEY`, which protects against a stolen
  database, but that key is on the server.
- **Admin self-service:** an admin can give themselves a role, which then gives them that channel's key and history once
  an online member's browser shares it. It shows in the member list.
- **What a removed member already has:** they keep anything they saved or copied, and old keys could open old messages if
  they ever got a copy of the database. They can't read anything sent after the key changes.
- **Past messages if a key leaks:** there's no forward secrecy, so someone with an account's private key and a copy of
  the database could read that person's old messages.

## Data storage

**MariaDB**

| Table | Contents |
|---|---|
| `users` | `username_hash`, `username_enc`, `password_hash` (of the login key), `kdf_salt`, `public_key`, wrapped private keys, `recovery_verifier_hash`, `is_owner`, `avatar_id` |
| `servers` | `slot` (its position in `INVITE_CODE`), `name`, `root_key_version` |
| `server_members` | Membership, and `nickname_enc` (encrypted with `DATA_ENCRYPTION_KEY`) |
| `server_keys` | Each version of the server key, encrypted with `DATA_ENCRYPTION_KEY` |
| `revoked_codes` | The blacklist: a hash of each revoked code |
| `roles`, `member_roles`, `channel_roles` | Roles, who holds them and which channels they open. `is_admin` marks the built-in admin role. |
| `channels` | `server_id`, `name`, `type`, `restricted`, `key_version`, `rotation_pending`, `created_by` |
| `channel_keys` | Each member's wrapped copy of each version of a restricted channel's key |
| `dm_conversations` | The two people and each one's wrapped key |

**MongoDB:** the `messages` collection has `channelId` or `dmId`, `authorId`, `encrypted`, `ciphertext`, `keyVersion`,
`attachment` (`id`, `encryptedSize`) and `createdAt`. Messages from before encryption have `content` and `image` instead.

**Disk:** each file is stored in `UPLOAD_DIR`, named with a random UUID. Profile pictures are in its `avatars` folder. Unfinished uploads end in `.part` and are removed
after an hour idle, or at startup.

Deleting a channel also deletes its messages and files. Servers are created at startup from
`server/src/serverDefinitions.ts`, each with `general` text and `General` voice channels.

## Security

- **Sessions:** a JWT in an `httpOnly`, `SameSite=Strict` cookie lasting 30 days, marked `Secure` in production.
- **Login:** the server stores an scrypt hash of a login key derived from the password, never the password itself. Unknown
  usernames get a stable decoy salt, so a login attempt can't reveal who has an account.
- **Origins:** CORS, `originGuard` and the socket handshake only accept `CLIENT_ORIGIN`.
- **Isolation:** every request checks server membership and channel access in `accessService`, and socket events only go
  to those allowed.
- **Uploads:** browsers check that a file is a real image before encrypting it and again after decrypting it. SVG is
  rejected, and files are served with a sandboxing Content-Security-Policy.
- **Embedded players:** YouTube and X load in sandboxed frames from their own sites, allowed by `frame-src` in
  `deploy/nginx-app.conf`. They can't read the page or its keys, or navigate it away. No third-party script runs in the app
  itself.
- **Limits:** the member limit is enforced in a single SQL statement, so simultaneous sign-ups can't pass it.
