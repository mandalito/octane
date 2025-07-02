import base58 from 'bs58';
import nacl from 'tweetnacl';
import { Keypair, Message, PublicKey } from '@solana/web3.js';

function bufferToSign(key: string, serializedMessage: Buffer): Uint8Array {
    const parts = [
        Buffer.from('octane-message-token', 'utf-8'),
        Buffer.from(key),
        serializedMessage
    ];
    const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const part of parts) {
        result.set(part, offset);
        offset += part.length;
    }
    return result;
}

export class MessageToken {
    key: string;
    message: Message;
    keypair: Keypair;

    constructor(key: string, message: Message, keypair: Keypair) {
        this.key = key;
        this.message = message;
        this.keypair = keypair;
    }

    compile(): string {
        const buffer = bufferToSign(this.key, this.message.serialize());
        const signature = nacl.sign.detached(buffer, this.keypair.secretKey);
        return base58.encode(signature);
    }

    static isValid(key: string, message: Message, token: string, publicKey: PublicKey): boolean {
        if (!token) {
            return false;
        }
        const buffer = bufferToSign(key, message.serialize());
        const signature = base58.decode(token);
        return nacl.sign.detached.verify(buffer, new Uint8Array(signature), new Uint8Array(publicKey.toBuffer()));
    }
}