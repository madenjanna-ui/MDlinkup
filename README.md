# 😍 Family

Family is split into two parts:

- `client/` — web application. This can be published with **GitHub Pages**.
- `server/` — Node.js + WebSocket backend. This must run on a server/VPS/cloud host.

## Local test

From `server/`:

```text
Start Server.bat
```

Then open:

```text
http://localhost:8000
```

## GitHub Pages

Publish the `client/` folder with GitHub Pages.

Before publishing, edit:

```text
client/js/config.js
```

and set:

```js
window.FAMILY_CONFIG = {
    API_BASE: "https://YOUR-FAMILY-SERVER"
};
```

The backend must support HTTPS and WebSocket (`wss://`) for production.

## Calls

Calls require HTTPS, permission for microphone/camera, and an active WebSocket connection. The default public STUN servers are enough for many networks, but do not guarantee a connection between all mobile networks. For reliable calls, deploy coturn on a VPS using `server/turnserver.conf.example` and `server/docker-compose.turn.example.yml`. Open TCP/UDP port `3478` and UDP ports `49152-49200` in the VPS firewall.

Set these Railway environment variables after deploying coturn:

```text
TURN_SHARED_SECRET=<the same value as static-auth-secret in coturn>
TURN_URLS=turn:YOUR_TURN_HOST:3478?transport=udp,turn:YOUR_TURN_HOST:3478?transport=tcp
TURN_TTL_SECONDS=3600
```

The server returns short-lived TURN credentials only to authenticated Family users. Do not put a permanent TURN password into a public `config.js` file. `CALL_ICE_SERVERS` remains available as a fallback for a manual setup:

```js
window.FAMILY_CONFIG = {
    API_BASE: "https://YOUR-FAMILY-SERVER",
    CALL_ICE_SERVERS: [
        {urls: ["stun:stun.l.google.com:19302"]},
        {urls: "turn:turn.example.com:3478", username: "TURN_USER", credential: "TURN_PASSWORD"}
    ]
};
```

For incoming calls while the app is minimized, install the app as a PWA and enable notifications in Family. A push notification opens the app; browsers do not permit automatic microphone/camera activation from a background notification.

## Security

Do **not** commit:

```text
server/data/family.json
server/.env
server/node_modules/
```

The live family database is intentionally not included in this GitHub-ready package.

## Current functionality

- server-side authentication
- up to 4 family users
- male/female avatars
- global family chat
- private chats
- reactions
- unread counters
- read state
- online/last-seen status
- WebSocket realtime updates
- last message/time in private dialog list
- photo and video messages, with full-screen photo viewer
- group ownership, member management, and group deletion
- participant-only real-time delivery and notifications
- recent-message loading for faster startup

## Privacy and storage encryption

Messages, media metadata, and notifications are delivered only to members of the relevant global chat, private dialog, or group. HTTPS/WSS protects data while it travels over the network.

To encrypt the database on the server, set the Railway environment variable `FAMILY_DB_ENCRYPTION_KEY` to a long, random secret. The server then stores `data/family.json` using AES-256-GCM. Keep that secret permanently: changing or losing it makes the encrypted database unreadable. This is encryption at rest; end-to-end encryption needs device-held keys and has not been enabled in this release.

## Production architecture

```text
GitHub Pages
      |
      v
Family😍 client
      |
      | HTTPS / WSS
      v
Family Server
      |
      v
Database
```

GitHub Pages alone cannot run `server.js`; the backend needs separate hosting.
