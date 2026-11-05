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
   └────── WebRTC UDP/TCP :40000 ───► mediasoup worker
```

- **Frontend:** Vue 3, TypeScript, Pinia, vue-router, mediasoup-client and Vite.
- **Backend:** Node.js, TypeScript, Express 5, Socket.IO, mediasoup, multer and zod.
- **Voice:** every participant sends audio to the server, which forwards it to the others (an SFU). Participants
  never connect to each other directly.
- **Workspaces:** `client` and `server` are npm workspaces under the root `package.json`.

## Scripts

Run these from the repository root.

| Command | What it does |
|---|---|
| `npm run dev` | Starts the backend and frontend together with hot reload |
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
| `config.ts` | Loads and validates environment variables with zod |
| `connections/` | Clients for MariaDB, MongoDB, mediasoup and Socket.IO |
| `routes/` | URL definitions, plus which middleware applies to each |
| `middlewares/` | `auth` (sessions), `originGuard`, `upload` (multer), `errorHandler` |
| `controllers/` | Validate input with zod, call a service, send the response. `socketController` does this for socket events. |
| `services/` | Business rules and real-time broadcasts: `auth`, `channel`, `message`, `image`, `voice` |
| `models/` | Database queries: `userModel`, `channelModel`, `messageModel`. `schema.ts` creates tables and indexes. |
| `utils/` | Small helpers: `httpError`, `password`, `token`, `imageSniffer` |

### Frontend: `client/src`

Data travels `api → mappers → stores → views and components`.

| Path | Responsibility |
|---|---|
| `api/` | HTTP calls. `http.ts` is the shared request function. |
| `mappers/` | Convert API data (`types/dto.ts`) into display models (`types/models.ts`) |
| `services/` | `socketClient` (socket and request helper), `voiceClient` (WebRTC session) |
| `stores/` | Pinia state: `authStore`, `channelStore`, `messageStore`, `voiceStore` |
| `composables/` | `useRealtime` (socket events into stores), `useImageUploads` (upload progress and cancel) |
| `router/` | Routes and the login guard |
| `views/` | The two pages: `LoginView`, `ChatView` |
| `components/` | The pieces those pages are built from |
| `utils/` | Helpers: `env`, `format`, `avatar`, `errors`, `images` |
| `styles/main.css` | Global styles |

## Pages

The app is served under `/chatappfriends/`, so the paths below come after that prefix. On each page's first
load, the router guard calls `GET /api/auth/me` once to restore the session. It then sends signed-out visitors to
`/login` and signed-in visitors away from it. Unknown paths redirect to the chat page.

### Login: `/login` (`views/LoginView.vue`)

A single form that switches between signing in and creating an account. Registering also asks for the invite code.

| Action | Endpoint |
|---|---|
| Sign in | `POST /api/auth/login` |
| Create an account | `POST /api/auth/register` |

### Chat: `/channels/:channelId?` (`views/ChatView.vue`)

The main screen: the channel sidebar, the open text channel's messages, and the message box. Without a valid text
channel in the URL, it opens the first one. It connects the socket while open and disconnects when you leave.

| Part | What it does | Endpoints and events |
|---|---|---|
| `ChatView` | Loads channels and the open channel's messages | `GET /api/channels`, `GET /api/channels/:id/messages` |
| `useRealtime` | Connects the socket and updates the stores from server events | All server events except `voice:newProducer` and `voice:consumerClosed` |
| `ChannelSidebar` | Lists channels, switches between them, joins voice, deletes channels, signs out | `DELETE /api/channels/:id`, `POST /api/auth/logout`, `voice:leave` |
| `CreateChannelDialog` | Creates a text or voice channel | `POST /api/channels` |
| `VoiceControls` | Shows the voice connection, with mute, deafen and leave | `voice:setState`, `voice:leave` |
| `MessageList` | Shows messages and loads older ones | `GET /api/channels/:id/messages?before=<id>` |
| `MessageItem` | Shows one message | None |
| `ImageAttachment` | Shows an image, or a load button if it's over 25 MB, plus a download link | `GET /api/images/:id`, `GET /api/images/:id?download=1` |
| `MessageComposer` | Sends text and uploads images | `POST /api/channels/:id/messages`, `POST /api/channels/:id/images` |
| `voiceClient` (via `voiceStore`) | Runs the WebRTC voice session | All other `voice:*` events; see [Voice connection](#voice-connection) |
| `AppIcon`, `UserAvatar` | Display only | None |

## REST API

The base URL is `<host>:8443/api`. Errors are JSON in the form `{ "error": "message" }`. Endpoints marked "Yes"
need the `chatapp_session` cookie.

| Method and path | Sign-in | Input | Success |
|---|---|---|---|
| `GET /health` | No | | `200 { status: "ok" }` |
| `POST /auth/register` | No | `{ username, password, inviteCode }` | `201` user, sets the cookie |
| `POST /auth/login` | No | `{ username, password }` | `200` user, sets the cookie |
| `POST /auth/logout` | No | | `204`, clears the cookie |
| `GET /auth/me` | Yes | | `200` user |
| `GET /channels` | Yes | | `200` channel list |
| `POST /channels` | Yes | `{ name, type: "text" \| "voice" }` | `201` channel |
| `DELETE /channels/:channelId` | Yes, creator only | | `204` |
| `GET /channels/:channelId/messages` | Yes | Query: `limit` (1-100, default 50), `before` (message id) | `200` message list, oldest first |
| `POST /channels/:channelId/messages` | Yes | `{ content }`, up to 4000 characters | `201` message |
| `POST /channels/:channelId/images` | Yes | Multipart: `image` (file), `caption` (optional) | `201` message |
| `GET /images/:imageId` | Yes | Query: `download` for an attachment | `200` image bytes |

Register and login together allow 30 attempts per client every 15 minutes. Usernames take 2-32 letters, numbers,
dots, dashes or underscores, and passwords need at least 8 characters.

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
| `message:new` | Message | Everyone |
| `channel:created` | Channel | Everyone |
| `channel:deleted` | `{ id }` | Everyone |
| `voice:rosters` | List of `{ channelId, participants }` | The socket that just connected |
| `voice:roster` | `{ channelId, participants }` | Everyone |
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

## Data storage

**MariaDB**

| Table | Columns |
|---|---|
| `users` | `id`, `username` (unique), `password_hash`, `created_at` |
| `channels` | `id`, `name`, `type` (`text` or `voice`), `created_by` (nullable), `created_at`; `name` and `type` are unique together |

**MongoDB:** the `messages` collection has `channelId`, `authorId`, `authorUsername`, `content`, `image`
(`id`, `filename`, `mimeType`, `size`, or null) and `createdAt`.

**Disk:** each image is stored in `UPLOAD_DIR`, named with a random UUID. Its metadata lives on its message.

Deleting a channel also deletes its messages and image files. The tables, indexes and starter channels (`general`
text and `General` voice) are created at startup when missing.

## Security

- **Sessions:** a JWT in an `httpOnly`, `SameSite=Strict` cookie lasting 30 days, marked `Secure` in production.
- **Passwords:** hashed with scrypt.
- **Origins:** CORS, `originGuard` and the socket handshake only accept `CLIENT_ORIGIN`.
- **Uploads:** the file type comes from the file's contents rather than its name, SVG is rejected, and files are
  served with a sandboxing Content-Security-Policy.
- **Member limit:** enforced in a single SQL statement, so simultaneous sign-ups can't pass it.
