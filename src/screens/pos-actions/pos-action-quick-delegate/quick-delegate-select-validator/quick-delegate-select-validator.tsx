import React from 'react';
import { Image, View } from 'react-native';
import { Text } from '../../../../library';
import { IReduxState } from '../../../../redux/state';
import stylesProvider from './styles';
import { withTheme, IThemeProps } from '../../../../core/theme/with-theme';
import { smartConnect } from '../../../../core/utils/smart-connect';
import { connect } from 'react-redux';
import { translate } from '../../../../core/i18n';
import {
    withNavigationParams,
    INavigationProps
} from '../../../../navigation/with-navigation-params';
import { getAccount, getNrPendingTransactions } from '../../../../redux/wallets/selectors';
import { Blockchain, ChainIdType } from '../../../../core/blockchain/types';
import BigNumber from 'bignumber.js';
import { IAccountState, ITokenState } from '../../../../redux/wallets/state';
import { TestnetBadge } from '../../../../components/testnet-badge/testnet-badge';
import { getTokenConfig } from '../../../../redux/tokens/static-selectors';
import { getChainId } from '../../../../redux/preferences/selectors';
import { IValidator, CardActionType } from '../../../../core/blockchain/types/stats';
import { ValidatorsList } from '../../../token/components/delegate-token/components/validators/validators-list/validators-list';
import { bind } from 'bind-decorator';
import { BottomCta } from '../../../../components/bottom-cta/bottom-cta';
import { PrimaryCtaField } from '../../../../components/bottom-cta/primary-cta-field/primary-cta-field';
import { AmountCtaField } from '../../../../components/bottom-cta/amount-cta-field/amount-cta-field';
import {
    navigateToEnterAmountStep,
    QUICK_DELEGATE_ENTER_AMOUNT
} from '../../../../redux/ui/screens/posActions/actions';
import { valuePrimaryCtaField } from '../../../../core/utils/format-string';
import { getValidators } from '../../../../redux/ui/validators/selectors';
import { PosBasicActionType } from '../../../../core/blockchain/types/token';
import { fetchValidators } from '../../../../redux/ui/validators/actions';
import { fetchDelegatedValidators } from '../../../../redux/ui/delegated-validators/actions';
import { LoadingIndicator } from '../../../../components/loading-indicator/loading-indicator';
import { getBlockchain } from '../../../../core/blockchain/blockchain-factory';
import { Dialog } from '../../../../components/dialog/dialog';
import { NavigationService } from '../../../../navigation/navigation-service';
import { isFeatureActive, RemoteFeature } from '../../../../core/utils/remote-feature-config';

interface IReduxProps {
    account: IAccountState;
    chainId: ChainIdType;
    validators: IValidator[];
    navigateToEnterAmountStep: typeof navigateToEnterAmountStep;
    fetchValidators: typeof fetchValidators;
    fetchDelegatedValidators: typeof fetchDelegatedValidators;
    hasPendingTransactions: boolean;
}

const mapStateToProps = (state: IReduxState, ownProps: INavigationParams) => {
    const chainId = getChainId(state, ownProps.blockchain);
    return {
        account: getAccount(state, ownProps.accountIndex, ownProps.blockchain),
        chainId,
        validators: getValidators(state, ownProps.blockchain, chainId, PosBasicActionType.DELEGATE),
        hasPendingTransactions: getNrPendingTransactions(state)
    };
};

const mapDispatchToProps = {
    navigateToEnterAmountStep,
    fetchValidators,
    fetchDelegatedValidators
};

export interface INavigationParams {
    accountIndex: number;
    blockchain: Blockchain;
    token: ITokenState;
    validators: IValidator[];
    actionText: string;
}

interface IState {
    validatorsList: IValidator[];
}

export const navigationOptions = ({ navigation }: any) => ({
    title: translate(navigation.state.params.actionText || 'App.labels.send')
});
export class QuickDelegateSelectValidatorComponent extends React.Component<
    INavigationProps<INavigationParams> &
        IReduxProps &
        IThemeProps<ReturnType<typeof stylesProvider>>,
    IState
