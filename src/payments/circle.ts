// Circle Agent Stack wallet integration
import { createPublicClient, http, createWalletClient, formatUnits, parseUnits } from 'viem';
import { arcTestnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { Config } from '../utils/config.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('CircleWallet');

export class CircleWallet {
    private config: Config;
    private publicClient: any;
    private walletClient: any;
    private account: any;
    private initialized: boolean = false;

    constructor(config: Config) {
        this.config = config;
    }

    async initialize() {
        // Create Viem clients for Arc
        this.publicClient = createPublicClient({
            chain: arcTestnet,
            transport: http(this.config.arcRpcUrl),
        });

        // Create wallet client from private key
        if (this.config.agentPrivateKey) {
            this.account = privateKeyToAccount(this.config.agentPrivateKey as `0x${string}`);
            this.walletClient = createWalletClient({
                account: this.account,
                chain: arcTestnet,
                transport: http(this.config.arcRpcUrl),
            });
            logger.info(`Wallet initialized: ${this.account.address}`);
        } else {
            logger.warn('No private key configured — read-only mode');
        }

        this.initialized = true;
    }

    async getBalance(): Promise<string> {
        if (!this.initialized) await this.initialize();
        
        try {
            // Native USDC balance (18 decimals on Arc)
            const balance = await this.publicClient.getBalance({
                address: this.account?.address || '0x0000000000000000000000000000000000000000',
            });
            
            // Convert from wei (18 decimals) to USDC (6 decimals for display)
            const balanceUSDC = Number(balance) / 1e18;
            return balanceUSDC.toFixed(6);
        } catch (error) {
            logger.error('Failed to get balance:', error);
            return '0.000000';
        }
    }

    async getERC20Balance(tokenAddress: string, walletAddress: string): Promise<string> {
        try {
            const balance = await this.publicClient.readContract({
                address: tokenAddress as `0x${string}`,
                abi: [
                    {
                        name: 'balanceOf',
                        type: 'function',
                        inputs: [{ name: 'account', type: 'address' }],
                        outputs: [{ name: 'balance', type: 'uint256' }],
                    },
                ],
                functionName: 'balanceOf',
                args: [walletAddress as `0x${string}`],
            });
            return balance.toString();
        } catch (error) {
            logger.error('Failed to get ERC20 balance:', error);
            return '0';
        }
    }

    async sendUSDC(
        recipient: string,
        amount: number,
        memo?: string
    ): Promise<string> {
        if (!this.walletClient) {
            throw new Error('Wallet not initialized — no private key configured');
        }

        logger.info(`Sending ${amount} USDC to ${recipient}...`);

        try {
            // Arc USDC is native (18 decimals for gas) — use native transfer
            // For ERC-20 interface, use the USDC contract at 0x3600...
            
            const amountWei = parseUnits(amount.toString(), 18);
            
            // Native transfer on Arc (USDC is native gas token)
            const hash = await this.walletClient.sendTransaction({
                to: recipient as `0x${string}`,
                value: amountWei,
            });

            logger.success(`Transaction sent: ${hash}`);
            
            // Wait for confirmation
            const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
            logger.success(`Transaction confirmed in block ${receipt.blockNumber}`);
            
            return hash;
        } catch (error) {
            logger.error('Failed to send USDC:', error);
            throw error;
        }
    }

    async sendERC20(
        tokenAddress: string,
        recipient: string,
        amount: number,
        decimals: number = 6
    ): Promise<string> {
        if (!this.walletClient) {
            throw new Error('Wallet not initialized');
        }

        logger.info(`Sending ${amount} tokens to ${recipient}...`);

        try {
            const amountInToken = parseUnits(amount.toString(), decimals);
            
            const hash = await this.walletClient.writeContract({
                address: tokenAddress as `0x${string}`,
                abi: [
                    {
                        name: 'transfer',
                        type: 'function',
                        inputs: [
                            { name: 'to', type: 'address' },
                            { name: 'amount', type: 'uint256' },
                        ],
                        outputs: [{ name: 'success', type: 'bool' }],
                    },
                ],
                functionName: 'transfer',
                args: [recipient as `0x${string}`, amountInToken],
            });

            logger.success(`ERC20 transfer sent: ${hash}`);
            return hash;
        } catch (error) {
            logger.error('Failed to send ERC20:', error);
            throw error;
        }
    }

    // Circle Agent Stack methods (placeholder for API integration)
    async createWallet(): Promise<string> {
        // Circle Agent Stack — create developer-controlled wallet
        logger.info('Creating Circle Agent Stack wallet...');
        // Implementation: call Circle API to create wallet
        return 'wallet_id_placeholder';
    }

    async getWalletInfo(walletId: string): Promise<any> {
        // Circle Agent Stack — get wallet info
        return { walletId, balance: '0' };
    }
}
