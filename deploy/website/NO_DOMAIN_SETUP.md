# No-domain launch: public UGN website + private dashboard + Shattered Crown IP

**This route does not require owning or changing `universalgaming.us`.** Leave `play.universalgaming.us` alone: it belongs to the existing Universal SMP setup.

## 1. Public UGN landing page (free GitHub Pages URL)

The static, player-facing page is stored at `deploy/website/public/index.html`. It intentionally has no login forms, admin routes, scheduler, tokens or private data.

Expected URL after publishing:

https://aaronnalle08-ops.github.io/Set-the-repository-name-to/

**Enable GitHub Pages:** visit [repository Settings → Pages](https://github.com/aaronnalle08-ops/Set-the-repository-name-to/settings/pages), change **Build and deployment → Source** to **GitHub Actions**, and save. Then go to [Actions → Publish public UGN website (no custom domain)](https://github.com/aaronnalle08-ops/Set-the-repository-name-to/actions/workflows/public-pages.yml) and choose **Run workflow**, branch `main`. Wait for both build and deploy to succeed, then use the Pages URL. GitHub Pages settings may show a slightly different link: prefer the URL confirmed in your deployed workflow.

Public site changes under `deploy/website/public/` then deploy automatically when pushed to `main`. Only that directory is uploaded as a Pages artifact: the rest of the repository, Node backend, private webhook URLs, and `data/` are excluded.

## 2. Keep the advertising dashboard private (recommended)

**Easiest starting point:** continue running the local `http://127.0.0.1:3000` Advertising Command Center on your Windows PC. The website above can be public while the dashboard stays private. The PC must remain running for scheduled ads.

For a **24/7 privately accessible dashboard without buying a domain**, run it on an Ubuntu VPS (or always-on PC) with **Tailscale Serve**. This gives you an HTTPS `*.ts.net` address accessible **only to approved devices in your tailnet**, *not* the whole internet. Unlike Tailscale Funnel, Serve is private.

Official docs: https://tailscale.com/docs/features/tailscale-serve and https://tailscale.com/docs/solutions/host-private-server-docker

### VPS prerequisite and private credentials

- Obtain a VPS that can run Docker and that stays online. Provisioning/billing is an action for your hosting account.
- Install Docker Engine and Compose. Install Tailscale on the VPS and your own computer. Join both to your private tailnet; review your tailnet's ACL/sharing settings.
- On the VPS, run `tailscale status` and `tailscale serve --help`. Enable Tailscale HTTPS when prompted.
- Your own `*.ts.net` HTTPS hostname is given by Tailscale (example `https://ugn-vps.your-tailnet.ts.net` — **do not** copy that example literally). You **must** use your actual assigned hostname for `PUBLIC_ORIGIN`.
- Generate a 36+ character random password. Keep it in a private file, never in GitHub or chat.

### Launch private dashboard with Docker

On the VPS, clone this repository:

```bash
git clone https://github.com/aaronnalle08-ops/Set-the-repository-name-to.git ugn-website
cd ugn-website
cp deploy/website/.env.example deploy/website/.env
openssl rand -base64 36
```

Edit `deploy/website/.env` to use your **actual** Tailscale hostname and your newly generated secret password:

```dotenv
PUBLIC_ORIGIN=https://YOUR-REAL-TAILSCALE-HOSTNAME.ts.net
ADMIN_PASSWORD=YOUR-OWN-STRONG-RANDOM-PASSWORD
```

You do **not** need a Cloudflare token for `compose-tailnet.yaml`.

```bash
chmod 600 deploy/website/.env
docker compose --env-file deploy/website/.env -f deploy/website/compose-tailnet.yaml up -d --build
docker compose --env-file deploy/website/.env -f deploy/website/compose-tailnet.yaml ps
tailscale serve --bg 3000
tailscale serve status
```

If the first Serve command prompts you to enable HTTPS or sign in, complete its steps, then rerun it. It prints your **real HTTPS tailnet URL**.

**Verification:** from your own computer connected to Tailscale, open the printed HTTPS address. The dashboard should prompt for its administrator password. From a device **not joined** to your tailnet, the dashboard should be unreachable. Your public GitHub Pages website must **not** link to or reveal this private address.

The Docker host binding is only `127.0.0.1:3000`, not a public IP. Do **not** add `0.0.0.0:3000:3000`, change it to `ports: ["3000:3000"]`, or use Tailscale **Funnel** for the admin dashboard.

### Preserve your v3.2/v3.3 campaign data

The VPS starts with an empty persistent volume called `ugn-public_ugn_private`. It does not automatically share state with your existing Windows `data/` folder. Before migration, back up that local folder and pause/stop the Windows scheduler.

Transfer the private `data/` files through a secure SSH/SFTP connection to `~/ugn-private-import/` on the VPS (permissions 0700). Do not send any secrets through public links.

From your repository directory on the VPS:

```bash
docker compose --env-file deploy/website/.env -f deploy/website/compose-tailnet.yaml stop dashboard
docker run --rm -v ugn-public_ugn_private:/dest -v "$HOME/ugn-private-import:/source:ro" alpine:3 sh -c 'cp -a /source/. /dest/ && chown -R 1000:1000 /dest'
docker compose --env-file deploy/website/.env -f deploy/website/compose-tailnet.yaml start dashboard
```

Verify both campaigns and webhook assignments before enabling the new server's schedules. Keep the old Windows scheduler stopped to prevent duplicate ads.

Cloud updates use `git pull --ff-only` followed by `docker compose --env-file ... -f deploy/website/compose-tailnet.yaml up -d --build`. The in-app Windows updater is **not** available on Linux. Never use `docker compose down -v` (deletes saved private state). Back up the Docker volume periodically.

## 3. Shattered Crown Minecraft public IP without buying a domain

A Minecraft host gives you a **real public numeric IP and port** (or an assigned hostname and port) after you purchase/provision a server. Players can join directly using those values. You **do not need custom DNS**.

1. Pick a host that supports your Shattered Crown mod loader and exact game version, plus sufficient RAM, storage and backups.
2. Upload your server modpack, start whitelisted, and confirm the server actually runs. Confirm external player connections before sharing its address.
3. Copy the assigned IP and port from your host's control panel. In Minecraft Java, use `ASSIGNED_IP:ASSIGNED_PORT`.
4. Update the Shattered Crown campaign in UGN only after the server is online. Do not claim Bedrock support unless you've tested actual mod compatibility.
5. Later, if you buy a domain you control, you can optionally point a Minecraft hostname to this existing IP using A/CNAME and optionally Java SRV records. This is **not required**.

See the full game-server preparation guide: [Shattered Crown public Minecraft setup](../minecraft/README.md).

## Why this separation matters

- GitHub Pages **public**: recruitment, server information and community website — no passwords.
- Tailscale Serve **private**: advertising admin dashboard, saved webhooks, schedules and posting actions.
- Minecraft provider **public game endpoint**: actual game server IP and port for players.

No one needs access to `universalgaming.us` DNS for this arrangement.
