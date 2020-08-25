import {
    IBlockchainTransaction,
    ITransferTransaction,
    TransactionType,
    AbstractBlockchainTransactionUtils,
    IPosTransaction
} from '../types';
import { INearTransactionAdditionalInfoType, NearTransactionActionType, Near } from './';
import { TransactionStatus } from '../../wallet/types';
import {
    transfer,
    createTransaction,
    signTransaction,
    functionCall
} from 'near-api-js/lib/transaction';
import { KeyPair, PublicKey } from 'near-api-js/lib/utils/key_pair';
import { base_decode } from 'near-api-js/lib/utils/serialize';
import BN from 'bn.js';
import sha256 from 'js-sha256';
import { getTokenConfig } from '../../../redux/tokens/static-selectors';
import { PosBasicActionType } from '../types/token';
import { Client as NearClient } from './client';
import cloneDeep from 'lodash/cloneDeep';

const DEFAULT_FUNC_CALL_GAS = new BN('100000000000000');

export class NearTransactionUtils extends AbstractBlockchainTransactionUtils {
    public async sign(
        tx: IBlockchainTransaction<INearTransactionAdditionalInfoType>,
        privateKey: string
    ): Promise<any> {
        // transaction actions
        const actions = tx.additionalInfo.actions
            .map(action => {
                switch (action.type) {
                    case NearTransactionActionType.TRANSFER:
                        return transfer(new BN(tx.amount));

                    case NearTransactionActionType.FUNCTION_CALL:
                        if (tx.data.method === 'deposit') {
                            return functionCall(
                                tx.data.method,
                                {},
                                DEFAULT_FUNC_CALL_GAS,
                                new BN(tx.amount)
                            );
                        } else {
                            return functionCall(
                                tx.data.method,
                                { amount: tx.amount },
                                DEFAULT_FUNC_CALL_GAS,
                                new BN('0')
                            );
                        }

                    default:
                        return false;
                }
            })
            .filter(Boolean);

        // setup KeyPair
        const keyPair = KeyPair.fromString(privateKey);

        // create transaction
        const nearTx = createTransaction(
            tx.address,
            PublicKey.fromString(tx.publicKey),
            tx.toAddress,
            tx.nonce,
            actions as any,
            base_decode(tx.additionalInfo.currentBlockHash)
        );

        // sign transaction
        const signer: any = {
            async signMessage(message) {
                const hash = new Uint8Array(sha256.sha256.array(message));
                return keyPair.sign(hash);
            },
            async getPublicKey() {
                return keyPair.getPublicKey();
            }
        };

        const signedTx = await signTransaction(nearTx, signer, tx.address, tx.chainId as string);

        return Buffer.from(signedTx[1].encode()).toString('base64');
    }

    public async buildTransferTransaction(
        tx: ITransferTransaction
    ): Promise<IBlockchainTransaction<INearTransactionAdditionalInfoType>> {
        const client = Near.getClient(tx.chainId);
        const nonce = await client.getNonce(tx.account.address, tx.account.publicKey);
        const blockInfo = await client.getCurrentBlock();

        const tokenConfig = getTokenConfig(tx.account.blockchain, tx.token);

        return {
            date: {
                created: Date.now(),
                signed: Date.now(),
                broadcasted: Date.now(),
                confirmed: Date.now()
            },
            blockchain: tx.account.blockchain,
            chainId: tx.chainId,
            type: TransactionType.TRANSFER,
            token: tokenConfig,

            address: tx.account.address,
            publicKey: tx.account.publicKey,

            toAddress: tx.toAddress,
            amount: tx.amount,
            feeOptions: tx.feeOptions,
            broadcastedOnBlock: undefined,
            nonce,
            status: TransactionStatus.PENDING,
            additionalInfo: {
                currentBlockHash: blockInfo.hash,
                actions: [
                    {
                        type: NearTransactionActionType.TRANSFER
                    }
                ]
            }
        };
    }

    public async buildPosTransaction(
        tx: IPosTransaction,
        transactionType: PosBasicActionType
    ): Promise<IBlockchainTransaction[]> {
        const client = Near.getClient(tx.chainId);

        const transactions: IBlockchainTransaction[] = [];

        switch (transactionType) {
            case PosBasicActionType.DELEGATE: {
                for (const validator of tx.validators) {
                    const txVote: IPosTransaction = cloneDeep(tx);

                    // Deposit
                    const depositTx: IBlockchainTransaction = await (client as NearClient).staking.deposit(
                        txVote,
                        validator
                    );
                    transactions.push(depositTx);

                    // Stake
                    const stakeTx: IBlockchainTransaction = await (client as NearClient).staking.stake(
                        txVote,
                        validator
                    );
                    stakeTx.nonce = stakeTx.nonce + transactions.length; // increase nonce with the number of previous transactions
                    transactions.push(stakeTx);
                }
            }
        }

        return transactions;
    }

    public getTransactionAmount(tx: IBlockchainTransaction): string {
        return tx.amount;
    }

    public getTransactionStatusByCode(status: any): TransactionStatus {
        if (status.SuccessValue === '') {
            return TransactionStatus.SUCCESS;
        } else if (status?.Failure) {
            return TransactionStatus.FAILED;
        } else {
            return TransactionStatus.FAILED;
        }
    }
}
