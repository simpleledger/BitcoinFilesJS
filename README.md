# bitcoinfilesjs

bitcoinfilesjs is a JavaScript Library for building transactions for Bitcoin Files Protocol (BFP).  Methods for uploading and downloading files are provided [per the BFP specification](https://github.com/simpleledger/slp-specification/blob/master/bitcoinfiles.md).  For convenience, BITBOX network functionality has been built into the library.

Other tools using the Bitcoin Files Protocol include:
* [Electron Cash SLP Edition](http://electroncash.org/#slp)
* [BitcoinFiles.com](http://bitcoinfiles.com)

[![NPM](https://nodei.co/npm/bitcoinfiles.png)](https://nodei.co/npm/bitcoinfiles/)

# Installation

#### For node.js
`npm install bitcoinfiles`

#### For browser
```<script src='https://unpkg.com/bitcoinfiles'></script>```
 

# Example File Dowload
```javascript
const bfp = require('bitcoinfiles').bfp;

// 1 - download file using URI
let result;
(async function(){
    result = await bfp.downloadFile('bitcoinfile:7e4600323c934926369c136562f5483e3df79baf087c8dd2b0ed1aea69d5ee49');
    console.log("download complete.");
})();

// Wait for download to complete -- Mario.png TAKES ABOUT 6 SEC TO DOWNLOAD!

// 2 - result includes a boolean check telling you if the file's sha256 matches the file's metadata```
if(result.passesHashCheck){
    console.log("Success: downloaded file sha256 matches file's metadata");
}

// 3 - do something with the file...
let fileBuffer = result.fileBuf;
```

# Example File Upload 
Below is a simple example.  For a more complete React.js [file upload example](https://github.com/simpleledger/SimpleToken.cash/blob/master/src/UploadDialog.js) visit [SimpleToken.cash website](https://simpletoken.cash)

```javascript
const bfp = require('bitcoinfiles').bfp;
const network = require('bitcoinfiles').network;
const BITBOX = require('bitcoinfiles').bitbox;

// 1 - get a file and file metadata somehow 
const someFileBuffer = new Buffer.from('aabbccddeeff', 'hex');
const fileName = 'a test file';
const fileExt = 'txt';
const fileSize = someFileBuffer.length
const fileSha256Hex = BITBOX.Crypto.sha256(someFileBuffer).toString('hex');

// 2 - estimate upload cost for funding the transaction
let config = {
    msgType: 1,
    chunkCount: 1,
    fileName: fileName,
    fileExt: fileExt,
    fileSize: fileSize,
    fileSha256Hex: fileSha256Hex,
    prevFileSha256Hex: null,
    fileUri: null,
    chunkData: null  // chunk not needed for cost estimate stage
};
let uploadCost = bfp.calculateFileUploadCost(fileSize, config);
console.log(uploadCost);

// 3 - create a funding transaction
let fundingAddress = 'bitcoincash:qqgvrkm0xpmwqgyhfm65qxv70tjtwma6lgk07ffv9u'
let fundingWif = 'KzcuA9xnDRrb9cPh29N7EQbBhQQLMWtcrDwKbEMoahmwBNACNRfa'

// 4 - Make sure address above is funded with the amount equal to the uploadCost
let fundingUtxo;
(async function(){
    let txos = await network.getUtxoWithRetry(fundingAddress);
    fundingUtxo = txos[txos.length-1]; // UTXOs are sorted small to large, so grab biggest one to be conservative.
    console.log('got funding Utxo.')
})();

// wait for network to resolve...

// 5 - upload the file
let fileId;
(async function(){
 fileId = await bfp.uploadFile(fundingUtxo, fundingAddress, fundingWif, someFileBuffer, fileName, fileExt);
 console.log(fileId);
})(); 

// wait for upload to complete resolve... Done.

```