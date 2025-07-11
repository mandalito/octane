import type { NextApiRequest, NextApiResponse } from 'next';
import base58 from 'bs58';
import BN from 'bn.js';
import Decimal from 'decimal.js';

import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { Percentage } from '@orca-so/common-sdk';

import { buildWhirlpoolsSwapToSOL, core } from '@solana/octane-core';
import {
    cache,
    connection,
    ENV_SECRET_KEYPAIR,
    cors,
    rateLimit,
} from '../../src';
import config from '../../../../config.json';

// Endpoint to build whirlpools swap transaction
export default async function (request: NextApiRequest, response: NextApiResponse) {
    await cors(request, response);
    await rateLimit(request, response);

    let user: PublicKey;
    try {
        user = new PublicKey(request.body?.user);
    } catch {
        response.status(400).send({ status: 'error', message: 'missing or invalid "user" parameter' });
        return;
    }
    let sourceMint: PublicKey;
    try {
        sourceMint = new PublicKey(request.body?.sourceMint);
    } catch {
        response.status(400).send({ status: 'error', message: 'missing or invalid "sourceMint" parameter' });
        return;
    }
    let amount: BN;
    try {
        amount = new BN(parseInt(request.body?.amount));
    } catch {
        response.status(400).send({ status: 'error', message: 'missing or invalid "amount" parameter' });
        return;
    }

    let slippingTolerance: Percentage;
    try {
        slippingTolerance = Percentage.fromDecimal(
            new Decimal(request.body?.slippingTolerance)
        );
    } catch {
        response.status(400).send({ status: 'error', message: 'missing or invalid "slippingTolerance" parameter' });
        return;
    }

    const tokenFees = (
        config.endpoints.whirlpoolsSwap.tokens.map((token) => core.TokenFee.fromSerializable(token))
        .filter((tokenFee) => tokenFee.mint.equals(sourceMint))
    );
    if (tokenFees.length === 0) {
        response.status(400).send({ status: 'error', message: 'this source mint isn\'t supported'});
        return;
    }
    const tokenFee = tokenFees[0];

    try {
        const { transaction, quote, messageToken } = await buildWhirlpoolsSwapToSOL(
            connection,
            ENV_SECRET_KEYPAIR,
            user,
            sourceMint,
            amount,
            slippingTolerance,
            cache,
            3000,
            {
                amount: Number(tokenFee.fee),
                sourceAccount: await getAssociatedTokenAddress(sourceMint, user),
                destinationAccount: tokenFee.account
            }
        );

        // PRODUCTION: Toujours signer et retourner la transaction
        transaction.sign(ENV_SECRET_KEYPAIR);
        
        console.log('✅ Transaction Whirlpools construite et signée');

        // Respond with the signed transaction, quote and messageToken
        response.status(200).send({
            status: 'ok',
            transaction: base58.encode(new Uint8Array(transaction.serialize({verifySignatures: false}))),
            quote,
            messageToken
        });
    } catch (error) {
        console.error('❌ Erreur dans buildWhirlpoolsSwap:', error);
        let message = '';
        if (error instanceof Error) {
            message = error.message;
        }
        response.status(400).send({ status: 'error', message });
    }
}