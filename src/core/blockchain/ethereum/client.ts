import { BlockchainGenericClient } from '../types';
import { networks } from './networks';
import { BigNumber } from 'bignumber.js';
import { config } from './config';
import { convertUnit } from '../ethereum/account';
import abi from 'ethereumjs-abi';
import { Erc20Client } from './tokens/erc20-client';
import { TokenType } from '../types/token';

export class Client extends BlockchainGenericClient {
    constructor(chainId: number) {
        super(chainId, networks);

        this.tokens[TokenType.ERC20] = new Erc20Client(this);
    }

    public getBalance(address: string): Promise<BigNumber> {
        return this.rpc.call('eth_getBalance', [this.fixAddress(address), 'latest']).then(res => {
            return new BigNumber(res.result, 16);
        });
    }

    public getNonce(address: string): Promise<number> {
        return this.rpc
            .call('eth_getTransactionCount', [this.fixAddress(address), 'latest'])
            .then(res => {
                return new BigNumber(res.result, 16).toNumber();
            });
    }

    public sendTransaction(transaction): Promise<string> {
        return this.rpc.call('eth_sendRawTransaction', [transaction]).then(res => res.result);
    }

    public async callContract(contractAddress, methodSignature, params: any[] = []) {
        const signature = methodSignature.split(':');
        const method = signature[0];
        let returnTypes = [];
        if (signature[1]) {
            returnTypes = signature[1]
                .replace('(', '')
                .replace(')', '')
                .split(',')
                .filter(Boolean)
                .map(t => t.trim());
        }

        const response = await this.rpc.call('eth_call', [
            {
                to: contractAddress,
                data: '0x' + abi.simpleEncode(method, ...params).toString('hex')
            },
            'latest'
        ]);

        const dataBuffer = Buffer.from(response.result.replace('0x', ''), 'hex');

        const result = abi.rawDecode(returnTypes, dataBuffer);
        if (result.length === 1) {
            return result.toString();
        } else {
            return result.map(r => r.toString());
        }
    }

    public async calculateFees(from: string, to: string) {
        const results = await this.estimateFees(from, to);

        let presets: {
            cheap: BigNumber;
            standard: BigNumber;
            fast: BigNumber;
            fastest: BigNumber;
        };
        if (results[1]) {
            const response = await results[1].json();

            presets = {
                cheap: convertUnit(
                    new BigNumber(response.safeLow),
                    config.feeOptions.ui.gasPriceUnit,
                    config.defaultUnit
                ),
                standard: convertUnit(
                    new BigNumber(response.average),
                    config.feeOptions.ui.gasPriceUnit,
                    config.defaultUnit
                ),
                fast: convertUnit(
                    new BigNumber(response.fast),
                    config.feeOptions.ui.gasPriceUnit,
                    config.defaultUnit
                ),
                fastest: convertUnit(
                    new BigNumber(response.fastest),
                    config.feeOptions.ui.gasPriceUnit,
                    config.defaultUnit
                )
            };
        }

        const gasPrice = presets?.standard || config.feeOptions.defaults.gasPrice;
        const gasLimit = results[0].result
            ? new BigNumber(parseInt(results[0].result, 16))
            : config.feeOptions.defaults.gasLimit;

        return {
            gasPrice,
            gasLimit,
            presets: presets ? presets : config.feeOptions.defaults.gasPricePresets,
            feeTotal: gasPrice.multipliedBy(gasLimit)
        };
    }

    private async estimateFees(from: string, to: string): Promise<any> {
        return Promise.all([
            this.rpc.call('eth_estimateGas', [{ from, to }]),
            // TODO: extract url in a constant, also create a firebase function to be sure that this service is up
            fetch('https://ethgasstation.info/json/ethgasAPI.json')
        ]);
    }

    private fixAddress(address: string): string {
        if (address.indexOf('0x') < 0) {
            address = '0x' + address;
        }
        return address;
    }
}
