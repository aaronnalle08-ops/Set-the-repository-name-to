# Universal Gaming Network — Advertising Command Center

Website version: **3.0.0**

This repository is being set up for UGN's GitHub-based updater. **The application source files must be uploaded before publishing the first release.**

## First-time setup

1. Download and extract `UGN_Auto_Advertising_Website_v3_GitHub_Updater.zip` from the ChatGPT conversation.
2. Open this repository and select **Add file → Upload files**.
3. Upload the extracted application files **at the repository root**, including `server.js`, `index.html`, `update-manager.js`, `update_windows.ps1`, the two test files, `package.json`, and Windows batch scripts. Preserve the `.github/workflows/release.yml` path.
4. **Never upload `data/`, `.env`, `node_modules/`, tokens, or Discord webhook URLs.** Web upload does not automatically honor .gitignore.
5. Check the Actions tab. After all files are uploaded, create a GitHub release tagged **v3.0.0**, targeting main.
6. The **Package UGN website updates** workflow will run tests and attach `ugn-auto-advertiser.zip` to the release. Check the workflow result before expecting automatic updates.
7. In the running local dashboard, open **Website updates**, save `aaronnalle08-ops/Set-the-repository-name-to` as the trusted repository, and click **Check for updates**. It will say you're current on version 3.0.0.

## Publishing later updates

Edit the source files, bump `package.json` version to `3.0.1`, run `npm test`, upload/push changes, and publish release tag `v3.0.1` from the new commit. After its workflow succeeds, use the dashboard's Update button.

**Note:** This project only automates posting to Discord webhook channels where you have explicit authorization. Minecraft listing directory submissions remain manual unless their supported integrations permit automation.

If you rename this repository, also update the trusted repository name in the UGN website's settings.
