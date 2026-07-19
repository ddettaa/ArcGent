// Shared types for ArcGent

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
  endpoint?: string;
  headers?: Record<string, string>;
  pollInterval?: number;
}

export interface ActionConfig {
  type: 'pay' | 'tip' | 'refund' | 'escrow' | 'bridge';
  recipient: string;
  amount: number;
  currency: 'USDC';
  memo?: string;
  onchainVerify?: boolean;
}

export interface Payment {
  id: string;
  txHash: string;
  ruleId: string;
  ruleName: string;
  recipient: string;
  amount: number;
  status: 'pending' | 'confirmed' | 'failed';
  timestamp: string;
  explorerUrl?: string;
}

export interface AgentStatus {
  running: boolean;
  rulesCount: number;
  balance: string;
  walletAddress: string;
  network: string;
  chainId: number;
  lastSignalCheck: string;
  uptime: number;
}

export interface ArcNetworkConfig {
  chainId: number;
  rpcUrl: string;
  explorerUrl: string;
  usdcContract: string;
  nativeUsdcDecimals: number;
  erc20UsdcDecimals: number;
}

// Constants
export const ARC_TESTNET: ArcNetworkConfig = {
  chainId: 5042002,
  rpcUrl: 'https://rpc.testnet.arc.network',
  explorerUrl: 'https://testnet.arcscan.app',
  usdcContract: '0x3600000000000000000000000000000000000000',
  nativeUsdcDecimals: 18,
  erc20UsdcDecimals: 6,
};

export const SIGNAL_SOURCES = ['github', 'api', 'oracle', 'onchain', 'webhook'] as const;
export const ACTION_TYPES = ['pay', 'tip', 'refund', 'escrow', 'bridge'] as const;

// Utility functions
export function formatUSDC(amount: number, decimals: number = 6): string {
  return `${amount.toFixed(decimals)} USDC`;
}

export function truncateAddress(address: string, chars: number = 6): string {
  if (!address) return '';
  return `${address.slice(0, chars)}...${address.slice(-4)}`;
}

export function getExplorerUrl(txHash: string, network: ArcNetworkConfig = ARC_TESTNET): string {
  return `${network.explorerUrl}/tx/${txHash}`;
}
