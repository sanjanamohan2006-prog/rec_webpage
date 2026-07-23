# REC Research Portal

## Run on this computer

Open a command prompt in this folder and run:

```bat
npm.cmd start
```

Or double-click `start-lan.cmd`.

Open `http://localhost:3000` on this computer. Data is saved in `portal.db` and survives browser refreshes and server restarts.

## Open from another laptop on the same Wi-Fi / LAN

1. Start the portal on the computer that holds this project and leave that command window open.
2. On that computer, run `ipconfig` and note its **IPv4 Address** for the active Wi-Fi or Ethernet adapter, for example `192.168.1.25`.
3. On the other laptop, connected to the same network, open `http://192.168.1.25:3000` (replace the example address with the one from step 2).
4. If Windows asks about firewall access for Node.js, allow it on **Private networks**. If no prompt appears and the page cannot load, allow inbound TCP port `3000` for Node.js in Windows Defender Firewall.

Both laptops will use the same portal and the same SQLite database, so a saved change from either laptop is visible after refreshing the other one.

Keep the portal host computer powered on and connected to the network. This LAN setup is intended for a trusted private network; do not expose port 3000 directly to the public internet without adding login and HTTPS.

## Publish it with a public link

A website can be opened from any laptop only when its backend is hosted on an internet-connected server. This project is ready to deploy on any server that supports Docker.

On a server with Docker installed, copy the project folder and run:

```bash
docker build -t rec-portal .
docker run -d --name rec-portal --restart unless-stopped -p 3000:3000 -v rec-portal-data:/app/data rec-portal
```

The site will then be reachable at `http://YOUR-SERVER-IP:3000`. The named `rec-portal-data` volume preserves `portal.db` through container rebuilds and restarts. Connect a domain and HTTPS reverse proxy (for example, Nginx or Caddy) before sharing it publicly.

Do not use serverless hosts with temporary filesystems for this SQLite version—the data can be erased between deployments. For those platforms, the backend should be switched to a managed database such as PostgreSQL.
