# Micro Arcade

Micro Arcade is a browser-based collection of instant-play mini-games built with React, TypeScript, Vite, and Tailwind CSS.

## Local development

**Prerequisite:** Node.js 20+ (or Bun)

```bash
npm install
npm run dev
```

The application is currently client-only. No API key or backend is required to run the arcade locally.

## Production build

```bash
npm run build
npm run preview
```

## Notes

- Player statistics and preferences are stored locally in the browser.
- The current leaderboard data is simulated/demo data and is not a live backend leaderboard.
- Production leaderboard infrastructure will be added separately.
