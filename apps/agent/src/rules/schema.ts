// Rule schema definitions
export interface Rule {
    id: string;
    name: string;
    description?: string;
    signal: SignalConfig;
    action: ActionConfig;
    enabled: boolean;
    cooldown?: number;
    createdAt?: string;
    updatedAt?: string;
}

export interface SignalConfig {
    source: 'github' | 'api' | 'oracle' | 'onchain' | 'webhook';
    trigger: string;
    conditions: Record<string, any>;
    endpoint?: string;         // API URL or onchain contract
    headers?: Record<string, string>; // API auth headers
    pollInterval?: number;      // ms between checks
}

export interface ActionConfig {
    type: 'pay' | 'tip' | 'refund' | 'escrow' | 'bridge';
    recipient: string;
    amount: number;
    currency: 'USDC';
    memo?: string;
    onchainVerify?: boolean;    // Verify payment onchain
}

export const SIGNAL_SOURCES = [
    'github',
    'api', 
    'oracle',
    'onchain',
    'webhook',
] as const;

export const ACTION_TYPES = [
    'pay',
    'tip', 
    'refund',
    'escrow',
    'bridge',
] as const;

export const DEFAULT_RULES: Rule[] = [
    {
        id: 'bug-bounty-example',
        name: 'Auto Bug Bounty',
        description: 'Pay developer when PR with "fix:" label is merged',
        signal: {
            source: 'github',
            trigger: 'pull_request.merged',
            conditions: { label: 'fix', repo: 'user/repo' },
        },
        action: {
            type: 'pay',
            recipient: '0x...dev_wallet',
            amount: 50,
            currency: 'USDC',
            memo: 'Bug bounty: fix merged',
            onchainVerify: true,
        },
        enabled: false,
        cooldown: 3600,
    },
    {
        id: 'flight-delay-example',
        name: 'Flight Delay Refund',
        description: 'Refund traveler when flight is delayed > 2 hours',
        signal: {
            source: 'api',
            trigger: 'flight.delayed',
            conditions: { delay_hours: 2 },
            endpoint: 'https://api.aviationstack.com/v1/flights',
        },
        action: {
            type: 'refund',
            recipient: '0x...traveler_wallet',
            amount: 100,
            currency: 'USDC',
            memo: 'Flight delay compensation',
        },
        enabled: false,
        cooldown: 86400,
    },
];
