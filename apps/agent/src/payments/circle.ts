// Circle Agent Stack wallet integration
// Arc Testnet uses USDC as native gas token (6 decimals)
import { createPublicClient, http, createWalletClient, parseUnits, defineChain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { Config } from '../utils/config.js';
import { Logger } from '../utils/logger.js';

const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  network: 'arc-testnet',
  nativeCurrency: { decimals: 6, name: 'USD Coin', symbol: 'USDC' },
  rpcUrls: { default: { http: ['https://rpc.testnet.arc.network'] }, public: { http: ['https://rpc.testnet.arc.network'] } },
  blockExplorers: { default: { name: 'Arc Explorer', url: 'https://testnet.arcscan.app' } },
  testnet: true,
});

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
            
            const amountWei = parseUnits(amount.toString(), 6);  // USDC uses 6 decimals on Arc
            
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

    // Nanopayments — sub-cent USDC transfers (0.000001 to 0.01 USDC)
    async sendNanopayment(to: string, microAmount: number, memo?: string): Promise<string> {
        if (!this.initialized || !this.walletClient) {
            throw new Error('Wallet not initialized');
        }

        // microAmount is in micro-USDC (0.000001 USDC = 1 micro-USDC)
        if (microAmount < 1 || microAmount > 10000) {
            throw new Error('Nanopayment amount must be between 1 and 10,000 micro-USDC (0.000001-0.01 USDC)');
        }

        const amountWei = BigInt(microAmount); // Already in 6-decimal format
        
        logger.info(`Sending nanopayment: ${microAmount} micro-USDC (${microAmount / 1000000} USDC) to ${to}...`);
        
        const hash = await this.walletClient.sendTransaction({
            to: to as `0x${string}`,
            value: amountWei,
            data: memo ? `0x${Buffer.from(`nano:${memo}`, 'utf8').toString('hex')}` : `0x${Buffer.from('nanopayment', 'utf8').toString('hex')}`,
        });

        logger.info(`Nanopayment sent: ${hash}`);
        return hash;
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
