
// Disable version guard
// @ts-ignore
global._bitcoreCash = global._bitcore = undefined

import { Address, Script, Transaction, PrivateKey } from "bitcore-lib-cash";

// @ts-ignore
global._bitcoreCash = global._bitcore = undefined

import { Utils } from './utils';
import { PushScriptHashInput, buildPushOut } from './pushoutput';
import { IGrpcClient } from 'grpc-bchrpc';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export interface utxo {
    txid: string;
    vout: number;
    amount?: number;
    satoshis: number;
    height?: number;
    confirmations?: number;
    wif?: string;
    address?: string;
}

export interface FileMetadata {
    msgType: number;
    chunkCount: number;
    fileName?: string;
    fileExt?: string;
    fileSize: number;
    fileSha256Hex?: string;
    prevFileSha256Hex?: string;
    fileUri?: string;
    chunkData?: Buffer;
}

export interface FundingTxnConfig {
    outputAddress: string;
    fundingAmountSatoshis: number;
    input_utxos: utxo[];
}

export interface MetadataTxnConfig {
    bfpMetadataOpReturn: Buffer;
    input_utxo: utxo
    fileReceiverAddress: string;
}

export interface DataChunkTxnConfig {
    bfpChunkOpReturn: Buffer;
    input_utxo: utxo
}

const p2shPushLength = 1505;
const p2shScriptPubKeySeparator = 1021;

export class Bfp {
    client: IGrpcClient;

    FEE_RATE = 1;

    constructor(client: IGrpcClient) {
        this.client = client;
    }

    static get bfpMagicHex() { return "42465000" }

    async uploadHashOnlyObject(
        type: number,
        fundingUtxo: utxo,
        fundingAddress: string,
        fundingWif: string,
        objectDataArrayBuffer: Buffer,
        objectName?: string,
        objectExt?: string,
        prevObjectSha256Hex?: string,
        objectExternalUri?: string,
        objectReceiverAddress?: string,
        signProgressCallback?: Function,
        signFinishedCallback?: Function,
        uploadProgressCallback?: Function,
        uploadFinishedCallback?: Function): Promise<string> {
        let fileSize = objectDataArrayBuffer.byteLength;
        let hash = Utils.Hash256(objectDataArrayBuffer).toString('hex');

        // chunks
        let chunkCount = 0; //Math.floor(fileSize / 220);

        // estimate cost
        // build empty meta data OpReturn
        let configEmptyMetaOpReturn = {
            msgType: type,
            chunkCount: chunkCount,
            fileName: objectName,
            fileExt: objectExt,
            fileSize: fileSize,
            fileSha256Hex: hash,
            prevFileSha256Hex: prevObjectSha256Hex,
            fileUri: objectExternalUri
        };

        //* ** building transaction
        let transactions: Transaction[] = [];
        let txid = fundingUtxo.txid;
        let satoshis = fundingUtxo.satoshis;
        let vout = fundingUtxo.vout;

        let metaOpReturn = Bfp.buildMetadataOpReturn(configEmptyMetaOpReturn);

        // build meta data transaction
        let configMetaTx = {
            bfpMetadataOpReturn: metaOpReturn,
            input_utxo: {
                txid: txid,//chunksTx.getId(),
                vout: vout,
                satoshis: satoshis,//chunksTx.outs[1].value,
                wif: fundingWif,
                address: fundingAddress
            },
            fileReceiverAddress: objectReceiverAddress != null ? objectReceiverAddress : fundingAddress
        };
        let metaTx = this.buildMetadataTx(configMetaTx);
        transactions.push(metaTx);

        // sign progress
        if (signProgressCallback != null) {
            signProgressCallback(100);
        }

        // progress : signing finished
        if (signFinishedCallback != null) {
            signFinishedCallback();
        }

        //* ** sending transaction
        if (uploadProgressCallback != null) {
            uploadProgressCallback(0);
        }
        console.log('transaction: ', transactions[0].serialize());
        let bfTxId: string;
        while (true) {
            console.log(`sending metadata txn`);
            try {
                const res = await this.client.submitTransaction({ txnHex: transactions[0].serialize() });
                bfTxId = Buffer.from(res.getHash_asU8().reverse()).toString("hex");
                break;
            } catch (err) {
                console.log(`waiting 60 sec to try again: ${err}`);
                await sleep(60000);
            }
        }

        // progress
        if (uploadProgressCallback != null) {
            uploadProgressCallback(100);
        }

        bfTxId = 'bitcoinfile:' + bfTxId;
        if (uploadFinishedCallback != null) {
            uploadFinishedCallback(bfTxId);
        }

        return bfTxId;
    }

