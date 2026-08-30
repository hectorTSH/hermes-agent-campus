# MacBook Air setup and remote access

This guide is written for a human or automation bot installing Hermes Agent Campus from GitHub.

Repository: <https://github.com/hectorTSH/hermes-agent-campus>

## Choose how to run Campus

### Option A — run Campus locally on the MacBook Air

Use this when you want a self-contained copy on the laptop.

```bash
cd ~/Projects
git clone https://github.com/hectorTSH/hermes-agent-campus.git
cd hermes-agent-campus
npm ci
npx playwright install chromium
npm run check
npm run dev
```

Open the `Local` URL printed by Vite, normally:

<http://127.0.0.1:5173/?room=home>

Do not double-click `index.html`; `file://` cannot load the JavaScript modules or RoomSpecs.

### Option B — run on the Mac mini and control the UI from the MacBook Air

This is the recommended path when the Mac mini is the machine that owns the Hermes profiles and jobs. Campus stays on the mini; the Air is only the browser/controller.

On the Mac mini:

```bash
cd ~/Projects
git clone https://github.com/hectorTSH/hermes-agent-campus.git
cd hermes-agent-campus
npm ci
npm run start:network
```

`start:network` builds the production app and serves it on port `4173` over the trusted local network.

From the MacBook Air, open:

```text
http://<mac-mini-lan-or-tailscale-name>:4173/?room=home
```

Examples of the host part are the Mac mini's `.local` hostname, private LAN IP, or Tailscale MagicDNS name. Discover those on the Mac mini with:

```bash
scutil --get LocalHostName
tailscale status
```

Use Tailscale or a trusted private LAN. Do not forward port 4173 from the public internet.

## Keep Campus running after logout

The repository includes a macOS LaunchAgent installer. Run it from a normal Terminal on the Mac mini:

```bash
cd ~/Projects/hermes-agent-campus
zsh scripts/install-macos-service.sh
```

It performs `npm ci`, builds the app, and installs:

```text
~/Library/LaunchAgents/com.hectortsh.hermes-agent-campus.plist
```

Useful commands:

```bash
launchctl print gui/$(id -u)/com.hectortsh.hermes-agent-campus
curl -I http://127.0.0.1:4173/?room=home
open ~/Library/Logs/hermes-agent-campus.log
```

To stop and remove only this service:

```bash
zsh scripts/uninstall-macos-service.sh
```

The uninstall script removes the LaunchAgent plist but does not delete the repository or logs.

## Update later

On the machine running Campus:

```bash
cd ~/Projects/hermes-agent-campus
git pull --ff-only
npm ci
npm run check
npm run build
launchctl kickstart -k gui/$(id -u)/com.hectortsh.hermes-agent-campus
```

If you run it manually instead, stop the old process and rerun `npm run start:network`.

## Controls

- **W/S:** pan
- **A/D and left/right:** intentionally inverted horizontal pan
- **Q/E:** orbit
- **Scroll:** zoom
- **R/F:** pitch
- Click an agent tag for its inspector
- Click the pet for the room digest
- Click JOB WALL for room-scoped jobs
- Click the Campus door to warp to another room

## Important agent-control limitation

Campus v1 is a visual release candidate. The visible agent state, mock usage, and job timestamps come from validated RoomSpecs. The work/downtime toggle demonstrates walking and does **not** start, stop, or message a real Hermes agent.

Read [MAC_MINI_AGENT_WIRING.md](MAC_MINI_AGENT_WIRING.md) before connecting local Hermes data. It defines the safe read-only boundary and makes clear which pieces are currently manual versus live.

## Troubleshooting

### The page only says “Opening Campus”

You used `file://`. Start Vite or the network service and use an `http://` URL.

### The Air cannot connect to the mini

1. Confirm `curl -I http://127.0.0.1:4173/?room=home` works on the mini.
2. Confirm the service is bound to `0.0.0.0:4173`.
3. Confirm both Macs are on the same trusted LAN or Tailscale network.
4. Check the macOS firewall prompt for Node/Vite.
5. Do not use the mini's `127.0.0.1` address from the Air; use the mini's hostname/IP.

### Port 4173 is already in use

Stop the existing Campus process or set another port before installing:

```bash
CAMPUS_PORT=4174 zsh scripts/install-macos-service.sh
```

Then browse to port 4174.
