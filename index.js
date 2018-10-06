const BITBOXCli = require('bitbox-cli/lib/bitbox-cli').default
    , BITBOX = new BITBOXCli()

let bfp = require('./lib/bfp').bfp;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

class BfpUtils {
    static async getTransactionDetailsWithRetry(txid, retries = 40){
        let result;
        let count = 0;
        while(result == undefined){
            result = await BITBOX.Transaction.details(txid);
            count++;
            if(count > retries)
                throw new Error("BITBOX.Address.details endpoint experienced a problem");

            await sleep(250);
        }
        return result; 
    }
}

async function downloadFile(bfpUri='', progressCallback=null) {
    let chunks = [];
    let size = 0;

    let txid = bfpUri.replace('bitcoinfile:', '')
    txid = txid.replace('bitcoinfiles:', '')

    let txn = await BfpUtils.getTransactionDetailsWithRetry(txid);

    let metadata_opreturn_hex = txn.vout[0].scriptPubKey.hex;
    let bfpMsg = BfpMessage.parsebfpDataOpReturn(metadata_opreturn_hex);

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
        let txn = await BfpUtils.getTransactionDetailsWithRetry(prevTxid)
        prevTxid = txn.vin[0].txid;

        // parse vout 0 for data, push onto chunks array
        let op_return_hex = txn.vout[0].scriptPubKey.hex;
        let bfpMsg = BfpMessage.parsebfpDataOpReturn(op_return_hex);
        chunks.push(bfpMsg.chunk);
        size += bfpMsg.chunk.length;
    }

    // reverse order of chunks
    chunks = chunks.reverse()
    let file = new Buffer(size);
    let index = 0;
    chunks.forEach(chunk => {
        chunk.copy(file, index)
        index += chunk.length;
    });

    // TODO: check that metadata hash matches if one was provided.
    return file;
}

class BfpMessage {

    static get lokadIdHex() { return "42465000" }

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


module.exports = {
    downloadFile: downloadFile,
    bfp: bfp
}