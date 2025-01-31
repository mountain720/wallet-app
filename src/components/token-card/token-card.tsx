import React from 'react';
import { View } from 'react-native';
import { IAccountState, ITokenState } from '../../redux/wallets/state';
import { Icon } from '../icon/icon';
import stylesProvider from './styles';
import { withTheme, IThemeProps } from '../../core/theme/with-theme';
import { NavigationScreenProp, NavigationState, NavigationParams } from 'react-navigation';
import { Amount } from '../amount/amount';
import { Blockchain } from '../../core/blockchain/types';
import { SmartImage } from '../../library/image/smart-image';
import { BASE_DIMENSION, normalize } from '../../styles/dimensions';
import { TouchableHighlight } from 'react-native-gesture-handler';
import { getTokenConfig } from '../../redux/tokens/static-selectors';
import { IconValues } from '../icon/values';
import { NavigationService } from '../../navigation/navigation-service';
import { translate } from '../../core/i18n';

interface IProps {
    blockchain: Blockchain;
    token: ITokenState;
    account: IAccountState;
    styles: ReturnType<typeof stylesProvider>;
    navigation: NavigationScreenProp<NavigationState, NavigationParams>;
    index: number;
}

const TokenCardComponent = (props: IProps & IThemeProps<ReturnType<typeof stylesProvider>>) => {
    const { account, blockchain, index, token, styles, theme } = props;

    const tokenConfig = getTokenConfig(account.blockchain, token.symbol);

    if (tokenConfig) {
        return (
            <TouchableHighlight
                testID={`token-card-${token.symbol.toLocaleLowerCase()}`}
                style={{ marginTop: index === 0 ? 0 : BASE_DIMENSION }}
                underlayColor={theme.colors.appBackground}
                onPress={() => {
                    NavigationService.navigate('Token', {
                        accountIndex: account.index,
                        blockchain: account.blockchain,
                        token,
                        accountName:
                            account?.name ||
                            `${translate('App.labels.account')} ${account.index + 1}`
                    });
                }}
            >
                <View style={styles.container}>
                    <SmartImage source={tokenConfig.icon} style={styles.imageStyle} />
                    <View style={styles.accountInfoContainer}>
                        <Amount
                            style={styles.firstAmount}
                            token={token.symbol}
                            tokenDecimals={tokenConfig.decimals}
                            uiDecimals={tokenConfig.ui.decimals}
                            amount={token.balance?.total || token.balance?.value}
                            blockchain={blockchain}
                        />
                        <Amount
                            style={styles.secondAmount}
                            token={token.symbol}
                            tokenDecimals={tokenConfig.decimals}
                            amount={token.balance?.total || token.balance?.value}
                            blockchain={blockchain}
                            convert
                        />
                    </View>
                    <Icon
                        name={IconValues.CHEVRON_RIGHT}
                        size={normalize(18)}
                        style={styles.icon}
                    />
                </View>
            </TouchableHighlight>
        );
    } else {
        // Used for web platform, tokens are not saved in the web storage
        // when the connection between the phone and web is lost
        return null;
    }
};

export const TokenCard = withTheme(stylesProvider)(TokenCardComponent);
