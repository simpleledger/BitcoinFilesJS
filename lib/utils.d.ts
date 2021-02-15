/// <reference types="node" />
export declare class Utils {
    static Sha256(message: Buffer): Buffer;
    static Hash256(message: Buffer): Buffer;
    static HashTxid(txnBuf: Buffer): Buffer;
    static getPushDataOpcode(data: Buffer | number[]): number | number[];
    static int2FixedBuffer(amount: number, size: number): Buffer;
    static encodeScript(script: number[]): Buffer;
}
