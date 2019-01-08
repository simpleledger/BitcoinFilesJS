const axios = require('axios');

module.exports = class BfpBitdb {

    constructor(network) {
        this.bitDbUrl = network === 'mainnet' ? 'https://bitdb.bitcoin.com/q/' : 'https://tbitdb.bitcoin.com/q/';
    }

    async getFileMetadata(txid, apiKey=null) {

        txid = txid.replace('bitcoinfile:', '');
        txid = txid.replace('bitcoinfiles:', '');

        // if(!apiKey)
        //     throw new Error('Missing BitDB key');

        let query = {
            "v": 3,
            "q": {
              "find": { "tx.h": txid, "out.h1": "42465000", "out.h2": "01" }
            },
            "r": { "f": "[ .[] | { timestamp: (if .blk? then (.blk.t | strftime(\"%Y-%m-%d %H:%M\")) else null end), chunks: .out[0].h3, filename: .out[0].s4, fileext: .out[0].s5, size: .out[0].h6, sha256: .out[0].h7, prev_sha256: .out[0].h8, ext_uri: .out[0].s9, URI: \"bitcoinfile:\\(.tx.h)\" } ]" }
        };

        // example response format:
        // { filename: 'tes158',
        //   fileext: '.json',
        //   size: '017a',
        //   sha256: '018321383bf2672befe28629d1e159af812260268a8aa77bbd4ec27489d65b58',
        //   prev_sha256: '',
        //   ext_uri: '' }

        const json_str = JSON.stringify(query);
        const data = Buffer.from(json_str).toString('base64');
        const response = (await axios({
            method: 'GET',
            url: this.bitDbUrl + data,
            headers: null,
            // {
            //     'key': apiKey,
            // },
            json: true,
        })).data;
    
        if(response.status === 'error'){
            throw new Error(response.message || 'API error message missing');
        }

        const list = [];
        // c = confirmed
        if(response.c){
            list.push(...response.c);
        }
        // u = unconfirmed
        if(response.u){
            list.push(...response.u);
        }
        if(list.length === 0){
            throw new Error('File not found');
        }
        console.log('bitdb response: ', list[0]);
        return list[0];
    }
}
