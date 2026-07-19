// ArcGent Core Agent
// "If this, then pay" — autonomous signal-to-payment agent
// Built on Arc + Circle Agent Stack

import { createConfig } from './utils/config.js';
import { RuleEngine } from './rules/engine.js';
import { CircleWallet } from './payments/circle.js';
import { ArcNetwork } from './payments/arc.js';
import { GitHubSignal } from './signals/github.js';
import { APISignal } from './signals/api.js';
import { Logger } from './utils/logger.js';

const logger = new Logger('ArcGent');

interface AgentRule {
    id: string;
    name: string;
    signal: {
        source: 'github' | 'api' | 'oracle' | 'onchain';
        trigger: string;       // e.g., 'pull_request.merged', 'flight.delayed', 'page.views'
        conditions: Record<string, any>; // e.g., { label: 'fix' }, { delay_hours: 2 }
    };
    action: {
        type: 'pay' | 'tip' | 'refund' | 'escrow';
        recipient: string;      // wallet address or identifier
        amount: number;         // in USDC
        currency?: 'USDC';
        memo?: string;
    };
    enabled: boolean;
    cooldown?: number;          // seconds between triggers
}

class ArcGent {
    private rules: AgentRule[] = [];
    private circleWallet: CircleWallet;
    private arcNetwork: ArcNetwork;
    private ruleEngine: RuleEngine;
    private running: boolean = false;
    private signalListeners: Map<string, any> = new Map();
    private lastTrigger: Map<string, number> = new Map();

    constructor() {
        const config = createConfig();
        this.circleWallet = new CircleWallet(config);
        this.arcNetwork = new ArcNetwork(config);
        this.ruleEngine = new RuleEngine();
    }

    async loadRules(rulesPath: string = './config/rules.json') {
        try {
            const fs = await import('fs');
            const data = fs.readFileSync(rulesPath, 'utf-8');
            const parsed = JSON.parse(data);
            this.rules = Array.isArray(parsed) ? parsed : parsed.rules || [];
            logger.info(`Loaded ${this.rules.length} rules`);
            return this.rules;
        } catch (error) {
            logger.warn('No rules file found, using defaults');
            this.rules = this.getDefaultRules();
            return this.rules;
        }
    }

    private getDefaultRules(): AgentRule[] {
        return [
            {
                id: 'bug-bounty-1',
                name: 'Auto Bug Bounty',
                signal: {
                    source: 'github',
                    trigger: 'pull_request.merged',
                    conditions: { label: 'fix', repo: 'ddettaa/arcgent-demo' }
                },
                action: {
                    type: 'pay',
                    recipient: '0x...dev_address',
                    amount: 50,
                    memo: 'Bug bounty payment'
                },
                enabled: true,
                cooldown: 3600
            },
            {
                id: 'flight-refund-1',
                name: 'Flight Delay Refund',
                signal: {
                    source: 'api',
                    trigger: 'flight.delayed',
                    conditions: { delay_hours: 2, flight_iata: 'GA123' }
                },
                action: {
                    type: 'refund',
                    recipient: '0x...traveler_address',
                    amount: 100,
                    memo: 'Flight delay compensation'
                },
                enabled: true,
                cooldown: 86400
            }
        ];
    }

    async start() {
        logger.info('🚀 ArcGent starting...');
        
        // Load rules
        await this.loadRules();
        
        // Initialize wallet connection
        await this.circleWallet.initialize();
        logger.info('✅ Circle Wallet connected');
        
        // Check balance
        const balance = await this.circleWallet.getBalance();
        logger.info(`💰 Wallet balance: ${balance} USDC`);
        
        // Start signal listeners
        await this.startSignalListeners();
        
        // Start rule evaluation loop
        this.running = true;
        await this.evaluationLoop();
        
        logger.info('🤖 ArcGent is running. Monitoring signals...');
    }

    private async startSignalListeners() {
        // GitHub listener
        const ghSignal = new GitHubSignal();
        this.signalListeners.set('github', ghSignal);
        
        // API listener
        const apiSignal = new APISignal();
        this.signalListeners.set('api', apiSignal);
        
        // Register rules with signal sources
        for (const rule of this.rules.filter(r => r.enabled)) {
            const listener = this.signalListeners.get(rule.signal.source);
            if (listener) {
                await listener.register(rule.signal.trigger, rule.signal.conditions);
            }
        }
    }

    private async evaluationLoop() {
        const CHECK_INTERVAL = 5000; // 5 seconds
        
        while (this.running) {
            for (const rule of this.rules.filter(r => r.enabled)) {
                try {
                    // Check cooldown
                    const lastTriggerTime = this.lastTrigger.get(rule.id) || 0;
                    if (rule.cooldown && (Date.now() - lastTriggerTime) < rule.cooldown * 1000) {
                        continue;
                    }

                    // Get signal data from appropriate listener
                    const listener = this.signalListeners.get(rule.signal.source);
                    if (!listener) continue;

                    // Check if signal condition is met
                    const signalMet = await listener.check(
                        rule.signal.trigger,
                        rule.signal.conditions
                    );

                    if (signalMet) {
                        logger.info(`🎯 Signal triggered: ${rule.name}`);
                        
                        // Evaluate rule
                        const decision = await this.ruleEngine.evaluate(rule, signalMet);
                        
                        if (decision.approved) {
                            await this.executeAction(rule, decision);
                            this.lastTrigger.set(rule.id, Date.now());
                        }
                    }
                } catch (error) {
                    logger.error(`Error evaluating rule ${rule.id}:`, error);
                }
            }
            
            // Wait before next check
            await new Promise(r => setTimeout(r, CHECK_INTERVAL));
        }
    }

    private async executeAction(rule: AgentRule, decision: any) {
        logger.info(`⚡ Executing action: ${rule.action.type} ${rule.action.amount} USDC to ${rule.action.recipient}`);
        
        try {
            switch (rule.action.type) {
                case 'pay':
                case 'tip':
                case 'refund':
                    const txHash = await this.circleWallet.sendUSDC(
                        rule.action.recipient,
                        rule.action.amount,
                        rule.action.memo
                    );
                    logger.info(`✅ Payment sent! TX: ${txHash}`);
                    logger.info(`🔗 Explorer: https://testnet.arcscan.app/tx/${txHash}`);
                    break;
                    
                default:
                    logger.warn(`Unknown action type: ${rule.action.type}`);
            }
        } catch (error) {
            logger.error(`❌ Payment failed:`, error);
        }
    }

    stop() {
        this.running = false;
        logger.info('🛑 ArcGent stopped');
    }
}

// Start the agent
const agent = new ArcGent();

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n');
    agent.stop();
    process.exit(0);
});

agent.start().catch(console.error);

export default ArcGent;
