# GitHub release updater — v3.2.0

Repository: `aaronnalle08-ops/Set-the-repository-name-to`

## Upgrade from v3.1.0 to v3.2.0

Your existing Windows updater can install this version when a correct GitHub release exists.

1. Review the latest **Test UGN website changes** run in the GitHub Actions tab and ensure all tests pass.
2. Create a new GitHub **release** from `main`; the **tag** must be exactly `v3.2.0`, not `main`. The release *name* can be `UGN Advertising Command Center v3.2.0`.
3. In the GitHub Actions tab confirm **Package UGN website updates** succeeds. It attaches `ugn-auto-advertiser.zip` automatically to the correct tagged release. If necessary, manually run the packaging workflow with `release_tag=v3.2.0`.
4. Make a backup of your local `data/` directory. Do not delete it.
5. On Windows, open `start_windows.bat`, then visit http://127.0.0.1:3000 and select **Website updates**.
6. Check that the trusted repository is `aaronnalle08-ops/Set-the-repository-name-to`. Click **Check for updates** then **Install update & restart**.
7. Verify **Installed website version: v3.2.0**.

## Migration and safety

- Existing campaigns and private Discord webhook URLs stay under `data/` and are not overwritten by GitHub ZIPs.
- The v3.1 shared schedule is moved to the project that was selected at upgrade time. The other project's schedule starts paused.
- Both project schedules can now run independently, but **existing Discord channels are assigned to Universal SMP only** until you explicitly approve them for Shattered Crown.
- Both schedules can share a Discord webhook only with explicit permission. A six-hour minimum interval per destination prevents duplicate posts when schedules overlap. Suppressed sends appear as `skipped` in the delivery history.
- Listing submissions are **manual**. Analytics do not claim to measure genuine player visits to third-party directories. Manual click/join totals must be entered from real measurements.
- Your computer and Node backend must be running for scheduled posts to send.

## Future updates

Change source, bump `package.json` to a newer version, run `npm test`, check GitHub Actions, publish a matching `vX.Y.Z` release, and use the in-app Update button. Protect your GitHub account with 2FA and never upload the private `data/` directory, Discord webhook URLs, `.env`, or tokens.

**Important:** If the release is titled `v3.2.0` but tagged `main`, the updater will not recognize it. Choose **Create new tag: v3.2.0 on publish**, with `main` only as the target branch.
