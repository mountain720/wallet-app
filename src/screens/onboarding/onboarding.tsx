import React from 'react';
import { View, Image, TouchableOpacity, Clipboard } from 'react-native';
import { Text, Button } from '../../library';
import stylesProvider from './styles';
import { withTheme, IThemeProps } from '../../core/theme/with-theme';
import { createHDWallet } from '../../redux/wallets/actions';
import { connect } from 'react-redux';
import { smartConnect } from '../../core/utils/smart-connect';
import { translate } from '../../core/i18n';
import { IReduxState } from '../../redux/state';
import { INavigationProps } from '../../navigation/with-navigation-params';

const COPY_DEVICE_ID_ATTEMPTS = 10;

export interface IReduxProps {
    deviceId: string;
    createHDWallet: typeof createHDWallet;
}

const mapStateToProps = (state: IReduxState) => ({
    deviceId: state.preferences.deviceId
});

const mapDispatchToProps = {
    createHDWallet
};

interface IState {
    copyDeviceIdLeft: number;
}

const navigationOptions = () => ({ header: null });

export class OnboardingScreenComponent extends React.Component<
    INavigationProps & IThemeProps<ReturnType<typeof stylesProvider>> & IReduxProps,
    IState
> {
    public static navigationOptions = navigationOptions;

    constructor(
        props: INavigationProps & IThemeProps<ReturnType<typeof stylesProvider>> & IReduxProps
    ) {
        super(props);
        this.state = {
            copyDeviceIdLeft: COPY_DEVICE_ID_ATTEMPTS
        };
    }

    public onPressRecover() {
        this.props.navigation.navigate('RecoverWallet');
    }
    public onPressCreate() {
        this.props.navigation.navigate('CreateWalletMnemonic', {
            mnemonic: undefined,
            step: 1
        });
    }

    public onPressConnect() {
        this.props.navigation.navigate('ConnectHardwareWallet');
    }

    public render() {
        const { styles } = this.props;
        const { copyDeviceIdLeft } = this.state;

        return (
            <View testID="onboarding-screen" style={styles.container}>
                <View style={styles.topContainer}>
                    <TouchableOpacity
                        activeOpacity={1}
                        onPress={() =>
                            this.setState({ copyDeviceIdLeft: copyDeviceIdLeft - 1 }, () => {
                                if (copyDeviceIdLeft === 0) {
                                    Clipboard.setString(this.props.deviceId);
                                    this.setState({ copyDeviceIdLeft: COPY_DEVICE_ID_ATTEMPTS });
                                }
                            })
                        }
                    >
                        <Image
                            style={styles.logoImage}
                            source={require('../../assets/images/png/moonlet_space.png')}
                        />
                    </TouchableOpacity>

                    <View style={styles.textContainer}>
                        <Text style={styles.welcomeTitle}>
                            {translate('Onboarding.welcomeTitle')}
                        </Text>
                        <Text style={styles.welcomeText}>
                            {translate('Onboarding.welcomeText')}
                        </Text>
                    </View>
                </View>

                <View style={styles.buttonsContainer}>
                    <View style={styles.topButtons}>
                        <Button
                            testID="recover-button"
                            style={[styles.leftButton]}
                            wrapperStyle={{ flex: 1 }}
                            onPress={() => this.onPressRecover()}
                        >
                            {translate('App.labels.recover')}
                        </Button>
                        <Button
                            style={[styles.rightButton]}
                            wrapperStyle={{ flex: 1 }}
                            onPress={() => this.onPressConnect()}
                        >
                            {translate('App.labels.connect')}
                        </Button>
                    </View>

                    <Button
                        testID="create-button"
                        style={styles.bottomButton}
                        primary
                        onPress={() => this.onPressCreate()}
                    >
                        {translate('App.labels.create')}
                    </Button>
                </View>
            </View>
        );
    }
}

export const OnboardingScreen = smartConnect(OnboardingScreenComponent, [
    connect(mapStateToProps, mapDispatchToProps),
    withTheme(stylesProvider)
]);
