export * from './cache';
export * from './connection';
export * from './env';
export * from './middleware';
export * from './reCaptcha';
export * from './returnSignature';
import { HybridCYGManager } from './SolManager';

// Au démarrage du serveur
if (process.env.NODE_ENV === 'production') {
    const manager = new HybridCYGManager();
    
    // Vérification immédiate
    manager.manageFunds().catch(console.error);
    
    // Puis toutes les heures
    setInterval(() => {
        manager.manageFunds().catch(console.error);
    }, 60 * 60 * 1000); // 1 heure
}