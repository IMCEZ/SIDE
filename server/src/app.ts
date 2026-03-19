import express from 'express';
import { applySecurity, loginLimiter } from './middleware/security';
import authRoutes from './routes/auth';
import settingsRoutes from './routes/settings';
import charactersRoutes from './routes/characters';

const app = express();

applySecurity(app);

app.use('/api/v1/auth/login', loginLimiter);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/characters', charactersRoutes);

export default app;

