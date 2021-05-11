
// Disable version guard
// @ts-ignore
global._bitcoreCash = global._bitcore = undefined

// @ts-ignore
import { deps, Script, Transaction, Signature, util, Opcode, crypto } from "bitcore-lib-cash";

// @ts-ignore
global._bitcoreCash = global._bitcore = undefined

var inherits = require("inherits");

// Based on code for MultisigScriptHash

/**
 * @constructor
 */
// TODO BitcoinFiles
// pubkeys = [pubkey]
// threshold = 1
// opts = [push up to 1013, push up to 484]
function PushScriptHashInput(input: any, pubkeys: any, threshold: any, signatures: any, opts: any) {
    /* jshint maxstatements:20 */
    opts = opts || {};
    // @ts-ignore
    Transaction.Input.apply(this, arguments);
    // @ts-ignore
    var self = this;
    pubkeys = pubkeys || input.publicKeys;
    threshold = threshold || input.threshold;
    signatures = signatures || input.signatures;
    // TODO BitcoinFiles
    // @ts-ignore
    this.publicKeys = pubkeys
    // @ts-ignore
    this.opts = opts
    // @ts-ignore
    this.redeemScript = buildPushOut(this.publicKeys, opts);
    // @ts-ignore
    if (!Script.buildScriptHashOut(this.redeemScript).equals(this.output.script)) {
        if (console) console.error("Output does not hash correctly");
        return;
    }
    // @ts-ignore
    this.publicKeyIndex = {};
    // @ts-ignore
    deps._.each(this.publicKeys, function(publicKey: any, index: any) {
        self.publicKeyIndex[publicKey.toString()] = index;
    });
    // @ts-ignore
    this.threshold = threshold;
    // Empty array of signatures
    // @ts-ignore
    this.signatures = signatures ? this._deserializeSignatures(signatures) : new Array(this.publicKeys.length);
    // @ts-ignore
    this.checkBitsField = new Uint8Array(this.publicKeys.length);
}
inherits(PushScriptHashInput, Transaction.Input);

PushScriptHashInput.prototype.toObject = function() {
    // TODO BitcoinFiles
    if (console) console.log("toObject unimplemented for P2SH data push inputs!");
    var obj: any = Transaction.Input.prototype.toObject.apply(this, arguments as any);
    obj.threshold = this.threshold;
    obj.publicKeys = deps._.map(this.publicKeys, function(publicKey: any) { return publicKey.toString(); });
    obj.signatures = this._serializeSignatures();
    return obj;
};

PushScriptHashInput.prototype._deserializeSignatures = function(signatures: any) {
    return deps._.map(signatures, function(signature: any) {
        if (!signature) {
            return undefined;
        }
        return new (Transaction as any).Signature(signature);
    });
};

PushScriptHashInput.prototype._serializeSignatures = function() {
    return deps._.map(this.signatures, function(signature: any) {
        if (!signature) {
            return undefined;
        }
        return signature.toObject();
    });
};

PushScriptHashInput.prototype.getSignatures = function(transaction: any, privateKey: any, index: any, sigtype: any, hashData: any, signingMethod: any) {
    hashData as any;
    if (!(this.output instanceof Transaction.Output)) {
        console.error("this.output instanceof Output false");
    }
    sigtype = sigtype || (Signature.SIGHASH_ALL | Signature.SIGHASH_FORKID);

    var self = this;
    var results: any = [];
    deps._.each(this.publicKeys, function(publicKey: any) {
        if (publicKey.toString() === privateKey.publicKey.toString()) {
            results.push(new (Transaction as any).Signature({
                publicKey: privateKey.publicKey,
                prevTxId: self.prevTxId,
                outputIndex: self.outputIndex,
                inputIndex: index,
                signature: (Transaction as any).Sighash.sign(transaction, privateKey, sigtype, index, self.redeemScript, self.output.satoshisBN, undefined, signingMethod),
                sigtype: sigtype
            }));
        }
    });
    return results;
};

PushScriptHashInput.prototype.addSignature = function(transaction: any, signature: any, signingMethod: any) {
    if (this.isFullySigned()) {
        console.error("All needed signatures have already been added");
    }
    if (deps._.isUndefined(this.publicKeyIndex[signature.publicKey.toString()])) {
        console.error("Signature has no matching public key");
    }
    if (!this.isValidSignature(transaction, signature, signingMethod)) {
        console.error("Invalid signature");
    }
    this.signatures[this.publicKeyIndex[signature.publicKey.toString()]] = signature;
    this.checkBitsField[this.publicKeyIndex[signature.publicKey.toString()]] = (signature !== undefined) ? 1 : 0;
    this._updateScript(signingMethod, this.checkBitsField);
    return this;
};

