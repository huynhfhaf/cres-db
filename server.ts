import 'dotenv/config';
import express from 'express';
import path from 'path';
import { initDatabase } from './server/db/database.ts';
import { seedDatabase } from './server/db/seed.ts';
import { apiRouter } from './server/routes/api.ts';
import { startBackgroundScheduler } from './server/jobs/timerScheduler.ts';

async function startServer() {
  // 1. Initialize SQLite schema & auto-seed base structure on first run (no sample candidates auto-seeded)
  initDatabase();
  const seedInfo = seedDatabase(false);
  console.log(`[C-res Recruit] Database ready (Round: ${seedInfo.roundId}, Cases: ${seedInfo.seededApplications})`);

  // 2. Start background timer scheduler (2-day supplement, 1-day reminder, 2-day unbook)
  startBackgroundScheduler();

  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // Disable caching on all API responses so status updates reflect immediately
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });

  // 3. Mount REST API routes under /api
  app.use('/api', apiRouter);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[C-res Recruit] Server running at http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start C-res Recruit server:', err);
  process.exit(1);
});
