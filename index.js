const BITBOXCli = require('bitbox-cli/lib/bitbox-cli').default
    , BITBOX = new BITBOXCli()

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