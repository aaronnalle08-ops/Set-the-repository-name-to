# Shattered Crown — public Minecraft server and IP setup

This is a deployment plan, **not a running server**. A real public IP/address can be issued only by the Minecraft hosting provider or VPS you provision. Do not advertise a placeholder address as a live server.

## Recommended first host

Use a specialized Minecraft hosting provider that supports the specific **Minecraft Java version and mod loader** used by Shattered Crown. [Modrinth Hosting](https://modrinth.com/hosting) is one option supporting custom modpacks and Fabric, Forge, and NeoForge. Confirm availability and pricing on the host's current checkout page. A large kingdom-building modpack with extensive schematics and a world that grows over time may need **8–12 GB+ RAM**, fast CPU and SSD/NVMe storage, and backup capacity; increase resources as testing demonstrates.

Do not configure the server with an invented Minecraft version or guess its mod loader. **Verify your compiled Shattered Crown modpack and server pack first**. Client-required Java mods generally prevent Bedrock/Geyser joining (see [Geyser FAQ](https://geysermc.org/wiki/geyser/faq/)).

## Create a safe public server

1. Purchase a modded Java Minecraft server in an appropriate region. Choose a provider with file/SFTP access, automatic backups, adequate RAM and an editable startup command.
2. Select the **exact** Minecraft Java edition version and mod loader that your finished Shattered Crown server pack supports.
3. Upload only the server-side modpack files/configs. Install the correct Java runtime for that version. Add the world and verify blueprints, levels, resources, construction and server performance in a **whitelisted test server**.
4. Read and accept the Minecraft EULA, enable `online-mode=true`, and set `white-list=true` while testing. Keep `enable-rcon=false` unless absolutely needed and secured privately.
5. Arrange automatic offsite backups and test that you can restore a world. Enable provider-side DDoS protection where available.
6. Start the server, use the assigned IP and **actual provider port** to connect from a different internet connection. Test with a second player account before publishing the address.
7. Once ready to open the public beta, change your policy, remove only the desired whitelist restrictions, and post the real address in the UGN website and Shattered Crown ad campaign.

For Java Edition, the typical game port is **25565 TCP**. Many hosts provide a different port; use the host's assigned port, not a guess.

## Add an optional custom domain

If you **control** `universalgaming.us` and manage its DNS, a distinct game hostname might be `shatteredcrown.universalgaming.us` or `crown.universalgaming.us`. Do not overwrite `play.universalgaming.us` if Universal SMP is already there.

- If the host provides a dedicated IPv4: add a **DNS-only** A record with name `shatteredcrown` and content set to that assigned IP.
- If the host provides a DNS hostname rather than a dedicated IP: follow the host's guide to create a DNS-only **CNAME** for `shatteredcrown`.
- If the Java port is not 25565 and you want players to omit `:port`, configure a **Minecraft Java SRV record** whose service and protocol are `_minecraft` and `_tcp`, host `shatteredcrown.universalgaming.us`, and target/port are the host's assigned endpoint. Follow your provider's specific format.
- At Cloudflare DNS, **disable the orange-cloud HTTP proxy** for the Minecraft A/CNAME records (use the gray cloud **DNS-only** mode). Standard Cloudflare proxy/Tunnel does not carry ordinary Minecraft protocol traffic to vanilla clients.

Use a port (such as `25565`) only once verified with your hosting provider, and keep the server hostname private until player testing succeeds.

## Bedrock option (only after mod compatibility testing)

A Java+Bedrock gateway such as Geyser is possible for suitable Java servers, but Geyser **cannot translate most custom modded blocks/items or mods that require client installation**. Bedrock players must not be promised compatibility until the actual Shattered Crown server pack passes testing. Some modern Bedrock versions also use NetherNet; follow the official [Geyser setup guide](https://geysermc.org/wiki/geyser/setup/) for the currently supported version and ports. A typical legacy Bedrock port is **19132 UDP**, but it may differ with transport or host configuration.

## Advertise only when ready

Change Shattered Crown's campaign status from *In development* to *Live* in the UGN Advertising Command Center only after the server is reachable from outside and stable. Fill in the real host, assigned Java port, and verified Bedrock details if supported. Until then, the public website correctly advertises recruitment rather than a fake join address.
