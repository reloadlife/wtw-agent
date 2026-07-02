# WMTW Agent

Open-source desktop agent for [WhatToWatch](https://whattowatch.app). Syncs local media player playback (MPV today; more players planned) to your personal watch history via webhooks.

**Privacy:** The agent only sends playback events to the webhook URL you configure. No third-party analytics. [Full source code](https://github.com/reloadlife/wmtw-agent) is available for review.

## Download

Pre-built binaries are published on [GitHub Releases](https://github.com/reloadlife/wmtw-agent/releases), or from [whattowatch.app/agent](https://whattowatch.app/agent):

| Platform | File |
|----------|------|
| macOS (Apple Silicon) | `wmtw-agent-macos-arm64` |
| macOS (Intel) | `wmtw-agent-macos-x64` |
| Linux x64 | `wmtw-agent-linux-x64` |
| Linux ARM64 | `wmtw-agent-linux-arm64` |
| Windows x64 | `wmtw-agent-windows-x64.exe` |

On macOS, you may need to right-click → Open the first time (unsigned binary).

## Setup

1. In WhatToWatch go to **Settings → Connected services → Add source → Local**
2. Copy the webhook token
3. Run the agent and paste your **Site URL** + **token**
4. Click **Send test** to verify
5. Configure MPV to use a JSON IPC socket (see below)

Config is stored at `~/.config/wmtw-agent/config.json`.

## MPV

Add to `~/.config/mpv/mpv.conf`:

```
input-ipc-server=~/.config/mpv/socket
```

Or set the socket path in the agent UI to match your MPV config.

## Build from source

Requires [Bun](https://bun.sh) 1.1+.

```bash
bun install
bun run dev          # development
bun run build        # cross-compile all platforms (from macOS)
bun run build:current # single binary for current OS
```

### Linux dependencies

```bash
sudo apt install libgtk-4-1 libwebkitgtk-6.0-4   # Debian/Ubuntu
```

### Windows

Install [Microsoft Edge WebView2](https://developer.microsoft.com/microsoft-edge/webview2/) on Windows 10.

## How it works

```mermaid
flowchart LR
  MPV[MPV player] -->|IPC socket| Agent[WMTW Agent]
  Agent -->|HTTPS POST| Webhook["/api/webhook/scrobble/token"]
  Webhook --> WMTW[WhatToWatch]
```

The agent polls MPV every 15 seconds. When progress crosses 85% or playback stops, it posts a normalized JSON payload to your private webhook URL.

## License

MIT