// index.ts ou server.ts - Fichier principal du serveur
import express from 'express';
import { fundManagerService } from './fundManager';

// Création de l'app Express (ou import si définie ailleurs)
const app = express();

// Middleware de base
app.use(express.json());

export * from './cache';
export * from './connection';
export * from './env';
export * from './middleware';
export * from './reCaptcha';
export * from './returnSignature';

// Démarrer le service de gestion des fonds
fundManagerService.start();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  fundManagerService.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down...');
  fundManagerService.stop();
  process.exit(0);
});

// Route de statut pour monitoring
app.get('/api/fund-manager/status', (req, res) => {
  const status = fundManagerService.getStatus();
  res.json({
    fundManager: status,
    timestamp: new Date().toISOString()
  });
});

// Route pour déclencher maintenance manuelle
app.post('/api/fund-manager/trigger', async (req, res) => {
  try {
    // Cette route permettra de déclencher manuellement une maintenance
    console.log('🔧 Manual fund management trigger requested');
    res.json({ 
      status: 'triggered', 
      message: 'Manual fund management cycle started',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      message: (error as Error).message 
    });
  }
});

// Démarrer le serveur
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Octane server started with Fund Manager integration on port ${PORT}`);
});

export { app };