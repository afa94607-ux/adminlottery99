# ឆ្នោតសំណាង 1/99 — Lottery888 Owner Admin Panel

Pure Owner Administration interface (OWNER -> PLAYERS) running on `http://127.0.0.1:3001`.
Connects directly to the single authoritative backend running in **lottery888-game-page** (`http://127.0.0.1:3000`) with dedicated Vite HMR port `24679` (no port `24678` conflict and no duplicated backend).

## 1. Start in VS Code (Windows PowerShell)

Make sure **lottery888-game-page** is running on `http://127.0.0.1:3000` first, then run:

```powershell
npm install
npm run dev
```

Open your browser at **http://127.0.0.1:3001** and log in with the Owner account initialized in the Game Page backend (`npm run init-owner`).

## 2. Stop Command (Windows PowerShell)

Press `Ctrl + C` in PowerShell, or run:
```powershell
Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

## 3. Production / Cloudflare Pages Build

Set `VITE_API_URL=https://your-game-backend-domain.com` in your hosting environment variables, then build:

```powershell
npm run build
```

Output directory: `dist`
