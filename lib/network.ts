import { Client } from 'grpc-bchrpc-web';
import { BITBOX } from 'bitbox-sdk';
import { AddressUtxoResult } from 'bitcoin-com-rest';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export class BfpNetwork {
    BITBOX: BITBOX;
    stopPayMonitor: boolean;
    isMonitoringPayment: boolean;
    client: Client;
    constructor(BITBOX: BITBOX, grpcUrl="https://bchd.greyh.at:8335") {
        this.BITBOX = BITBOX;
        this.stopPayMonitor = false;
        this.isMonitoringPayment = false;
        if(grpcUrl)
            this.client = new Client(grpcUrl)
        else
            this.client = new Client()
    }

    async getLastUtxoWithRetry(address: string, retries = 40) {
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

    async getTransactionDetailsWithRetry(txid: string, retries = 40){
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

    async getLastUtxo(address: string) {
        // must be a cash or legacy addr
        if(!this.BITBOX.Address.isCashAddress(address) && !this.BITBOX.Address.isLegacyAddress(address))
            throw new Error("Not an a valid address format, must be cashAddr or Legacy address format.");
        let res = (<AddressUtxoResult[]>await this.BITBOX.Address.utxo([ address ]))[0];
        if(res && res.utxos && res.utxos.length > 0)
            return res.utxos[0];
        return res;
    }

    async sendTx(hex: string, log=true) {
        let res = await this.BITBOX.RawTransactions.sendRawTransaction(hex);
        if(res && res.error)
            return undefined;
        if(res === "64: too-long-mempool-chain")
            throw new Error("Mempool chain too long");
        if(log)
            console.log('sendTx() res: ', res);
        return res;
    }

    async sendTxWithRetry(hex: string, retries = 40) {
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

    async monitorForPayment(paymentAddress: string, fee: number, onPaymentCB: Function) {
        if(this.isMonitoringPayment || this.stopPayMonitor)
            return;

        this.isMonitoringPayment = true;

        // must be a cash or legacy addr
        if(!this.BITBOX.Address.isCashAddress(paymentAddress) && !this.BITBOX.Address.isLegacyAddress(paymentAddress))
            throw new Error("Not an a valid address format, must be cashAddr or Legacy address format.");

        while (true) {
            try {
                var utxo = <{
                    txid: string;
                    vout: number;
                    amount: number;
                    satoshis: number;
                    height: number;
                    confirmations: number;
                }> await this.getLastUtxo(paymentAddress);
                if (utxo && utxo && utxo.satoshis >= fee && utxo.confirmations === 0) {
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