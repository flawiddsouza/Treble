Requires Node 22.12 or newer. Run commands from backend.

1. Install dependencies:
   npm ci
2. Copy .env.example to .env if .env does not exist. Set MUSIC_DIRECTORY to your music folder.
   Relative music and MUSIC_DB_PATH paths resolve from backend, regardless of the shell directory.
3. Build the UI as described in ../ui/README.txt, or run its development server.
4. Start Treble:
   npm start

Development restart-on-change:
   npm run dev

The music library initializes and watches for changes at startup. Existing music.db
records keep their IDs while metadata columns are added and tags are refreshed.
Rescan music folder in the empty-library view waits for a scan to finish.
Audio files are never modified.
The music index is stored in MUSIC_DB_PATH. No database server is required.
Windows UNC music folders use polling every 30 seconds to detect changes.

Network access:
Leave HOST empty for all available interfaces, preserving IPv4, IPv6 and Tailscale access.
Set HOST to a particular Tailscale IP to bind only that interface, or to 127.0.0.1
for IPv4 localhost-only use. HOST=0.0.0.0 listens on all IPv4 interfaces.
PORT defaults to 4001. The built UI is available on that port.
The music API is for a personal trusted network and does not require sign-in.
Use your existing Tailscale access controls to choose which devices can reach it.
CORS_ORIGINS optionally restricts browser origins to a comma-separated list.
Leaving it empty preserves access from different personal-network browser origins.

Checks:
   npm test
   npm audit
