# BitcoinFilesJS

This is a JavaScript Library for uploading and downloading files per the Bitcoin Files Protocol [specification](https://github.com/simpleledger/slp-specification/blob/master/bitcoinfiles.md) to the Bitcoin Cash blockchain.  It's important to understand that files uploaded to any blockchain are permanent and cannot be deleted.  All uploaded content is associated with the public key(s) you use to pay for uploading the content.

Other tools using the Bitcoin Files Protocol include:
* [Electron Cash SLP Edition](https://electroncash.org/#slp)

[![NPM](https://nodei.co/npm/bitcoinfiles.png)](https://nodei.co/npm/bitcoinfiles/)

# Installation (0.6.0+)

#### For node.js
`npm install bitcoinfiles`

#### For browser
`<script src='https://unpkg.com/bitcoinfiles'></script>`

# Example File Download
```javascript
const Grpc = require('grpc-bchrpc-node'); // or window.bchrpc
const Bfp = require('bitcoinfiles').Bfp;  // or window.bitcoinfiles.Bfp
const grpc = new Grpc.GrpcClient;
const bfp = new Bfp(grpc);

// 1 - download file using URI
let result;
(async function() {
    result = await bfp.downloadFile('bitcoinfile:7e4600323c934926369c136562f5483e3df79baf087c8dd2b0ed1aea69d5ee49');

    // Wait for download to complete -- Mario.png TAKES ABOUT 6 SEC TO DOWNLOAD!
    console.log("download complete.");

    // 2 - result includes a boolean check telling you if the file's sha256 matches the file's metadata
    if (result.passesHashCheck) {
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
const Utils = require('bitcoinfiles').Utils;
const grpc = new Grpc.GrpcClient;
const bfp = new Bfp(grpc);


// 1 - get a file and file metadata somehow
const someFileBuffer = Buffer.from('aabbccddeeff', 'hex');
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

// 4 - Make sure address above is funded with at least uploadCost
let fundingUtxo = {
    "txid": "85c1b22c116b44539ead07353c509502b46106344bb5b4bd46a880ba8a530c27",
    "satoshis": 12000,
    "vout": 3
};

// wait for network to resolve...

// 5 - upload the file
let fileId;
(async function() {
    fileId = await bfp.uploadFile(fundingUtxo, fundingAddress, fundingWif, someFileBuffer, fileName, fileExt);
    console.log('fileId: ', fileId);
})();

// wait for upload to complete resolve... Done.

```

# Documentation

```typescript
async uploadFile(
    fundingUtxo: utxo,
    fundingAddress: string,
    fundingWif: string,
    fileDataArrayBuffer: Buffer,
    fileName?: string,
    fileExt?: string,
    prevFileSha256Hex?: string,
    fileExternalUri?: string,
    fileReceiverAddress?: string,
    signProgressCallback?: Function,
    signFinishedCallback?: Function,
    uploadProgressCallback?: Function,
    uploadFinishedCallback?: Function,
    delay_ms = 500,
    uploadMethod = 1): Promise<string>;
```

`uploadFile` is the method used to a upload file

Mandatory parameters:
- `fundingUtxo` is the utxo to fund the uploading transaction(s). It must have a value no less than calculated by `calculateFileUploadCost`
- `fundingAddress` is the address to which belongs the utxo
- `fundingWif` is the private key which unlocks the funding address in Wallet Import Format
- `fileDataArrayBuffer` is the data to be uploaded, which may be a NodeJS `Buffer` or a browser `ArrayBuffer`; see bottom for notes about `ArrayBuffer` usage

Optional parameters:
- `fileName` is the file name
- `fileExt` is the file extension
- `prevFileSha256Hex` is a reference to the previous file
- `fileExternalUri` is a URI for the file
- `fileReceiverAddress` is a recipient address for the last uploading transaction, to be used instead of fundingAddress
- `signProgressCallback`, `signFinishedCallback`, `uploadProgressCallback`, `uploadFinishedCallback` are callback functions for upload progress updates
- `delay_ms` is the delay between uploading consecutive transactions
- `uploadMethod` refers to the upload protocol: `1` for small data pushes and backwards compatibility, `2` for 0.6.0+ compatible more efficient data pushes intended for larger files

Returns the `fileId`, which contains a prefix (`bitcoinfile:`) and the TXID

---

```typescript
async downloadFile(
    bfpUri: string,
    progressCallback?: Function): Promise<{
        passesHashCheck: boolean;
        fileBuf: Buffer;
}>;
```

`downloadFile` is the method used to download a file

- `bfpUri` may be the TXID of the metadata-containing transaction, or the TXID prepended with `bitcoinfile:` or `bitcoinfiles:`
- `progressCallback` is an optional download progress callback function

Returns an object with `passesHashCheck` which determines if downloading was sucessful and `fileBuf` which has the file contents; see bottom for notes about `ArrayBuffer` usage

---

```typescript
static calculateFileUploadCost(
    fileSizeBytes: number,
    configMetadataOpReturn: FileMetadata,
    fee_rate?: number,
    uploadMethod?: number): number;
```

Mandatory parameters:
`fileSizeBytes` is the length of file contents in terms of octets
`configMetadataOpReturn` is the metadata that would be uploaded with the file

Optional parameters:
`fee_rate` is the fee rate in satoshis per byte
`uploadMethod` is the upload protocol; see `uploadFile` documentation for details

## Types

```
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
```

- `msgType` is a synonym of `uploadMethod`, which is described in `uploadFile` documentation
- `chunkCount` is a placeholder that can be set as `1`
- `chunkData` is a placeholder that can be set as `null`

The other values can be set as described earlier

---

```
export interface utxo {
    txid: string;
    vout: number;
    satoshis: number;
}
```

The fields that should be set are shown above for an unspent output

---

`Buffer`: This may be a NodeJS buffer or an ArrayBuffer. For use in a browser,
it is suggested that an `ArrayBuffer` of `Uint8Array` should be used.

For a variable `fileContents` of type `Uint8Array`, the `ArrayBuffer` can be accessed
as `fileContents.buffer`. However, this might not always work, for example if `.subarray(...)`
was applied to `fileContents` before `.buffer`. In this case, the approach [here](https://stackoverflow.com/a/54646864) can be taken.
