const assert = require('assert');
const bitcoinfiles = require('../index.js');
const bfp = bitcoinfiles.bfp;
describe('bitcoinfiles', function(){
    describe('file upload cost estimates', function(){
        it('estimates fee for multi-chunk outside of metadata chunk', function(){
            let config = {
                msgType: 1,
                chunkCount: 2,
                fileName: 'token-document',
                fileExt: '.json',
                fileSize: 378,
                fileSha256Hex: '9900c8f6b6ba545b9b7cf0953765dca2d9e7fb378e664b3791401b8c2f4d8420',
                prevFileSha256Hex: null,
                fileUri: null,
                chunkData: null
            }

            // estimate fee for file
            let cost = bfp.calculateFileUploadCost(378, config);
            assert.equal(cost, 1615)
        });
        it('estimates fee for single chunk in metadata', function(){

        });
        it('estimates fee for single chunk outside of metadata', function(){

        });
        it('estimates fee for multi-chunk including metadata chunk', function(){

        });
    });
    describe('file downloads', function(){
        it('downloads a file and checks file sha256 against metadata', async function(){
            this.timeout(15000);
            // download mario.png with size of 1723
            let res = await bfp.downloadFile('bitcoinfile:7e4600323c934926369c136562f5483e3df79baf087c8dd2b0ed1aea69d5ee49');
            
            assert.equal(res.file.length, 1723);
            assert.equal(res.passesHashCheck, true);
        });
        it('downloads a file and fails hash check, wrong hash', async function(){

        });
        it('downloads a file and fails hash check, hash left empty', async function(){

        });
    });
});