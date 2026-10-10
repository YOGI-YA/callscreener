import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { screeningRouter } from './routes/screeningRoutes.js';
import { logRouter } from './routes/logRoutes.js';
import { healthRouter } from './routes/healthRoutes.js';

export function createServer(): Express {
  const app = express();

  // Middleware
  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-token']
  }));
  app.use(express.json({ limit: '2mb' }));

  // Request logger in dev
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const start = Date.now();
    _res.on('finish', () => {
      const duration = Date.now() - start;
      if (process.env.NODE_ENV !== 'test') {
        console.log(`[${req.method}] ${req.originalUrl} - ${_res.statusCode} (${duration}ms)`);
      }
    });
    next();
  });

  // Mount API Routers
  app.use('/api/health', healthRouter);
  app.use('/api', screeningRouter);
  app.use('/api/logs', logRouter);

  // Root welcome endpoint
  app.get('/', (_req: Request, res: Response) => {
    res.json({
      message: 'AI-Powered Android Call Screener Backend API',
      status: 'healthy',
      docs: {
        health: '/api/health',
        screenCall: 'POST /api/screen-call',
        rules: '/api/rules',
        logs: '/api/logs',
        stats: '/api/logs/stats'
      }
    });
  });

  // Global error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled server error:', err);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: err?.message || 'Unknown error'
    });
  });

  return app;
}
