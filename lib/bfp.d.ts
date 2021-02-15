/// <reference types="node" />
import { Transaction } from "bitcore-lib-cash";
import { IGrpcClient } from 'grpc-bchrpc';
export interface utxo {
    txid: string;
    vout: number;
    amount?: number;
    satoshis: number;
    height?: number;
    confirmations?: number;
    wif?: string;
    address?: string;
}
export interface FileMetadata {
    msgType: number;
    chunkCount: number;
    fileName?: string;
    fileExt?: string;
    fileSize: number;
    fileSha256Hex?: string;
    prevFileSha256Hex?: string;
    fileUri?: string;
    chunkData?: Buffer;
}
export interface FundingTxnConfig {
    outputAddress: string;
    fundingAmountSatoshis: number;
    input_utxos: utxo[];
}
export interface MetadataTxnConfig {
    bfpMetadataOpReturn: Buffer;
    input_utxo: utxo;
    fileReceiverAddress: string;
}
export interface DataChunkTxnConfig {
    bfpChunkOpReturn: Buffer;
    input_utxo: utxo;
}
export declare class Bfp {
    client: IGrpcClient;
    FEE_RATE: number;
    constructor(client: IGrpcClient);
    static get bfpMagicHex(): string;
    uploadHashOnlyObject(type: number, // file = 1,  folder = 3
    fundingUtxo: utxo, // object in form: { txid:'', satoshis:#, vout:# }
    fundingAddress: string, // string
    fundingWif: string, // hex string?
    objectDataArrayBuffer: Buffer, // ArrayBuffer
    objectName?: string, // string
    objectExt?: string, // string
    prevObjectSha256Hex?: string, // hex string
    objectExternalUri?: string, // utf8 string
    objectReceiverAddress?: string, // string
    signProgressCallback?: Function, signFinishedCallback?: Function, uploadProgressCallback?: Function, uploadFinishedCallback?: Function): Promise<string>;
    uploadFolderHashOnly(fundingUtxo: utxo, // object in form: { txid:'', satoshis:#, vout:# }
    fundingAddress: string, // string
    fundingWif: string, // hex string?
    folderDataArrayBuffer: Buffer, // ArrayBuffer
    folderName?: string, // string
    folderExt?: string, // string
    prevFolderSha256Hex?: string, // hex string
    folderExternalUri?: string, // utf8 string
    folderReceiverAddress?: string, // string
    signProgressCallback?: Function, signFinishedCallback?: Function, uploadProgressCallback?: Function, uploadFinishedCallback?: Function): Promise<string>;
    uploadFileHashOnly(fundingUtxo: utxo, // object in form: { txid:'', satoshis:#, vout:# }
    fundingAddress: string, // string
    fundingWif: string, // hex string?
    fileDataArrayBuffer: Buffer, // ArrayBuffer
    fileName?: string, // string
    fileExt?: string, // string
    prevFileSha256Hex?: string, // hex string
    fileExternalUri?: string, // utf8 string
    fileReceiverAddress?: string, // string
    signProgressCallback?: Function, signFinishedCallback?: Function, uploadProgressCallback?: Function, uploadFinishedCallback?: Function): Promise<string>;
    uploadFile(fundingUtxo: utxo, // object in form: { txid:'', satoshis:#, vout:# }
    fundingAddress: string, // string
    fundingWif: string, // hex string?
    fileDataArrayBuffer: Buffer, // ArrayBuffer
    fileName?: string, // string
    fileExt?: string, // string
    prevFileSha256Hex?: string, // hex string
    fileExternalUri?: string, // utf8 string
    fileReceiverAddress?: string, // string
    signProgressCallback?: Function, signFinishedCallback?: Function, uploadProgressCallback?: Function, uploadFinishedCallback?: Function, delay_ms?: number): Promise<string>;
    downloadFile(bfpUri: string, progressCallback?: Function): Promise<{
        passesHashCheck: boolean;
        fileBuf: Buffer;
    }>;
    static buildMetadataOpReturn(config: FileMetadata): Buffer;
    static buildDataChunkOpReturn(chunkData: Buffer): Buffer;
    buildFundingTx(config: FundingTxnConfig): Transaction;
    buildChunkTx(config: DataChunkTxnConfig): Transaction;
    buildMetadataTx(config: MetadataTxnConfig): Transaction;
    calculateMetadataMinerFee(genesisOpReturnLength: number, feeRate?: number): number;
    calculateDataChunkMinerFee(sendOpReturnLength: number, feeRate?: number): number;
    static calculateFileUploadCost(fileSizeBytes: number, configMetadataOpReturn: FileMetadata, fee_rate?: number): number;
    static chunk_can_fit_in_final_opreturn(script_length: number, chunk_data_length: number): boolean;
    parsebfpDataOpReturn(hex: string): any;
}
