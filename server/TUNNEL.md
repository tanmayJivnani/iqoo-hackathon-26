# Wireless development

1. From `server`, run `npm run dev` and leave it running.
2. In another terminal in `server`, run `npm run tunnel`. Install `cloudflared` on your OS if needed; the script also accepts `CLOUDFLARED_PATH` and looks in the repository's ignored `tools` directory.
3. The script prints the public HTTPS URL and updates `mobile/.env.local` automatically. This machine-specific URL is not committed.
4. Restart Metro from `mobile` with `npm start -- --lan`. Keep the laptop and phone on the same Wi-Fi and open the installed development app using that Metro session. The backend can be reached through Cloudflare without USB port forwarding.

Keep the backend, tunnel and Metro running. Quick Tunnel URLs change when the tunnel restarts, so restart Metro again after starting a new tunnel. Existing native modules do not need rebuilding just to change the API URL. If the development app is used away from the laptop's Wi-Fi, Metro needs its own tunnel or you need an app build with bundled JavaScript.

The URL is public and provides access to this development backend. Keep it within your demo team. Quick Tunnels are temporary development endpoints, not production hosting: https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/
