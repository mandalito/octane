import { TransactionInstruction } from '@solana/web3.js';

export function areInstructionsEqual(instruction1: TransactionInstruction, instruction2: TransactionInstruction) {
    return (
        new Uint8Array(instruction1.data).every((val, i) => val === new Uint8Array(instruction2.data)[i]) &&
        instruction1.programId.equals(instruction2.programId) &&
        instruction1.keys.every(
            (key1, i) =>
                key1.pubkey.equals(instruction2.keys[i].pubkey) &&
                key1.isWritable === instruction2.keys[i].isWritable &&
                key1.isSigner === instruction2.keys[i].isSigner
        )
    );
}