    async uploadFolderHashOnly(
        fundingUtxo: utxo,
        fundingAddress: string,
        fundingWif: string,
        folderDataArrayBuffer: Buffer,
        folderName?: string,
        folderExt?: string,
        prevFolderSha256Hex?: string,
        folderExternalUri?: string,
        folderReceiverAddress?: string,
        signProgressCallback?: Function,
        signFinishedCallback?: Function,
        uploadProgressCallback?: Function,
        uploadFinishedCallback?: Function): Promise<string> {
        return await this.uploadHashOnlyObject(3,
            fundingUtxo,
            fundingAddress,
            fundingWif,
            folderDataArrayBuffer,
            folderName,
            folderExt,
            prevFolderSha256Hex,
            folderExternalUri,
            folderReceiverAddress,
            signProgressCallback,
            signFinishedCallback,
            uploadProgressCallback,
            uploadFinishedCallback
        )
    }

    async uploadFileHashOnly(
        fundingUtxo: utxo,
        fundingAddress: string,
        fundingWif: string,
        fileDataArrayBuffer: Buffer,
        fileName?: string,
        fileExt?: string,
        prevFileSha256Hex?: string,
        fileExternalUri?: string,
        fileReceiverAddress?: string,
        signProgressCallback?: Function,
        signFinishedCallback?: Function,
        uploadProgressCallback?: Function,
        uploadFinishedCallback?: Function): Promise<string> {
        return await this.uploadHashOnlyObject(1,
            fundingUtxo,
            fundingAddress,
            fundingWif,
            fileDataArrayBuffer,
            fileName,
            fileExt,
            prevFileSha256Hex,
            fileExternalUri,
            fileReceiverAddress,
            signProgressCallback,
            signFinishedCallback,
            uploadProgressCallback,
            uploadFinishedCallback
        )
    }

