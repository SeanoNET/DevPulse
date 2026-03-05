# DevPulse

A system tray app that aggregates CI/CD events from GitHub, Jira, and Octopus Deploy into a unified timeline feed with desktop notifications.

## Install

### Linux

Download from the [latest release](https://github.com/SeanoNET/DevPulse/releases/latest):

- **AppImage** - `DevPulse-x.x.x-x86_64.AppImage` (portable, no install needed)
  ```bash
  chmod +x DevPulse-*.AppImage
  ./DevPulse-*.AppImage
  ```
- **Debian/Ubuntu** - `DevPulse-x.x.x-amd64.deb`
  ```bash
  sudo dpkg -i DevPulse-*.deb
  ```

### Windows

Download `DevPulse-Setup-x.x.x.exe` from the [latest release](https://github.com/SeanoNET/DevPulse/releases/latest) and run the installer.

## Getting Started

1. Launch DevPulse - it will appear as an icon in your system tray
2. Click the tray icon to open the event feed
3. Click the gear icon to open Settings
4. Go to the **Connections** tab and connect your integrations:

### GitHub

1. [Create a Personal Access Token](https://github.com/settings/tokens/new?scopes=repo,notifications) (classic) with `repo` and `notifications` scopes, or a fine-grained token with **Actions (read)** permission
2. Paste the token and click **Connect**

### Jira

1. Go to [Atlassian API tokens](https://id.atlassian.com/manage-profile/security/api-tokens) and create a token
2. Enter your Jira site URL (e.g. `https://yoursite.atlassian.net`)
3. Enter your Atlassian account email
4. Paste the API token and click **Connect**

### Octopus Deploy

1. In Octopus, go to Profile > My API Keys and create a new key
2. Enter your Octopus server URL (e.g. `https://octopus.example.com`)
3. Paste the API key and click **Connect**

## Usage

- **Click the tray icon** to toggle the event feed
- **Click an event** to open it in your browser
- **Filter events** by source (GitHub, Jira, Octopus) or severity (Errors, Warnings)
- **Mark all read** to clear the unread indicators
- **Settings > General** to change poll interval, enable autostart, or toggle notification sounds
- **Settings > Notifications** to configure notification preferences

## Development

Requires [Bun](https://bun.sh/) and Node.js 20+.

```bash
bun install
bun run dev
```

### Build

```bash
bun run build
npx electron-builder
```

## License

MIT
