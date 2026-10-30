# Independent player authentication

`player-auth.gs` is the personal-password implementation installed in the independent Rangers Training Apps Script project. Replace the previous `authenticatePlayer` and `authenticatePlayerSession_` definitions and include these helpers. Preserve the existing private project constants, player roster and copied Sheet ID.

The frontend obtains a public per-player challenge, derives a PBKDF2-SHA256 proof with 600,000 iterations and a random 24-byte salt, and submits that proof over the existing authenticated Google bridge. The backend stores only a peppered HMAC verifier in private Script Properties. Password changes verify the current password under a script lock and rotate the session revision. No personal password, proof, pepper, roster login hashes or coach credentials belong in this repository.

The existing owner-executed deployment URL and permissions are unchanged. Until a player chooses a personal password, their existing password continues to work. Old player sessions expire when that player's password changes. All real credential changes must be entered and submitted by the player or user directly.

Run the synthetic authentication checks with `node --test tests/player-password.test.mjs`. Tests use in-memory Apps Script substitutes and never change a live account.

Coach password recovery uses `resetPlayerPassword`, authorized with the existing private coach authorization. It restores the original jersey verifier using a fresh revision, clears failure throttling for that player, and invalidates every earlier player session. A legacy tombstone is retained so pre-personal-password sessions cannot become valid again. No training records are modified. Add the method to both connection allowlists when deploying.

`team-calendar.gs` adds a calendar reader authorized with the existing player session or coach code, and replaces the older `getTeamSchedule` reader with the same authorization. The TeamSnap feed remains in the private copied backend. Full event text and the subscription address are returned only after authorization. Add `getPlayerTeamCalendar` to both bridge allowlists. The public sanitized calendar route continues to omit detailed event names, locations and notes. No calendar data or subscription address belongs in this public repository.

Player calendar overrides use private Script Properties named `teamCalendarFeed:<player>`. Marcus must have an override configured; other players use the existing team feed unless explicitly overridden. Each feed has its own hashed cache key. Player selection comes from the verified session, and coaches can choose a roster player in Team Calendar to inspect that player’s feed. No override address is included in GitHub.
