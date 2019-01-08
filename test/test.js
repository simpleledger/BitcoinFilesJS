const BITBOXSDK = require('bitbox-sdk/lib/bitbox-sdk').default
    , BITBOX = new BITBOXSDK();

const assert = require('assert');
const bitcoinfiles = require('../index.js');
const Bfp = bitcoinfiles.bfp;
const Network = bitcoinfiles.network;

describe('bitcoinfiles', function(){
    describe('file downloads', function(){
        it('downloads a mainnet file and checks file sha256 against metadata', async function(){
            let fileId = '71c5d8cd7bb7f9f1524bfc29bb2c21aec5dbab362313ecc07e17285ddb2903a9';
            this.timeout(15000);
            
            // download a file check result
            let f = new Bfp();
            let res1 = await f.downloadFile(fileId);
            let res2 = await f.downloadFile('bitcoinfile:' + fileId);
            assert.equal(res1.fileBuf.length, 15);
            assert.equal(res1.passesHashCheck, true);
            assert.equal(res2.fileBuf.length, 15);
            assert.equal(res2.passesHashCheck, true);

            // cross check bitdb sha256 from metadata query
            let fileSha256 = BITBOX.Crypto.sha256(res1.fileBuf);
            let m1 = await f.bitdb.getFileMetadata(fileId);
            let m2 = await f.bitdb.getFileMetadata('bitcoinfile:' + fileId);
            assert.equal(m1.passesHashCheck, m2.passesHashCheck);
            let bufComp = Buffer.compare(fileSha256, new Buffer.from(m1.sha256, 'hex'));
            assert.equal(bufComp, 0);
        });
        it('downloads a testnet3 file and checks file sha256 against metadata', async function(){
            let fileId = '1616ff1c1e21e8824151d9a114949cdebe6a92619bdce68f8936fd117dc11051';
            this.timeout(15000);
            // download a file
            let f = new Bfp('testnet');
            let res1 = await f.downloadFile(fileId);
            let res2 = await f.downloadFile('bitcoinfile:' + fileId);
            assert.equal(res1.fileBuf.length, 15);
            assert.equal(res1.passesHashCheck, true);
            assert.equal(res2.fileBuf.length, 15);
            assert.equal(res2.passesHashCheck, true);

            let fileSha256 = BITBOX.Crypto.sha256(res1.fileBuf);
            let m1 = await f.bitdb.getFileMetadata(fileId);
            let m2 = await f.bitdb.getFileMetadata('bitcoinfile:' + fileId);
            assert.equal(m1.passesHashCheck, m2.passesHashCheck);
            let bufComp = Buffer.compare(fileSha256, new Buffer.from(m1.sha256, 'hex'));
            assert.equal(bufComp, 0);
        });
    });
    describe('BITBOX network responses', function(){
        it('gets first mainnet utxo from an address', async function(){
            let address = 'bitcoincash:qrqan3ky8wcnrpng7jrp7w9t9fjf8denpgd4kew06l';
            let network = new Network('mainnet');
            let utxo = await network.getLastUtxoWithRetry(address);
            assert.equal(utxo && utxo.satoshis >= 0, true);
        });
        it('gets first testnet3 utxo from an address', async function(){
            let address = 'bchtest:qp94fxw6ugxgytcqugcjcsncd7cth9ltyy7apq7z8t';
            let network = new Network('testnet');
            let utxo = await network.getLastUtxoWithRetry(address);
            assert.equal(utxo && utxo.satoshis >= 0, true);
        });
        it("Build OP_RETURN Script", function(){
            let configMetaOpReturn = {
                msgType: 1,
                chunkCount: 1,
                fileName: "test",
                fileExt: ".json",
                fileSize: 100,
                fileSha256Hex: "0011223344556677889900112233445566778899001122334455667788991111",
                prevFileSha256Hex: null,
                fileUri: null,
                chunkData: new Buffer.from("0011", 'hex')
            };
            let metaOpReturn = Bfp.buildMetadataOpReturn(configMetaOpReturn)
            console.log('metaOpReturn: ', metaOpReturn);
        });
    });
});
