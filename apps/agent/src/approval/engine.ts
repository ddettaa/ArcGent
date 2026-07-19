// ArcGent Approval Engine — 3-tier payment approval system
// AUTO: <$10 → execute immediately
// REVIEW: $10-$100 → notify Telegram, execute after 5min if no objection
// MANUAL: >$100 → require manual approval in dashboard

export type ApprovalTier = "AUTO" | "REVIEW" | "MANUAL";
export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "EXECUTED" | "CANCELLED";

export interface ApprovalRequest {
  id: string;
  ruleId: string;
  amount: number;
  to: string;
  reason: string;
  tier: ApprovalTier;
  status: ApprovalStatus;
  createdAt: number;
  expiresAt: number;
  approvedBy?: string;
  executedAt?: number;
  txHash?: string;
}

const AUTO_LIMIT = 10;
const REVIEW_LIMIT = 100;
const REVIEW_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const MANUAL_TIMEOUT = 60 * 60 * 1000; // 1 hour

class ApprovalEngine {
  private requests: Map<string, ApprovalRequest> = new Map();
  private reviewCallbacks: Map<string, (req: ApprovalRequest) => void> = new Map();
  private telegramBotToken: string;
  private telegramChatId: string;

  constructor() {
    this.telegramBotToken = process.env.TELEGRAM_BOT_TOKEN || "";
    this.telegramChatId = process.env.TELEGRAM_CHAT_ID || "";
  }

  determineTier(amount: number): ApprovalTier {
    if (amount < AUTO_LIMIT) return "AUTO";
    if (amount < REVIEW_LIMIT) return "REVIEW";
    return "MANUAL";
  }

  createRequest(
    ruleId: string,
    amount: number,
    to: string,
    reason: string,
    onExecute: (req: ApprovalRequest) => Promise<{ txHash?: string; error?: string }>
  ): ApprovalRequest {
    const tier = this.determineTier(amount);
    const id = `${ruleId}-${Date.now()}`;
    const now = Date.now();

    const request: ApprovalRequest = {
      id,
      ruleId,
      amount,
      to,
      reason,
      tier,
      status: "PENDING",
      createdAt: now,
      expiresAt: now + (tier === "REVIEW" ? REVIEW_TIMEOUT : MANUAL_TIMEOUT),
    };

    this.requests.set(id, request);

    if (tier === "AUTO") {
      this.executeRequest(request, onExecute);
    } else if (tier === "REVIEW") {
      this.notifyTelegram(request);
      // Schedule auto-execution after timeout
      setTimeout(() => {
        const req = this.requests.get(id);
        if (req && req.status === "PENDING") {
          this.executeRequest(req, onExecute);
        }
      }, REVIEW_TIMEOUT);
    } else {
      // MANUAL — wait for explicit approval
      this.notifyTelegram(request);
    }

    return request;
  }

  async approve(id: string, approvedBy: string = "dashboard"): Promise<ApprovalRequest | null> {
    const request = this.requests.get(id);
    if (!request || request.status !== "PENDING") return null;

    request.status = "APPROVED";
    request.approvedBy = approvedBy;
    return request;
  }

  reject(id: string): ApprovalRequest | null {
    const request = this.requests.get(id);
    if (!request || request.status !== "PENDING") return null;

    request.status = "REJECTED";
    return request;
  }

  getPending(): ApprovalRequest[] {
    return [...this.requests.values()].filter(r => r.status === "PENDING");
  }

  getById(id: string): ApprovalRequest | undefined {
    return this.requests.get(id);
  }

  getAll(): ApprovalRequest[] {
    return [...this.requests.values()].sort((a, b) => b.createdAt - a.createdAt);
  }

  private async executeRequest(
    request: ApprovalRequest,
    onExecute: (req: ApprovalRequest) => Promise<{ txHash?: string; error?: string }>
  ) {
    try {
      const result = await onExecute(request);
      if (result.error) {
        request.status = "CANCELLED";
      } else {
        request.status = "EXECUTED";
        request.executedAt = Date.now();
        request.txHash = result.txHash;
      }
    } catch (e) {
      request.status = "CANCELLED";
    }
  }

  private async notifyTelegram(request: ApprovalRequest) {
    if (!this.telegramBotToken || !this.telegramChatId) return;

    const emoji = request.tier === "REVIEW" ? "⏳" : "🔐";
    const text = `${emoji} *${request.tier} APPROVAL REQUIRED*\n\n` +
      `💰 Amount: *${request.amount} USDC*\n` +
      `📍 To: \`${request.to}\`\n` +
      `📋 Rule: \`${request.ruleId}\`\n` +
      `📝 Reason: ${request.reason}\n\n` +
      `🆔 ID: \`${request.id}\`\n` +
      (request.tier === "REVIEW"
        ? `⏰ Auto-executes in 5 minutes unless rejected`
        : `🔴 Manual approval required in dashboard`);

    try {
      await fetch(`https://api.telegram.org/bot${this.telegramBotToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: this.telegramChatId,
          text,
          parse_mode: "Markdown",
        }),
      });
    } catch (e) {
      console.error("[Approval] Telegram notification failed:", e);
    }
  }
}

// Singleton
let approvalEngine: ApprovalEngine | null = null;
export function getApprovalEngine(): ApprovalEngine {
  if (!approvalEngine) approvalEngine = new ApprovalEngine();
  return approvalEngine;
}