    async uploadFile(
        fundingUtxo: utxo,
        fundingAddress: string,
        fundingWif: string,
        fileDataArrayBuffer: Buffer,
        fileName?: string,
        fileExt?: string,
        prevFileSha256Hex?: string,
        fileExternalUri?: string,
        fileReceiverAddress?: string,
        signProgressCallback?: Function,
        signFinishedCallback?: Function,
        uploadProgressCallback?: Function,
        uploadFinishedCallback?: Function,
        delay_ms = 500,
        uploadMethod = 1): Promise<string> {

        let fileSize = fileDataArrayBuffer.byteLength;
        let hash = Utils.Sha256(fileDataArrayBuffer).toString('hex');

        // P2SH outputs per transaction
        let msgType = uploadMethod;
        let perTransactionCapacity = 0;
        if (uploadMethod == 2) {
            perTransactionCapacity = 50;
        }

        let arrangement = Bfp.arrangeOutputs(fileSize, perTransactionCapacity);
        let conservativeFileSize = arrangement.conservativeFileSize;
        let numberOfOuts = arrangement.numberOfOuts;
        let transactionCount = numberOfOuts.length;

        // Build the last OP_RETURN push first
        let configEmptyMetaOpReturn: FileMetadata = {
            msgType: msgType,
            chunkCount: transactionCount,
            fileName: fileName,
            fileExt: fileExt,
            fileSize: fileSize,
            fileSha256Hex: hash,
            prevFileSha256Hex: prevFileSha256Hex,
            fileUri: fileExternalUri
        };
        let finalOpReturn = Bfp.buildMetadataOpReturn(configEmptyMetaOpReturn);

        const padDifference = conservativeFileSize - fileSize;
        let buf = fileDataArrayBuffer;
        if (padDifference != 0) {
            if (padDifference < 0) {
                console.log("Negative padding!")
            }

            // Handle the case that padding is not needed and last bytes fit into metadata push
            let capacity = 223 - finalOpReturn.length;
            let pushSize = 220;
            if (uploadMethod == 2) {
                pushSize = p2shPushLength;
            }

            let lastPushSize = pushSize - padDifference;
            // We forced at least 2 P2SH outputs of the last transaction already
            // unless the file was too small (the second condition)
            if ((capacity >= lastPushSize) && !(padDifference > pushSize)) {
                if (uploadMethod == 2) {
                    // So a padded P2SH push is not needed
                    numberOfOuts[transactionCount - 1]--;
                } else {
                    // One padded OP_RETURN push is not needed
                    transactionCount--;
                }

                // add data to metadata push
                let configMetaOpReturn: FileMetadata = {
                    msgType: 2,
                    // Now, the last tx has a data-containing OP_RETURN too
                    chunkCount: transactionCount + 1,
                    fileName: fileName,
                    fileExt: fileExt,
                    fileSize: fileSize,
                    fileSha256Hex: hash,
                    prevFileSha256Hex: prevFileSha256Hex,
                    fileUri: fileExternalUri,
                    chunkData: buf.slice(-lastPushSize)
                };
                finalOpReturn = Bfp.buildMetadataOpReturn(configMetaOpReturn);
                // We already handled the last padDifference
                buf = buf.slice(0, -lastPushSize);
                conservativeFileSize -= lastPushSize;
            } else {
                buf = Buffer.alloc(conservativeFileSize);
                buf.set(fileDataArrayBuffer);
            }
        }

        const privateKey = PrivateKey.fromWIF(fundingWif);
        const publicKey = privateKey.toPublicKey();
        let publicKeyAsBuffer = publicKey.toBuffer();
        let bufferHex = publicKeyAsBuffer.toString('hex');
        publicKeyAsBuffer.toString = function() {
            return bufferHex;
        }
        const address = Address.fromString(fundingAddress);

        let receiver;
        if (fileReceiverAddress) {
            receiver = Address.fromString(fileReceiverAddress);
        } else {
            receiver = address;
        }

        //* ** building transaction
        let transactions: Transaction[] = [];
        let fileIndex = 0, tx = new Transaction().feePerByte(this.FEE_RATE);

        // show progress
        let nDiff = 100 / transactionCount;
        let nCurPos = 0;

        tx.addInput(
            new Transaction.Input.PublicKeyHash({
                output: new Transaction.Output({
                    script: Script.buildPublicKeyHashOut(address),
                    satoshis: fundingUtxo.satoshis
                }),
                prevTxId: fundingUtxo.txid,
                outputIndex: fundingUtxo.vout,
                script: Script.empty()
            })
        )

        for (let nId = 0; nId < transactionCount; nId++) {
            tx = tx.addData(
                buf.slice(fileIndex, fileIndex + 220)
            );
            fileIndex += 220;

            const outsInThisTX = numberOfOuts[nId];
            var txStartIndex = fileIndex;

            for (let z = 0; z < outsInThisTX; z++) {
                tx = tx.addOutput(
                    new Transaction.Output({
                        script:
                            Script.buildScriptHashOut(
                                buildPushOut(
                                    [publicKeyAsBuffer], [
                                    buf.slice(fileIndex, fileIndex + p2shScriptPubKeySeparator),
                                    buf.slice(fileIndex + p2shScriptPubKeySeparator, fileIndex + p2shPushLength)
                                ]
                                )
                            ),
                        satoshis:
                            546
                    })
                );
                fileIndex += p2shPushLength;
            }

            (tx as any)._changeScript = Script.buildPublicKeyOut(publicKey);
            (tx as any)._clearSignatures = function() { };
            (tx as any)._updateChangeOutput();

            if (uploadMethod == 2) {
                // Set change
                const changeIndex = (tx as any)._changeIndex;
                if (!changeIndex) console.log("Not enough funds!")
                const changeOutput = tx.outputs[changeIndex];
                const totalOutputAmount = (tx as any)._outputAmount;
                (tx as any)._removeOutput(changeIndex);
                (tx as any)._outputAmount = totalOutputAmount;
                (tx.outputs[1] as any).satoshis += changeOutput.satoshis;
            }

            tx = tx.sign(privateKey, null as any, "schnorr");
            transactions.push(tx);

            const txHash = tx.hash;

            let tx2 = new Transaction().feePerByte(this.FEE_RATE);

            if (outsInThisTX == 0) {
                tx2 = (tx2 as any).from({
                    "txid": txHash,
                    "vout": 1,
                    "address": address,
                    "scriptPubKey": tx.outputs[1].script,
                    "satoshis": tx.outputs[1].satoshis
                });
            }
            for (let i = 1; i <= outsInThisTX; i++) {
                let out = new Transaction.Output({
                    script: tx.outputs[i].script,
                    satoshis: tx.outputs[i].satoshis
                });
                let utxo = new Transaction.UnspentOutput({
                    output: out,
                    prevTxId: txHash,
                    outputIndex: i,
                    script: Script.empty()
                });
                // @ts-ignore
                let pushin = new PushScriptHashInput(utxo,
                    [publicKeyAsBuffer], 1, undefined, [
                    buf.slice(txStartIndex, txStartIndex + p2shScriptPubKeySeparator),
                    buf.slice(txStartIndex + p2shScriptPubKeySeparator, txStartIndex + p2shPushLength)
                ]
                );

                tx2.addInput(pushin as any);
                txStartIndex += p2shPushLength;
            }
            tx = tx2;

            // sign progress
            if (signProgressCallback != null) {
                signProgressCallback(nCurPos)
            }
            nCurPos += nDiff;
        }

        if (fileIndex != buf.length) {
            console.log("Padding error " + fileIndex + " " + buf.length)
        }

        tx.addOutput(new Transaction.Output({
            script: finalOpReturn,
            satoshis: 0
        }));

        const lastTx = tx.change(receiver);
        if (!(lastTx as any)._changeIndex) console.log("Not enough funds for the last transaction!")
        transactions.push(lastTx.sign(privateKey, null as any, "schnorr"));

        // progress : signing finished
        if (signFinishedCallback != null) {
            signFinishedCallback();
        }

        let bfTxId = await this.uploadTransactions(transactions, delay_ms, uploadProgressCallback);
        if (uploadFinishedCallback != null) {
            uploadFinishedCallback(bfTxId);
        }

        return bfTxId;
    }

