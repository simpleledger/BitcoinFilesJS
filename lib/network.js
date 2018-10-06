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

    static async getUtxo(address) {
        // must be a cash or legacy addr
        if(!BITBOX.Address.isCashAddress(address) && !BITBOX.Address.isLegacyAddress(address))
            throw new Error("Not an a valid address format, must be cashAddr or Legacy address format.");
        let res = await BITBOX.Address.utxo(address);
        return res;
    }

    static async sendTx(hex) {
        let res = await BITBOX.RawTransactions.sendRawTransaction(hex);
        console.log(res);
        return res;
    }

    static async monitorForPayment(paymentAddress, fee, onPaymentCB) {
        // must be a cash or legacy addr
        if(!BITBOX.Address.isCashAddress(paymentAddress) && !BITBOX.Address.isLegacyAddress(paymentAddress))
            throw new Error("Not an a valid address format, must be cashAddr or Legacy address format.");

        while (true) {
            try {
                var utxo = (await BfpNetwork.getUtxo(paymentAddress))[0];
                if (utxo && utxo.satoshis >= fee) {
                    break;
                }
            } catch (ex) {
                console.log(ex);
            }
            await sleep(5000);
        }
        onPaymentCB(utxo);
    }

}

module.exports = BfpNetwork;