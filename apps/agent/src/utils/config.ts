// Configuration management
import { readFileSync } from 'fs';

export interface Config {
    arcRpcUrl: string;
    arcChainId: number;
    usdcContract: string;
    circleApiKey: string;
    circleEntitySecret: string;
    circleWalletId: string;
    circleKitKey: string;
    agentPrivateKey: string;
    agentRulesPath: string;
}

export function createConfig(): Config {
    // Load .env if it exists
    try {
        const envFile = readFileSync('.env', 'utf-8');
        envFile.split('\n').forEach(line => {
            const [key, ...values] = line.split('=');
            if (key && values.length && !key.startsWith('#')) {
                process.env[key.trim()] = values.join('=').trim();
            }
        });
    } catch (e) {
        // .env not found, rely on process.env
    }

    return {
        arcRpcUrl: process.env.ARC_RPC_URL || 'https://rpc.testnet.arc.network',
        arcChainId: parseInt(process.env.ARC_CHAIN_ID || '5042002'),
        usdcContract: process.env.USDC_CONTRACT || '0x360000000000000000000000000000000000000002',
        circleApiKey: process.env.CIRCLE_API_KEY || '',
        circleEntitySecret: process.env.CIRCLE_ENTITY_SECRET || '',
        circleWalletId: process.env.CIRCLE_WALLET_ID || '',
        circleKitKey: process.env.CIRCLE_KIT_KEY || '',
        agentPrivateKey: process.env.AGENT_PRIVATE_KEY || '',
        agentRulesPath: process.env.AGENT_RULES_PATH || './config/rules.json',
    };
}
