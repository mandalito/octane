import {
  Connection,
  Transaction,
  TransactionSignature,
  Keypair
} from '@solana/web3.js';
import base58 from 'bs58';

// Check that a transaction is basically valid, sign it, and serialize it, verifying the signatures
// This function doesn't check if payer fee was transferred (instead, use validateTransfer) or
// instruction signatures do not include fee payer as a writable account (instead, use validateInstructions).
export async function validateTransaction(
  connection: Connection,
  transaction: Transaction,
  feePayer: Keypair,
  maxSignatures: number,
  lamportsPerSignature: number
): Promise<{ signature: TransactionSignature; rawTransaction: Buffer }> {
  // Check the fee payer and blockhash for basic validity
  if (!transaction.feePayer?.equals(feePayer.publicKey)) throw new Error('invalid fee payer');
  if (!transaction.recentBlockhash) throw new Error('missing recent blockhash');

  // Step 1: Check blockhash freshness from Octane's RPC
  const { blockhash: latestBlockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  const currentBlockHeight = await connection.getBlockHeight();

  if (transaction.recentBlockhash !== latestBlockhash || currentBlockHeight > lastValidBlockHeight) {
    throw new Error('blockhash not found or expired');
  }

  // Step 2: Estimate fee from Octane's RPC
  const message = transaction.compileMessage();
  const feeInfo = await connection.getFeeForMessage(message);

  if (!feeInfo || feeInfo.value === null) throw new Error('Unable to get fee info from RPC');

  // Recreate feeCalculator-like object to keep original logic
  const feeCalculator = {
    value: {
      lamportsPerSignature: Math.ceil(feeInfo.value / Math.max(transaction.signatures.length, 1))
    }
  };

  if (feeCalculator.value.lamportsPerSignature > lamportsPerSignature) {
    throw new Error('fee too high');
  }

  // Step 3: Signature validation
  if (!transaction.signatures.length) throw new Error('no signatures');
  if (transaction.signatures.length > maxSignatures) throw new Error('too many signatures');

  const [primary, ...secondary] = transaction.signatures;
  if (!primary.publicKey.equals(feePayer.publicKey)) throw new Error('invalid fee payer pubkey');
  if (primary.signature) throw new Error('invalid fee payer signature');

  for (const signature of secondary) {
    if (!signature.publicKey) throw new Error('missing public key');
    if (!signature.signature) throw new Error('missing signature');
  }

  // Step 4: Add the fee payer signature
  transaction.partialSign(feePayer);

  // Step 5: Serialize and return
  const rawTransaction = transaction.serialize();
  return {
    signature: base58.encode(transaction.signature!),
    rawTransaction
  };
}
