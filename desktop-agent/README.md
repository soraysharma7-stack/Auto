# Auto Agent PC

A separate Tauri + Rust companion for permission-controlled actions on the user's own computer.
It is not a browser extension and does not give Auto Web direct OS access.

## Security behavior

- Pairing uses a one-time, eight-character code that expires after ten minutes.
- The returned high-entropy device token is stored in the operating-system credential store;
  only its SHA-256 hash is stored by Auto Web.
- Screen, input and file permissions start disabled and are changed locally in this app.
- Starting and stopping a session is explicit. Lost polling connectivity clears the local session.
- Rust checks the active session and local permission again before every native action.
- File operations require absolute paths inside canonicalized, user-selected folders.
- Stop and revocation cancel pending work server-side; local stop works even while offline.
- No terminal, shell, administrator, hidden-window or auto-elevation command is registered.

## Build on Windows

Prerequisites: Node.js 22+, Rust stable (1.85+), and the
[Tauri Windows prerequisites](https://v2.tauri.app/start/prerequisites/).

```bash
cd desktop-agent
npm ci
npm run tauri:dev       # Development companion
npm run tauri:build     # NSIS installer under src-tauri/target/release/bundle
```

The web server must run the matching device API and migrations. Use HTTPS in production;
HTTP is accepted only for localhost development.

## Source boundaries

- `src/`: visible React companion window.
- `src-tauri/src/commands.rs`: narrowly registered Tauri commands and protocol sequence.
- `src-tauri/src/api.rs`: authenticated HTTPS requests and server-URL validation.
- `src-tauri/src/state.rs`: non-secret config and OS credential-store access.
- `src-tauri/src/native.rs`: screen, input and canonical-path file operations.
- `src-tauri/src/models.rs`: serialized contracts without device tokens.

Native compilation and Windows interaction tests must run on Windows before release. This
repository does not claim an installer exists until CI or a release build produces one.
