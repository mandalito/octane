# 🚀 Système de Gestion Automatique CYG/SOL pour Octane

Ce système gère automatiquement les tokens CYG collectés comme frais par Octane et distribue les profits aux développeurs.

## 📋 Table des matières

- [Vue d'ensemble](#vue-densemble)
- [Architecture](#architecture)
- [Configuration](#configuration)
- [Scripts disponibles](#scripts-disponibles)
- [Fonctionnement](#fonctionnement)
- [Intégration serveur](#intégration-serveur)
- [Mode simulation](#mode-simulation)
- [Déploiement production](#déploiement-production)
- [Troubleshooting](#troubleshooting)

## 🎯 Vue d'ensemble

### Problématique
Octane collecte des tokens CYG comme frais de transaction. Ces tokens s'accumulent et doivent être :
1. **Convertis en SOL** pour maintenir les opérations
2. **Distribués aux développeurs** comme profits
3. **Gardés en réserve** pour les frais futurs

### Solution
Un système automatique qui :
- 🔍 **Monitor** les soldes SOL et CYG en continu
- 🔄 **Convertit** l'excès de CYG en SOL (via Jupiter ou transfer direct)
- 💰 **Distribue** les profits SOL aux développeurs
- 🛡️ **Maintient** des réserves minimales pour les opérations

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Fee Payer     │    │   Jupiter API   │    │  Dev Wallet     │
│   Wallet        │◄──►│   (Swap CYG→SOL)│    │                 │
│                 │    └─────────────────┘    │                 │
│ • SOL: 2.99     │                           │ • Reçoit CYG    │
│ • CYG: 50.00    │──────────────────────────►│ • Reçoit SOL    │
└─────────────────┘                           └─────────────────┘
```

### Composants

1. **SolManager.ts** - Monitoring des soldes
2. **simulationManager.ts** - Gestionnaire principal (mode simulation)
3. **jupiterSwap.ts** - Intégration Jupiter (pour Mainnet)
4. **index.ts** - Intégration serveur Octane

## ⚙️ Configuration

### 1. Variables d'environnement

Créer un fichier `.env` dans `packages/server/` :

```env
SECRET_KEY=votre_clé_privée_base58
RPC_URL=https://api.devnet.solana.com
RATE_LIMIT=10
RATE_LIMIT_INTERVAL=60
```

### 2. Token CYG

- **Mint Address**: `2XhF8JfNDapMdH9jb18gAZEeSxbLAo6B2WfLqKcfnHZU`
- **Decimals**: 9
- **Dev Wallet**: `5TGkrhQfuBUTSAtAzjbd2t9dJrZgtYpK8qkXzqWUZktF`

### 3. Installation

```bash
cd packages/server
npm install dotenv bs58
```

## 📜 Scripts disponibles

### 🔍 Monitoring des soldes

```bash
npx ts-node src/SolManager.ts
```

**Fonctionnalité :**
- Affiche les soldes SOL et CYG actuels
- Calcule les excès et besoins
- Analyse la situation financière

**Exemple de sortie :**
```
🚀 SOL Manager started at 2025-07-02T12:55:15.773Z
📍 Fee Payer: 8gby9pCaCRt2hujAvM8aUbnPxjUv5kEPFXZn8Dn8aMMJ
💰 SOL Balance: 2.9903 SOL
🪙 CYG Balance: 50.0000 CYG
✅ SOL balance is sufficient
📤 Excess CYG: 49.5000 CYG could be processed
```

### 🎭 Simulation complète

```bash
npx ts-node src/simulationManager.ts
```

**Fonctionnalité :**
- Teste la logique complète sans exécuter de transactions
- Vérifie la compatibilité Jupiter
- Simule les transfers CYG et SOL
- Fournit un rapport détaillé

### 🔄 Swap Jupiter (Mainnet)

```bash
npx ts-node src/jupiterSwap.ts
```

**Fonctionnalité :**
- Convertit CYG en SOL via Jupiter
- Gestion automatique du slippage
- Optimisation des routes de swap

## 🔄 Fonctionnement

### 1. Cycle de monitoring

```
┌─────────────────┐
│  Check Balances │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐     ┌─────────────────┐
│ SOL < 0.5 ?     │────►│ Need CYG→SOL    │
└─────────┬───────┘     │ Conversion      │
          │             └─────────────────┘
          ▼
┌─────────────────┐     ┌─────────────────┐
│ CYG > 1.0 ?     │────►│ Send Excess     │
└─────────┬───────┘     │ to Dev Wallet   │
          │             └─────────────────┘
          ▼
┌─────────────────┐
│   Wait 30min    │
└─────────────────┘
```

### 2. Stratégie de gestion

#### Seuils de réserve :
- **SOL minimum** : 0.5 SOL (pour les frais de transaction)
- **CYG de réserve** : 0.5 CYG (pour les frais Octane futurs)
- **SOL opérationnel** : 1.5 SOL (garde pour les opérations)

#### Logique de distribution :
1. **Si SOL < 0.5** → Convertir CYG en SOL
2. **Si CYG > 1.0** → Envoyer l'excès aux devs
3. **Si SOL > 1.5** → Distribuer le profit SOL aux devs

### 3. Fallback strategy

```
┌─────────────────┐
│ Test Jupiter    │
│ Support for CYG │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐     ┌─────────────────┐
│ Supported?      │ NO  │ Direct Transfer │
│                 │────►│ CYG to Dev      │
└─────────┬───────┘     └─────────────────┘
          │ YES
          ▼
┌─────────────────┐
│ Jupiter Swap    │
│ CYG → SOL       │
└─────────────────┘
```

## 🔗 Intégration serveur

### Dans `packages/server/src/index.ts` :

```typescript
import { checkBalances } from './SolManager';
import { HybridCYGManager } from './simulationManager';

// Au démarrage du serveur
if (process.env.NODE_ENV === 'production') {
    const manager = new HybridCYGManager();
    
    // Vérification immédiate au démarrage
    manager.manageFunds()
        .then(() => console.log('✅ Initial fund management completed'))
        .catch(console.error);
    
    // Monitoring périodique (toutes les 30 minutes)
    setInterval(() => {
        manager.manageFunds().catch(console.error);
    }, 30 * 60 * 1000);
    
    // Monitoring léger des soldes (toutes les 10 minutes)
    setInterval(() => {
        checkBalances().catch(console.error);
    }, 10 * 60 * 1000);
}
```

## 🎭 Mode simulation

Le système fonctionne par défaut en **mode simulation** pour éviter les transactions accidentelles.

### Caractéristiques :
- ✅ Lit les vrais soldes blockchain
- ✅ Teste la vraie API Jupiter
- ✅ Calcule les vrais montants
- ❌ N'exécute aucune transaction
- 📊 Log tout ce qui se passerait

### Exemple de logs simulation :
```
🎭 Hybrid CYG Manager (SIMULATION MODE)...
📊 Excess CYG to process: 49.5000 CYG
❌ Jupiter does not support CYG token on Devnet
📤 [SIMULATION] Would transfer 49.5000 CYG to dev wallet...
💸 [SIMULATION] Would send 1.4903 SOL profit to dev wallet
✅ [SIMULATION] Transfer would be successful: SIMULATION_f7i88n
```

## 🚀 Déploiement production

### 1. Activation du mode réel

Pour passer en mode production, modifier dans `simulationManager.ts` :

```typescript
// Remplacer les fonctions de simulation par :
async transferCYGToDev(amount: number): Promise<string | null> {
    // Décommenter le vrai code de transaction
    // Supprimer les console.log [SIMULATION]
}

async distributeProfits(): Promise<void> {
    // Décommenter le vrai code de transaction  
    // Supprimer les console.log [SIMULATION]
}
```

### 2. Configuration Mainnet

```env
RPC_URL=https://api.mainnet-beta.solana.com
# Ou utiliser un RPC premium comme QuickNode, Helius, etc.
```

### 3. Tests progressifs

1. **Tester avec de petits montants** (0.01 CYG)
2. **Vérifier les logs** et transactions
3. **Augmenter progressivement** les seuils
4. **Monitorer les performances**

## 🐛 Troubleshooting

### Erreurs communes

#### `SECRET_KEY environment variable is required`
```bash
# Vérifier que .env existe et contient SECRET_KEY
ls -la .env
grep SECRET_KEY .env
```

#### `Jupiter API error: 400 Bad Request`
- Normal sur Devnet (CYG pas supporté)
- Utiliser le mode simulation ou passer sur Mainnet

#### `Module not found` errors
```bash
# Installer les dépendances manquantes
npm install dotenv bs58 @solana/web3.js @solana/spl-token
```

#### `Cannot find exported member`
- Vérifier les versions de `@solana/spl-token`
- Utiliser les imports compatibles avec votre version

### Monitoring

#### Vérifier les soldes manuellement :
```bash
# SOL balance
solana balance 8gby9pCaCRt2hujAvM8aUbnPxjUv5kEPFXZn8Dn8aMMJ --url devnet

# CYG balance  
spl-token balance 2XhF8JfNDapMdH9jb18gAZEeSxbLAo6B2WfLqKcfnHZU --owner 8gby9pCaCRt2hujAvM8aUbnPxjUv5kEPFXZn8Dn8aMMJ --url devnet
```

#### Logs de transaction :
- **Devnet** : https://solscan.io/?cluster=devnet
- **Mainnet** : https://solscan.io/

### Performance

#### Optimisations recommandées :
- **RPC premium** pour Mainnet (QuickNode, Helius)
- **Monitoring d'alertes** (Discord webhook, email)
- **Backup de clés** et procédures de récupération
- **Tests réguliers** du système

## 📊 Métriques de succès

- ✅ **Uptime** : >99% de disponibilité du monitoring
- ✅ **Réactivité** : SOL reconstitué en <1h si besoin
- ✅ **Profits** : Distribution automatique quotidienne
- ✅ **Réserves** : Jamais en dessous des seuils critiques

## 🔒 Sécurité

### Bonnes pratiques :
- 🔐 Clés privées dans `.env` (pas dans le code)
- 🛡️ Seuils de sécurité pour éviter la sur-distribution
- 📊 Logs détaillés pour audit
- ⚠️ Mode simulation par défaut
- 🔄 Tests réguliers sur Devnet

---

## 🎯 Résumé

Ce système automatise complètement la gestion des revenus Octane :
- **Maintient** la liquidité SOL nécessaire
- **Optimise** les conversions CYG→SOL  
- **Distribue** les profits automatiquement
- **Protège** contre les erreurs par la simulation
- **Scale** avec le volume de transactions Octane

**Prêt pour la production** avec activation simple du mode réel ! 🚀