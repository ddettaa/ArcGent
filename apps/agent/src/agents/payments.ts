// ArcGent Agent-to-Agent Payment System
// Enable agents to pay each other for services using USDC

import { Config } from '../utils/config.js';
import { Logger } from '../utils/logger.js';
import { CircleWallet } from '../payments/circle.js';

const logger = new Logger('AgentPayments');

export interface AgentService {
  id: string;
  name: string;
  description: string;
  pricePerUnit: number; // in micro-USDC (0.000001 USDC)
  unitType: 'request' | 'token' | 'second' | 'byte' | 'computation';
  providerAgentId: string;
  active: boolean;
}

export interface AgentPayment {
  id: string;
  fromAgentId: string;
  toAgentId: string;
  serviceId: string;
  amount: number; // in micro-USDC
  units: number;
  status: 'pending' | 'completed' | 'failed';
  timestamp: string;
  txHash?: string;
  metadata?: Record<string, any>;
}

export interface AgentIdentity {
  id: string;
  name: string;
  walletAddress: string;
  services: AgentService[];
  reputation: number; // 0-100
  totalEarned: number; // in micro-USDC
  totalSpent: number; // in micro-USDC
}

export class AgentPaymentSystem {
  private config: Config;
  private circleWallet: CircleWallet;
  private agents: Map<string, AgentIdentity> = new Map();
  private services: Map<string, AgentService> = new Map();
  private payments: Map<string, AgentPayment> = new Map();

  constructor(config: Config) {
    this.config = config;
    this.circleWallet = new CircleWallet(config);
  }

  async initialize() {
    await this.circleWallet.initialize();
    this.registerDefaultAgents();
  }

  private registerDefaultAgents() {
    // Register some example agents
    const defaultAgents: AgentIdentity[] = [
      {
        id: 'content-evaluator',
        name: 'Content Evaluator Agent',
        walletAddress: '0x3695F3261cc7FB2e54106df524c12ce9FFd9a556',
        services: [],
        reputation: 95,
        totalEarned: 0,
        totalSpent: 0,
      },
      {
        id: 'translation-agent',
        name: 'Translation Agent',
        walletAddress: '0x3695F3261cc7FB2e54106df524c12ce9FFd9a556',
        services: [],
        reputation: 88,
        totalEarned: 0,
        totalSpent: 0,
      },
      {
        id: 'security-auditor',
        name: 'Security Auditor Agent',
        walletAddress: '0x3695F3261cc7FB2e54106df524c12ce9FFd9a556',
        services: [],
        reputation: 92,
        totalEarned: 0,
        totalSpent: 0,
      },
    ];

    defaultAgents.forEach(agent => {
      this.agents.set(agent.id, agent);
    });

    // Register services
    const defaultServices: AgentService[] = [
      {
        id: 'content-quality-check',
        name: 'Content Quality Check',
        description: 'AI evaluates content quality and originality',
        pricePerUnit: 500, // 0.0005 USDC per check
        unitType: 'request',
        providerAgentId: 'content-evaluator',
        active: true,
      },
      {
        id: 'text-translation',
        name: 'Text Translation',
        description: 'Translate text between languages',
        pricePerUnit: 100, // 0.0001 USDC per 100 tokens
        unitType: 'token',
        providerAgentId: 'translation-agent',
        active: true,
      },
      {
        id: 'security-scan',
        name: 'Security Scan',
        description: 'Scan code for vulnerabilities',
        pricePerUnit: 2000, // 0.002 USDC per scan
        unitType: 'request',
        providerAgentId: 'security-auditor',
        active: true,
      },
    ];

    defaultServices.forEach(service => {
      this.services.set(service.id, service);
      // Add service to provider agent
      const provider = this.agents.get(service.providerAgentId);
      if (provider) {
        provider.services.push(service);
      }
    });

    logger.info(`Registered ${defaultAgents.length} agents and ${defaultServices.length} services`);
  }

