import assert from "assert";
import { GrpcClient } from "grpc-bchrpc-node";
import { Bfp } from "../lib/bfp"

const grpc = new GrpcClient;
// @ts-ignore
const bfp = new Bfp(grpc);

describe("bitcoinfiles", () => {
    it("can read TX", async function() {
        this.timeout(5000);
        let result = await bfp.downloadFile('bitcoinfile:7e4600323c934926369c136562f5483e3df79baf087c8dd2b0ed1aea69d5ee49');
        assert.strictEqual(result.passesHashCheck, true);
    });
});
