import BigNumber from 'bignumber.js';
import { TokenType } from '../blockchain/types/token';
import { getBlockchain } from '../blockchain/blockchain-factory';
import { IAccountState } from '../../redux/wallets/state';
import { ChainIdType, IFeeOptions } from '../blockchain/types';
import { ITokenConfigState } from '../../redux/tokens/state';

export const getInputAmountToStd = (
    account: IAccountState,
    tokenConfig: ITokenConfigState,
    amount: string
): BigNumber => {
    const blockchainInstance = getBlockchain(account.blockchain);

    return blockchainInstance.account.amountToStd(new BigNumber(amount || 0), tokenConfig.decimals);
};

export const availableFunds = (
    amount: string,
    account: IAccountState,
    tokenBalance: string,
    tokenConfig: ITokenConfigState,
    chainId: ChainIdType,
    feeOptions: IFeeOptions,
    balanceAvailable?: string
): { insufficientFunds: boolean; insufficientFundsFees: boolean } => {
    const result = {
        insufficientFunds: false,
        insufficientFundsFees: false
    };

    // Amount check
    const inputAmount = getInputAmountToStd(account, tokenConfig, amount);
    const availableBalanceValue = balanceAvailable
        ? getInputAmountToStd(account, tokenConfig, balanceAvailable)
        : new BigNumber(tokenBalance);

    // Amount > available amount
    result.insufficientFunds = inputAmount.isGreaterThan(availableBalanceValue);

    if (result.insufficientFunds === true) {
        return result;
    }

    // Fees check
    const feeTotal = new BigNumber(feeOptions?.feeTotal);

    if (tokenConfig.type === TokenType.NATIVE) {
        // feeTotal + amount > available amount
        result.insufficientFundsFees = feeTotal
            .plus(inputAmount)
            .isGreaterThan(availableBalanceValue);
    } else {
        const nativeCoin = getBlockchain(account.blockchain).config.coin;
        const nativeCoinBalance = account.tokens[chainId][nativeCoin].balance?.value;
        const availableBalance = new BigNumber(nativeCoinBalance);

        // ERC20 / ZRC2
        // feeTotal > available amount
        result.insufficientFundsFees = feeTotal.isGreaterThan(availableBalance);
    }

    return result;
};

export const availableAmount = (
    account: IAccountState,
    tokenBalance: string,
    tokenConfig: ITokenConfigState,
    feeOptions?: IFeeOptions,
    balanceAvailable?: string
): string => {
    let balance: BigNumber = balanceAvailable
        ? getInputAmountToStd(account, tokenConfig, balanceAvailable)
        : new BigNumber(tokenBalance);
    if (feeOptions) {
        if (tokenConfig.type === TokenType.NATIVE) {
            balance = balance.minus(feeOptions?.feeTotal);
        }
    }

    if (balance.isGreaterThanOrEqualTo(0)) {
        const blockchainInstance = getBlockchain(account.blockchain);
        const amountFromStd = blockchainInstance.account.amountFromStd(
            new BigNumber(balance),
            tokenConfig.decimals
        );
        return amountFromStd.toString();
    } else {
        return new BigNumber(0).toString();
    }
};
