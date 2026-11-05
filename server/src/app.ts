import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { config } from './config.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { originGuard } from './middlewares/originGuard.js';
import { apiRoutes } from './routes/index.js';
import { HttpError } from './utils/httpError.js';

/** Builds the Express application. */
export function createApp(): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.use(cors({ origin: config.CLIENT_ORIGIN, credentials: true }));
  app.use(originGuard);
  app.use(express.json({ limit: '64kb' }));
  app.use('/api', apiRoutes);
  app.use(() => {
    throw new HttpError(404, 'Not found');
  });
  app.use(errorHandler);
  return app;
}
