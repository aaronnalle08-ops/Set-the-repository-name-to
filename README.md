# Universal Gaming Network — Advertising Command Center

**Source version: v3.3.0** • Node.js 22+ • Windows local dashboard

A campaign-management dashboard for Universal SMP and Shattered Crown, with authorized Discord announcements, a directory of 25 Minecraft listing resources, independent project schedules, and honest campaign analytics.

## What's new in v3.3.0 — secure public hosting

- Public-facing UGN landing page for Universal SMP and Shattered Crown, separate from the advertising controls.
- Docker Compose template for an always-on Ubuntu VPS with no published HTTP ports, using a Cloudflare Tunnel.
- Two distinct hostnames: public community page and private administrator dashboard protected by Cloudflare Access and a long local password.
- Production security checks for admin credentials, a configured HTTPS public origin and cross-site write restrictions.
- Persistent Docker volume for the private data folder, with a migration guide to carry over the existing local campaigns and scheduled webhooks.
- Detailed deployment guide for an assigned public Minecraft server IP and custom DNS for Shattered Crown. No server is automatically provisioned.

**Start here:** [Secure website deployment](deploy/website/DEPLOY.md) and [Shattered Crown public IP setup](deploy/minecraft/README.md).

## What changed in v3.2.0

- **25 Minecraft listing resources** (previously 14), with links to their public sites and owner-help pages. Directory submissions are still manual: the app doesn't log in, submit forms, solve captchas, or bypass posting rules.
- **Independent schedules:** Universal SMP and Shattered Crown each have a saved interval/weekday schedule, next-run countdown, enabled state and last run. Both schedules run independently even if you switch the selected project in the dashboard.
- **Explicit webhook assignments:** A Discord channel may be approved for Universal SMP, Shattered Crown, or both. Existing v3.1 Discord channels migrate as **Universal SMP only** until you explicitly authorize Shattered Crown announcements.
- **Safety limit:** Only one advertisement can be accepted per webhook every six hours across both campaigns; overlapping posts are logged as skipped. Use separate permitted channels if both campaigns should post independently.
- **Campaign analytics:** Actual Discord webhook sends and failures, counts of listing-site links opened from this dashboard, and optional **manually reported** clicks and player joins. Dashboard link opens are not third-party views and manually entered outcomes are not verified automatically.
- **Dashboard redesign:** Updated navigation and visual theme, campaign-switching tiles, independent schedule summaries, analytics bars and side-by-side campaign comparison.
- **Migration:** The v3.1 single schedule moves to whichever campaign was active when the upgrade occurred. Previous saved advertisements, webhook URLs and existing listing tracker entries are retained. The `data/` directory is never included in release ZIPs.

## How to use

1. Launch with `start_windows.bat` (do not open index.html as a file). Open http://127.0.0.1:3000.
2. Select **Universal SMP** or **Shattered Crown** under Active campaign.
3. Edit each campaign in **Campaign builder**. Shattered Crown defaults to *In development* and does not fabricate a live join IP.
4. Under **Auto scheduler**, connect a Discord webhook in a channel that permits promotion and choose its approved project(s). Configure and start each campaign schedule separately.
5. Under **Advertising sites**, open manual directory pages. Mark submitted only after successfully completing a site's requirements.
6. Under **Analytics**, review actual Discord deliveries, directory link opens, manually recorded submissions, and optional manual click/join figures.

## Safety and hosting

The backend can post to approved incoming Discord webhooks only. **It does not automatically publish to Minecraft listing sites.** Each site's owner-verification and promotional rules apply.

This local desktop website only schedules posts while the computer and Node.js backend are running. It does not measure actual player referrals without user-supplied metrics. To track real referrals automatically, you would need site/server-integrated data or publicly hosted redirect infrastructure designed with privacy protections.

Keep `data/`, webhook URLs, `.env`, `node_modules/`, and passwords out of public GitHub.

## Upgrade from v3.1.0 (original v3.2 release notes)

1. Publish release tag **`v3.2.0`** from the latest `main` commit after all tests pass.
2. Verify the **Package UGN website updates** Actions job succeeds and attaches `ugn-auto-advertiser.zip`.
3. Back up your local `data/` folder.
4. Run your existing v3.1.0 website with `start_windows.bat`. Select **Website updates → Check for updates → Install update & restart**.
5. Review both schedules and channel-to-campaign assignments after upgrading. The original schedule remains with its v3.1 active project.

[Detailed GitHub updater guide](GITHUB_UPDATE_SETUP.md).

Directory v3.2 also includes ListMC, GameMonitoring, MinecraftServersList.net, and MCCompanion owner-submission resources.
