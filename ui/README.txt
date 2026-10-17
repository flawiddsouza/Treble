Requires Node 22.22.2+, Node 24.15+, or Node 26+ for the development and test tools.
Run commands from ui.

1. Install dependencies:
   npm ci
2. Start the backend as described in ../backend/README.txt.
3. Start the UI:
   npm run dev

Open http://localhost:4000 or http://<Tailscale-IP>:4000.
The dev server accepts Tailscale .ts.net names and forwards /api to port 4001.
For a different backend port, set VITE_PROXY_TARGET in the shell before starting Vite.

Production:
   npm run build
The backend serves ui/dist together with /api on port 4001.
Open http://<Tailscale-IP>:4001 after building and starting the backend.
For separate UI hosting, proxy /api to the backend or set VITE_API_URL at build time.
Leave VITE_API_URL empty for same-origin hosting. Avoid localhost URLs when using another device.

Checks:
   npm test
   npm run build
   npm audit

Open Settings beside the search bar, then Theme to choose Turquoise Dreams,
Purple, Royalty or Dark. Themes apply immediately and are saved per browser.

Volume, shuffle and repeat are saved per browser. The active tab, folder/album,
search, scroll position, queue and paused playback position resume in the same tab.
Reload does not start playback automatically. Removed files fall out of the saved queue.

The search bar finds songs across the whole library by title, artist, album,
filename or folder path. Clear it or press Escape to return to the previous view
and scroll position. Playing a search result queues the matching songs in result
order. Editing or clearing the search leaves that playback queue intact.

Right-click a song, or use its options button, to go to its album, artist or
containing folder without changing playback. Untagged songs offer folder navigation.
