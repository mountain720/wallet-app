export const AVAILABLE_CURRENCIES = [
    'AUD',
    'CAD',
    'CNY',
    'DAI',
    'EUR',
    'GBP',
    'JPY',
    'SGD',
    'THB',
    'USD',
    'USDT'
];
export const WC_CONNECTION = 'wcConnection';
export const WC = {
    GET_STATE: 'moonletGetState',
    SIGN_TRANSACTION: 'moonletSignTransaction',
    UPDATE_STATE: 'moonletUpdateState',
    PING: 'moonletPing'
};
export const CONN_EXTENSION = 'connectExtension';
export const RESET_APP_FAILED_LOGINS = 15;
export const FAILED_LOGIN_BLOCKING = {
    3: 5 * 60 * 1000, // 5 min
    6: 20 * 60 * 1000, // 20 min
    9: 60 * 60 * 1000, // 1h
    12: 24 * 60 * 60 * 1000 // 1 day
};
export const MNEMONIC_LENGTH = 12;

export enum AppStateStatus {
    ACTIVE = 'active',
    BACKGROUND = 'background',
    INACTIVE = 'inactive'
}

export const CONN_EXT_RETRY_ATTEMPTS = 3;

// TODO: move this to a config, maybe firebase or db?
export const NEAR_TLD = {
    mainnet: 'near',
    testnet: 'testnet'
};
export const NEAR_LOCKUP_SUFFIX = {
    mainnet: '.lockup.near',
    testnet: '.testnet'
};