> {
    public static navigationOptions = navigationOptions;

    constructor(
        props: INavigationProps<INavigationParams> &
            IReduxProps &
            IThemeProps<ReturnType<typeof stylesProvider>>
    ) {
        super(props);

        this.state = {
            validatorsList: props.validators || []
        };
    }

    public componentDidMount() {
        if (!isFeatureActive(RemoteFeature.IMPROVED_NONCE) && this.props.hasPendingTransactions) {
            Dialog.alert(
                translate('Validator.cannotInitiateTxTitle'),
                translate('Validator.cannotInitiateTxMessage'),
                undefined,
                {
                    text: translate('App.labels.ok'),
                    onPress: () => NavigationService.replace('TransactonsHistory', {})
                }
            );
        } else {
            this.props.fetchValidators(this.props.account, PosBasicActionType.DELEGATE);
            this.props.fetchDelegatedValidators(this.props.account);
        }
    }

    public componentDidUpdate(prevProps: IReduxProps) {
        const { maximumNumberOfValidators } = getBlockchain(
            this.props.blockchain
        ).config.ui.validator;
        if (this.props.validators !== prevProps.validators) {
            if (this.props.validators === undefined) {
                this.setState({
                    validatorsList: []
                });
            } else
                this.setState({
                    validatorsList:
                        maximumNumberOfValidators > this.props.validators.length
                            ? this.props.validators
                            : this.props.validators.slice(0, maximumNumberOfValidators)
                });
        }
    }

    @bind
    public onSelect(validator: IValidator) {
        let selected = true;
        if (validator.actionTypeSelected) {
            selected = !validator.actionTypeSelected;
        }

        const validators = this.state.validatorsList;
        Object.values(validators).map(object => {
            if (validator.id === object.id) object.actionTypeSelected = selected;
        });
        this.setState({ validatorsList: validators });
    }

    private renderValidatorList() {
        return (
            <View key={'validator-list'} style={this.props.styles.listContainer}>
                <ValidatorsList
                    validators={this.state.validatorsList}
                    blockchain={this.props.blockchain}
                    token={this.props.token}
                    onSelect={this.onSelect}
                    actionType={CardActionType.CHECKBOX}
                    contentContainerStyle={this.props.styles.validatorsList}
                />
            </View>
        );
    }

    private renderBottomConfirm() {
        const tokenConfig = getTokenConfig(this.props.account.blockchain, this.props.token.symbol);

        const selectedValidators = this.state.validatorsList.filter(
            validator => validator.actionTypeSelected === true
        );

        const disableButton: boolean = selectedValidators.length === 0;

        return (
            <BottomCta
                label={translate('App.labels.next')}
                disabled={disableButton}
                onPress={() => {
                    // navigate to next screen
                    this.props.navigateToEnterAmountStep(
                        this.props.accountIndex,
                        this.props.blockchain,
                        this.props.token,
                        selectedValidators,
                        this.props.actionText,
                        'QuickDelegateEnterAmount',
                        QUICK_DELEGATE_ENTER_AMOUNT
                    );
                }}
            >
                <PrimaryCtaField
                    label={translate(this.props.actionText)}
                    action={translate('App.labels.for').toLowerCase()}
                    value={valuePrimaryCtaField(this.state.validatorsList)}
                />
                <AmountCtaField
                    tokenConfig={tokenConfig}
                    stdAmount={new BigNumber(0)}
                    account={this.props.account}
                />
            </BottomCta>
        );
    }

    public render() {
        const { styles } = this.props;
        return (
            <View style={styles.container}>
                <TestnetBadge />

                <View style={styles.content}>
                    {!this.props.validators ? (
                        <View style={styles.loadingContainer}>
                            <LoadingIndicator />
                        </View>
                    ) : this.props.validators.length === 0 ? (
                        <View style={styles.emptySection}>
                            <Image
                                style={styles.logoImage}
                                source={require('../../../../assets/images/png/moonlet_space_gray.png')}
                            />
                            <Text style={styles.noNodesText}>{translate('Validator.noNodes')}</Text>
                        </View>
                    ) : (
                        this.renderValidatorList()
                    )}
                </View>

                {this.renderBottomConfirm()}
            </View>
        );
    }
}

export const QuickDelegateSelectValidator = smartConnect(QuickDelegateSelectValidatorComponent, [
    connect(mapStateToProps, mapDispatchToProps),
    withTheme(stylesProvider),
    withNavigationParams()
]);
