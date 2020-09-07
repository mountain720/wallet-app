import { IAccountState } from '../../redux/wallets/state';

import BigNumber from 'bignumber.js';

import { getBlockchain } from '../blockchain/blockchain-factory';
import { Blockchain, ChainIdType } from '../blockchain/types';
import { IExchangeRates } from '../../redux/market/state';
import { ITokenConfigState } from '../../redux/tokens/state';

export const calculateBalance = (
    account: IAccountState,
    chainId: ChainIdType,
    token: ITokenConfigState,
    exchangeRates: IExchangeRates
) => {
    const tokenKeys = Object.keys((account?.tokens || {})[chainId] || {});
    let balance = new BigNumber(0);

    tokenKeys.map(key => {
        const tokenState = account.tokens[chainId][key];

        const tokenBalanceValue = new BigNumber(tokenState.balance?.value);

        if (tokenState && tokenState.active) {
            if (token.removable === false) {
                balance = balance.plus(tokenBalanceValue);
            } else {
                const amount = convertAmount(
                    account.blockchain,
                    exchangeRates,
                    tokenBalanceValue.toString(),
                    key,
                    token.symbol,
                    token.decimals
                );
                balance = balance.plus(amount);
            }
        }
    });
    return balance.toString();
};

export const convertAmount = (
    blockchain: Blockchain,
    exchangeRates: IExchangeRates,
    value: string,
    fromToken: string,
    toToken: string,
    tokenDecimals: number
): BigNumber => {
    const blockchainInstance = getBlockchain(blockchain);
    const valueBigNumber = new BigNumber(value);
    const amount = blockchainInstance.account.amountFromStd(valueBigNumber, tokenDecimals);
    if (fromToken === toToken) {
        return amount;
    }

    if (value && exchangeRates[fromToken] && exchangeRates[toToken]) {
        return amount.multipliedBy(exchangeRates[fromToken]).dividedBy(exchangeRates[toToken]);
    }

    return new BigNumber(0);
};