    async downloadFile(
        bfpUri: string,
        progressCallback?: Function) {

        let chunks = [];
        let size = 0;

        let txid = bfpUri.replace('bitcoinfile:', '');
        txid = txid.replace('bitcoinfiles:', '');

        let tx = await this.client.getTransaction({ hash: txid, reversedHashOrder: true });
        let prevHash = Buffer.from(tx.getTransaction()!.getInputsList()[0].getOutpoint()!.getHash_asU8()).toString('hex');
        let metadata_opreturn_hex = Buffer.from(tx.getTransaction()!.getOutputsList()[0].getPubkeyScript_asU8()).toString('hex')
        let bfpMsg = <any>this.parsebfpDataOpReturn(metadata_opreturn_hex);

        let downloadCount = bfpMsg.chunk_count;
        if (downloadCount > 0 && bfpMsg.chunk != null && bfpMsg.chunk.length > 0) {
            downloadCount--;
            chunks.push(bfpMsg.chunk)
            size += <number>bfpMsg.chunk.length;
        }

        let inputData = <any>this.parsebfpDataInput(tx.getTransaction()!.getInputsList());
        chunks.push(inputData);
        size += <number>inputData.length;

        // Loop through raw transactions, parse out data
        for (let index = 0; index < downloadCount; index++) {

            // download prev txn
            let tx = await this.client.getTransaction({ hash: prevHash });
            prevHash = Buffer.from(tx.getTransaction()!.getInputsList()[0].getOutpoint()!.getHash_asU8()).toString('hex');
            let op_return_hex = Buffer.from(tx.getTransaction()!.getOutputsList()[0].getPubkeyScript_asU8()).toString('hex');

            // parse vout 0 for data, push onto chunks array
            let bfpMsg = <any>this.parsebfpDataOpReturn(op_return_hex);
            chunks.push(bfpMsg.chunk);
            size += <number>bfpMsg.chunk.length;

            // parse vin for data
            let inputData = <any>this.parsebfpDataInput(tx.getTransaction()!.getInputsList());
            chunks.push(inputData);
            size += <number>inputData.length;

            if (progressCallback) {
                progressCallback(index / (downloadCount - 1));
            }
        }

        if (bfpMsg.filesize) {
            if (size < bfpMsg.filesize) {
                console.log("Bad length, read too little!");
            }
            size = bfpMsg.filesize;
        }

        // reverse order of chunks
        chunks = chunks.reverse()
        let fileBuf = Buffer.alloc(size);
        let index = 0;
        chunks.forEach(chunk => {
            chunk.copy(fileBuf, index)
            index += chunk.length;
        });

        // TODO: check that metadata hash matches if one was provided.
        let passesHashCheck = false
        if (bfpMsg.sha256 != null) {
            let fileSha256 = Utils.Sha256(fileBuf);
            let res = Buffer.compare(fileSha256, bfpMsg.sha256);
            if (res === 0) {
                passesHashCheck = true;
            }
        }

        return { passesHashCheck, fileBuf };
    }

