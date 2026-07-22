import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { RoomManager } from './rooms/RoomManager.js';
import { registerSocketHandlers } from './socket/handlers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
const CLIENT_DIST = path.resolve(__dirname, '../../client/dist');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: process.env.CLIENT_ORIGIN || '*' },
  maxHttpBufferSize: 2_000_000,
});

const manager = new RoomManager(io);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.use(express.static(CLIENT_DIST));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return next();
  res.sendFile(path.join(CLIENT_DIST, 'index.html'), (e) => {
    if (e) next();
  });
});

io.on('connection', (socket) => {
  registerSocketHandlers(io, socket, manager);
});

httpServer.listen(PORT, () => {
  console.log(`memeit server listening on :${PORT}`);
});
