import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { initDatabase } from './server/db/database';
import { seedDatabase } from './server/db/seed';
import { apiRouter } from './server/routes/api';
import { startBackgroundScheduler } from './server/jobs/timerScheduler';

async function startServer() {
  // 1. Initialize SQLite schema & auto-seed on first run
  initDatabase();
  const seedInfo = seedDatabase(false);
  console.log(`[C-res Recruit] Database ready (Round: ${seedInfo.roundId}, Cases: ${seedInfo.seededApplications})`);

  // 2. Start background timer scheduler (2-day supplement, 1-day reminder, 2-day unbook)
  startBackgroundScheduler();

  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // 3. Mount REST API routes under /api (and also support root-level aliases if called directly)
  app.use('/api', apiRouter);

  if (process.env.NODE_ENV !== 'production') {
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

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[C-res Recruit] Server running at http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start C-res Recruit server:', err);
  process.exit(1);
});
