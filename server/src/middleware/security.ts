import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

const userAgentBlacklist = ['curl', 'wget', 'httpclient', 'scrapy'];

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false
});

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false
});

function antiScraping(req: Request, res: Response, next: NextFunction) {
  const ua = (req.headers['user-agent'] || '').toLowerCase();
  if (userAgentBlacklist.some((b) => ua.includes(b))) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}

export function applySecurity(app: Express) {
  app.use(helmet());
  app.use(
    cors({
      origin: '*'
    })
  );
  app.use(antiScraping);
  app.use(apiLimiter);
  app.use(
    express.json({
      limit: '50mb'
    }) as any
  );
  app.use(
    express.urlencoded({
      limit: '50mb',
      extended: true
    }) as any
  );
}

