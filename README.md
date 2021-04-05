# bitcoinfilesjs

bitcoinfilesjs is a JavaScript Library for building transactions for Bitcoin Files Protocol (BFP).  Methods for uploading and downloading files are provided [per the BFP specification](https://github.com/simpleledger/slp-specification/blob/master/bitcoinfiles.md).

Other tools using the Bitcoin Files Protocol include:
* [Electron Cash SLP Edition](http://electroncash.org/#slp)
* [BitcoinFiles.com](http://bitcoinfiles.com)

[![NPM](https://nodei.co/npm/bitcoinfiles.png)](https://nodei.co/npm/bitcoinfiles/)

# Installation (0.6.0+)

#### For node.js
`npm install bitcoinfiles`

#### For browser
```<script src='https://unpkg.com/bitcoinfiles'></script>```
 

# Example File Download
```javascript
const Grpc = require('grpc-bchrpc-node'); // or window.bchrpc
const Bfp = require('bitcoinfiles').Bfp;  // or window.bitcoinfiles.Bfp
const grpc = new Grpc.GrpcClient;
const bfp = new Bfp(grpc);

// 1 - download file using URI
let result;
(async function(){
    result = await bfp.downloadFile('bitcoinfile:7e4600323c934926369c136562f5483e3df79baf087c8dd2b0ed1aea69d5ee49');

    // Wait for download to complete -- Mario.png TAKES ABOUT 6 SEC TO DOWNLOAD!
    console.log("download complete.");

    // 2 - result includes a boolean check telling you if the file's sha256 matches the file's metadata
    if(result.passesHashCheck){
        console.log("Success: downloaded file sha256 matches file's metadata");
    }

    // 3 - do something with the file...
    let fileBuffer = result.fileBuf;
})();


```

# Example File Upload 
Below is a simple example.  For a more complete React.js [file upload example](https://github.com/simpleledger/SimpleToken.cash/blob/master/src/UploadDialog.js) visit [SimpleToken.cash website](https://simpletoken.cash)

```javascript
const Grpc = require('grpc-bchrpc-node'); // or window's property equivalents
const Bfp = require('bitcoinfiles').Bfp;
const Utils = require('bitcoinfiles').Ufp;
const grpc = new Grpc.GrpcClient;
const bfp = new Bfp(grpc);


// 1 - get a file and file metadata somehow 
const someFileBuffer = new Buffer.from('aabbccddeeff', 'hex');
const fileName = 'a test file';
const fileExt = 'txt';
const fileSize = someFileBuffer.length
const fileSha256Hex = Utils.Sha256(someFileBuffer).toString('hex');

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
let uploadCost = Bfp.calculateFileUploadCost(fileSize, config);
console.log('upload cost: ', uploadCost);

// 3 - create a funding transaction
let fundingAddress = 'bitcoincash:qqgvrkm0xpmwqgyhfm65qxv70tjtwma6lgk07ffv9u'
let fundingWif = 'KzcuA9xnDRrb9cPh29N7EQbBhQQLMWtcrDwKbEMoahmwBNACNRfa'

// 4 - Make sure address above is funded with the amount equal to the uploadCost
let fundingUtxo = {
    "txid": "85c1b22c116b44539ead07353c509502b46106344bb5b4bd46a880ba8a530c27",
    "satoshis": 12000,
    "vout": 3
};

// wait for network to resolve...

// 5 - upload the file
let fileId;
(async function(){
    fileId = await bfp.uploadFile(fundingUtxo, fundingAddress, fundingWif, someFileBuffer, fileName, fileExt);
    console.log('fileId: ', fileId);
})(); 

// wait for upload to complete resolve... Done.

```