  async payForService(
    fromAgentId: string,
    serviceId: string,
    units: number,
    metadata?: Record<string, any>
  ): Promise<AgentPayment> {
    const service = this.services.get(serviceId);
    if (!service) {
      throw new Error(`Service ${serviceId} not found`);
    }

    if (!service.active) {
      throw new Error(`Service ${serviceId} is not active`);
    }

    const fromAgent = this.agents.get(fromAgentId);
    const toAgent = this.agents.get(service.providerAgentId);

    if (!fromAgent || !toAgent) {
      throw new Error('Agent not found');
    }

    const totalAmount = service.pricePerUnit * units;

    const payment: AgentPayment = {
      id: `a2a_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      fromAgentId,
      toAgentId: service.providerAgentId,
      serviceId,
      amount: totalAmount,
      units,
      status: 'pending',
      timestamp: new Date().toISOString(),
      metadata,
    };

    this.payments.set(payment.id, payment);

    try {
      // Execute nanopayment
      const txHash = await this.circleWallet.sendNanopayment(
        toAgent.walletAddress,
        totalAmount,
        `A2A:${service.name}:${units}${service.unitType}`
      );

      payment.status = 'completed';
      payment.txHash = txHash;

      // Update agent balances
      fromAgent.totalSpent += totalAmount;
      toAgent.totalEarned += totalAmount;

      logger.info(`Agent payment completed: ${fromAgentId} → ${service.providerAgentId} (${totalAmount} micro-USDC)`);

      return payment;
    } catch (error) {
      payment.status = 'failed';
      logger.error(`Agent payment failed: ${error}`);
      throw error;
    }
  }

  async getAgents(): Promise<AgentIdentity[]> {
    return Array.from(this.agents.values());
  }

  async getServices(): Promise<AgentService[]> {
    return Array.from(this.services.values());
  }

  async getPayments(): Promise<AgentPayment[]> {
    return Array.from(this.payments.values());
  }

  async getAgentStats(): Promise<{
    totalAgents: number;
    totalServices: number;
    totalPayments: number;
    totalVolume: number; // in micro-USDC
    topEarners: Array<{ agentId: string; earned: number }>;
    topSpenders: Array<{ agentId: string; spent: number }>;
  }> {
    const totalVolume = Array.from(this.payments.values())
      .filter(p => p.status === 'completed')
      .reduce((sum, p) => sum + p.amount, 0);

    const agents = Array.from(this.agents.values());
    const topEarners = agents
      .map(a => ({ agentId: a.id, earned: a.totalEarned }))
      .sort((a, b) => b.earned - a.earned)
      .slice(0, 5);

    const topSpenders = agents
      .map(a => ({ agentId: a.id, spent: a.totalSpent }))
      .sort((a, b) => b.spent - a.spent)
      .slice(0, 5);

    return {
      totalAgents: this.agents.size,
      totalServices: this.services.size,
      totalPayments: this.payments.size,
      totalVolume,
      topEarners,
      topSpenders,
    };
  }

  async registerAgent(agent: Omit<AgentIdentity, 'services' | 'totalEarned' | 'totalSpent'>): Promise<AgentIdentity> {
    const newAgent: AgentIdentity = {
      ...agent,
      services: [],
      totalEarned: 0,
      totalSpent: 0,
    };
    this.agents.set(agent.id, newAgent);
    logger.info(`Registered new agent: ${agent.name}`);
    return newAgent;
  }

  async registerService(service: Omit<AgentService, 'id'>): Promise<AgentService> {
    const id = `service_${Date.now()}`;
    const newService: AgentService = { ...service, id };
    this.services.set(id, newService);
    
    // Add to provider agent
    const provider = this.agents.get(service.providerAgentId);
    if (provider) {
      provider.services.push(newService);
    }
    
    logger.info(`Registered new service: ${service.name}`);
    return newService;
  }
}

// Singleton instance
let _agentPayments: AgentPaymentSystem | null = null;
export function getAgentPayments(config?: Config): AgentPaymentSystem {
  if (!_agentPayments) {
    if (!config) throw new Error('AgentPayments requires config on first initialization');
    _agentPayments = new AgentPaymentSystem(config);
  }
  return _agentPayments;
}