// Gestionnaire de fonds adapté pour Devnet
import { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getAccount, getAssociatedTokenAddress } from '@solana/spl-token';
import { exec } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';

const execAsync = promisify(exec);

import base58 from 'bs58';

export class OptimalDevnetFundManager {
  private connection: Connection;
  private wallet: Keypair;
  private octaneUrl: string;

  constructor() {
    // Chargement depuis env comme votre ancien script
    if (!process.env.SECRET_KEY) {
      throw new Error('SECRET_KEY not found in environment');
    }
    
    this.connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    this.wallet = Keypair.fromSecretKey(base58.decode(process.env.SECRET_KEY));  // ✅ Depuis env
    this.octaneUrl = process.env.OCTANE_URL || 'https://octane-server-eta.vercel.app';
  }

  /**
   * 🪂 DEVNET: Refill SOL via airdrop automatique
   */
  async refillSOLViaAirdrop(targetSOL = 1.5): Promise<boolean> {
    try {
      console.log(`🪂 [DEVNET] Requesting SOL airdrop to reach ${targetSOL} SOL...`);
      
      const currentBalance = await this.getSOLBalance();
      const needSOL = Math.max(0, targetSOL - currentBalance);
      
      if (needSOL < 0.1) {
        console.log(`💡 [DEVNET] No airdrop needed (current: ${currentBalance.toFixed(4)} SOL)`);
        return true;
      }

      // Airdrop via CLI Solana
      const airdropAmount = Math.min(needSOL + 0.5, 2.0); // Max 2 SOL par airdrop
      
      console.log(`🪂 [DEVNET] Requesting ${airdropAmount.toFixed(2)} SOL airdrop...`);
      
      const command = `solana airdrop ${airdropAmount} ${this.wallet.publicKey.toString()} --url devnet`;
      const { stdout, stderr } = await execAsync(command);
      
      if (stderr && !stderr.includes('Warning')) {
        throw new Error(`Airdrop failed: ${stderr}`);
      }
      
      console.log(`✅ [DEVNET] Airdrop successful:`, stdout.trim());
      
      // Vérifier le nouveau solde
      await new Promise(resolve => setTimeout(resolve, 2000)); // Attendre propagation
      const newBalance = await this.getSOLBalance();
      console.log(`💰 [DEVNET] New SOL balance: ${newBalance.toFixed(4)} SOL`);
      
      return newBalance >= targetSOL * 0.9; // 90% du target = succès

    } catch (error) {
      console.error('❌ [DEVNET] Airdrop failed:', error);
      return false;
    }
  }

  /**
   * 🌊 WHIRLPOOLS: Test de disponibilité (simulation pour devnet)
   */
  async testWhirlpoolsAvailability(): Promise<{ available: boolean; reason: string }> {
    try {
      console.log('🌊 Testing Whirlpools CYG→SOL availability...');
      
      const response = await axios.post(`${this.octaneUrl}/api/buildWhirlpoolsSwap`, {
        user: this.wallet.publicKey.toString(),
        sourceMint: '2XhF8JfNDapMdH9jb18gAZEeSxbLAo6B2WfLqKcfnHZU', // CYG
        amount: 100000000, // 0.1 CYG test
        slippingTolerance: 0.01
      });

      if (response.data.status === 'ok') {
        return {
          available: true,
          reason: 'Whirlpools pool CYG↔SOL found and functional'
        };
      }

      return {
        available: false,
        reason: response.data.message || 'Whirlpools build failed'
      };

    } catch (error) {
      let errorMsg: string;
      
      if (error && typeof error === 'object' && 'response' in error) {
        // Erreur Axios avec response
        const axiosError = error as { response?: { data?: { message?: string } } };
        errorMsg = axiosError.response?.data?.message || 'Unknown axios error';
      } else if (error instanceof Error) {
        // Erreur standard
        errorMsg = error.message;
      } else {
        // Autre type d'erreur
        errorMsg = String(error);
      }
      
      return {
        available: false,
        reason: `Whirlpools unavailable: ${errorMsg}`
      };
    }
  }

