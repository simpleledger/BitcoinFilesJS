import * as crypto from "crypto";

export class Utils {

    public static Sha256(message: Buffer): Buffer {
        const hash1 = crypto.createHash("sha256");
        hash1.update(message);
        return Buffer.from(hash1.digest().toJSON().data);
    }

    public static Hash256(message: Buffer): Buffer {
        const hash1 = crypto.createHash("sha256");
        const hash2 = crypto.createHash("sha256");
        hash1.update(message);
        hash2.update(hash1.digest());
        return Buffer.from(hash2.digest().toJSON().data);
    }

    public static HashTxid(txnBuf: Buffer): Buffer {
        return Buffer.from(Utils.Hash256(txnBuf).reverse());
    }

    static getPushDataOpcode(data: Buffer | number[]) {
        let length = data.length

        if (length === 0)
            return [0x4c, 0x00]
        else if (length < 76)
            return length
        else if (length < 256)
            return [0x4c, length]
        else
            throw Error("Pushdata too large")
    }

    static int2FixedBuffer(amount: number, size: number) {
        let hex = amount.toString(16);
        // pad the beginning with '0' to length size * 2
        hex = '0'.repeat(size * 2 - hex.length) + hex;
        if (hex.length % 2) hex = '0' + hex;
        return Buffer.from(hex, 'hex');
    }

    static encodeScript(script: number[]) {
        const bufferSize = script.reduce((acc, cur) => {
            if (Array.isArray(cur)) return acc + cur.length
            else return acc + 1
        }, 0)

        const buffer = Buffer.allocUnsafe(bufferSize)
        let offset = 0
        script.forEach((scriptItem) => {
            if (Array.isArray(scriptItem)) {
                scriptItem.forEach((item) => {
                    buffer.writeUInt8(item, offset)
                    offset += 1
                })
            } else {
                buffer.writeUInt8(scriptItem, offset)
                offset += 1
            }
        })

        return buffer
    }
}
