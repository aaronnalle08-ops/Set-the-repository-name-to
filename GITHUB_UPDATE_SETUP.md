# UGN Advertising Command Center — GitHub Update Setup

## Upgrade an existing v3.0.0 Windows installation to v3.1.0

The local website is on version **3.0.0** until it installs a newer published release. The GitHub source files have already been updated to **3.1.0**.

1. Open the repository's **Releases → Draft a new release** page.
2. Create a **new tag `v3.1.0`** from the latest `main` commit and publish it. You do **not** need to release v3.0.0 first.
3. Open **Actions → Package UGN website updates** and confirm the release job succeeds. It should attach `ugn-auto-advertiser.zip` to the release.
4. Back up your Windows installation's `data/` folder first.
5. On Windows, open the v3 website using `start_windows.bat` and browse to `http://127.0.0.1:3000`.
6. Under **Website updates**, save the trusted public repository `aaronnalle08-ops/Set-the-repository-name-to`, then select **Check for updates**.
7. Confirm the version shown is **3.1.0**, then select **Install update & restart**. The updater validates the GitHub SHA-256 asset digest and preserves the local `data/` folder.

The upgrade adds **14 Minecraft listing links** and a separate **Shattered Crown** campaign. Your existing Universal SMP data should be migrated automatically. Shattered Crown is initially **in development**, so add a real reachable IP and switch the status to live before listing it as a playable public server.

## Publish later updates

1. Edit your project source code on GitHub or locally and push it to `main`.
2. Run `npm test`, and check **Actions → Test UGN website changes** for success.
3. Increase `package.json` from `3.1.0` to a higher version, for example `3.2.0`.
4. Publish a stable GitHub release tagged `v3.2.0`, referencing that updated commit.
5. Wait for **Package UGN website updates** to succeed and attach `ugn-auto-advertiser.zip`.
6. On the Windows dashboard, click **Check for updates → Install update & restart**.

**Important:** Do not upload your private `data/` directory, `.env`, secrets, Discord webhook URLs, or `node_modules/` to GitHub. The `.gitignore` helps with Git-based pushes but **not** uploads via the GitHub web interface.

Automatic advertising only sends to approved Discord webhook channels. Directory submissions remain assisted manual tasks. Only **one active campaign** is scheduled at once, and switching campaigns automatically pauses the scheduler. Your computer must be running to post automatically; online 24/7 scheduling requires hosting the backend.