PushScriptHashInput.prototype._updateScript = function(signingMethod: any, checkBitsField: any) {
    this.setScript(buildP2SHPushIn(
        this.publicKeys,
        this.opts,
        this._createSignatures(signingMethod)
    ));
    checkBitsField as any;
    return this;
};

PushScriptHashInput.prototype._createSignatures = function(signingMethod: any) {
    return deps._.map(
        deps._.filter(this.signatures, function(signature: any) { return !deps._.isUndefined(signature); }),
        function(signature: any) {
            return util.buffer.concat([
                signature.signature.toDER(signingMethod),
                util.buffer.integerAsSingleByteBuffer(signature.sigtype)
            ]);
        }
    );
};

PushScriptHashInput.prototype.clearSignatures = function() {
    this.signatures = new Array(this.publicKeys.length);
    this._updateScript();
};

PushScriptHashInput.prototype.isFullySigned = function() {
    return this.countSignatures() === this.threshold;
};

PushScriptHashInput.prototype.countMissingSignatures = function() {
    return this.threshold - this.countSignatures();
};

PushScriptHashInput.prototype.countSignatures = function() {
    return deps._.reduce(this.signatures, function(sum: any, signature: any) {
        return sum + (!!signature);
    }, 0);
};

PushScriptHashInput.prototype.publicKeysWithoutSignature = function() {
    var self = this;
    return deps._.filter(this.publicKeys, function(publicKey: any) {
        return !(self.signatures[self.publicKeyIndex[publicKey.toString()]]);
    });
};

PushScriptHashInput.prototype.isValidSignature = function(transaction: any, signature: any, signingMethod: any) {
    // FIXME: Refactor signature so this is not necessary
    signingMethod = signingMethod || "ecdsa";
    signature.signature.nhashtype = signature.sigtype;
    return (Transaction as any).Sighash.verify(
        transaction,
        signature.signature,
        signature.publicKey,
        signature.inputIndex,
        this.redeemScript,
        this.output.satoshisBN,
        undefined,
        signingMethod
    );
};

// TODO BitcoinFiles
PushScriptHashInput.prototype._estimateSize = function() {
    return 149 + this.opts[0].length +
        this.opts[1].length;
};

function buildP2SHPushIn(pubkeys: any, opts: any, signatures: any) {
    if (!deps._.isArray(pubkeys) || !deps._.isArray(opts) || !deps._.isArray(signatures)) {
        console.error("Bad buildP2SHPushIn args", pubkeys, opts, signatures);
    }
    var s = Script.empty();
    deps._.each(signatures, function(signature: any) {
        if (!util.buffer.isBuffer(signature)) {
            console.error("Signatures must be an array of Buffers");
        }
        // TODO: allow signatures to be an array of Signature objects
        s.add(signature);
    });
    s.add(pubkeys[0]);
    s.add(Buffer.from(opts[0].slice(0, 520)));
    s.add(Buffer.from(opts[0].slice(520)));
    s.add(
        buildPushOut(pubkeys, opts).toBuffer()
    );
    return s;
};

function buildPushOut(publicKeys: any, opts: any) {
    opts = opts || {};
    var script = Script.empty();
    script.add(Opcode.OP_HASH160)
        .add(Opcode.OP_SWAP)
        .add(Opcode.OP_HASH160)
        .add(Opcode.OP_CAT)
        .add(Opcode.OP_2DUP)
        .add(Opcode.OP_CAT)
        .add(Opcode.OP_HASH160);
    script.add(crypto.Hash.sha256ripemd160(Buffer.from(
        Buffer.concat([publicKeys[0],
        crypto.Hash.sha256ripemd160(
            Buffer.from(opts[0].slice(520))
        ),
        crypto.Hash.sha256ripemd160(
            Buffer.from(opts[0].slice(0, 520))
        )
        ])
    )));
    script.add(Opcode.OP_EQUALVERIFY)
        .add(Buffer.from(opts[1]))
        .add(Opcode.OP_2DROP)
        .add(Opcode.OP_CHECKSIGVERIFY)
        .add(Opcode.OP_DEPTH)
        .add(Opcode.OP_NOT);
    return script;
};

export { PushScriptHashInput, buildPushOut };
