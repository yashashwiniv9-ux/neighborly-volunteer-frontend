# Neighborly Frontend

React and Vite frontend for Neighborly, a community volunteer matching app.

## Run locally

Requirements: Node.js 20+.

```powershell
npm ci
npm run dev
```

The Vite development server proxies `/api` to the backend at `http://localhost:8080`.

For deployment, set `VITE_API_BASE_URL` to the API base URL, such as `https://your-api.onrender.com/api`.

## Build

```powershell
npm run build
```
