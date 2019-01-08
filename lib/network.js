const BITBOXSDK = require('bitbox-sdk/lib/bitbox-sdk').default
 
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

class BfpNetwork {
    constructor(network = 'mainnet') {
        if(network === 'mainnet')
            this.BITBOX = new BITBOXSDK({ restURL: 'https://rest.bitcoin.com/v1/' })
        else
            this.BITBOX = new BITBOXSDK({ restURL: 'https://trest.bitcoin.com/v1/' })

        this.stopPayMonitor = false;
        this.isMonitoringPayment = false;
    }

    async getLastUtxoWithRetry(address, retries = 40) {
		let result;
		let count = 0;
		while(result == undefined){
            result = await this.getLastUtxo(address)
            console.log(result);
			count++;
			if(count > retries)
				throw new Error("BITBOX.Address.utxo endpoint experienced a problem");
			await sleep(250);
		}
		return result;
    }

    async getTransactionDetailsWithRetry(txid, retries = 40){
        let result;
        let count = 0;
        while(result == undefined){
            result = await this.BITBOX.Transaction.details(txid);
            count++;
            if(count > retries)
                throw new Error("BITBOX.Address.details endpoint experienced a problem");

            await sleep(250);
        }
        return result; 
    }

    async getLastUtxo(address, log=true) {
        // must be a cash or legacy addr
        if(!this.BITBOX.Address.isCashAddress(address) && !this.BITBOX.Address.isLegacyAddress(address))
            throw new Error("Not an a valid address format, must be cashAddr or Legacy address format.");
        let res = await this.BITBOX.Address.utxo(address);
        if(log)
            console.log('getLastUtxo for ', address, ': ', res);
        return res[0];
    }

    async sendTx(hex, log=true) {
        let res = await this.BITBOX.RawTransactions.sendRawTransaction(hex);
        if(res === "64: too-long-mempool-chain")
            throw new Error("Mempool chain too long");
        if(log)
            console.log('sendTx() res: ', res);
        return res;
    }

    async sendTxWithRetry(hex, retries = 40) {
        let res;
        let count = 0;
        while(res === undefined || res.length != 64) {
            res = await this.sendTx(hex);
            count++;
            if(count > retries)
                break;
            await sleep(250);
        }

        if(res.length != 64)
            throw new Error("BITBOX network error");
        
        return res;
    }

    async monitorForPayment(paymentAddress, fee, onPaymentCB) {
        if(this.isMonitoringPayment || this.stopPayMonitor)
            return;

        this.isMonitoringPayment = true;

        // must be a cash or legacy addr
        if(!this.BITBOX.Address.isCashAddress(paymentAddress) && !this.BITBOX.Address.isLegacyAddress(paymentAddress))
            throw new Error("Not an a valid address format, must be cashAddr or Legacy address format.");

        while (true) {
            try {
                var utxo = await this.getLastUtxo(paymentAddress);
                if (utxo && utxo.satoshis >= fee && utxo.confirmations === 0) {
                    break;
                }
            } catch (ex) {
                console.log('monitorForPayment() error: ', ex);
            }

            if(this.stopPayMonitor) {
                this.isMonitoringPayment = false;
                return;
            }

            await sleep(2000);
        }

        this.isMonitoringPayment = false;
        onPaymentCB(utxo);
    }
}

module.exports = BfpNetwork;