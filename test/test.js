const assert = require('assert');
const bitcoinfiles = require('../index.js');
const bfp = bitcoinfiles.bfp;
const bitboxnetwork = bitcoinfiles.network;

describe('bitcoinfiles', function(){
    describe('file downloads', function(){
        it('downloads a mainnet file and checks file sha256 against metadata', async function(){
            this.timeout(15000);
            // download mario.png with size of 1723
            let f = new bfp();
            let res = await f.downloadFile('bitcoinfile:71c5d8cd7bb7f9f1524bfc29bb2c21aec5dbab362313ecc07e17285ddb2903a9');
            
            assert.equal(res.fileBuf.length, 15);
            assert.equal(res.passesHashCheck, true);
        });
        it('downloads a testnet3 file and checks file sha256 against metadata', async function(){
            this.timeout(15000);
            // download mario.png with size of 1723
            let f = new bfp('testnet');
            let res = await f.downloadFile('bitcoinfile:1616ff1c1e21e8824151d9a114949cdebe6a92619bdce68f8936fd117dc11051');
            
            assert.equal(res.fileBuf.length, 15);
            assert.equal(res.passesHashCheck, true);
        });
    });
    describe('BITBOX network responses', function(){
        it('gets first mainnet utxo from an address', async function(){
            let address = 'bitcoincash:qrqan3ky8wcnrpng7jrp7w9t9fjf8denpgd4kew06l';
            let network = new bitboxnetwork('mainnet');
            let utxo = await network.getUtxo(address, false);
            assert.equal(utxo && utxo.satoshis >= 0, true);
        });
        it('gets first testnet3 utxo from an address', async function(){
            let address = 'bchtest:qp94fxw6ugxgytcqugcjcsncd7cth9ltyy7apq7z8t';
            let network = new bitboxnetwork('testnet');
            let utxo = await network.getUtxo(address, false);
            assert.equal(utxo && utxo.satoshis >= 0, true);
        });
    });
});
