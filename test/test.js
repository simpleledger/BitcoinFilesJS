const assert = require('assert');
const bitcoinfiles = require('../index.js');
const downloadFile = bitcoinfiles.bfp.downloadFile;
describe('bitcoinfiles', function(){
    describe('download file', function(){
        it('downloads a valid file', async function(){
            this.timeout(15000);
            let buffer = await downloadFile('bitcoinfile:7e4600323c934926369c136562f5483e3df79baf087c8dd2b0ed1aea69d5ee49');
            assert.equal(buffer.length, 1723)
        });
    });
});