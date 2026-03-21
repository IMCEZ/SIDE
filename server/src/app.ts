import express from 'express';
import path from 'path';
import fs from 'fs';
import { applySecurity, loginLimiter } from './middleware/security';
import authRoutes from './routes/auth';
import settingsRoutes from './routes/settings';
import charactersRoutes from './routes/characters';
import worldsRoutes from './routes/worlds';
import presetsRoutes from './routes/presets';
import apiConfigsRoutes from './routes/apiConfigs';
import chatRoutes from './routes/chat';
import importsRoutes from './routes/imports';
import { errorMiddleware } from './core/errors/errorMiddleware';

const app = express();
const clientDistPath = path.resolve(__dirname, '../../client/dist');
const hasClientDist = fs.existsSync(path.join(clientDistPath, 'index.html'));

applySecurity(app);

app.use('/api/v1/auth/login', loginLimiter);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/characters', charactersRoutes);
app.use('/api/v1/worlds', worldsRoutes);
app.use('/api/v1/presets', presetsRoutes);
app.use('/api/v1/api-configs', apiConfigsRoutes);
app.use('/api/v1/chat', chatRoutes);
app.use('/api/import', importsRoutes);

if (hasClientDist) {
  app.use(express.static(clientDistPath));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

app.use(errorMiddleware);

export default app;
