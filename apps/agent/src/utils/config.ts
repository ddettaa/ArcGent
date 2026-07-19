// Configuration management
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface Config {
    arcRpcUrl: string;
    arcChainId: number;
    usdcContract: string;
    circleApiKey: string;
    circleEntitySecret: string;
    circleWalletId: string;
    circleKitKey: string;
    circleClientKey: string;
    agentPrivateKey: string;
    agentRulesPath: string;
    llmBaseUrl: string;
    llmApiKey: string;
    llmModel: string;
}

function loadEnv() {
    const paths = ['.env', '../.env', '../../.env', join(process.cwd(), '.env')];
    for (const envPath of paths) {
        try {
            if (!existsSync(envPath)) continue;
            const envFile = readFileSync(envPath, 'utf-8');
            envFile.split('\n').forEach(line => {
                const [key, ...values] = line.split('=');
                if (key && values.length && !key.startsWith('#')) {
                    process.env[key.trim()] = values.join('=').trim();
                }
            });
            return;
        } catch { /* continue */ }
    }
}

export function createConfig(): Config {
    loadEnv();
    return {
        arcRpcUrl: process.env.ARC_RPC_URL || 'https://rpc.testnet.arc.network',
        arcChainId: parseInt(process.env.ARC_CHAIN_ID || '5042002'),
        usdcContract: process.env.USDC_CONTRACT || '0x360000000000000000000000000000000000000002',
        circleApiKey: process.env.CIRCLE_API_KEY || '',
        circleEntitySecret: process.env.CIRCLE_ENTITY_SECRET || '',
        circleWalletId: process.env.CIRCLE_WALLET_ID || '',
        circleKitKey: process.env.CIRCLE_KIT_KEY || '',
        circleClientKey: process.env.CIRCLE_CLIENT_KEY || '',
        agentPrivateKey: process.env.AGENT_PRIVATE_KEY || '',
        agentRulesPath: process.env.AGENT_RULES_PATH || './config/rules.json',
        llmBaseUrl: process.env.LLM_BASE_URL || '',
        llmApiKey: process.env.LLM_API_KEY || '',
        llmModel: process.env.LLM_MODEL || 'btlbagus',
    };
}
