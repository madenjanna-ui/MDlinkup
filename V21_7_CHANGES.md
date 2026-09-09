# Family v21.7

- Fixed sending photos and videos in global and private chats: the missing API client methods are now present.
- Photos are compressed before the 3 MB limit is applied; videos retain a 6 MB limit.
- The server verifies Base64 media type and actual decoded size, rather than trusting the browser-supplied MIME type and size.
- Incoming calls now send a push notification even when a backgrounded PWA keeps its WebSocket connection open.
- Calls can use custom STUN/TURN servers through `CALL_ICE_SERVERS`; TURN is recommended for reliable calls across mobile networks.
- Startup now recovers from corrupted local favourites and shows an error screen instead of a blank page if the client cannot start.
- Profile now has an explicit microphone/camera permission check. Calls include controls for microphone, video camera, and audio-output selection where the browser permits it.
- Fixed the responder's remote audio/video stream being discarded when the incoming-call view switches to the connected-call view. Brief network disconnections no longer close a call automatically.
- Reconnected call signaling after a WebSocket refresh, fixed stale pending-call cleanup on the server, and added one ICE restart attempt for the caller.
- Restricted WebSocket message, reaction, edit, delete, and push delivery to chat participants. Added group media deletion, group management, full-screen photo viewing, 100-message history limits, and optional AES-256-GCM database encryption.
- Group message actions now refresh immediately for all authorised group participants.
- Calls now retrieve short-lived TURN credentials from the authenticated server when `TURN_SHARED_SECRET` and `TURN_URLS` are configured. Coturn deployment templates are included.