    private static buildMetadataOpReturn(
        config: FileMetadata) {

        let script: number[] = [];

        // OP Return Prefix
        script.push(0x6a);

        // Lokad Id
        let lokadId = Buffer.from(Bfp.bfpMagicHex, 'hex');
        script = script.concat(Utils.getPushDataOpcode(lokadId));
        lokadId.forEach((item) => script.push(item));

        // Message Type
        script = script.concat(Utils.getPushDataOpcode([config.msgType]));
        script.push(config.msgType);

        // Chunk Count
        let chunkCount = Utils.int2FixedBuffer(config.chunkCount, 4);
        script = script.concat(Utils.getPushDataOpcode(chunkCount))
        chunkCount.forEach((item) => script.push(item))

        // File Name
        if (config.fileName == null || config.fileName.length === 0 || config.fileName == '') {
            [0x4c, 0x00].forEach((item) => script.push(item));
        } else {
            let fileName = Buffer.from(config.fileName, 'utf8')
            script = script.concat(Utils.getPushDataOpcode(fileName));
            fileName.forEach((item) => script.push(item));
        }

        // File Ext
        if (config.fileExt == null || config.fileExt.length === 0 || config.fileExt == '') {
            [0x4c, 0x00].forEach((item) => script.push(item));
        } else {
            let fileExt = Buffer.from(config.fileExt, 'utf8');
            script = script.concat(Utils.getPushDataOpcode(fileExt));
            fileExt.forEach((item) => script.push(item));
        }

        let fileSize = Utils.int2FixedBuffer(config.fileSize, 8);
        script = script.concat(Utils.getPushDataOpcode(fileSize))
        fileSize.forEach((item) => script.push(item))

        // File SHA256
        var re = /^[0-9a-fA-F]+$/;
        if (config.fileSha256Hex == null || config.fileSha256Hex.length === 0 || config.fileSha256Hex == '') {
            [0x4c, 0x00].forEach((item) => script.push(item));
        } else if (config.fileSha256Hex.length === 64 && re.test(config.fileSha256Hex)) {
            let fileSha256Buf = Buffer.from(config.fileSha256Hex, 'hex');
            script = script.concat(Utils.getPushDataOpcode(fileSha256Buf));
            fileSha256Buf.forEach((item) => script.push(item));
        } else {
            throw Error("File hash must be provided as a 64 character hex string");
        }

        // Previous File Version SHA256
        if (config.prevFileSha256Hex == null || config.prevFileSha256Hex.length === 0 || config.prevFileSha256Hex == '') {
            [0x4c, 0x00].forEach((item) => script.push(item));
        } else if (config.prevFileSha256Hex.length === 64 && re.test(config.prevFileSha256Hex)) {
            let prevFileSha256Buf = Buffer.from(config.prevFileSha256Hex, 'hex');
            script = script.concat(Utils.getPushDataOpcode(prevFileSha256Buf));
            prevFileSha256Buf.forEach((item) => script.push(item));
        } else {
            throw Error("Previous File hash must be provided as a 64 character hex string")
        }

        // File URI
        if (config.fileUri == null || config.fileUri.length === 0 || config.fileUri == '') {
            [0x4c, 0x00].forEach((item) => script.push(item));
        } else {
            let fileUri = Buffer.from(config.fileUri, 'utf8');
            script = script.concat(Utils.getPushDataOpcode(fileUri));
            fileUri.forEach((item) => script.push(item));
        }

        // Chunk Data
        if (config.chunkData == null || config.chunkData.length === 0) {
            [0x4c, 0x00].forEach((item) => script.push(item));
        } else {
            let chunkData = Buffer.from(config.chunkData);
            script = script.concat(Utils.getPushDataOpcode(chunkData));
            chunkData.forEach((item) => script.push(item));
        }

        //console.log('script: ', script);
        let encodedScript = Utils.encodeScript(script);

        if (encodedScript.length > 223) {
            throw Error("Script too long, must be less than 223 bytes.")
        }

        return encodedScript;
    }

