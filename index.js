const BITBOXCli = require('bitbox-cli/lib/bitbox-cli').default
    , BITBOX = new BITBOXCli()

let bfp = require('./lib/bfp');
let utils = require('./lib/utils');
let network = require('./lib/network')

module.exports = {
    bfp: bfp,
    utils: utils, 
    network: network,
    bitbox: BITBOX
}