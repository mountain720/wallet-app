import React from 'react';
import { View } from 'react-native';
import { HeaderRight } from '../../components/header-right/header-right';
import stylesProvider from './styles';
import { IAccountState, IWalletState, ITokenState } from '../../redux/wallets/state';
import {
    getAccountFilteredTransactions,
    getAccount,
    getSelectedWallet
} from '../../redux/wallets/selectors';
import { IReduxState } from '../../redux/state';
import { NavigationScreenProp, NavigationState, NavigationParams } from 'react-navigation';
import { withTheme } from '../../core/theme/with-theme';
import { connect } from 'react-redux';
import { smartConnect } from '../../core/utils/smart-connect';
import { Text } from '../../library';
import { translate } from '../../core/i18n';
import { withNavigationParams, INavigationProps } from '../../navigation/with-navigation-params';
import { Blockchain, IBlockchainTransaction, ChainIdType } from '../../core/blockchain/types';
import { themes } from '../../navigation/navigation';
import { getBalance, updateTransactionFromBlockchain } from '../../redux/wallets/actions';
import { getChainId } from '../../redux/preferences/selectors';
import { TestnetBadge } from '../../components/testnet-badge/testnet-badge';
import { TokenScreenComponentType } from '../../core/blockchain/types/token';
import { DefaultTokenScreen } from './components/default-token/default-token';
import { DelegateTokenScreen } from './components/delegate-token/delegate-token';
import { AccountSettingsModal } from './components/account-settings/account-settings';
import { SmartImage } from '../../library/image/smart-image';
import {
    BASE_DIMENSION,
    normalizeFontAndLineHeight,
    LETTER_SPACING
} from '../../styles/dimensions';
import { TransactionStatus } from '../../core/wallet/types';
import { getTokenConfig } from '../../redux/tokens/static-selectors';
import bind from 'bind-decorator';
import { IconValues } from '../../components/icon/values';

interface IProps {
    navigation: NavigationScreenProp<NavigationState, NavigationParams>;
    styles: ReturnType<typeof stylesProvider>;
}

interface IReduxProps {
    account: IAccountState;
    transactions: IBlockchainTransaction[];
    wallet: IWalletState;
    chainId: ChainIdType;
    getBalance: typeof getBalance;
    updateTransactionFromBlockchain: typeof updateTransactionFromBlockchain;
}

interface INavigationParams {
    accountIndex: number;
    blockchain: Blockchain;
    token: ITokenState;
    activeTab?: string;
    accountName?: string;
}

interface IState {
    settingsVisible: boolean;
}

const mapStateToProps = (state: IReduxState, ownProps: INavigationParams) => {
    return {
        account: getAccount(state, ownProps.accountIndex, ownProps.blockchain),
        transactions: getAccountFilteredTransactions(
            state,
            ownProps.accountIndex,
            ownProps.blockchain,
            ownProps.token
        ),
        wallet: getSelectedWallet(state),
        chainId: getChainId(state, ownProps.blockchain)
    };
};

const mapDispatchToProps = {
    getBalance,
    updateTransactionFromBlockchain
};

const navigationOptions = ({ navigation, theme }: any) => ({
    headerRight: () => (
        <HeaderRight
            icon={IconValues.NAVIGATION_MENU_HORIZONTAL}
            onPress={navigation.state.params && navigation.state.params.openSettingsMenu}
        />
    ),
    headerTitle: () => {
        const tokenIcon = getTokenConfig(
            navigation.state.params.blockchain,
            navigation.state.params.token.symbol
        ).icon;

        const TokenIconComponent = tokenIcon.iconComponent;

        return (
            <View style={{ flexDirection: 'row' }}>
                <SmartImage
                    source={{
                        iconComponent: TokenIconComponent,
                        uri: tokenIcon.uri
                    }}
                    style={{ marginRight: BASE_DIMENSION }}
                    small
                />
                <Text
                    style={{
                        fontSize: normalizeFontAndLineHeight(22),
                        lineHeight: normalizeFontAndLineHeight(28),
                        color: themes[theme].colors.text,
                        letterSpacing: LETTER_SPACING,
                        textAlign: 'center',
                        fontWeight: 'bold'
                    }}
                >
                    {navigation.state.params?.accountName || navigation.state.params?.accName}
                </Text>
            </View>
        );
    }
});

export class TokenScreenComponent extends React.Component<
    INavigationProps<INavigationParams> & IReduxProps & IProps,
    IState
> {
    public static navigationOptions = navigationOptions;
    public passwordModal: any;

    constructor(props: INavigationProps<INavigationParams> & IReduxProps & IProps) {
        super(props);

        this.state = {
            settingsVisible: false
        };
    }
    public componentDidMount() {
        const accName =
            this.props.account?.name ||
            `${translate('App.labels.account')} ${this.props.accountIndex + 1}`;

        this.props.navigation.setParams({
            openSettingsMenu: this.openSettingsMenu,
            accName
        });

        this.props.getBalance(
            this.props.account.blockchain,
            this.props.account.address,
            undefined,
            false // should we actually force it?
        );

        this.props.transactions?.map((transaction: IBlockchainTransaction) => {
            if (transaction.status === TransactionStatus.PENDING) {
                this.props.updateTransactionFromBlockchain(
                    transaction.id,
                    transaction.blockchain,
                    transaction.chainId,
                    transaction.broadcastedOnBlock
                );
            }
        });
    }

    @bind
    public openSettingsMenu() {
        this.setState({ settingsVisible: !this.state.settingsVisible });
    }

    private renderComponent() {
        const tokenConfig = getTokenConfig(this.props.blockchain, this.props.token.symbol);

        switch (tokenConfig.ui.tokenScreenComponent) {
            case TokenScreenComponentType.DELEGATE:
                return (
                    <DelegateTokenScreen
                        accountIndex={this.props.accountIndex}
                        blockchain={this.props.blockchain}
                        token={this.props.token}
                        navigation={this.props.navigation}
                        activeTab={this.props.activeTab}
                    />
                );
            default:
                return (
                    <DefaultTokenScreen
                        accountIndex={this.props.accountIndex}
                        blockchain={this.props.blockchain}
                        token={this.props.token}
                        navigation={this.props.navigation}
                    />
                );
        }
    }

    public render() {
        const { styles } = this.props;

        return (
            <View style={styles.container}>
                <TestnetBadge />

                {this.renderComponent()}

                <AccountSettingsModal
                    visible={this.state.settingsVisible}
                    onDonePressed={() => this.openSettingsMenu()}
                    account={this.props.account}
                    wallet={this.props.wallet}
                    chainId={this.props.chainId}
                />
            </View>
        );
    }
}

export const TokenScreen = smartConnect(TokenScreenComponent, [
    connect(mapStateToProps, mapDispatchToProps),
    withTheme(stylesProvider),
    withNavigationParams()
]);
