// pages/api/transfer.ts - Avec vérification SOL intégrée
import { sendAndConfirmRawTransaction, Transaction } from '@solana/web3.js';
import type { NextApiRequest, NextApiResponse } from 'next';
import base58 from 'bs58';
import { signWithTokenFee, core } from '@solana/octane-core';
import {
    cache,
    connection,
    ENV_SECRET_KEYPAIR,
    cors,
    rateLimit,
} from '../../src';
import { fundManagerService } from '../../src/fundManager';
import config from '../../../../config.json';

export default async function (request: NextApiRequest, response: NextApiResponse) {
    await cors(request, response);
    await rateLimit(request, response);

    // 🔍 VÉRIFICATION CRITIQUE SOL avant transaction
    try {
        console.log('🔍 Checking SOL balance before processing transaction...');
        const solCheck = await fundManagerService.checkCriticalSOL();
        
        if (!solCheck.shouldProceed) {
            console.log('🚨 Transaction blocked due to critical SOL shortage');
            response.status(503).send({ 
                status: 'error', 
                message: solCheck.message || 'Service temporarily unavailable due to insufficient SOL'
            });
            return;
        }
        
        if (solCheck.message) {
            console.log('⚠️ SOL warning:', solCheck.message);
        }
        
    } catch (checkError) {
        console.error('❌ SOL check failed, proceeding with transaction:', checkError);
        // Continuer même si le check échoue pour ne pas bloquer le service
    }

    // Deserialize a base58 wire-encoded transaction from the request
    const serialized = request.body?.transaction;
    if (typeof serialized !== 'string') {
        response.status(400).send({ status: 'error', message: 'request should contain transaction' });
        return;
    }

    let transaction: Transaction;
    try {
        transaction = Transaction.from(base58.decode(serialized));
    } catch (e) {
        response.status(400).send({ status: 'error', message: "can't decode transaction" });
        return;
    }

    try {
        const { signature } = await signWithTokenFee(
            connection,
            transaction,
            ENV_SECRET_KEYPAIR,
            config.maxSignatures,
            config.lamportsPerSignature,
            config.endpoints.transfer.tokens.map((token) => core.TokenFee.fromSerializable(token)),
            cache
        );

        // PRODUCTION: Toujours envoyer la transaction sur la blockchain
        transaction.addSignature(
            ENV_SECRET_KEYPAIR.publicKey,
            Buffer.from(base58.decode(signature))
        );

        console.log('🚀 Envoi transaction sur blockchain...', signature);

        await sendAndConfirmRawTransaction(
            connection,
            transaction.serialize(),
            {commitment: 'confirmed'}
        );

        console.log('✅ Transaction confirmée:', signature);

        // Respond with the confirmed transaction signature
        response.status(200).send({ status: 'ok', signature });
        
    } catch (error) {
        console.error('❌ Erreur dans transfer:', error);
        let message = '';
        if (error instanceof Error) {
            message = error.message;
        }
        response.status(400).send({ status: 'error', message });
    }
}