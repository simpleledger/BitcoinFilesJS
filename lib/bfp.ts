import { Address, Script, Transaction } from "bitcore-lib-cash";
import { Utils } from './utils';
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

export class Bfp {
    client: IGrpcClient;

    FEE_RATE = 1;

    constructor(client: IGrpcClient) {
        this.client = client;
    }

    static get bfpMagicHex() { return "42465000" }

    async uploadHashOnlyObject(type: number, // file = 1,  folder = 3
                                fundingUtxo: utxo,                // object in form: { txid:'', satoshis:#, vout:# }
                                fundingAddress: string,           // string
                                fundingWif: string,               // hex string?
                                objectDataArrayBuffer: Buffer,    // ArrayBuffer
                                objectName?: string,              // string
                                objectExt?: string,               // string
                                prevObjectSha256Hex?: string,     // hex string
                                objectExternalUri?: string,       // utf8 string
                                objectReceiverAddress?: string,   // string
                                signProgressCallback?: Function, 
                                signFinishedCallback?: Function, 
                                uploadProgressCallback?: Function, 
                                uploadFinishedCallback?: Function){
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
        if(signProgressCallback != null){
            signProgressCallback(100);
        }

        // progress : signing finished
        if(signFinishedCallback != null){
            signFinishedCallback();
        }
        
        //* ** sending transaction
        if(uploadProgressCallback != null){
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
        if(uploadProgressCallback != null){
            uploadProgressCallback(100);
        }

        bfTxId = 'bitcoinfile:' + bfTxId;
        if(uploadFinishedCallback != null){
            uploadFinishedCallback(bfTxId);
        }

        return bfTxId;
    }

    async uploadFolderHashOnly(fundingUtxo: utxo,                // object in form: { txid:'', satoshis:#, vout:# }
                                fundingAddress: string,             // string
                                fundingWif: string,                 // hex string?
                                folderDataArrayBuffer: Buffer,        // ArrayBuffer
                                folderName?: string,              // string
                                folderExt?: string,               // string
                                prevFolderSha256Hex?: string,         // hex string
                                folderExternalUri?: string,       // utf8 string
                                folderReceiverAddress?: string,   // string
                                signProgressCallback?: Function, 
                                signFinishedCallback?: Function, 
                                uploadProgressCallback?: Function, 
                                uploadFinishedCallback?: Function){
        return await this.uploadHashOnlyObject(3,
                                                fundingUtxo,                // object in form: { txid:'', satoshis:#, vout:# }
                                                fundingAddress,             // string
                                                fundingWif,                 // hex string?
                                                folderDataArrayBuffer,      // ArrayBuffer
                                                folderName,            // string
                                                folderExt,             // string
                                                prevFolderSha256Hex,   // hex string
                                                folderExternalUri,     // utf8 string
                                                folderReceiverAddress, // string
                                                signProgressCallback, 
                                                signFinishedCallback, 
                                                uploadProgressCallback, 
                                                uploadFinishedCallback
        )
    }

    async uploadFileHashOnly(fundingUtxo: utxo,                   // object in form: { txid:'', satoshis:#, vout:# }
                                fundingAddress: string,             // string
                                fundingWif: string,                 // hex string?
                                fileDataArrayBuffer: Buffer,        // ArrayBuffer
                                fileName?: string,              // string
                                fileExt?: string,               // string
                                prevFileSha256Hex?: string,     // hex string
                                fileExternalUri?: string,       // utf8 string
                                fileReceiverAddress?: string,   // string
                                signProgressCallback?: Function, 
                                signFinishedCallback?: Function, 
                                uploadProgressCallback?: Function, 
                                uploadFinishedCallback?: Function){
        return await this.uploadHashOnlyObject(1,
                                                fundingUtxo,          // object in form: { txid:'', satoshis:#, vout:# }
                                                fundingAddress,       // string
                                                fundingWif,           // hex string?
                                                fileDataArrayBuffer,  // ArrayBuffer
                                                fileName,             // string
                                                fileExt,              // string
                                                prevFileSha256Hex,    // hex string
                                                fileExternalUri,      // utf8 string
                                                fileReceiverAddress,  // string
                                                signProgressCallback, 
                                                signFinishedCallback, 
                                                uploadProgressCallback, 
                                                uploadFinishedCallback
        )
    }

    async uploadFile(fundingUtxo: utxo,                       // object in form: { txid:'', satoshis:#, vout:# }
                            fundingAddress: string,             // string
                            fundingWif: string,                 // hex string?
                            fileDataArrayBuffer: Buffer,        // ArrayBuffer
                            fileName?: string,              // string
                            fileExt?: string,               // string
                            prevFileSha256Hex?: string,     // hex string
                            fileExternalUri?: string,       // utf8 string
                            fileReceiverAddress?: string,   // string
                            signProgressCallback?: Function, 
                            signFinishedCallback?: Function, 
                            uploadProgressCallback?: Function, 
                            uploadFinishedCallback?: Function, 
                            delay_ms=500) {

        let fileSize = fileDataArrayBuffer.byteLength;
        let hash = Utils.Sha256(fileDataArrayBuffer).toString('hex');
        
        // chunks
        let chunks = [];
        let chunkCount = Math.floor(fileSize / 220);

        for (let nId = 0; nId < chunkCount; nId++) {
            chunks.push(fileDataArrayBuffer.slice(nId * 220, (nId + 1) * 220));
        }

        // meta
        if (fileSize % 220) {
            chunks[chunkCount] = fileDataArrayBuffer.slice(chunkCount * 220, fileSize);
            chunkCount++;
        }

        // estimate cost
        // build empty meta data OpReturn
        let configEmptyMetaOpReturn: FileMetadata = {
            msgType: 1,
            chunkCount: chunkCount,
            fileName: fileName,
            fileExt: fileExt,
            fileSize: fileSize,
            fileSha256Hex: hash,
            prevFileSha256Hex: prevFileSha256Hex,
            fileUri: fileExternalUri
        };

        //* ** building transaction
        let transactions = [];

        // show progress
        let nDiff = 100 / chunkCount;
        let nCurPos = 0;

        for (let nId = 0; nId < chunkCount; nId++) {
            // build chunk data OpReturn
            let chunkOpReturn = Bfp.buildDataChunkOpReturn(chunks[nId]);

            let txid = '';
            let satoshis = 0;
            let vout = 1;
            if (nId === 0) {
                txid = fundingUtxo.txid;
                satoshis = fundingUtxo.satoshis;
                vout = fundingUtxo.vout;
            } else {
                txid = transactions[nId - 1].id;
                satoshis = transactions[nId - 1].outputs[1].satoshis;
            }

            // build chunk data transaction
            let configChunkTx: DataChunkTxnConfig = {
                bfpChunkOpReturn: chunkOpReturn,
                input_utxo: <utxo>{
                    address: fundingAddress,
                    txid: txid,
                    vout: vout,
                    satoshis: satoshis,
                    wif: fundingWif
                }
            };

            let chunksTx = this.buildChunkTx(configChunkTx);

            if (nId === chunkCount - 1) {
                let emptyOpReturn = Bfp.buildMetadataOpReturn(configEmptyMetaOpReturn);
                let capacity = 223 - emptyOpReturn.length;
                if (capacity >= chunks[nId].byteLength) {
                    // finish with just a single metadata txn
                    // build meta data OpReturn
                    let configMetaOpReturn = {
                        msgType: 1,
                        chunkCount: chunkCount,
                        fileName: fileName,
                        fileExt: fileExt,
                        fileSize: fileSize,
                        fileSha256Hex: hash,
                        prevFileSha256Hex: prevFileSha256Hex,
                        fileUri: fileExternalUri,
                        chunkData: chunks[nId]
                    };
                    let metaOpReturn = Bfp.buildMetadataOpReturn(configMetaOpReturn);

                    // build meta data transaction
                    let configMetaTx = {
                        bfpMetadataOpReturn: metaOpReturn,
                        input_utxo: {
                            txid: txid,
                            vout: vout,
                            satoshis: satoshis,
                            wif: fundingWif,
                            address: fundingAddress
                        },
                        fileReceiverAddress: fileReceiverAddress != null ? fileReceiverAddress : fundingAddress
                    };
                    let metaTx = this.buildMetadataTx(configMetaTx);
                    transactions.push(metaTx);
                } else {
                    // finish with both chunk txn and then final empty metadata txn
                    transactions.push(chunksTx);

                    let metaOpReturn = Bfp.buildMetadataOpReturn(configEmptyMetaOpReturn);

                    // build meta data transaction
                    let configMetaTx = {
                        bfpMetadataOpReturn: metaOpReturn,
                        input_utxo: {
                            txid: chunksTx.id,
                            vout: vout,
                            satoshis: chunksTx.outputs[1].satoshis,
                            wif: fundingWif,
                            address: fundingAddress
                        },
                        fileReceiverAddress: fileReceiverAddress != null ? fileReceiverAddress : fundingAddress
                    };
                    let metaTx = this.buildMetadataTx(configMetaTx);
                    transactions.push(metaTx);
                }
            } else { // not last transaction
                transactions.push(chunksTx);
            }

            // sign progress
            if(signProgressCallback != null){
                signProgressCallback(nCurPos)
            }
            nCurPos += nDiff;
        }

        // progress : signing finished
        if(signFinishedCallback != null){
            signFinishedCallback();
        }

        //* ** sending transaction
        nDiff = 100 / transactions.length;
        nCurPos = 0;
        if(uploadProgressCallback != null){
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
            if(uploadProgressCallback != null){
                uploadProgressCallback(nCurPos);
            }
            nCurPos += nDiff;

            // delay between transactions
            await sleep(delay_ms);
        }

        bfTxId = 'bitcoinfile:' + bfTxId!;
        if(uploadFinishedCallback != null){
            uploadFinishedCallback(bfTxId);
        }

        return bfTxId;
    }

    async downloadFile(bfpUri: string, progressCallback?: Function) {
        let chunks = [];
        let size = 0;

        let txid = bfpUri.replace('bitcoinfile:', '');
        txid = txid.replace('bitcoinfiles:', '');


        let tx = await this.client.getTransaction({ hash: txid, reversedHashOrder: true });
        let prevHash = Buffer.from(tx.getTransaction()!.getInputsList()[0].getOutpoint()!.getHash_asU8()).toString('hex');
        let metadata_opreturn_hex = Buffer.from(tx.getTransaction()!.getOutputsList()[0].getPubkeyScript_asU8()).toString('hex')
        let bfpMsg = <any>this.parsebfpDataOpReturn(metadata_opreturn_hex);

        let downloadCount = bfpMsg.chunk_count;
        if(bfpMsg.chunk_count > 0 && bfpMsg.chunk != null && bfpMsg.chunk.length > 0) {
            downloadCount = bfpMsg.chunk_count - 1;
            chunks.push(bfpMsg.chunk)
            size += <number>bfpMsg.chunk.length;
        }


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

            if(progressCallback) {
                progressCallback(index/(downloadCount-1));
            }
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
        if(bfpMsg.sha256 != null){
            let fileSha256 = Utils.Sha256(fileBuf);
            let res = Buffer.compare(fileSha256, bfpMsg.sha256);
            if(res === 0){
                passesHashCheck = true;
            }
        }

        return { passesHashCheck, fileBuf };
    }

    static buildMetadataOpReturn(config: FileMetadata) {

        let script:number[] = [];

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
        let chunkCount = Utils.int2FixedBuffer(config.chunkCount, 1)
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

        let fileSize = Utils.int2FixedBuffer(config.fileSize, 2)
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

    static buildDataChunkOpReturn(chunkData: Buffer) {
        let script: number[] = []

        // OP Return Prefix
        script.push(0x6a)

        // Chunk Data
        if (chunkData === undefined || chunkData === null || chunkData.length === 0) {
            [0x4c, 0x00].forEach((item) => script.push(item));
        } else {
            let chunkDataBuf = Buffer.from(chunkData);
            script = script.concat(Utils.getPushDataOpcode(chunkDataBuf));
            chunkDataBuf.forEach((item) => script.push(item));
        }

        let encodedScript = Utils.encodeScript(script);
        if (encodedScript.length > 223) {
            throw Error("Script too long, must be less than 223 bytes.");
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
        tx.sign([...config.input_utxos.map(o => o.wif!)]);

        return tx;
    }

    buildChunkTx(config: DataChunkTxnConfig) {

        let tx = new Transaction();
        tx.feePerByte(this.FEE_RATE);

        tx.addInput(new Transaction.Input.PublicKeyHash({
            output: new Transaction.Output({
                script: Script.buildPublicKeyHashOut(new Address(config.input_utxo.address!)),
                satoshis: config.input_utxo.satoshis
            }),
            prevTxId: Buffer.from(config.input_utxo.txid, "hex"),
            outputIndex: config.input_utxo.vout,
            script: Script.empty()
        }));

        let chunkTxFee = this.calculateDataChunkMinerFee(config.bfpChunkOpReturn.length);
        let outputAmount = config.input_utxo.satoshis - chunkTxFee;

        // Chunk OpReturn
        tx.addOutput(new Transaction.Output({
            script: config.bfpChunkOpReturn,
            satoshis: 0
        }));

        // Genesis token mint
        tx.addOutput(new Transaction.Output({
            script: new Script(new Address(config.input_utxo.address!)),
            satoshis: outputAmount
        }));

        // sign inputs
        tx.sign(config.input_utxo.wif!);

        return tx;
    }

    buildMetadataTx(config: MetadataTxnConfig) {

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
        tx.sign(config.input_utxo.wif!);

        return tx;
    }

    calculateMetadataMinerFee(genesisOpReturnLength: number, feeRate = 1) {
        let fee = 195; // 1 p2pkh and 1 p2pkh output ~195 bytes
        fee += genesisOpReturnLength
        fee += 10 // added to account for OP_RETURN ammount of 0000000000000000
        fee *= feeRate
        return fee
    }

    calculateDataChunkMinerFee(sendOpReturnLength: number, feeRate = 1) {
        let fee = 195; // 1 p2pkh and 1 p2pkh output ~195 bytes
        fee += sendOpReturnLength
        fee += 10 // added to account for OP_RETURN ammount of 0000000000000000
        fee *= feeRate
        return fee
    }

    static calculateFileUploadCost(fileSizeBytes: number, configMetadataOpReturn: FileMetadata, fee_rate = 1){
        let byte_count = fileSizeBytes;
        let whole_chunks_count = Math.floor(fileSizeBytes / 220);
        let last_chunk_size = fileSizeBytes % 220;

        // cost of final transaction's op_return w/o any chunkdata
        let final_op_return_no_chunk = Bfp.buildMetadataOpReturn(configMetadataOpReturn);
        byte_count += final_op_return_no_chunk.length;

        // cost of final transaction's input/outputs
        byte_count += 35;
        byte_count += 148 + 1;

        // cost of chunk trasnsaction op_returns
        byte_count += (whole_chunks_count + 1) * 3;

        if (!Bfp.chunk_can_fit_in_final_opreturn(final_op_return_no_chunk.length, last_chunk_size))
        {
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

        // dust output to be passed along each txn
        let dust_amount = 546;

        return byte_count * fee_rate + dust_amount;
    }

    static chunk_can_fit_in_final_opreturn (script_length: number, chunk_data_length: number) {
        if (chunk_data_length === 0) {
            return true;
        }

        let op_return_capacity = 223 - script_length;
        if (op_return_capacity >= chunk_data_length) {
            return true;
        }

        return false;
    }

    parsebfpDataOpReturn(hex: string) {
        const decodedScript: any = Script.fromHex(hex);
        let bfpData: any = {}
        bfpData.type = 'metadata'
        let script = [];
        for (var i = 0; i < decodedScript.chunks.length; i++) {
            let chunk = decodedScript.chunks[i];
            script.push(decodedScript._chunkToString(chunk, 'asm').slice(1));
        }

        if(script.length == 2) {
            bfpData.type = 'chunk';
            try {
                bfpData.chunk = Buffer.from(script[1], 'hex');
            } catch(e) {
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
        if ((script[2] != 'OP_1') && (script[2] != '01')) {
            throw new Error('Not a BFP file (type 0x01)');
        }

        // chunk count
        bfpData.chunk_count = parseInt(script[3], 16);
        if(script[3].includes('OP_')){
            let val = script[3].replace('OP_', '');
            bfpData.chunk_count = parseInt(val);
        }

        // filename
        if(script[4] == 'OP_0'){
            bfpData.filename = null
        } else {
            bfpData.filename = Buffer.from(script[4], 'hex').toString('utf8');
        }

        // fileext
        if(script[5] == 'OP_0'){
            bfpData.fileext = null
        } else {
            bfpData.fileext = Buffer.from(script[5], 'hex').toString('utf8');
        }

        // filesize
        if(script[6] == 'OP_0'){
            bfpData.filesize = null
        } else {
            bfpData.filesize = parseInt(script[6], 16);
        }

        // file_sha256
        if(script[7] == 'OP_0'){
            bfpData.sha256 = null
        } else {
            bfpData.sha256 = Buffer.from(script[7], 'hex');
        }

        // prev_file_sha256
        if(script[8] == 'OP_0'){
            bfpData.prevsha256 = null
        } else {
            bfpData.prevsha256 = Buffer.from(script[8], 'hex');
        }

        // uri
        if(script[9] == 'OP_0'){
            bfpData.uri = null
        } else {
            bfpData.uri = Buffer.from(script[9], 'hex').toString('utf8');
        }

        // chunk_data
        if(script[10] == 'OP_0'){
            bfpData.chunk = null
        } else {
            try {
                bfpData.chunk = Buffer.from(script[10], 'hex');
            } catch(e) {
                bfpData.chunk = null
            }
        }

        return bfpData;
    }
}
