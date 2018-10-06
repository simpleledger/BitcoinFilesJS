const BITBOXCli = require('bitbox-cli/lib/bitbox-cli').default
    , BITBOX = new BITBOXCli()
 
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

class BfpNetwork {

    static async getTransactionDetailsWithRetry(txid, retries = 40){
        let result;
        let count = 0;
        while(result == undefined){
            result = await BITBOX.Transaction.details(txid);
            count++;
            if(count > retries)
                throw new Error("BITBOX.Address.details endpoint experienced a problem");

            await sleep(250);
        }
        return result; 
    }
}

module.exports = BfpNetwork;