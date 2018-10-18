const BITBOXSDK = require('bitbox-sdk/lib/bitbox-sdk').default
    , BITBOX = new BITBOXSDK()

let bfp = require('./lib/bfp');
let utils = require('./lib/utils');
let network = require('./lib/network');
let bitdb = require('./lib/bitdb');

module.exports = {
    bfp: bfp,
    utils: utils, 
    network: network,
    bitdb: bitdb,
    bitbox: BITBOX
}