    // We may not need this function since the web browser wallet will be receiving funds in a single txn.
    buildFundingTx(config: FundingTxnConfig) {

        let tx = new Transaction();
        let feeRate = this.FEE_RATE; // sat/byte
        tx.feePerByte(feeRate);
        let satoshis = 0;
        config.input_utxos.forEach(token_utxo => {
            tx.addInput(new Transaction.Input.PublicKeyHash({
                output: new Transaction.Output({
                    script: Script.buildPublicKeyHashOut(new Address(token_utxo.address!)),
                    satoshis: token_utxo.satoshis
                }),
                prevTxId: Buffer.from(token_utxo.txid, "hex"),
                outputIndex: token_utxo.vout,
                script: Script.empty()
            }));
            satoshis += token_utxo.satoshis;
        });

        // @ts-ignore
        let fundingMinerFee = tx._estimateSize() * feeRate;
        let outputAmount = satoshis - fundingMinerFee;

        // Output exact funding amount
        tx.addOutput(new Transaction.Output({
            script: new Script(new Address(config.outputAddress)),
            satoshis: outputAmount
        }));

        // sign inputs
        tx.sign([...config.input_utxos.map(o => o.wif!)], null as any, "schnorr");

        return tx;
    }

    private buildMetadataTx(config: MetadataTxnConfig) {

        let tx = new Transaction();
        tx.feePerByte(this.FEE_RATE);

        let inputSatoshis = 0;

        tx.addInput(new Transaction.Input.PublicKeyHash({
            output: new Transaction.Output({
                script: Script.buildPublicKeyHashOut(new Address(config.input_utxo.address!)),
                satoshis: config.input_utxo.satoshis
            }),
            prevTxId: Buffer.from(config.input_utxo.txid, "hex"),
            outputIndex: config.input_utxo.vout,
            script: Script.empty()
        }));
        inputSatoshis += config.input_utxo.satoshis;


        let metadataFee = this.calculateMetadataMinerFee(config.bfpMetadataOpReturn.length); //TODO: create method for calculating miner fee
        let output = inputSatoshis - metadataFee;

        // Metadata OpReturn
        tx.addOutput(new Transaction.Output({
            script: config.bfpMetadataOpReturn,
            satoshis: 0
        }));

        // outputs
        tx.addOutput(new Transaction.Output({
            script: new Script(new Address(config.fileReceiverAddress)),
            satoshis: output
        }));

        // sign inputs
        tx.sign(config.input_utxo.wif!, null as any, "schnorr");

        return tx;
    }

    private calculateMetadataMinerFee(genesisOpReturnLength: number, feeRate = 1) {
        let fee = 195; // 1 p2pkh and 1 p2pkh output ~195 bytes
        fee += genesisOpReturnLength
        fee += 10 // added to account for OP_RETURN ammount of 0000000000000000
        fee *= feeRate
        return fee
    }

    static calculateFileUploadCost(
        fileSizeBytes: number,
        configMetadataOpReturn?: FileMetadata,
        fee_rate = 1,
        uploadMethod = 1) {
        let byte_count = 0;
        if (uploadMethod == 2) {
            let arrangement = Bfp.arrangeOutputs(fileSizeBytes, 50);
            let numberOfOuts = arrangement.numberOfOuts;
            let transactionCount = numberOfOuts.length;

            const costConstantSizeWithOPReturn = 258;
            const costP2SHOut = 32;
            const costP2SHIn = 1689;
            const costP2PKHIn = 144;
            const costP2PKHOut = 35;

            // First transaction
            let byteCount = costP2PKHIn + costConstantSizeWithOPReturn;

            for (let i = 1; i < transactionCount; i++ , byteCount += costConstantSizeWithOPReturn) {
                byteCount += costP2SHIn * numberOfOuts[i - 1] + costP2SHOut * numberOfOuts[i];
            }

            // Last transaction
            // transactionCount counts only P2SH-forming transactions
            byte_count += costConstantSizeWithOPReturn
                + numberOfOuts[transactionCount - 1] * costP2SHIn
                + costP2PKHOut;
        } else {
            byte_count = fileSizeBytes;
            let whole_chunks_count = Math.floor(fileSizeBytes / 220);
            let last_chunk_size = fileSizeBytes % 220;

            // cost of final transaction's op_return w/o any chunkdata
            let final_op_return_no_chunk;

            if (configMetadataOpReturn) {
                final_op_return_no_chunk = Bfp.buildMetadataOpReturn(configMetadataOpReturn);
                byte_count += final_op_return_no_chunk.length;
            } else {
                byte_count += 223;
            }

            // cost of final transaction's input/outputs
            byte_count += 35;
            byte_count += 148 + 1;

            // cost of chunk trasnsaction op_returns
            byte_count += (whole_chunks_count + 1) * 3;

            if (!final_op_return_no_chunk
                || !Bfp.chunk_can_fit_in_final_opreturn(final_op_return_no_chunk.length, last_chunk_size)) {
                // add fees for an extra chunk transaction input/output
                byte_count += 149 + 35;
                // opcode cost for chunk op_return
                byte_count += 16;
            }

            // output p2pkh
            byte_count += 35 * (whole_chunks_count);

            // dust input bytes (this is the initial payment for the file upload)
            byte_count += (148 + 1) * whole_chunks_count;

            // other unaccounted per txn
            byte_count += 22 * (whole_chunks_count + 1);
        }

        // dust output to be passed along each txn
        let dust_amount = 546;

        return byte_count * fee_rate + dust_amount;
    }

