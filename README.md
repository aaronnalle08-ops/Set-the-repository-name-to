# Universal Gaming Network — Advertising Command Center

Current source version: **3.1.0**

## What's new in v3.1.0

- **Two campaigns:** Universal SMP and Shattered Crown, with separate advertisements and submission tracking.
- **14 Minecraft directory destinations:** including CraftRank (prefilled form), Planet Minecraft, Minecraft-MP, MinecraftServers.org, Minecraft Atlas, Minecraft.Buzz, TopG, Minecraft-ServerList, MCServer-List, Minelist, MineBuff, MCServerShare, MinecraftServer.Buzz, and MinecraftIP.
- **Shattered Crown starts in development mode:** recruitment copy for volunteer builders and mod makers, without a fabricated server IP. Live-directory "mark submitted" buttons stay disabled until you set a live server address.
- **Schedule safety:** switching active campaigns pauses the scheduler; resume manually after reviewing the new advertisement. Only **one** active campaign runs through the automatic Discord webhook scheduler at a time.
- **Migration:** existing Universal SMP campaign, schedules and private webhook settings are retained in the local `data/` directory.
- **Automated tests:** test workflow checks every new push to the main branch.

## Automatic posting limitations

Automatic sends work **only for approved Discord webhooks** where the operator has posting permission. Minecraft listing destinations in the dashboard are *manual submission links*, not automatic posting integrations. Each listing service has its own rules; many require the server to be online.

## Run locally on Windows

1. Install Node.js 22 or later.
2. Double-click `start_windows.bat`.
3. Open `http://127.0.0.1:3000`.
4. Use **Active campaign** at the top to switch between Universal SMP and Shattered Crown.
5. Use **Campaign builder** to edit/save the active campaign, and **Advertising sites** to open owner-submission pages.
6. Connect permitted Discord webhooks and review **Auto scheduler** before starting posts.

Private state lives in `data/`, which must never be uploaded to public GitHub or deleted by updates.

## Publish version v3.1.0 to Windows installations

All website code is committed to GitHub, but a release isn't available until one is published:

1. Open this repository's **Releases → Draft a new release**.
2. Create tag `v3.1.0` on branch `main`. The version tag **must match** `package.json`.
3. Publish the release, then check **Actions → Package UGN website updates**.
4. A successful run adds `ugn-auto-advertiser.zip` to the published release.
5. In your *existing* v3.0.0 Windows dashboard, go to **Website updates**, save this trusted public GitHub repository (`aaronnalle08-ops/Set-the-repository-name-to`), then choose **Check for updates → Install update & restart**.
6. The updater backs up program files and preserves `data/`, including your prior Universal SMP settings.

More details: [GITHUB_UPDATE_SETUP.md](GITHUB_UPDATE_SETUP.md).

Do not commit passwords, Discord webhook URLs, `data/`, `.env`, or `node_modules/`. Public listing sites should receive only truthful claims about live servers.