  /**
   * 💱 SIMULATION: Différentes stratégies de conversion CYG→SOL
   */
  async simulateConversionStrategies(cygAmount: number): Promise<void> {
    console.log(`\n💱 [SIMULATION] Testing conversion strategies for ${cygAmount.toFixed(4)} CYG`);
    
    // 1. Test Whirlpools
    const whirlpools = await this.testWhirlpoolsAvailability();
    console.log(`🌊 Whirlpools: ${whirlpools.available ? '✅ Available' : '❌ Not available'}`);
    console.log(`   Reason: ${whirlpools.reason}`);
    
    if (whirlpools.available) {
      console.log(`   [SIMULATION] Would swap ${cygAmount.toFixed(4)} CYG → ~${(cygAmount / 20).toFixed(4)} SOL via Whirlpools`);
      console.log(`   [SIMULATION] Estimated slippage: 0.5-2%`);
      console.log(`   [SIMULATION] Octane fees: 0.1 CYG`);
    }

    // 2. Test Jupiter (pour mainnet)
    console.log(`\n🪐 Jupiter API:`);
    const jupiterSupported = await this.testJupiterAPI(cygAmount);
    console.log(`   ${jupiterSupported ? '✅ Supported' : '❌ Not supported on devnet'}`);
    
    if (jupiterSupported) {
      console.log(`   [FUTURE] Would swap ${cygAmount.toFixed(4)} CYG → SOL via Jupiter`);
      console.log(`   [FUTURE] Better rates possible with aggregated liquidity`);
    }

    // 3. Fallback direct transfer
    console.log(`\n📤 Direct Transfer (Fallback):`);
    console.log(`   ✅ Always available`);
    console.log(`   [SIMULATION] Would transfer ${cygAmount.toFixed(4)} CYG to dev wallet`);
    console.log(`   [SIMULATION] Devs handle manual conversion`);

    // 4. Devnet airdrop (current solution)
    console.log(`\n🪂 Devnet Airdrop (Current):`);
    console.log(`   ✅ Available for devnet`);
    console.log(`   [CURRENT] Would request SOL airdrop instead of conversion`);
    console.log(`   [CURRENT] Transfer ${cygAmount.toFixed(4)} CYG to devs for accumulation`);
  }

  /**
   * 🪐 Test Jupiter API (pour mainnet future)
   */
  private async testJupiterAPI(cygAmount: number): Promise<boolean> {
    try {
      const params = new URLSearchParams({
        inputMint: '2XhF8JfNDapMdH9jb18gAZEeSxbLAo6B2WfLqKcfnHZU',
        outputMint: 'So11111111111111111111111111111111111111112',
        amount: Math.floor(cygAmount * 1e9).toString(),
        slippageBps: '100'
      });

      const response = await fetch(`https://quote-api.jup.ag/v6/quote?${params}`);
      
      if (response.ok) {
        const quote = await response.json();
        return quote && !quote.error;
      }
      
      return false;
    } catch {
      return false;
    }
  }

  /**
   * 🎯 STRATÉGIE DEVNET OPTIMALE
   */
  async executeDevnetStrategy(): Promise<void> {
    console.log('🎯 [DEVNET] Executing optimal strategy...\n');

    try {
      const { solBalance, cygBalance } = await this.getBalances();
      
      console.log(`💰 Current balances:`);
      console.log(`  SOL: ${solBalance.toFixed(4)} SOL`);
      console.log(`  CYG: ${cygBalance.toFixed(4)} CYG`);

      // 1. Gérer le SOL en priorité
      if (solBalance < 0.5) {
        console.log(`\n🚨 Low SOL detected, requesting airdrop...`);
        const airdropSuccess = await this.refillSOLViaAirdrop(1.5);
        
        if (!airdropSuccess) {
          console.log(`⚠️ Airdrop failed, continuing with CYG management...`);
        }
      }

      // 2. Gérer l'excédent CYG
      const excessCYG = Math.max(0, cygBalance - 0.5);
      
      if (excessCYG > 1.0) {
        console.log(`\n📊 Excess CYG detected: ${excessCYG.toFixed(4)} CYG`);
        
        // Simuler les options de conversion
        await this.simulateConversionStrategies(excessCYG);
        
        // Pour devnet: Transfer direct aux devs
        console.log(`\n📤 [DEVNET] Transferring excess CYG to developers...`);
        await this.transferCYGToDev(excessCYG);
      }

      // 3. Distribution profits SOL (si > 2 SOL)
      const updatedSOLBalance = await this.getSOLBalance();
      const profitSOL = Math.max(0, updatedSOLBalance - 2.0);
      
      if (profitSOL > 0.1) {
        console.log(`\n💰 SOL profit detected: ${profitSOL.toFixed(4)} SOL`);
        console.log(`📤 [SIMULATION] Would send ${profitSOL.toFixed(4)} SOL to developers`);
        // En simulation pour devnet - pas de vrai transfer de SOL
      }

      console.log('\n✅ [DEVNET] Strategy execution completed!');

    } catch (error) {
      console.error('❌ [DEVNET] Strategy execution failed:', error);
    }
  }