    private static chunk_can_fit_in_final_opreturn(script_length: number, chunk_data_length: number) {
        if (chunk_data_length === 0) {
            return true;
        }

        let op_return_capacity = 223 - script_length;
        if (op_return_capacity >= chunk_data_length) {
            return true;
        }

        return false;
    }

    private parsebfpDataOpReturn(hex: string) {
        const decodedScript: any = Script.fromHex(hex);
        let bfpData: any = {}
        bfpData.type = 'metadata'
        let script = [];
        for (var i = 0; i < decodedScript.chunks.length; i++) {
            let chunk = decodedScript.chunks[i];
            script.push(decodedScript._chunkToString(chunk, 'asm').slice(1));
        }

        if (script.length == 2) {
            bfpData.type = 'chunk';
            try {
                bfpData.chunk = Buffer.from(script[1], 'hex');
            } catch (e) {
                bfpData.chunk = null;
            }
            return bfpData;
        }

        if (script[0] != 'OP_RETURN') {
            throw new Error('Not an OP_RETURN');
        }

        if (script[1] !== Bfp.bfpMagicHex) {
            throw new Error('Not a BFP OP_RETURN');
        }

        // 01 = On-chain File
        if ((script[2] != 'OP_1') && (script[2] != '01') && (script[2] != 'OP_2') && (script[2] != '02')) {
            throw new Error('Not a BFP file (type 0x01 or 0x02)');
        }

        // chunk count
        bfpData.chunk_count = parseInt(script[3], 16);
        if (script[3].includes('OP_')) {
            let val = script[3].replace('OP_', '');
            bfpData.chunk_count = parseInt(val);
        }

        // filename
        if (script[4] == 'OP_0') {
            bfpData.filename = null
        } else {
            bfpData.filename = Buffer.from(script[4], 'hex').toString('utf8');
        }

        // fileext
        if (script[5] == 'OP_0') {
            bfpData.fileext = null
        } else {
            bfpData.fileext = Buffer.from(script[5], 'hex').toString('utf8');
        }

        // filesize
        if (script[6] == 'OP_0') {
            bfpData.filesize = null
        } else {
            bfpData.filesize = parseInt(script[6], 16);
        }

        // file_sha256
        if (script[7] == 'OP_0') {
            bfpData.sha256 = null
        } else {
            bfpData.sha256 = Buffer.from(script[7], 'hex');
        }

        // prev_file_sha256
        if (script[8] == 'OP_0') {
            bfpData.prevsha256 = null
        } else {
            bfpData.prevsha256 = Buffer.from(script[8], 'hex');
        }

        // uri
        if (script[9] == 'OP_0') {
            bfpData.uri = null
        } else {
            bfpData.uri = Buffer.from(script[9], 'hex').toString('utf8');
        }

        // chunk_data
        if (script[10] == 'OP_0') {
            bfpData.chunk = null
        } else {
            try {
                bfpData.chunk = Buffer.from(script[10], 'hex');
            } catch (e) {
                bfpData.chunk = null
            }
        }

        return bfpData;
    }

    private parsebfpDataInput(inputList: any) {
        let chunks = [];
        let len = 0;
        const inputListLen = inputList.length;
        for (let i = 0; i < inputListLen; i++) {
            let hex = Buffer.from(inputList[i].getSignatureScript_asU8()).toString('hex')

            // Normal P2PKH input
            if (hex.length < 220) {
                return Buffer.allocUnsafe(0);
            }

            const script = Script.fromHex(hex).toASM().split(" ");

            let buf = Buffer.from(script[2], 'hex')
            chunks.push(buf);
            len += buf.length;

            buf = Buffer.from(script[3], 'hex')
            chunks.push(buf);
            len += buf.length;

            const innerScript = Script.fromHex(script[4]).toASM().split(" ");

            buf = Buffer.from(innerScript[9], 'hex')
            chunks.push(buf);
            len += buf.length;
        }

        let fileBuf = Buffer.alloc(len);
        let index = 0;
        chunks.forEach(chunk => {
            chunk.copy(fileBuf, index)
            index += chunk.length;
        });
        return fileBuf;
    }

