// Arc Network interactions
import { createPublicClient, http, type Hash } from 'viem';
import { arcTestnet } from 'viem/chains';
import { Config } from '../utils/config.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('ArcNetwork');

export class ArcNetwork {
    private config: Config;
    private publicClient: any;

    constructor(config: Config) {
        this.config = config;
        this.publicClient = createPublicClient({
            chain: arcTestnet,
            transport: http(config.arcRpcUrl),
        });
    }

    async getChainId(): Promise<number> {
        const chainId = await this.publicClient.getChainId();
        return chainId;
    }

    async getBlockNumber(): Promise<number> {
        return await this.publicClient.getBlockNumber();
    }

    async getTransaction(txHash: string): Promise<any> {
        return await this.publicClient.getTransaction({
            hash: txHash as Hash,
        });
    }

    async getTransactionReceipt(txHash: string): Promise<any> {
        return await this.publicClient.getTransactionReceipt({
            hash: txHash as Hash,
        });
    }

    async verifyTransaction(txHash: string): Promise<boolean> {
        try {
            const receipt = await this.getTransactionReceipt(txHash);
            return receipt.status === 'success';
        } catch (error) {
            logger.error('Failed to verify transaction:', error);
            return false;
        }
    }

    async getGasPrice(): Promise<string> {
        const gasPrice = await this.publicClient.getGasPrice();
        // Arc uses USDC as gas (18 decimals)
        const gasPriceUSDC = Number(gasPrice) / 1e18;
        return `${gasPriceUSDC.toFixed(9)} USDC`;
    }

    async getAddressBalance(address: string): Promise<string> {
        const balance = await this.publicClient.getBalance({
            address: address as `0x${string}`,
        });
        const balanceUSDC = Number(balance) / 1e18;
        return `${balanceUSDC.toFixed(6)} USDC`;
    }

    getExplorerUrl(txHash: string): string {
        return `${this.config.arcRpcUrl.includes('testnet') ? 'https://testnet.arcscan.app' : 'https://arcscan.app'}/tx/${txHash}`;
    }

    // Listen to onchain events (for signal monitoring)
    async watchEvent(
        contractAddress: string,
        eventName: string,
        abi: any[],
        onEvent: (event: any) => void
    ): Promise<void> {
        logger.info(`Watching ${eventName} on ${contractAddress}...`);
        
        const unwatch = this.publicClient.watchContractEvent({
            address: contractAddress as `0x${string}`,
            abi,
            eventName,
            onLogs: (logs: any[]) => {
                logs.forEach(log => onEvent(log));
            },
        });

        // Store unwatch function for cleanup
        this.unwatchFunctions.push(unwatch);
    }

    private unwatchFunctions: (() => void)[] = [];

    cleanup() {
        this.unwatchFunctions.forEach(fn => fn());
        this.unwatchFunctions = [];
    }
}
