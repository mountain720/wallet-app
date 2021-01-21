import { Dispatch } from 'react';
import { IReduxState } from '../../../state';
import { ICta, ICtaAction } from '../../../../components/widgets/types';
import { IAction } from '../../../types';
import {
    getNrPendingTransactions,
    getSelectedAccount,
    getSelectedBlockchain,
    getSelectedWallet
} from '../../../wallets/selectors';
import { getChainId } from '../../../preferences/selectors';
import { PosBasicActionType } from '../../../../core/blockchain/types/token';
import {
    buildDummyValidator,
    claimRewardNoInput,
    delegate,
    delegateV2,
    redelegate,
    setSelectedBlockchain,
    withdraw
} from '../../../wallets/actions';
import {
    runScreenValidation,
    setScreenInputData,
    toggleValidatorMultiple
} from '../input-data/actions';
import { NavigationService } from '../../../../navigation/navigation-service';
import { openURL } from '../../../../core/utils/linking-handler';
import { getBlockchain } from '../../../../core/blockchain/blockchain-factory';
import { getScreenDataKey } from './reducer';
import { Dialog } from '../../../../components/dialog/dialog';
import { translate } from '../../../../core/i18n';
import { LOAD_MORE_VALIDATORS, LOAD_MORE_VALIDATORS_V2 } from './actions';
import { ITokenState } from '../../../wallets/state';
import { HttpClient } from '../../../../core/utils/http-client';
import { navigateToEnterAmountStep, QUICK_DELEGATE_ENTER_AMOUNT } from '../posActions/actions';
import BigNumber from 'bignumber.js';
import { IValidator } from '../../../../core/blockchain/types/stats';
import { getTokenConfig } from '../../../tokens/static-selectors';
import { splitStake } from '../../../../core/utils/balance';

export const handleCta = (
    cta: ICta,
    options?: {
        screenKey?: string;
        validator?: {
            id: string;
            name: string;
            icon?: string;
            website?: string;
        };
    }
) => async (dispatch: Dispatch<IAction<any>>, getState: () => IReduxState) => {
    if (!cta) {
        return;
    }

    if (cta?.actions && Array.isArray(cta?.actions)) {
        for (const action of cta.actions) {
            await handleCtaAction(action, dispatch, getState, options);
        }
    } else {
        // used this to handle deprecated versions
        await handleCtaAction(
            {
                type: cta.type,
                params: cta?.params
            },
            dispatch,
            getState,
            options
        );
    }
};

