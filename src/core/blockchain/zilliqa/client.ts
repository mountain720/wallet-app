import {
    BlockchainGenericClient,
    ChainIdType,
    IBlockInfo,
    TransactionMessageText,
    TransactionType
} from '../types';
import { BigNumber } from 'bignumber.js';
import { networks } from './networks';
import { fromBech32Address } from '@zilliqa-js/crypto/dist/bech32';
import { config } from './config';
import { NameService } from './name-service';
import { TokenType } from '../types/token';
import { Zrc2Client } from './tokens/zrc2-client';
import { isBech32 } from '@zilliqa-js/util/dist/validation';
import { ClientUtils } from './client-utils';

export class Client extends BlockchainGenericClient {
    constructor(chainId: ChainIdType) {
        super(chainId, networks);

        this.nameService = new NameService();
        this.tokens[TokenType.ZRC2] = new Zrc2Client(this);
        this.utils = new ClientUtils(this);
    }

    public async getBalance(address: string): Promise<BigNumber> {
        try {
            const response = await this.call('GetBalance', [
                fromBech32Address(address)
                    .replace('0x', '')
                    .toLowerCase()
            ]);
            return new BigNumber(response.result.balance);
        } catch (result) {
            if (result?.error?.message === 'Account is not created') {
                return Promise.resolve(new BigNumber(0));
            }
            return Promise.reject(result);
        }
    }

    public async getNonce(address: string): Promise<number> {
        try {
            const response = await this.call('GetBalance', [
                fromBech32Address(address)
                    .replace('0x', '')
                    .toLowerCase()
            ]);
            return response.result.nonce + 1; // TODO to see what happens when there are multiple transactions in a limited time
        } catch (result) {
            if (result?.error?.message === 'Account is not created') {
                return 0;
            }
            return Promise.reject(result);
        }
    }

    public async getCurrentBlock(): Promise<IBlockInfo> {
        try {
            const response = await this.call('GetLatestTxBlock');
            return {
                hash: response?.result?.body?.BlockHash,
                number: response?.result?.header?.BlockNum
            };
        } catch (result) {
            return Promise.reject(result);
        }
    }

    public sendTransaction(transaction): Promise<{ txHash: string; rawResponse: any }> {
        return this.http.jsonRpc('CreateTransaction', [transaction]).then(res => {
            if (res.result) {
                return {
                    txHash: res.result.TranID,
                    rawResponse: res
                };
            }

            const errorMessage: string = res.error.message;
            if (errorMessage.includes('transaction underpriced')) {
                return Promise.reject(TransactionMessageText.TR_UNDERPRICED);
            }
            if (errorMessage.includes("Contract account won't accept normal txn")) {
                return Promise.reject(TransactionMessageText.CONTRACT_TX_NORMAL_NOT_ALLOWED);
            }
        });
    }

    public async call(method: string, params: any[] = []): Promise<any> {
        try {
            const result = await this.http.jsonRpc(method, params);
            if (result.error) {
                return Promise.reject(result);
            }
            return result;
        } catch (e) {
            return Promise.reject(e);
        }
    }

    public async getFees(
        transactionType: TransactionType,
        data: {
            from?: string;
            to?: string;
            amount?: string;
            contractAddress?: string;
            raw?: string;
        },
        tokenType: TokenType = TokenType.NATIVE
    ) {
        const gasLimit = config.feeOptions.defaults.gasLimit[tokenType];

        try {
            const result = await this.estimateFees();

            const gasPrice = result.result
                ? new BigNumber(Number(result.result))
                : config.feeOptions.defaults.gasPrice;

            return {
                gasPrice: gasPrice.toString(),
                gasLimit: gasLimit.toString(),
                feeTotal: gasPrice.multipliedBy(gasLimit).toString()
            };
        } catch {
            const gasPrice = config.feeOptions.defaults.gasPrice;
            return {
                gasPrice: gasPrice.toString(),
                gasLimit: gasLimit.toString(),
                feeTotal: gasPrice.multipliedBy(gasLimit).toString()
            };
        }
    }

    public async getSmartContractSubState(
        contractAddress: string,
        field: string,
        subFields: string[] = []
    ) {
        return this.call('GetSmartContractSubState', [
            fromBech32Address(contractAddress)
                .replace('0x', '')
                .toLowerCase(),
            field,
            subFields
        ]).then(response => response?.result);
    }

    public async getSmartContractInit(address: string) {
        let addr: string;

        if (isBech32(address)) {
            addr = fromBech32Address(address)
                .replace('0x', '')
                .toLowerCase();
        } else {
            addr = address.replace('0x', '').toLowerCase();
        }
        return this.call('GetSmartContractInit', [addr]).then(response => response?.result);
    }

    private async estimateFees(): Promise<any> {
        return this.http.jsonRpc('GetMinimumGasPrice', []);
    }
}
