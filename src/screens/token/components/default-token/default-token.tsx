import React from 'react';
import { View, ScrollView, Platform } from 'react-native';
import stylesProvider from './styles';
import { IAccountState, IWalletState, ITokenState } from '../../../../redux/wallets/state';
import {
    getAccountFilteredTransactions,
    getAccount,
    getSelectedWallet
} from '../../../../redux/wallets/selectors';
import { IReduxState } from '../../../../redux/state';
import { withTheme, IThemeProps } from '../../../../core/theme/with-theme';
import { connect } from 'react-redux';
import { smartConnect } from '../../../../core/utils/smart-connect';
import { Button } from '../../../../library';
import { translate, Translate } from '../../../../core/i18n';
import { INavigationProps } from '../../../../navigation/with-navigation-params';
import { AccountAddress } from '../../../../components/account-address/account-address';
import { Blockchain, IBlockchainTransaction, ChainIdType } from '../../../../core/blockchain/types';
import { TransactionsHistoryList } from '../../../transactions-history/list-transactions-history/list-transactions-history';
import { sendTransferTransaction } from '../../../../redux/wallets/actions';
import { getChainId } from '../../../../redux/preferences/selectors';
import { NavigationScreenProp, NavigationState } from 'react-navigation';

export interface IProps {
    accountIndex: number;
    blockchain: Blockchain;
    token: ITokenState;
    navigation: NavigationScreenProp<NavigationState>;
}

export interface IReduxProps {
    account: IAccountState;
    transactions: IBlockchainTransaction[];
    wallet: IWalletState;
    sendTransferTransaction: typeof sendTransferTransaction;
    chainId: ChainIdType;
    canSend: boolean;
}

export const mapStateToProps = (state: IReduxState, ownProps: IProps) => {
    return {
        account: getAccount(state, ownProps.accountIndex, ownProps.blockchain),
        transactions: getAccountFilteredTransactions(
            state,
            ownProps.accountIndex,
            ownProps.blockchain,
            ownProps.token
        ),
        wallet: getSelectedWallet(state),
        chainId: getChainId(state, ownProps.blockchain),
        canSend: Platform.OS !== 'web' || state.ui.extension.stateLoaded
    };
};

const mapDispatchToProps = {
    sendTransferTransaction
};

export class DefaultTokenScreenComponent extends React.Component<
    INavigationProps & IProps & IReduxProps & IThemeProps<ReturnType<typeof stylesProvider>>
> {
    public render() {
        const { styles, navigation, account, transactions, token } = this.props;

        return (
            <View style={styles.container}>
                <ScrollView
                    contentContainerStyle={styles.scrollContainer}
                    showsVerticalScrollIndicator={false}
                >
                    <AccountAddress account={account} token={token} />
                    <View style={styles.buttonsContainer}>
                        <Button
                            testID="button-send"
                            style={styles.button}
                            wrapperStyle={{ flex: 1 }}
                            // disabled={!this.props.canSend} // TODO
                            onPress={() => {
                                navigation.navigate('Send', {
                                    accountIndex: account.index,
                                    blockchain: account.blockchain,
                                    token
                                });
                            }}
                        >
                            {translate('App.labels.send')}
                        </Button>
                        <Button
                            testID="button-receive"
                            style={styles.button}
                            wrapperStyle={{ flex: 1 }}
                            onPress={() => {
                                navigation.navigate('Receive', {
                                    accountIndex: account.index,
                                    blockchain: account.blockchain,
                                    token
                                });
                            }}
                        >
                            {translate('App.labels.receive')}
                        </Button>
                    </View>

                    <View>
                        <Translate
                            text="App.labels.transactions"
                            style={styles.transactionsTitle}
                        />
                        <TransactionsHistoryList
                            transactions={transactions}
                            account={account}
                            navigation={navigation}
                        />
                    </View>
                </ScrollView>
            </View>
        );
    }
}

export const DefaultTokenScreen = smartConnect<IProps>(DefaultTokenScreenComponent, [
    connect(mapStateToProps, mapDispatchToProps),
    withTheme(stylesProvider)
]);
