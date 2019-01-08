const BITBOXSDK = require('bitbox-sdk/lib/bitbox-sdk').default
    , BITBOX = new BITBOXSDK()

let bfp = require('./lib/bfp');
let utils = require('./lib/utils');
let network = require('./lib/network');

module.exports = {
    bfp: bfp,
    utils: utils, 
    network: network,
    bitbox: BITBOX
}