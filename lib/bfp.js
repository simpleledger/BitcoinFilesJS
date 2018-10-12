let utils = require('./utils');
let network = require('./network');

const BITBOXCli = require('bitbox-cli/lib/bitbox-cli').default
    , BITBOX = new BITBOXCli()

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

class Bfp {

    static get lokadIdHex() { return "42465000" }

    static async uploadFile(fundingUtxo,                // object in form: { txid:'', satoshis:#, vout:# }
                            fundingAddress,             // string
                            fundingWif,                 // hex string?
                            fileDataArrayBuffer,        // ArrayBuffer
                            fileName=null,              // string
                            fileExt=null,               // string
                            prevFileSha256Hex=null,     // hex string
                            fileExternalUri=null,       // utf8 string
                            fileReceiverAddress=null,   // string
                            signProgressCallback=null, signFinishedCallback=null, 
                            uploadProgressCallback=null, uploadFinishedCallback=null) {

        let fileSize = fileDataArrayBuffer.byteLength;
        let hash = BITBOX.Crypto.sha256(new Buffer(fileDataArrayBuffer)).toString('hex');
        
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
        let configEmptyMetaOpReturn = {
            msgType: 1,
            chunkCount: chunkCount,
            fileName: fileName,
            fileExt: fileExt,
            fileSize: fileSize,
            fileSha256Hex: hash,
            prevFileSha256Hex: prevFileSha256Hex,
            fileUri: fileExternalUri,
            chunkData: null
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
                txid = transactions[nId - 1].getId();
                satoshis = transactions[nId - 1].outs[1].value;
            }

            // build chunk data transaction
            let configChunkTx = {
                bfpChunkOpReturn: chunkOpReturn,
                input_utxo: {
                    address: fundingAddress,
                    txid: txid,
                    vout: vout,
                    satoshis: satoshis,
                    wif: fundingWif
                }
            };

            let chunksTx = Bfp.buildChunkTx(configChunkTx);

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
                        fileUri: '',
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
                            wif: fundingWif
                        },
                        fileReceiverAddress: fileReceiverAddress != null ? fileReceiverAddress : fundingAddress
                    };
                    let metaTx = Bfp.buildMetadataTx(configMetaTx);
                    transactions.push(metaTx);
                } else {
                    // finish with both chunk txn and then final empty metadata txn
                    transactions.push(chunksTx);

                    let metaOpReturn = Bfp.buildMetadataOpReturn(configEmptyMetaOpReturn);

                    // build meta data transaction
                    let configMetaTx = {
                        bfpMetadataOpReturn: metaOpReturn,
                        input_utxo: {
                            txid: chunksTx.getId(),
                            vout: vout,
                            satoshis: chunksTx.outs[1].value,
                            wif: fundingWif
                        },
                        fileReceiverAddress: fileReceiverAddress != null ? fileReceiverAddress : fundingAddress
                    };
                    let metaTx = Bfp.buildMetadataTx(configMetaTx);
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
        for (let nId = 0; nId < transactions.length; nId++) {
            console.log(transactions[nId].toHex());
            var bfTxId = await network.sendTx(transactions[nId].toHex());
            // progress
            if(uploadProgressCallback != null){
                uploadProgressCallback(nCurPos);
            }
            nCurPos += nDiff;

            // delay between transactions
            await sleep(500);
        }

        bfTxId = 'bitcoinfile:' + bfTxId;
        if(uploadFinishedCallback != null){
            uploadFinishedCallback(bfTxId);
        }

        return bfTxId;
    }

    static async downloadFile(bfpUri, progressCallback=null) {
        let chunks = [];
        let size = 0;

        let txid = bfpUri.replace('bitcoinfile:', '')
        txid = txid.replace('bitcoinfiles:', '')

        let txn = await network.getTransactionDetailsWithRetry(txid);

        let metadata_opreturn_hex = txn.vout[0].scriptPubKey.hex;
        let bfpMsg = Bfp.parsebfpDataOpReturn(metadata_opreturn_hex);

        let downloadCount = bfpMsg.chunk_count;
        if(bfpMsg.chunk_count > 0 && bfpMsg.chunk != null) {
            downloadCount = bfpMsg.chunk_count - 1;
            chunks.push(bfpMsg.chunk)
            size += bfpMsg.chunk.length;
        }

        let prevTxid = txn.vin[0].txid;

        // Loop through raw transactions, parse out data
        for (let index = 0; index < downloadCount; index++) {

            // download prev txn
            let txn = await network.getTransactionDetailsWithRetry(prevTxid)
            prevTxid = txn.vin[0].txid;

            // parse vout 0 for data, push onto chunks array
            let op_return_hex = txn.vout[0].scriptPubKey.hex;
            let bfpMsg = Bfp.parsebfpDataOpReturn(op_return_hex);
            chunks.push(bfpMsg.chunk);
            size += bfpMsg.chunk.length;

            if(progressCallback != null) {
                progressCallback(index/(downloadCount-1));
            }
        }

        // reverse order of chunks
        chunks = chunks.reverse()
        let fileBuf = new Buffer(size);
        let index = 0;
        chunks.forEach(chunk => {
            chunk.copy(fileBuf, index)
            index += chunk.length;
        });

        // TODO: check that metadata hash matches if one was provided.
        let passesHashCheck = false
        if(bfpMsg.sha256 != null){
            let fileSha256 = BITBOX.Crypto.sha256(fileBuf);
            let res = Buffer.compare(fileSha256, bfpMsg.sha256);
            if(res == 0){
                passesHashCheck = true;
            }
        }

        return { passesHashCheck, fileBuf };
    }

    static buildMetadataOpReturn(config) {

        let script = [];

        // OP Return Prefix
        script.push(0x6a);

        // Lokad Id
        let lokadId = Buffer.from(this.lokadIdHex, 'hex');
        script.push(utils.getPushDataOpcode(lokadId));
        lokadId.forEach((item) => script.push(item));

        // Message Type
        script.push(utils.getPushDataOpcode([config.msgType]));
        script.push(config.msgType);

        // Chunk Count
        let chunkCount = utils.int2FixedBuffer(config.chunkCount, 1)
        script.push(utils.getPushDataOpcode(chunkCount))
        chunkCount.forEach((item) => script.push(item))

        // File Name
        if (config.fileName == null || config.fileName.length === 0 || config.fileName == '') {
            [0x4c, 0x00].forEach((item) => script.push(item));
        } else {
            let fileName = Buffer.from(config.fileName, 'utf8')
            script.push(utils.getPushDataOpcode(fileName));
            fileName.forEach((item) => script.push(item));
        }

        // File Ext
        if (config.fileExt == null || config.fileExt.length === 0 || config.fileExt == '') {
            [0x4c, 0x00].forEach((item) => script.push(item));
        } else {
            let fileExt = Buffer.from(config.fileExt, 'utf8');
            script.push(utils.getPushDataOpcode(fileExt));
            fileExt.forEach((item) => script.push(item));
        }

        let fileSize = utils.int2FixedBuffer(config.fileSize, 2)
        script.push(utils.getPushDataOpcode(fileSize))
        fileSize.forEach((item) => script.push(item))

        // File SHA256
        var re = /^[0-9a-fA-F]+$/;
        if (config.fileSha256Hex == null || config.fileSha256Hex.length === 0 || config.fileSha256Hex == '') {
            [0x4c, 0x00].forEach((item) => script.push(item));
        } else if (config.fileSha256Hex.length === 64 && re.test(config.fileSha256Hex)) {
            let fileSha256Buf = Buffer.from(config.fileSha256Hex, 'hex');
            script.push(utils.getPushDataOpcode(fileSha256Buf));
            fileSha256Buf.forEach((item) => script.push(item));
        } else {
            throw Error("File hash must be provided as a 64 character hex string");
        }

        // Previous File Version SHA256
        if (config.prevFileSha256Hex == null || config.prevFileSha256Hex.length === 0 || config.prevFileSha256Hex == '') {
            [0x4c, 0x00].forEach((item) => script.push(item));
        } else if (config.prevFileSha256Hex.length === 64 && re.test(config.prevFileSha256Hex)) {
            let prevFileSha256Buf = Buffer.from(config.prevFileSha256Hex, 'hex');
            script.push(utils.getPushDataOpcode(prevFileSha256Buf));
            prevFileSha256Buf.forEach((item) => script.push(item));
        } else {
            throw Error("Previous File hash must be provided as a 64 character hex string")
        }

        // File URI
        if (config.fileUri == null || config.fileUri.length === 0 || config.fileUri == '') {
            [0x4c, 0x00].forEach((item) => script.push(item));
        } else {
            let fileUri = Buffer.from(config.fileUri, 'utf8');
            script.push(utils.getPushDataOpcode(fileUri));
            fileUri.forEach((item) => script.push(item));
        }

        // Chunk Data
        if (config.chunkData == null || config.chunkData.length === 0) {
            [0x4c, 0x00].forEach((item) => script.push(item));
        } else {
            let chunkData = Buffer.from(config.chunkData);
            script.push(utils.getPushDataOpcode(chunkData));
            chunkData.forEach((item) => script.push(item));
        }

        // console.log(script);
        let encodedScript = utils.encodeScript(script);

        if (encodedScript.length > 223) {
            throw Error("Script too long, must be less than 223 bytes.")
        }

        return encodedScript;
    }

    static buildDataChunkOpReturn(chunkData) {
        let script = []

        // OP Return Prefix
        script.push(0x6a)

        // Chunk Data
        if (chunkData === undefined || chunkData === null || chunkData.length === 0) {
            [0x4c, 0x00].forEach((item) => script.push(item));
        } else {
            let chunkDataBuf = Buffer.from(chunkData);
            script.push(utils.getPushDataOpcode(chunkDataBuf));
            chunkDataBuf.forEach((item) => script.push(item));
        }

        let encodedScript = utils.encodeScript(script);
        if (encodedScript.length > 223) {
            throw Error("Script too long, must be less than 223 bytes.");
        }
        return encodedScript;
    }

    // We may not need this function since the web browser wallet will be receiving funds in a single txn.
    static buildFundingTx(config) {
        // Example config:
        // let config = {
        //     outputAddress: this.bfpAddress,
        //     fundingAmountSatoshis: ____,
        //     input_utxos: [{
        //          txid: utxo.txid,
        //          vout: utxo.vout,
        //          satoshis: utxo.satoshis,
        //          wif: wif
        //     }]
        //   }

        let transactionBuilder = new BITBOX.TransactionBuilder('bitcoincash');
        let satoshis = 0;
        config.input_utxos.forEach(token_utxo => {
            transactionBuilder.addInput(token_utxo.txid, token_utxo.vout);
            satoshis += token_utxo.satoshis;
        });

        let fundingMinerFee = BITBOX.BitcoinCash.getByteCount({ P2PKH: config.input_utxos.length }, { P2PKH: 1 })
        let outputAmount = satoshis - fundingMinerFee;

        //assert config.fundingAmountSatoshis == outputAmount //TODO: Use JS syntax and throw on error

        // Output exact funding amount
        transactionBuilder.addOutput(config.outputAddress, outputAmount);

        // sign inputs
        let i = 0;
        for (const txo of config.input_utxos) {
            let paymentKeyPair = BITBOX.ECPair.fromWIF(txo.wif);
            transactionBuilder.sign(i, paymentKeyPair, null, transactionBuilder.hashTypes.SIGHASH_ALL, txo.satoshis);
            i++;
        }

        return transactionBuilder.build();
    }

    static buildChunkTx(config) {
        // Example config: 
        // let config = {
        //     bfpChunkOpReturn: chunkOpReturn,
        //     input_utxo: {
        //          address: utxo.address??
        //          txid: utxo.txid,
        //          vout: utxo.vout,
        //          satoshis: utxo.satoshis,
        //          wif: wif
        //     }
        //   }

        let transactionBuilder = new BITBOX.TransactionBuilder('bitcoincash');
        transactionBuilder.addInput(config.input_utxo.txid, config.input_utxo.vout);

        let chunkTxFee = this.calculateDataChunkMinerFee(config.bfpChunkOpReturn.length);
        let outputAmount = config.input_utxo.satoshis - chunkTxFee;

        // Chunk OpReturn
        transactionBuilder.addOutput(config.bfpChunkOpReturn, 0);

        // Genesis token mint
        transactionBuilder.addOutput(config.input_utxo.address, outputAmount);

        // sign inputs

        let paymentKeyPair = BITBOX.ECPair.fromWIF(config.input_utxo.wif);
        transactionBuilder.sign(0, paymentKeyPair, null, transactionBuilder.hashTypes.SIGHASH_ALL, config.input_utxo.satoshis);

        return transactionBuilder.build();
    }

    static buildMetadataTx(config) {
        // Example config: 
        // let config = {
        //     bfpMetadataOpReturn: metadataOpReturn,
        //     input_utxo:
        //       {
        //         txid: previousChunkTxid,
        //         vout: 1,
        //         satoshis: previousChunkTxData.satoshis,
        //         wif: fundingWif 
        //       },
        //     fileReceiverAddress: outputAddress
        //   }      
        let transactionBuilder = new BITBOX.TransactionBuilder('bitcoincash');
        let inputSatoshis = 0;

        transactionBuilder.addInput(config.input_utxo.txid, config.input_utxo.vout);
        inputSatoshis += config.input_utxo.satoshis;


        let metadataFee = this.calculateMetadataMinerFee(config.bfpMetadataOpReturn.length); //TODO: create method for calculating miner fee
        let output = inputSatoshis - metadataFee;

        // Metadata OpReturn
        transactionBuilder.addOutput(config.bfpMetadataOpReturn, 0);

        // outputs
        let outputAddress = BITBOX.Address.toCashAddress(config.fileReceiverAddress);
        transactionBuilder.addOutput(outputAddress, output);

        // sign inputs
        let paymentKeyPair = BITBOX.ECPair.fromWIF(config.input_utxo.wif);
        transactionBuilder.sign(0, paymentKeyPair, null, transactionBuilder.hashTypes.SIGHASH_ALL, config.input_utxo.satoshis);

        return transactionBuilder.build();
    }

    static calculateMetadataMinerFee(genesisOpReturnLength, feeRate = 1) {
        let fee = BITBOX.BitcoinCash.getByteCount({ P2PKH: 1 }, { P2PKH: 1 })
        fee += genesisOpReturnLength
        fee += 10 // added to account for OP_RETURN ammount of 0000000000000000
        fee *= feeRate
        return fee
    }

    static calculateDataChunkMinerFee(sendOpReturnLength, feeRate = 1) {
        let fee = BITBOX.BitcoinCash.getByteCount({ P2PKH: 1 }, { P2PKH: 1 })
        fee += sendOpReturnLength
        fee += 10 // added to account for OP_RETURN ammount of 0000000000000000
        fee *= feeRate
        return fee
    }

    static calculateFileUploadCost(fileSizeBytes, configMetadataOpReturn, fee_rate = 1){
        let byte_count = fileSizeBytes;
        let whole_chunks_count = Math.floor(fileSizeBytes / 220);
        let last_chunk_size = fileSizeBytes % 220;

        // cost of final transaction's op_return w/o any chunkdata
        let final_op_return_no_chunk = this.buildMetadataOpReturn(configMetadataOpReturn);
        byte_count += final_op_return_no_chunk.length;

        // cost of final transaction's input/outputs
        byte_count += 35;
        byte_count += 148 + 1;

        // cost of chunk trasnsaction op_returns
        byte_count += (whole_chunks_count + 1) * 3;

        if (!this.chunk_can_fit_in_final_opreturn(final_op_return_no_chunk.length, last_chunk_size))
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

    static chunk_can_fit_in_final_opreturn (script_length, chunk_data_length) {
        if (chunk_data_length === 0) {
            return true;
        }

        let op_return_capacity = 223 - script_length;
        if (op_return_capacity >= chunk_data_length) {
            return true;
        }

        return false;
    }

    static getFileUploadPaymentInfoFromHdNode(masterHdNode) {
        let hdNode = BITBOX.HDNode.derivePath(masterHdNode, "m/44'/145'/1'");
        let node0 = BITBOX.HDNode.derivePath(hdNode, '0/0');
        let keyPair = BITBOX.HDNode.toKeyPair(node0);
        let wif = BITBOX.ECPair.toWIF(keyPair);
        let ecPair = BITBOX.ECPair.fromWIF(wif);
        let address = BITBOX.ECPair.toLegacyAddress(ecPair);
        let cashAddress = BITBOX.Address.toCashAddress(address);

        return {address: cashAddress, wif: wif};
    }

    static getFileUploadPaymentInfoFromSeedPhrase(seedPhrase) {
        let phrase = seedPhrase;
        let seedBuffer = BITBOX.Mnemonic.toSeed(phrase);
        // create HDNode from seed buffer
        let hdNode = BITBOX.HDNode.fromSeed(seedBuffer);
        let hdNode2 = BITBOX.HDNode.derivePath(hdNode, "m/44'/145'/1'");
        let node0 = BITBOX.HDNode.derivePath(hdNode2, '0/0');
        let keyPair = BITBOX.HDNode.toKeyPair(node0);
        let wif = BITBOX.ECPair.toWIF(keyPair);
        let ecPair = BITBOX.ECPair.fromWIF(wif);
        let address = BITBOX.ECPair.toLegacyAddress(ecPair);
        let cashAddress = BITBOX.Address.toCashAddress(address);

        return {address: cashAddress, wif: wif};
    }

    static parsebfpDataOpReturn(hex) {
        const script = BITBOX.Script.toASM(Buffer.from(hex, 'hex')).split(' ');
        let bfpData = {}
        bfpData.type = 'metadata'

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

        if (script[1] !== this.lokadIdHex) {
            throw new Error('Not a BFP OP_RETURN');
        }

        // 01 = On-chain File
        if (script[2] != 'OP_1') { // NOTE: bitcoincashlib-js converts hex 01 to OP_1 due to BIP62.3 enforcement
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

module.exports = Bfp;