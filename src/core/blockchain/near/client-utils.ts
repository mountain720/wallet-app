import { IClientUtils } from '../types/client-utils';
import { Client } from './client';
import { Blockchain, TransactionType, IBlockchainTransaction } from '../types';
import { Near } from '.';
import { getTokenConfig } from '../../../redux/tokens/static-selectors';
import { TransactionStatus } from '../../wallet/types';
import { ITokenConfigState } from '../../../redux/tokens/state';

export class ClientUtils implements IClientUtils {
    constructor(private client: Client) {}

    async getTransaction(
        hash: string,
        options: { address: string }
    ): Promise<IBlockchainTransaction> {
        const res = await this.client.http.jsonRpc('tx', [hash, options.address]);

        return this.buildTransactionFromBlockchain(res.result);
    }

    async getTransactionStatus(
        hash: string,
        context: {
            address?: string;
            txData?: any;
            currentBlockNumber?: number;
            token?: ITokenConfigState;
        }
    ): Promise<TransactionStatus> {
        try {
            if (context?.txData?.status) {
                return Near.transaction.getTransactionStatusByCode(context.txData.status);
            }

            if (context?.address) {
                const tx = await this.getTransaction(hash, { address: context.address });
                return tx.status;
            }
        } catch (error) {
            //
        }
    }

    async buildTransactionFromBlockchain(txData: any): Promise<IBlockchainTransaction> {
        const transaction: IBlockchainTransaction = {
            id: txData.transaction.hash,
            type: TransactionType.TRANSFER,
            date: {
                created: Date.now(),
                signed: Date.now(),
                broadcasted: Date.now(),
                confirmed: Date.now()
            },
            blockchain: Blockchain.NEAR,
            chainId: this.client.chainId,

            address: txData.transaction.signer_id,
            toAddress: txData.transaction.receiver_id,
            publicKey: txData.transaction.public_key,

            amount: '0',
            data: null,
            feeOptions: null,
            broadcastedOnBlock: undefined, // TODO: use txData.receipts_outcome.block_hash
            status: Near.transaction.getTransactionStatusByCode(txData.status),
            token: getTokenConfig(Blockchain.NEAR, 'NEAR'),
            nonce: txData.transaction.nonce
        };

        for (const action of txData.transaction.actions) {
            if (action?.Transfer) {
                transaction.amount = action.Transfer.deposit;
                transaction.additionalInfo = {
                    actions: [{ type: TransactionType.TRANSFER }]
                };
            } else if (action?.FunctionCall) {
                transaction.type = TransactionType.CONTRACT_CALL;

                const nearReceiptsOutcomeLogsRegex = [
                    /The deposit and stake of ([^ ]*) to @?([^ ]*) succeeded/i,
                    /The deposit of ([^ ]*) to @?([^ ]*) succeeded/i,
                    /Staking of ([^ ]*) at @?([^ ]*) succeeded/i,
                    /The withdrawal of ([^ ]*) from @?([^ ]*) succeeded/i
                ];

                for (const receiptsOutcome of txData?.receipts_outcome || []) {
                    for (const log of receiptsOutcome?.outcome?.logs || []) {
                        for (const regex of nearReceiptsOutcomeLogsRegex) {
                            const outcome = log.match(regex);
                            if (outcome && outcome[1] && outcome[2]) {
                                transaction.amount = outcome[1];
                                transaction.toAddress = outcome[2]; // validatorId
                                transaction.address = txData.transaction.receiver_id;
                            }
                        }

                        const outcomeAmount = log.match(/^@?[^ ]* staking ([0-9]*)\./);
                        if (outcomeAmount && outcomeAmount[1]) {
                            transaction.amount = outcomeAmount[1];
                        }
                    }
                }
            }
        }

        return transaction;
    }
}