const handleCtaAction = async (
    action: ICtaAction,
    dispatch: Dispatch<IAction<any>>,
    getState: () => IReduxState,
    options?: {
        screenKey?: string;
        validator?: {
            id: string;
            name: string;
            icon?: string;
            website?: string;
        };
    }
) => {
    const state = getState();

    switch (action.type) {
        case 'callAction':
            switch (action.params.action) {
                case PosBasicActionType.CLAIM_REWARD_NO_INPUT: {
                    let validators = [];

                    if (action.params?.params?.validators) {
                        for (const v of action.params.params.validators) {
                            const validator = buildDummyValidator(v.validatorId, v.validatorName);
                            validators.push(validator);
                        }
                    } else {
                        validators = [
                            buildDummyValidator(
                                action.params.params.validatorId,
                                action.params.params.validatorName
                            )
                        ];
                    }

                    claimRewardNoInput(
                        getSelectedAccount(state),
                        validators,
                        action.params?.params?.tokenSymbol,
                        undefined
                    )(dispatch, getState);
                    break;
                }

                case PosBasicActionType.WITHDRAW: {
                    const withdrawValidator =
                        action?.params?.params?.validatorId &&
                        action?.params?.params?.validatorName &&
                        buildDummyValidator(
                            action.params.params.validatorId,
                            action.params.params.validatorName
                        );

                    withdraw(
                        getSelectedAccount(state),
                        withdrawValidator && [withdrawValidator],
                        action.params?.params?.tokenSymbol,
                        {
                            amount: action.params?.params?.amount,
                            stakeAccountKey: action.params?.params?.stakeAccountKey
                        },
                        undefined
                    )(dispatch, getState);
                    break;
                }

                case 'MULTIPLE_SELECTION':
                case 'multipleSelection':
                    toggleValidatorMultiple(options.screenKey, {
                        id: options.validator.id,
                        name: options.validator.name,
                        icon: options?.validator?.icon,
                        website: options.validator?.website
                    })(dispatch, getState);
                    break;

                case 'SINGLE_SELECTION':
                case 'singleSelection':
                    setScreenInputData(options.screenKey, {
                        validators: [
                            {
                                id: options.validator.id,
                                name: options.validator.name,
                                icon: options.validator?.icon,
                                website: options.validator?.website
                            }
                        ]
                    })(dispatch, getState);
                    break;

                /** @deprecated */
                case 'LOAD_MORE_VALIDATORS':
                case 'loadMoreValidators':
                    dispatch({
                        type: LOAD_MORE_VALIDATORS,
                        data: { screenKey: options.screenKey }
                    });
                    break;

                case 'loadMoreValidatorsV2':
                    dispatch({
                        type: LOAD_MORE_VALIDATORS_V2,
                        data: {
                            screenKey: options.screenKey,
                            screen: action.params?.params?.screen
                        }
                    });
                    break;

                case 'delegateToValidator': {
                    // Run Screen Validations

                    // Take amount from screen
                    const account = getSelectedAccount(state);
                    const chainId = getChainId(state, account.blockchain);

                    const screenKey = getScreenDataKey({
                        pubKey: getSelectedWallet(state)?.walletPublicKey,
                        blockchain: account?.blockchain,
                        chainId: String(chainId),
                        address: account?.address,
                        step: action.params?.params?.step,
                        tab: undefined
                    });

                    // Open Process Tx
                    if (
                        action.params?.params?.validatorId &&
                        action.params?.params?.validatorName &&
                        action.params?.params?.token
                    ) {
                        const { token, validatorId, validatorName } = action.params.params;

                        if (
                            state.ui.screens.inputData &&
                            state.ui.screens.inputData[screenKey]?.data?.amount
                        ) {
                            const amount = state.ui.screens.inputData[screenKey].data.amount;

                            const validators = [buildDummyValidator(validatorId, validatorName)];

                            delegate(
                                getSelectedAccount(state),
                                amount,
                                validators,
                                token,
                                undefined, // feeOptions
                                undefined
                            )(dispatch, getState);
                        }
                    }
                    break;
                }

                case 'delegateToValidatorV2': {
                    const account = getSelectedAccount(state);
                    const chainId = getChainId(state, account.blockchain);
                    const blockchainInstance = getBlockchain(account.blockchain);

                    const token = action.params?.params?.token;
                    const tokenConfig = getTokenConfig(account.blockchain, token);

                    const screenKey = getScreenDataKey({
                        pubKey: getSelectedWallet(state)?.walletPublicKey,
                        blockchain: account?.blockchain,
                        chainId: String(chainId),
                        address: account?.address,
                        step: action.params?.params?.step,
                        tab: undefined
                    });

                    const data = state.ui.screens.inputData[screenKey].data;

                    const validators: {
                        validator: IValidator;
                        amount: string;
                    }[] = [];

                    // Build validators list from redux
                    for (const dataKey of Object.keys(data || {})) {
                        if (data[dataKey] && data[dataKey]?.validator && data[dataKey]?.amount) {
                            const amount = data[dataKey].amount;
                            const validator = data[dataKey].validator;
                            if (new BigNumber(amount).isGreaterThan(0)) {
                                validators.push({
                                    validator: buildDummyValidator(
                                        validator?.id || validator?.address,
                                        validator.name,
                                        validator.icon,
                                        validator.website
                                    ),
                                    amount: blockchainInstance.account
                                        .amountToStd(amount, tokenConfig.decimals)
                                        .toFixed()
                                });
                            }
                        }
                    }

                    // Build validators list from params
                    if (
                        action.params?.params?.validators &&
                        Array.isArray(action.params.params.validators) &&
                        state.ui.screens.inputData[screenKey]?.data?.amount
                    ) {
                        const amountSplit = splitStake(
                            state.ui.screens.inputData[screenKey].data.amount,
                            action.params.params.validators.length
                        );
                        for (const validator of action.params.params.validators) {
                            validators.push({
                                validator: buildDummyValidator(
                                    validator?.id || validator?.address,
                                    validator.name,
                                    validator.icon,
                                    validator.website
                                ),
                                amount: blockchainInstance.account
                                    .amountToStd(amountSplit, tokenConfig.decimals)
                                    .toFixed()
                            });
                        }
                    }

                    delegateV2(
                        getSelectedAccount(state),
                        validators,
                        token,
                        undefined, // feeOptions
                        undefined
                    )(dispatch, getState);
                    break;
                }

                case 'switchNodeDelegateToValidator': {
                    // Run Screen Validations

                    // Take amount from screen
                    const account = getSelectedAccount(state);
                    const chainId = getChainId(state, account.blockchain);

                    const context = action.params?.params?.context;

                    const screenKey = getScreenDataKey({
                        pubKey: getSelectedWallet(state)?.walletPublicKey,
                        blockchain: account?.blockchain,
                        chainId: String(chainId),
                        address: account?.address,
                        step: context?.step,
                        tab: undefined
                    });

                    // Node details are stored on flow
                    const switchNodeValidator =
                        state.ui.screens.inputData[context?.flowId]?.data?.switchNodeValidator;

                    // Open Process Tx
                    if (
                        switchNodeValidator &&
                        action.params?.params?.token &&
                        state.ui.screens.inputData &&
                        state.ui.screens.inputData[screenKey] &&
                        state.ui.screens.inputData[screenKey]?.data?.amount &&
                        action.params?.params?.toValidator
                    ) {
                        const fromValidator = buildDummyValidator(
                            switchNodeValidator.id,
                            switchNodeValidator.name
                        );

                        const validators = [
                            buildDummyValidator(
                                action.params.params.toValidator.id,
                                action.params.params.toValidator.name
                            )
                        ];

                        const amount = state.ui.screens.inputData[screenKey]?.data?.amount;

                        redelegate(
                            getSelectedAccount(state),
                            amount,
                            validators,
                            action.params.params.token,
                            undefined, // feeOptions
                            { fromValidator }
                        )(dispatch, getState);
                    }
                    break;
                }

                case 'switchNodeConfirm': {
                    // Run Screen Validations

                    // Take amount from screen
                    const account = getSelectedAccount(state);
                    const chainId = getChainId(state, account.blockchain);

                    const context = action.params?.params?.context;

                    const screenKey = getScreenDataKey({
                        pubKey: getSelectedWallet(state)?.walletPublicKey,
                        blockchain: account?.blockchain,
                        chainId: String(chainId),
                        address: account?.address,
                        step: context?.step,
                        tab: undefined
                    });

                    // Node details are stored on flow
                    const switchNodeValidator =
                        state.ui.screens.inputData[context?.flowId]?.data?.switchNodeValidator;

                    const switchNodeToValidator =
                        state.ui.screens.inputData[context?.flowId]?.data?.switchNodeToValidator;

                    // Open Process Tx
                    if (
                        switchNodeValidator &&
                        switchNodeToValidator &&
                        action.params?.params?.token &&
                        state.ui.screens.inputData &&
                        state.ui.screens.inputData[screenKey] &&
                        state.ui.screens.inputData[screenKey]?.data?.amount
                    ) {
                        const fromValidator = buildDummyValidator(
                            switchNodeValidator.id,
                            switchNodeValidator.name
                        );

                        const validators = [
                            buildDummyValidator(
                                switchNodeToValidator.id,
                                switchNodeToValidator.name
                            )
                        ];

                        const amount = state.ui.screens.inputData[screenKey]?.data?.amount;

                        redelegate(
                            getSelectedAccount(state),
                            amount,
                            validators,
                            action.params.params.token,
                            undefined, // feeOptions
                            { fromValidator }
                        )(dispatch, getState);
                    }
                    break;
                }

                case 'setSwitchNodeValidator':
                    setScreenInputData(action.params?.params?.flowId, {
                        switchNodeValidator: {
                            id: action.params?.params?.validatorId,
                            name: action.params?.params?.validatorName,
                            availableBalance: action.params?.params?.availableBalance
                        }
                    })(dispatch, getState);
                    break;

                case 'setSwitchNodeToValidator':
                    setScreenInputData(action.params?.params?.flowId, {
                        switchNodeToValidator: {
                            id: action.params?.params?.validatorId,
                            name: action.params?.params?.validatorName,
                            availableBalance: action.params?.params?.availableBalance
                        }
                    })(dispatch, getState);
                    break;

                case 'hasPendingTransactions':
                    if (getNrPendingTransactions(state)) {
                        const nvServiceFn =
                            NavigationService.getCurrentRoute() === 'Dashboard'
                                ? 'navigate'
                                : 'replace';
                        Dialog.alert(
                            translate('Validator.cannotInitiateTxTitle'),
                            translate('Validator.cannotInitiateTxMessage'),
                            undefined,
                            {
                                text: translate('App.labels.ok'),
                                onPress: () =>
                                    NavigationService[nvServiceFn]('TransactonsHistory', {})
                            }
                        );
                    }
                    break;

                case 'selectBlockchain':
                    setSelectedBlockchain(action.params?.params?.blockchain)(dispatch, getState);
                    break;

                case 'switchNodeSelectReasons': {
                    const infoText = action.params?.params?.infoText;
                    const flowId = action.params?.params?.flowId;

                    const selectReasons = [];
                    Object.assign(
                        selectReasons,
                        state.ui.screens.inputData[flowId]?.data?.selectReasons
                    );
                    const reasonIndex = selectReasons.findIndex(r => r === infoText);

                    if (reasonIndex === -1) {
                        // select reason
                        selectReasons.push(infoText);
                    } else {
                        // unselect reason
                        selectReasons.splice(reasonIndex, 1);
                    }

                    setScreenInputData(flowId, {
                        selectReasons
                    })(dispatch, getState);
                    break;
                }

                case 'saveDataToUrl': {
                    if (action?.params?.params?.url && action?.params?.params?.data) {
                        let data = action.params.params.data;

                        const url = action.params.params.url;
                        const httpClient = new HttpClient(url);

                        const flowId = data?.flowId;

                        if (
                            state.ui.screens.inputData &&
                            state.ui.screens.inputData[flowId]?.data
                        ) {
                            data = {
                                ...data,
                                flowData: state.ui.screens.inputData[flowId]?.data
                            };
                        }

                        const account = getSelectedAccount(state);
                        const chainId = getChainId(state, account.blockchain);

                        const screenKey = getScreenDataKey({
                            pubKey: getSelectedWallet(state)?.walletPublicKey,
                            blockchain: account?.blockchain,
                            chainId: String(chainId),
                            address: account?.address,
                            step: data?.context?.step || action.params?.params?.step,
                            tab: undefined
                        });

                        if (
                            state.ui.screens.inputData &&
                            state.ui.screens.inputData[screenKey]?.data
                        ) {
                            data = {
                                ...data,
                                screenData: state.ui.screens.inputData[screenKey]?.data
                            };
                        }

                        try {
                            await httpClient.post('', { ...data });
                        } catch {
                            //
                        }
                    }
                    break;
                }

                case 'canPerformAction': {
                    const blockchain = getSelectedBlockchain(state);
                    const blockchainInstance = getBlockchain(blockchain);
                    const chainId = getChainId(state, blockchain);
                    const { opAction, validatorAddress } = action?.params?.params;

                    if (opAction && validatorAddress && Array.isArray(validatorAddress)) {
                        const performAction: {
                            value: boolean;
                            message: string;
                        } = await blockchainInstance.getClient(chainId).canPerformAction(opAction, {
                            account: getSelectedAccount(state),
                            validatorAddress
                        });

                        if (performAction && performAction.value === false) {
                            Dialog.alert(
                                translate('Validator.operationNotAvailable'),
                                performAction.message,
                                undefined,
                                {
                                    text: translate('App.labels.ok'),
                                    onPress: () => NavigationService.goBack()
                                }
                            );
                        }
                    }
                    break;
                }

                case 'stakeNowSupportDialog': {
                    const {
                        title,
                        body,
                        button1Text,
                        button2Text,
                        // flowId,
                        validators,
                        moonletValidatorId,
                        amount,
                        token
                    } = action?.params?.params;

                    Dialog.alert(
                        title,
                        body,
                        {
                            text: button1Text,
                            onPress: () => {
                                // I don't care

                                // Remove Moonlet Validator

                                const validatorsWithoutMoonlet = validators.filter(
                                    vld =>
                                        vld?.address?.toLowerCase() !==
                                            moonletValidatorId?.toLowerCase() &&
                                        vld?.id?.toLowerCase() !== moonletValidatorId?.toLowerCase()
                                );

                                const selectedValidators = [];
                                for (const v of validatorsWithoutMoonlet) {
                                    selectedValidators.push(
                                        buildDummyValidator(
                                            v?.address || v?.id,
                                            v.name,
                                            v?.icon,
                                            v?.website
                                        )
                                    );
                                }

                                // Open process tx
                                delegate(
                                    getSelectedAccount(state),
                                    amount,
                                    selectedValidators,
                                    token,
                                    undefined, // feeOptions
                                    undefined
                                )(dispatch, getState);

                                // NavigationService.navigate(
                                //     'SmartScreen',
                                //     {
                                //         context: {
                                //             screen: 'StakeNow',
                                //             step: 'StakeNowQuestionnaire',
                                //             key: 'stake-now-questionnaire',
                                //             flowId,
                                //             params: {
                                //                 validators
                                //             }
                                //         },
                                //         navigationOptions: {
                                //             title: 'Questionnaire'
                                //         }
                                //     },
                                //     'stake-now-questionnaire'
                                // );
                            }
                        },
                        {
                            text: button2Text,
                            onPress: () => {
                                // I’ll support you

                                // Check validations
                                const account = getSelectedAccount(state);
                                const chainId = getChainId(state, account.blockchain);

                                const screenKey = getScreenDataKey({
                                    pubKey: getSelectedWallet(state)?.walletPublicKey,
                                    blockchain: account?.blockchain,
                                    chainId: String(chainId),
                                    address: account?.address,
                                    step: action.params?.params?.step,
                                    tab: undefined
                                });

                                if (
                                    state.ui.screens.inputData[screenKey]?.validation?.valid ===
                                    true
                                ) {
                                    // Open process tx and start processing
                                    handleCta(
                                        {
                                            type: 'callAction',
                                            params: {
                                                action: 'delegateToValidatorV2',
                                                params: {
                                                    step: action?.params?.params?.step,
                                                    token: action?.params?.params?.token
                                                }
                                            }
                                        },
                                        options
                                    )(dispatch, getState);
                                } else {
                                    const msg =
                                        (state.ui.screens.inputData[screenKey]?.validation
                                            ?.fieldsErrors?.amount &&
                                            state.ui.screens.inputData[screenKey]?.validation
                                                ?.fieldsErrors?.amount[0]?.message) ||
                                        translate('App.labels.errorOccured');
                                    Dialog.info(translate('App.labels.warning'), msg);
                                }
                            }
                        }
                    );
                    break;
                }

                case 'navigateToEnterAmountStep': {
                    const validators = action?.params?.params?.validators || [];

                    const selectedValidators = [];
                    for (const v of validators) {
                        selectedValidators.push(
                            buildDummyValidator(v?.address || v?.id, v.name, v?.icon, v?.website)
                        );
                    }

                    const account = getSelectedAccount(state);
                    const chainId = getChainId(state, account.blockchain);
                    const token =
                        account.tokens[chainId][getBlockchain(account.blockchain).config.coin];

                    // Navigate to enter amount step
                    navigateToEnterAmountStep(
                        account.index,
                        account.blockchain,
                        token,
                        selectedValidators,
                        'App.labels.stakeNow',
                        'QuickDelegateEnterAmount',
                        QUICK_DELEGATE_ENTER_AMOUNT,
                        undefined,
                        action?.params?.params?.screenKey
                    )(dispatch);

                    break;
                }

                case 'amountSelectableBoxPercentageToMoonlet': {
                    const screenKey = options?.screenKey;

                    const amountBox =
                        (screenKey &&
                            state.ui.screens.inputData &&
                            state.ui.screens.inputData[options.screenKey]?.data?.amountBox) ||
                        action?.params?.params?.amountBox;

                    if (
                        action?.params?.params?.amount &&
                        amountBox &&
                        amountBox?.type === 'percentage' &&
                        amountBox?.value &&
                        action?.params?.params?.validators &&
                        Array.isArray(action.params.params.validators)
                    ) {
                        const inputAmount = action.params.params.amount;
                        const validators = action.params.params.validators;
                        const percentage = amountBox.value;

                        const moonletValidator = validators[0];
                        const moonletValidatorStakedAmount = new BigNumber(percentage)
                            .multipliedBy(new BigNumber(inputAmount))
                            .dividedBy(100);

                        setScreenInputData(screenKey, {
                            [moonletValidator.address]: {
                                validator: moonletValidator,
                                amount: moonletValidatorStakedAmount
                            }
                        })(dispatch, getState);

                        // (100 - procent) / (validators length - 1) * input * 100
                        const splitStakePerOtherValidators = new BigNumber(
                            new BigNumber(100).minus(new BigNumber(percentage))
                        )
                            .dividedBy(new BigNumber(validators.length - 1))
                            .multipliedBy(new BigNumber(inputAmount))
                            .dividedBy(new BigNumber(100));

                        for (const validator of action.params.params.validators) {
                            const vId = validator?.address || validator?.id;
                            if (vId !== moonletValidator.address) {
                                setScreenInputData(screenKey, {
                                    [vId]: {
                                        validator,
                                        amount: splitStakePerOtherValidators
                                    }
                                })(dispatch, getState);
                            }
                        }

                        runScreenValidation(
                            state.ui.screens.data.StakeNow[options.screenKey].response?.validation,
                            options.screenKey
                        )(dispatch, getState);
                    }
                    break;
                }

                case 'navigateToStakeNowEnterAmountValidators': {
                    const account = getSelectedAccount(state);
                    const chainId = getChainId(state, account.blockchain);

                    const screenKey = getScreenDataKey({
                        pubKey: getSelectedWallet(state)?.walletPublicKey,
                        blockchain: account?.blockchain,
                        chainId: String(chainId),
                        address: account?.address,
                        step: action.params?.params?.step,
                        tab: undefined
                    });

                    const validators: any = state.ui.screens.inputData[screenKey]?.data?.validators;

                    NavigationService.navigate(
                        'SmartScreen',
                        {
                            context: {
                                screen: 'StakeNow',
                                step: 'StakeNowEnterAmountValidators',
                                key: 'stake-now-enter-amount-validators',
                                screenKey,
                                params: {
                                    validators
                                }
                            },
                            navigationOptions: {
                                title: 'Stake now'
                            }
                        },
                        screenKey
                    );
                    break;
                }

                case 'navigateToStakeNowPartToMoonlet': {
                    const account = getSelectedAccount(state);
                    const chainId = getChainId(state, account.blockchain);

                    const screenKey = getScreenDataKey({
                        pubKey: getSelectedWallet(state)?.walletPublicKey,
                        blockchain: account?.blockchain,
                        chainId: String(chainId),
                        address: account?.address,
                        step: action.params?.params?.step,
                        tab: undefined
                    });

                    const validators: any = action.params?.params?.validators;
                    const amount = state.ui.screens.inputData[screenKey]?.data?.amount;

                    NavigationService.navigate(
                        'SmartScreen',
                        {
                            context: {
                                screen: 'StakeNow',
                                step: 'StakeNowPartToMoonlet',
                                key: 'switch-node-part-to-moonlet',
                                flowId: action.params?.params?.flowId || screenKey,
                                params: {
                                    validators,
                                    amount
                                }
                            },
                            navigationOptions: {
                                title: 'Stake now',
                                headerStyle: {
                                    backgroundColor: '#005067',
                                    borderBottomWidth: 0
                                }
                            },
                            background: {
                                gradient: ['#005067', '#061529']
                            }
                        },
                        screenKey
                    );
                    break;
                }

                case 'navigateToStakeNowPartToMoonletCheckAmount': {
                    const account = getSelectedAccount(state);
                    const chainId = getChainId(state, account.blockchain);

                    const screenKey = getScreenDataKey({
                        pubKey: getSelectedWallet(state)?.walletPublicKey,
                        blockchain: account?.blockchain,
                        chainId: String(chainId),
                        address: account?.address,
                        step: action.params?.params?.step,
                        tab: undefined
                    });

                    const amount = state.ui.screens.inputData[screenKey]?.data?.amount;
                    const minAmountToStake = action.params?.params?.minAmountToStake || 100;

                    if (new BigNumber(amount).isGreaterThan(new BigNumber(minAmountToStake))) {
                        handleCta(
                            {
                                type: 'callAction',
                                params: {
                                    action: 'navigateToStakeNowPartToMoonlet',
                                    params: {
                                        step: action.params?.params?.step,
                                        validators: action.params?.params?.validators,
                                        flowId: action.params?.params?.flowId
                                    }
                                }
                            },
                            options
                        )(dispatch, getState);
                    } else {
                        handleCta({
                            type: 'callAction',
                            params: {
                                action: 'delegateToValidatorV2',
                                params: {
                                    step: action.params?.params?.step,
                                    validators: action.params?.params?.validators,
                                    flowId: action.params?.params?.flowId,
                                    token: action.params?.params?.token
                                }
                            }
                        })(dispatch, getState);
                    }
                    break;
                }

                default:
                    break;
            }
            break;

        case 'navigateTo': {
            const account = getSelectedAccount(state);

            const blockchain = account?.blockchain;

            const chainId = blockchain && getChainId(state, blockchain);

            let token: ITokenState;
            if (blockchain && action?.params?.params?.token === true) {
                const blockchainConfig = getBlockchain(blockchain);
                token = account.tokens[chainId][blockchainConfig.config.coin];
            }

            const screen = action.params?.params?.screen || action.params?.screen;
            const screenKey = action.params?.params?.context?.key;

            NavigationService.navigate(
                screen,
                {
                    ...action.params?.params,
                    blockchain,
                    accountIndex: account?.index,
                    token
                },
                screenKey
            );
            break;
        }

        case 'openUrl':
            action?.params?.url && openURL(action.params.url);
            break;

        case 'onBack':
            NavigationService.goBack();
            break;

        default:
            break;
    }
};
