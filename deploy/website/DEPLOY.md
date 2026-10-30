# Host the UGN website securely on a public domain

This deployment hosts a **public informational website** and a **private Advertising Command Center** as two different containers behind a Cloudflare Tunnel. It **does not host Shattered Crown Minecraft**; see [../minecraft/README.md](../minecraft/README.md).

## Important: Do not open the dashboard to the Internet without authentication

Cloudflare Tunnel does not automatically enforce login. Before enabling the private public hostname, create a **Cloudflare Access self-hosted application** with an Allow policy restricted to *your* email/identity. The dashboard also uses a separate 24+ character `ADMIN_PASSWORD` for defense in depth. Never set `ADMIN_PASSWORD` to a weak or shared password.

No web ports are published from this Docker Compose setup, and the Cloudflare route only reaches containers through the internal Docker network.

## Prerequisites

- An Ubuntu 24.04 LTS VPS with Docker Engine and Docker Compose plugin installed, kept online continuously. A small 2 GB RAM VPS is a practical starting point for the lightweight advertising site. Back up disk storage; use SSH keys and allow only necessary SSH traffic at the host firewall. You do not need inbound HTTP/HTTPS ports for this tunnel.
- A domain **you control in Cloudflare DNS** (for example `universalgaming.us` if that is yours and you manage its DNS). Do **not** overwrite existing `play.universalgaming.us` DNS for Universal SMP.
- Two previously unused subdomains: `community.universalgaming.us` (public) and `admin.universalgaming.us` (private). Substitute your actual domain/subdomains in every step.

References:
- [Cloudflare Tunnel](https://developers.cloudflare.com/tunnel/get-started/)
- [Cloudflare Access for self-hosted apps](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/)
- [Docker Engine on Ubuntu](https://docs.docker.com/engine/install/ubuntu/)

## A. Prepare a Cloudflare Tunnel

1. Open the Cloudflare dashboard, visit **Networking → Tunnels**, then create a remotely managed tunnel named `ugn-public-website`.
2. Copy the token from the tunnel's **Docker installation command**. Treat the token like a password. Do not commit it to GitHub or post it in chat.
3. In **Cloudflare Zero Trust → Access controls → Applications**, create a *self-hosted* application for the private hostname `admin.universalgaming.us`. Make an **Allow** policy containing only your permitted email identity; do not allow Everyone. Verify the Access policy applies to the whole hostname, including `/api/*`.
4. Only once the policy is in place, add two **published application** hostname routes to the tunnel:
   - `community.universalgaming.us` → **HTTP** `http://public:80` (public landing page; no Access required).
   - `admin.universalgaming.us` → **HTTP** `http://dashboard:3000` (must have the Access app above).
5. Both containers and `cloudflared` will be in the same Docker Compose project, so the container names `public` and `dashboard` resolve internally.
6. Ensure DNS for these tunnel routes is configured as Cloudflare directs (the published hostname route normally creates or guides the tunnel CNAME).

## B. Start on your VPS

Log in to the VPS over SSH using a non-root user authorized for Docker:

```bash
git clone https://github.com/aaronnalle08-ops/Set-the-repository-name-to.git ugn-website
cd ugn-website
cp deploy/website/.env.example deploy/website/.env
openssl rand -base64 36
```

Edit `deploy/website/.env` privately and replace **every** example value:

```dotenv
PUBLIC_ORIGIN=https://admin.universalgaming.us
ADMIN_PASSWORD=YOUR_OWN_UNIQUE_36_PLUS_CHARACTER_SECRET
CLOUDFLARE_TUNNEL_TOKEN=YOUR_OWN_SECRET_TUNNEL_TOKEN
```

Use the generated password only inside this private file. **Do not paste actual tokens or passwords into GitHub or ChatGPT.**

Protect the file and launch:

```bash
chmod 600 deploy/website/.env
docker compose --env-file deploy/website/.env -f deploy/website/compose.yaml up -d --build
docker compose --env-file deploy/website/.env -f deploy/website/compose.yaml ps
```

Verify from an external browser:

- `https://community.universalgaming.us` should display the public UGN/Universal SMP/Shattered Crown landing page.
- `https://admin.universalgaming.us` should require Cloudflare Access, followed by your private dashboard Basic Auth password.
- A browser logged out of Access or an unauthorized email should **not** reach the dashboard, its APIs, or saved webhooks.

The `NODE_ENV=production` setting refuses to start the dashboard unless the password is long enough and `PUBLIC_ORIGIN` is a valid HTTPS origin. Modifying actions require same-origin JSON requests to guard against cross-site browser attacks.

## C. Preserve your existing v3.2 local campaign data

Your Windows local UGN website stores campaigns, schedules, authorized Discord webhooks, and delivery records in `data/`. The new VPS uses a persistent Docker volume named `ugn-public_ugn_private`. **These are separate stores: the local site will not automatically sync with the cloud site.**

To move the existing campaign settings to the cloud:

1. Pause automatic posting on the Windows dashboard. **Stop `start_windows.bat`** so the old scheduler cannot make duplicate posts while the new host is running.
2. Make an encrypted/secured backup of your local `data/` folder. Do not place it in GitHub or a public folder.
3. Transfer the backup to your VPS using a secure channel such as SSH/SFTP into a private directory within your Linux home folder, for example `~/ugn-private-import`, with permissions `0700`. Do not make this directory web-accessible.
4. On the VPS, stop only the dashboard container (the other two services can remain running):

```bash
docker compose --env-file deploy/website/.env -f deploy/website/compose.yaml stop dashboard
docker run --rm -v ugn-public_ugn_private:/dest -v "$HOME/ugn-private-import:/source:ro" alpine:3 sh -c 'cp -a /source/. /dest/ && chown -R 1000:1000 /dest'
docker compose --env-file deploy/website/.env -f deploy/website/compose.yaml start dashboard
```

5. Check that the cloud dashboard shows your existing Universal SMP and Shattered Crown settings. Confirm your desired channels and schedules; restart scheduling on the new host only after verification.
6. Remove the temporary import directory securely after you have a valid backup elsewhere.

**Warning:** Never run the old Windows scheduler and the new hosted scheduler at the same time against the same Discord webhooks unless you're deliberately coordinating them.

## D. Updates and backups

The local Windows **Install update & restart** button intentionally remains unavailable in cloud hosting. The cloud deployment uses container rebuilds instead:

```bash
cd ~/ugn-website
git pull --ff-only
docker compose --env-file deploy/website/.env -f deploy/website/compose.yaml up -d --build
```

These commands preserve `ugn-public_ugn_private` because it is a named volume. **Never use `docker compose down -v`**; that deletes private data volumes.

Make regular encrypted backups of the persistent volume to storage outside the VPS. Review logs with:

```bash
docker compose --env-file deploy/website/.env -f deploy/website/compose.yaml logs --tail=80 dashboard cloudflared
```

If `PUBLIC_ORIGIN` changes, edit the private `.env` first and restart the dashboard. An Access bypass, a public error page exposing the admin login, or unexpected authentication behavior is a reason to disable the tunnel hostname until corrected.

## E. Don't mix the website and game server DNS

For Shattered Crown Minecraft, use a separate DNS-only game-server hostname such as `shatteredcrown.universalgaming.us` that points to the Minecraft host's *assigned* address. Game traffic does not belong behind a standard Cloudflare HTTP Tunnel. See [../minecraft/README.md](../minecraft/README.md).