  // Utilitaires
  private async getSOLBalance(): Promise<number> {
    const balance = await this.connection.getBalance(this.wallet.publicKey);
    return balance / LAMPORTS_PER_SOL;
  }

  async getBalances() {
    const solBalance = await this.getSOLBalance();
    
    let cygBalance = 0;
    try {
      const cygATA = await getAssociatedTokenAddress(
        new PublicKey('2XhF8JfNDapMdH9jb18gAZEeSxbLAo6B2WfLqKcfnHZU'),
        this.wallet.publicKey
      );
      const accountInfo = await getAccount(this.connection, cygATA);
      cygBalance = Number(accountInfo.amount) / 1e9;
    } catch (e) {
      // Pas de compte CYG
    }

    return { solBalance, cygBalance };
  }

  private async transferCYGToDev(amount: number): Promise<boolean> {
    console.log(`📤 [SIMULATION] Would transfer ${amount.toFixed(4)} CYG to dev wallet`);
    console.log(`🔗 [SIMULATION] Transaction would be visible on explorer`);
    // TODO: Implémenter le vrai transfer via votre endpoint Octane
    return true;
  }
}

// 📋 TODO MAINNET - Fonctionnalités à implémenter pour production
export const MAINNET_TODOS = {
  whirlpools: {
    description: "Swap CYG→SOL via Whirlpools intégré à Octane",
    implementation: "Utiliser les endpoints /api/buildWhirlpoolsSwap + /api/sendWhirlpoolsSwap",
    benefits: "Gasless swaps, routes optimisées, intégration native",
    status: "Ready to implement - endpoints already exist"
  },
  
  jupiter: {
    description: "Swap CYG→SOL via Jupiter API directe",
    implementation: "Intégration Jupiter V6 API + signing + sending",
    benefits: "Meilleurs prix, plus de liquidité, routes multiples",
    status: "TODO - Requires Jupiter integration"
  },
  
  realDistribution: {
    description: "Vraie distribution SOL/CYG aux développeurs",
    implementation: "Remplacer simulations par vrais transfers",
    benefits: "Revenus automatiques pour l'équipe",
    status: "Easy to implement - reuse existing transfer logic"
  },
  
  monitoring: {
    description: "Monitoring et alertes avancés",
    implementation: "Discord webhooks, métriques, dashboards",
    benefits: "Visibilité opérationnelle, alertes proactives",
    status: "TODO - Nice to have"
  }
};

// Usage
async function main() {
  const manager = new OptimalDevnetFundManager();
  await manager.executeDevnetStrategy();
  
  console.log('\n📋 MAINNET ROADMAP:');
  Object.entries(MAINNET_TODOS).forEach(([key, todo]) => {
    console.log(`\n🔹 ${key.toUpperCase()}:`);
    console.log(`   📝 ${todo.description}`);
    console.log(`   🔧 ${todo.implementation}`);
    console.log(`   ✨ ${todo.benefits}`);
    console.log(`   📊 Status: ${todo.status}`);
  });
}

// Exécution directe seulement si lancé en standalone
if (require.main === module) {
  main().catch(console.error);
}