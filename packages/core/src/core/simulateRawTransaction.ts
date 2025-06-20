import {
  Connection,
  PublicKey,
  SimulatedTransactionResponse,
  Transaction,
  VersionedTransaction
} from '@solana/web3.js';

// Simulate a signed, serialized transaction before broadcasting
export async function simulateRawTransaction(
  connection: Connection,
  rawTransaction: Buffer,
  includeAccounts?: boolean | Array<PublicKey>
): Promise<SimulatedTransactionResponse> {
  // Decode raw transaction
  const legacyTx = Transaction.from(rawTransaction);
  const message = legacyTx.compileMessage();
  const versionedTx = new VersionedTransaction(message);

  // Copy over signatures from the legacy transaction
  versionedTx.signatures = legacyTx.signatures.map(sig => sig.signature ?? Buffer.alloc(64));

  // Simulate
  const simulated = await Connection.prototype.simulateTransaction.call(
    connection,
    versionedTx,
    {
      sigVerify: true,
      replaceRecentBlockhash: true,
      ...(includeAccounts
        ? {
            accounts: Array.isArray(includeAccounts)
              ? {
                  encoding: 'base64',
                  addresses: includeAccounts.map((p) => p.toBase58())
                }
              : {
                  encoding: 'base64',
                  addresses: []
                }
          }
        : {})
    }
  );

  if (simulated.value.err) throw new Error('Simulation error');
  return simulated.value;
}
