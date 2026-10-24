import express from 'express';
import mongoose from 'mongoose';

const router = express.Router();

// Root message (optional)
router.get('/', (req, res) => {
  res.send({
    status: 'ok',
    message: 'Health check endpoint',
  });
});

// Ping (simple heartbeat)
router.get('/ping', (req, res) => {
  res.send('pong');
});

// General health check
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Server is healthy',
    timestamp: new Date().toISOString(),
  });
});

// App info
router.get('/info', (req, res) => {
  res.status(200).json({
    app: process.env.APP_NAME || 'My Express API',
    version: process.env.APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
  });
});

// Liveness probe
router.get('/live', (req, res) => {
  res.sendStatus(200);
});

// Readiness probe (checks DB connection)
router.get('/ready', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      throw new Error('Database not connected');
    }
    res.sendStatus(200);
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: (err as any)?.message || 'Not ready',
    });
  }
});

const healthRoutes = router;

export default healthRoutes;
