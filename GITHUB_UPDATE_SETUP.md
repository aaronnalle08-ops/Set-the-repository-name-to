# UGN Website — One-time GitHub Update Setup

This repository contains version 3 of the Universal Gaming Network Advertising Command Center. Version 3 adds a Windows GitHub Releases updater.

## Set up the local website

1. Back up your existing UGN website folder, especially `data/`.
2. Install Node.js 22 or later.
3. Copy version 3 application files into your existing UGN website folder. Replace code files, but **do not delete your existing `data/` folder**.
4. Double-click `start_windows.bat` and open http://127.0.0.1:3000.
5. In **Website updates**, enter the trusted GitHub repository `aaronnalle08-ops/Set-the-repository-name-to`, save it, and select **Check for updates**.

## Publish the first release

1. Ensure all project files are at the repository root. Confirm the workflow is at `.github/workflows/release.yml`.
2. **Never upload** `data/`, `.env`, secrets, private webhook URLs, or `node_modules/`. The `.gitignore` helps with Git-based pushes but not GitHub's web uploader.
3. Under **Releases**, select **Draft a new release**.
4. Create the tag `v3.0.0` on the branch `main`. Publish the release.
5. Check **Actions → Package UGN website updates** for success. The workflow must run `npm test` and attach `ugn-auto-advertiser.zip` to the published release.
6. On the local dashboard, select **Check for updates**. Version 3.0.0 should be current, so no update is expected yet.

## Future releases: no manual ZIP downloads

1. Edit your website code. Run `npm test` before publishing.
2. Increase `package.json` from `3.0.0` to a newer version such as `3.0.1`.
3. Commit and push the changes to `main`.
4. Publish a new stable release tagged `v3.0.1` from that exact commit.
5. Check the **Actions** tab for a successful package build and a new `ugn-auto-advertiser.zip` release asset.
6. In the local dashboard, choose **Website updates → Check for updates → Install update & restart**.

The updater checks that the release is published and from your configured GitHub repository, has the expected asset name and SHA-256 digest, and contains the expected application files. It backs up existing program files and does not replace `data/`.

**Security:** Protect your GitHub account with two-factor authentication. Review proposed changes before publishing. The update system is designed for a trusted public repository that you control.

**Restrictions:** This updater is for the local Windows installation started through `start_windows.bat`. Posting only works automatically for authorized Discord channels; Minecraft directories remain assisted manual submissions unless their supported APIs allow automation. Scheduled posting on your Windows computer only runs while the program is open and the computer is running. Cloud hosting requires separate deployment.
