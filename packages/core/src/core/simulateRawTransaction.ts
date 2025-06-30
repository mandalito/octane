import {
    Connection,
    PublicKey,
    SimulatedTransactionResponse,
    VersionedTransaction,
    SimulateTransactionConfig
} from '@solana/web3.js'

/**
 * Simule une transaction signée et sérialisée avant envoi.
 */
export async function simulateRawTransaction(
    connection: Connection,
    rawTransaction: Buffer,
    includeAccounts?: boolean | PublicKey[]
): Promise<SimulatedTransactionResponse> {
    const transaction = VersionedTransaction.deserialize(rawTransaction);

    const config: SimulateTransactionConfig = {
        sigVerify: false,
        replaceRecentBlockhash: false,
        accounts: Array.isArray(includeAccounts)
            ? {
                  encoding: 'base64' as const, // <- 💥 Fix ici
                  addresses: includeAccounts.map((pk) => pk.toBase58())
              }
            : undefined
    };

    const simulated = await connection.simulateTransaction(transaction, config);
    console.log(JSON.stringify(simulated.value, null, 2));
    if (simulated.value.err) throw new Error('Simulation error');

    return simulated.value;
}
