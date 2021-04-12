import { step } from "mocha-steps";
import * as assert from "assert";
import { GetAddressUnspentOutputsResponse, GetBlockchainInfoResponse, SlpAction, SlpTransactionInfo } from "grpc-bchrpc-node";
import { PrivateKey, Networks, Transaction, Script, Address } from "bitcore-lib-cash";
import * as bchaddrjs from "bchaddrjs-slp";
import { createGrpcClient, createRpcClient } from "../lib/utils";

import { Bfp, utxo } from "../../lib/bfp";
import fs from "fs";

// setup RPC clients (used primarily for generating blocks only)
const bchd1Grpc = createGrpcClient();
const bchd2Rpc = createRpcClient();

const bfp = new Bfp(bchd1Grpc);

// private key for the mining address (address is stored in bchd.conf)
//
// NOTE: bchd doesn't have generatetoaddress, only generate is available.
//
const privKey1 = new PrivateKey("cPgxbS8PaxXoU9qCn1AKqQzYwbRCpizbsG98xU2vZQzyZCJt4NjB", Networks.testnet);
const wallet1 = {
  _privKey: privKey1,
  address: privKey1.toAddress().toString(),
  bchRegtestAddress: bchaddrjs.toRegtestAddress(privKey1.toAddress().toString()),
  wif: privKey1.toWIF(),
  pubKey: privKey1.toPublicKey()
};

// private key for creating transactions (a small amount separate from the mining rewards)
const privKey2 = new PrivateKey(undefined);
const wallet2 = {
  _privKey: privKey2,
  address: privKey2.toAddress().toString(),
  bchRegtestAddress: bchaddrjs.toRegtestAddress(privKey2.toAddress().toString()),
  wif: privKey2.toWIF(),
  pubKey: privKey2.toPublicKey()
};

describe("Bitcoin File type 0x02", () => {
  step("bchd1 ready", async (): Promise<void> => {
    const info1 = await bchd1Grpc.getBlockchainInfo();
    assert.strictEqual(info1.getBitcoinNet(), GetBlockchainInfoResponse.BitcoinNet.REGTEST);
    // console.log(`bchd1 on block ${info1.getBestHeight()}`);

    const res = await bchd2Rpc.getPeerInfo();
    assert.strictEqual(typeof res, "object");
    assert.ok(res.length === 1);

    const info2 = await bchd2Rpc.getBlockchainInfo();
    // console.log(`bchd2 on block ${info2.blocks}`);

    assert.strictEqual(info1.getBestHeight(), info2.blocks);
  });

  let resBal: GetAddressUnspentOutputsResponse;
  step("generate block to address", async () => {

    // get balance for address
    resBal = await bchd1Grpc.getAddressUtxos({ address: wallet1.bchRegtestAddress, includeMempool: true });
    while (resBal.getOutputsList().length < 100) {
      await bchd2Rpc.generate(1);
      resBal = await bchd1Grpc.getAddressUtxos({ address: wallet1.bchRegtestAddress, includeMempool: true });
    }
    // console.log(`${resBal.getOutputsList().length} outputs (balance: ${resBal.getOutputsList().reduce((p,c,i) => p += c.getValue() / 10**8, 0)} TBCH)`);

    assert.ok(1);
  });

  // a variable to keep track of the last unspent bch outpoint in wallet2
  let prevOutBch: { txid: string, vout: number, satoshis: number };

  // send a small amount from mining rewards to wallet2 address
  step("send to wallet2", async () => {

    // grab the last unspent coin on the mining address (the aged coin)
    // NOTE: mined outputs require 100 block aging before they can be spent
    const output = resBal.getOutputsList()[resBal.getOutputsList().length-1]!;

    // using bitcore-lib to build a transaction
    const txn = new Transaction();

    // spend the mined output
    txn.addInput(new Transaction.Input.PublicKeyHash({
      output: new Transaction.Output({
        script: Script.buildPublicKeyHashOut(new Address(wallet1.address)),
        satoshis: output.getValue()
      }),
      prevTxId: Buffer.from(output.getOutpoint()!.getHash_asU8()).reverse(),
      outputIndex: output.getOutpoint()!.getIndex(),
      script: Script.empty()
    }));

    // send to wallet2 p2pkh (less a small fee)
    const sendSatoshis = output.getValue() - 200;
    txn.addOutput(new Transaction.Output({
      script: new Script(new Address(wallet2.address)),
      satoshis: sendSatoshis
    }));

    // sign
    txn.sign(wallet1._privKey);

    // serialize
    const txnHex = txn.serialize();

    // broadcast
    const res = await bchd1Grpc.submitTransaction({ txnHex });
    assert.ok(res.getHash_asU8().length === 32);

    // store prevOut for use in the next step
    prevOutBch = {
      txid: Buffer.from(res.getHash_asU8()).reverse().toString("hex"),
      vout: 0,
      satoshis: sendSatoshis
    };

    // check gRPC server mempool
    const resTx = await bchd1Grpc.getTransaction({ hash: prevOutBch.txid, reversedHashOrder: true, includeTokenMetadata: true });

    // check token metadata
    assert.ok(resTx.getTokenMetadata() === undefined);
    assert.ok(resTx.getTransaction()!.getOutputsList()[0].getSlpToken() === undefined);
    assert.ok(resTx.getTransaction()!.getOutputsList()[0].getValue() === sendSatoshis);

    // check slp transaction info
    const info = resTx.getTransaction()!.getSlpTransactionInfo()!;
    assert.ok(info.getValidityJudgement() === SlpTransactionInfo.ValidityJudgement.UNKNOWN_OR_INVALID);
    assert.ok(info.getSlpAction() === SlpAction.NON_SLP);
  });

  let fileID: string;

  step("Upload an 0x02 file", async function() {
    this.timeout(5000);

    const filePath = "./content/mario.png";
    const fileBuf = fs.readFileSync(filePath);

    let txo = {
      txid: prevOutBch.txid,
      vout: prevOutBch.vout,
      satoshis: prevOutBch.satoshis,
      wif: wallet2.wif,
      address: wallet2.bchRegtestAddress,
    } as utxo;

    const cb = (inp: string) => { console.log(inp); }
    fileID = await bfp.uploadFile(txo, wallet2.bchRegtestAddress, wallet2.wif, fileBuf, "mario", "png", undefined, undefined, wallet2.bchRegtestAddress, cb, cb, cb, cb, 0, 2);
  });

  step("Download an 0x02 file", async function() {
    this.timeout(5000);
    let result = await bfp.downloadFile(fileID);
    assert.strictEqual(result.passesHashCheck, true);
  });
});
