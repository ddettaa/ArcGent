// ArcGent Paymaster Service — Gas sponsorship for user transactions
// Sponsor gas fees for new users, micro-transactions, and agent-to-agent payments

import { Config } from '../utils/config.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('Paymaster');

export interface PaymasterPolicy {
  id: string;
  name: string;
  maxGasPerTx: number; // in USDC
  maxDailySpend: number; // in USDC
  allowedContracts: string[]; // whitelisted contract addresses
  userTier: 'new' | 'verified' | 'premium';
  active: boolean;
}

export interface SponsorshipRequest {
  userAddress: string;
  transactionHash: string;
  estimatedGas: number;
  contractAddress: string;
  userTier: 'new' | 'verified' | 'premium';
}

export class PaymasterService {
  private config: Config;
  private policies: Map<string, PaymasterPolicy> = new Map();
  private dailySpend: Map<string, number> = new Map(); // userAddress -> spend today
  private sponsoredTxs: Map<string, SponsorshipRequest> = new Map();

  constructor(config: Config) {
    this.config = config;
    this.initializeDefaultPolicies();
  }

  private initializeDefaultPolicies() {
    // Default policies for different user tiers
    const defaultPolicies: PaymasterPolicy[] = [
      {
        id: 'new-user-welcome',
        name: 'New User Welcome',
        maxGasPerTx: 0.001, // 0.001 USDC max per transaction
        maxDailySpend: 0.01, // 0.01 USDC max per day
        allowedContracts: [], // Allow all for onboarding
        userTier: 'new',
        active: true,
      },
      {
        id: 'micro-transactions',
        name: 'Micro Transactions',
        maxGasPerTx: 0.0005, // 0.0005 USDC for nanopayments
        maxDailySpend: 0.005,
        allowedContracts: [], // Nanopayment contracts
        userTier: 'verified',
        active: true,
      },
      {
        id: 'premium-unlimited',
        name: 'Premium Unlimited',
        maxGasPerTx: 0.01,
        maxDailySpend: 0.1,
        allowedContracts: [],
        userTier: 'premium',
        active: true,
      },
    ];

    defaultPolicies.forEach(policy => {
      this.policies.set(policy.id, policy);
    });

    logger.info(`Initialized ${defaultPolicies.length} paymaster policies`);
  }

  async sponsorTransaction(request: SponsorshipRequest): Promise<{
    approved: boolean;
    reason: string;
    policyId?: string;
    sponsoredAmount?: number;
  }> {
    const { userAddress, estimatedGas, contractAddress, userTier } = request;

    // Find applicable policy
    const applicablePolicies = Array.from(this.policies.values())
      .filter(p => p.active && p.userTier === userTier)
      .filter(p => p.allowedContracts.length === 0 || p.allowedContracts.includes(contractAddress))
      .filter(p => estimatedGas <= p.maxGasPerTx);

    if (applicablePolicies.length === 0) {
      return {
        approved: false,
        reason: `No applicable paymaster policy for tier ${userTier}, gas ${estimatedGas} USDC`,
      };
    }

    // Check daily spend limit
    const today = new Date().toDateString();
    const dailyKey = `${userAddress}-${today}`;
    const currentSpend = this.dailySpend.get(dailyKey) || 0;
    const policy = applicablePolicies[0]; // Use first matching policy

    if (currentSpend + estimatedGas > policy.maxDailySpend) {
      return {
        approved: false,
        reason: `Daily spend limit exceeded: ${currentSpend + estimatedGas} > ${policy.maxDailySpend} USDC`,
      };
    }

    // Approve sponsorship
    this.dailySpend.set(dailyKey, currentSpend + estimatedGas);
    this.sponsoredTxs.set(request.transactionHash, request);

    logger.info(`Sponsoring ${estimatedGas} USDC gas for ${userAddress} (policy: ${policy.name})`);

    return {
      approved: true,
      reason: `Sponsored by ${policy.name}`,
      policyId: policy.id,
      sponsoredAmount: estimatedGas,
    };
  }

  async getPolicies(): Promise<PaymasterPolicy[]> {
    return Array.from(this.policies.values());
  }

  async getSponsorshipStats(): Promise<{
    totalSponsored: number;
    totalTransactions: number;
    dailySpend: number;
    topUsers: Array<{ address: string; sponsored: number }>;
  }> {
    const totalSponsored = Array.from(this.sponsoredTxs.values())
      .reduce((sum, tx) => sum + tx.estimatedGas, 0);

    const today = new Date().toDateString();
    const dailySpend = Array.from(this.dailySpend.entries())
      .filter(([key]) => key.endsWith(today))
      .reduce((sum, [, amount]) => sum + amount, 0);

    // Top users by sponsored amount
    const userSpend = new Map<string, number>();
    Array.from(this.sponsoredTxs.values()).forEach(tx => {
      const current = userSpend.get(tx.userAddress) || 0;
      userSpend.set(tx.userAddress, current + tx.estimatedGas);
    });

    const topUsers = Array.from(userSpend.entries())
      .map(([address, sponsored]) => ({ address, sponsored }))
      .sort((a, b) => b.sponsored - a.sponsored)
      .slice(0, 10);

    return {
      totalSponsored,
      totalTransactions: this.sponsoredTxs.size,
      dailySpend,
      topUsers,
    };
  }

  async createPolicy(policy: Omit<PaymasterPolicy, 'id'>): Promise<PaymasterPolicy> {
    const id = `policy-${Date.now()}`;
    const newPolicy: PaymasterPolicy = { ...policy, id };
    this.policies.set(id, newPolicy);
    logger.info(`Created paymaster policy: ${newPolicy.name}`);
    return newPolicy;
  }

  async updatePolicy(id: string, updates: Partial<PaymasterPolicy>): Promise<PaymasterPolicy | null> {
    const policy = this.policies.get(id);
    if (!policy) return null;

    const updated = { ...policy, ...updates };
    this.policies.set(id, updated);
    logger.info(`Updated paymaster policy: ${updated.name}`);
    return updated;
  }

  async deletePolicy(id: string): Promise<boolean> {
    const deleted = this.policies.delete(id);
    if (deleted) {
      logger.info(`Deleted paymaster policy: ${id}`);
    }
    return deleted;
  }
}

// Singleton instance
let _paymaster: PaymasterService | null = null;
export function getPaymaster(config?: Config): PaymasterService {
  if (!_paymaster) {
    if (!config) throw new Error('Paymaster requires config on first initialization');
    _paymaster = new PaymasterService(config);
  }
  return _paymaster;
}