    private static arrangeOutputs(fileSize: number, perTransactionCapacity: number) {
        // Maximum inputs per tx: 50
        const totalPerTransactionCapacity = perTransactionCapacity * p2shPushLength + 220;
        let transactionCount = Math.ceil(fileSize / totalPerTransactionCapacity);
        // Doesn't include the last transaction, which creates no P2SH outputs
        let numberOfOuts = new Uint8Array(transactionCount);
        // waterfill
        numberOfOuts.fill(perTransactionCapacity);

        if (perTransactionCapacity == 0) {
            // There's no concept of "Outs"
            // Add padding and calculate the conservative file size with padding
            let conservativeFileSize = transactionCount * 220;
            return { conservativeFileSize, numberOfOuts }
        }

        // calculate the number of outs of last tx
        const leftOver = (fileSize - (transactionCount - 1) * totalPerTransactionCapacity - 220)
        numberOfOuts[transactionCount - 1] = Math.ceil(leftOver / p2shPushLength)

        // These may bypass the limit "Maximum inputs per tx: 50"
        // up to 52, which is safe.
        if (transactionCount > 1) {
            // Move one push to the last transaction
            // This removes the need to waste more space in the
            // "numberOfOuts[transactionCount - 1] == 0" conditional later
            if (numberOfOuts[transactionCount - 2] > 1) {
                numberOfOuts[transactionCount - 2]--;
                numberOfOuts[transactionCount - 1]++;
            }

            // Move another push to the last transaction
            // This may allow us to possibly save space
            // by moving extra data to the metadata OP_RETURN push
            // instead of padding to fill one P2SH push
            // by guaranteeing that there would still be one P2SH push
            if (numberOfOuts[transactionCount - 2] > 1) {
                numberOfOuts[transactionCount - 2]--;
                numberOfOuts[transactionCount - 1]++;
            } else if ((transactionCount > 2)
                && (numberOfOuts[transactionCount - 3] > 1)) {
                // This branch may run only if "Maximum inputs per tx"
                // is reduced to 1
                numberOfOuts[transactionCount - 3]--;
                numberOfOuts[transactionCount - 1]++;
            }
        }

        // Transactions are linked by P2SH outputs, so one is needed every time.
        // This condition is true if the file is little
        if (numberOfOuts[transactionCount - 1] == 0) {
            // will be padded later
            numberOfOuts[transactionCount - 1]++
        }

        // Add padding and calculate the conservative file size with padding
        let conservativeFileSize = 0;
        for (let i = 0; i < transactionCount; i++ , conservativeFileSize += 220) {
            conservativeFileSize += numberOfOuts[i] * p2shPushLength;
        }

        return { conservativeFileSize, numberOfOuts }
    }

    async uploadTransactions(
        transactions: Transaction[],
        delay_ms: number,
        uploadProgressCallback?: Function): Promise<string> {
        let nDiff = 100 / transactions.length;
        let nCurPos = 0;
        if (uploadProgressCallback != null) {
            uploadProgressCallback(0);
        }
        let bfTxId: string;
        for (let nId = 0; nId < transactions.length; nId++) {
            console.log('transaction: ', transactions[nId].id);

            while (true) {
                console.log(`upload progress: ${nCurPos}%`);
                try {
                    let txnHex = transactions[nId].uncheckedSerialize();
                    const res = await this.client.submitTransaction({ txnHex });
                    bfTxId = Buffer.from(res.getHash_asU8().reverse()).toString("hex");
                    break;
                } catch (err) {
                    if (err.message.includes("fully-spent transaction")) {
                        console.log(`skipping transaction already spent ${transactions[nId].id}`);
                        break;
                    } else if (err.message.includes("transaction already exists")) {
                        console.log(`transaction already exists ${transactions[nId].id}`);
                        break;
                    } else if (err.message.includes("already have transaction")) {
                        console.log(`already have transaction ${transactions[nId].id}`);
                        break;
                    } else {
                        console.log(`waiting 60 sec to try again: ${err}`);
                        await sleep(60000);
                    }
                }
            }
            // progress
            if (uploadProgressCallback != null) {
                uploadProgressCallback(nCurPos);
            }
            nCurPos += nDiff;

            // delay between transactions
            await sleep(delay_ms);
        }

        return 'bitcoinfile:' + bfTxId!;
    }
}
