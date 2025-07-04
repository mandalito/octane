// src/fundManager.ts - Fichier principal du gestionnaire
import 'dotenv/config';
import { OptimalDevnetFundManager } from './devnetFundManager';

class FundManagerService {
  private manager: OptimalDevnetFundManager;
  private isRunning = false;
  private intervalId?: NodeJS.Timeout;

  constructor() {
    this.manager = new OptimalDevnetFundManager();
  }

  /**
   * Démarrer le service de gestion des fonds
   */
  start(): void {
    if (this.isRunning) {
      console.log('⚠️ Fund manager already running');
      return;
    }

    console.log('🚀 Starting Fund Manager Service...');
    
    // Exécution immédiate au démarrage
    this.executeMaintenanceCycle()
      .then(() => console.log('✅ Initial fund management completed'))
      .catch(error => console.error('❌ Initial fund management failed:', error));

    // Programmation des cycles (toutes les 30 minutes)
    this.intervalId = setInterval(() => {
      this.executeMaintenanceCycle()
        .catch(error => console.error('❌ Scheduled fund management failed:', error));
    }, 30 * 60 * 1000); // 30 minutes

    this.isRunning = true;
    console.log('⏰ Fund manager scheduled every 30 minutes');
  }

  /**
   * Arrêter le service
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.isRunning = false;
    console.log('🛑 Fund manager service stopped');
  }

  /**
   * Vérification critique avant transaction (à appeler dans les endpoints)
   */
  async checkCriticalSOL(): Promise<{ shouldProceed: boolean; message?: string }> {
    try {
      // Vérifier le solde SOL critique
      const balances = await this.manager.getBalances();
      
      if (balances.solBalance < 0.1) {
        console.log('🚨 CRITICAL SOL shortage detected!');
        
        // Tentative d'airdrop d'urgence
        const emergencyRefill = await this.manager.refillSOLViaAirdrop(1.0);
        
        if (!emergencyRefill) {
          return {
            shouldProceed: false,
            message: `Critical SOL shortage (${balances.solBalance.toFixed(4)} SOL). Please try again in a few minutes.`
          };
        }
        
        console.log('✅ Emergency SOL refill completed');
      }

      return { shouldProceed: true };

    } catch (error) {
      console.error('❌ Critical SOL check failed:', error);
      // En cas d'erreur, permettre la transaction pour ne pas bloquer le service
      return { shouldProceed: true };
    }
  }

  /**
   * Cycle de maintenance complet
   */
  private async executeMaintenanceCycle(): Promise<void> {
    try {
      console.log('\n🔄 [MAINTENANCE] Starting fund management cycle...');
      console.log(`📅 Timestamp: ${new Date().toISOString()}`);
      
      await this.manager.executeDevnetStrategy();
      
      console.log('✅ [MAINTENANCE] Fund management cycle completed\n');
      
    } catch (error) {
      console.error('❌ [MAINTENANCE] Fund management cycle failed:', error);
    }
  }

  /**
   * Statut du service
   */
  getStatus(): { running: boolean; nextCycle?: string } {
    return {
      running: this.isRunning,
      nextCycle: this.isRunning ? new Date(Date.now() + 30 * 60 * 1000).toISOString() : undefined
    };
  }
}

// Instance singleton
export const fundManagerService = new FundManagerService();

// Pour utilisation en script standalone
if (require.main === module) {
  console.log('🎭 Running Fund Manager in standalone mode...');
  
  const manager = new OptimalDevnetFundManager();
  manager.executeDevnetStrategy()
    .then(() => {
      console.log('✅ Standalone execution completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Standalone execution failed:', error);
      process.exit(1);
    });
}