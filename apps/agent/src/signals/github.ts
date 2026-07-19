// GitHub Signal Listener — monitors PR merges, issues closed
// EventEmitter pattern: emits "signal" with GitHubSignal payload
// Also supports async check() for rule engine integration

export interface GitHubSignal {
  id: string;
  type: "pull_request.merged" | "issues.closed" | "push";
  action: string;
  repo: string;
  title: string;
  url: string;
  labels: string[];
  author: string;
  timestamp: string;
  raw: any;
}

export class GitHubListener {
  private token: string;
  private repos: string[];
  private pollInterval: number;
  private lastChecked: Map<string, string> = new Map();
  private timer: NodeJS.Timeout | null = null;
  private handlers: Map<string, (signal: GitHubSignal) => void> = new Map();
  private signalQueue: GitHubSignal[] = [];

  constructor(token: string, repos: string[], pollIntervalMs = 30000) {
    this.token = token;
    this.repos = repos;
    this.pollInterval = pollIntervalMs;
  }

  async start() {
    console.log(`[GitHub] Listening to ${this.repos.length} repos every ${this.pollInterval}ms`);
    this.timer = setInterval(() => this.poll(), this.pollInterval);
    await this.poll(); // initial fetch
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Check if a specific trigger/condition is met — used by rule engine */
  async check(trigger: string, conditions: Record<string, any>): Promise<GitHubSignal | null> {
    const now = Date.now();
    // Look through recent signals (last 30s)
    const cutoff = new Date(now - 30000).toISOString();
    const match = this.signalQueue.find(s => {
      if (s.type !== trigger) return false;
      if (new Date(s.timestamp) < new Date(cutoff)) return false;
      // Check all conditions
      for (const [key, val] of Object.entries(conditions)) {
        if (key === "label" && !s.labels.some(l => l.toLowerCase().includes(String(val).toLowerCase()))) return false;
        if (key === "repo" && s.repo !== val) return false;
        if (key === "author" && s.author !== val) return false;
      }
      return true;
    });
    return match || null;
  }

  /** Register interest in a specific trigger */
  on(event: "signal", handler: (signal: GitHubSignal) => void): void {
    const id = `handler_${this.handlers.size}`;
    this.handlers.set(id, handler);
  }

  /** Get all recent signals (for API / dashboard) */
  getRecentSignals(count = 50): GitHubSignal[] {
    return this.signalQueue.slice(-count);
  }

  private async poll() {
    for (const repo of this.repos) {
      try {
        await this.checkRepo(repo);
      } catch (e) {
        console.error(`[GitHub] Error checking ${repo}:`, e);
      }
    }
    // Clean queue — keep last 1000
    if (this.signalQueue.length > 1000) {
      this.signalQueue = this.signalQueue.slice(-500);
    }
  }

  private async checkRepo(repo: string) {
    const since = this.lastChecked.get(repo) || new Date(Date.now() - 3600000).toISOString();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "ArcGent-Agent/1.0",
    };

    // Check PRs
    try {
      const prRes = await fetch(
        `https://api.github.com/repos/${repo}/pulls?state=closed&sort=updated&per_page=10&direction=desc`,
        { headers }
      );
      if (!prRes.ok) {
        if (prRes.status === 403) console.error(`[GitHub] Rate limited on ${repo}`);
        return;
      }
      const prs = await prRes.json();
      if (!Array.isArray(prs)) return;

      for (const pr of prs) {
        if (pr.merged_at && new Date(pr.merged_at) > new Date(since)) {
          const signal: GitHubSignal = {
            id: `gh_pr_${pr.id}`,
            type: "pull_request.merged",
            action: "merged",
            repo,
            title: pr.title || "",
            url: pr.html_url || "",
            labels: (pr.labels || []).map((l: any) => l.name),
            author: pr.user?.login || "",
            timestamp: pr.merged_at,
            raw: pr,
          };
          this.emit(signal);
        }
      }
    } catch (e) {
      // Silently skip PR errors — not all repos have PRs
    }

    // Check issues
    try {
      const issueRes = await fetch(
        `https://api.github.com/repos/${repo}/issues?state=closed&sort=updated&per_page=10&direction=desc`,
        { headers }
      );
      if (!issueRes.ok) return;
      const issues = await issueRes.json();
      if (!Array.isArray(issues)) return;

      for (const issue of issues) {
        if (issue.pull_request) continue; // skip PRs
        if (new Date(issue.closed_at || "") > new Date(since)) {
          const signal: GitHubSignal = {
            id: `gh_issue_${issue.id}`,
            type: "issues.closed",
            action: "closed",
            repo,
            title: issue.title || "",
            url: issue.html_url || "",
            labels: (issue.labels || []).map((l: any) => l.name),
            author: issue.user?.login || "",
            timestamp: issue.closed_at || "",
            raw: issue,
          };
          this.emit(signal);
        }
      }
    } catch (e) {
      // Silently skip
    }

    this.lastChecked.set(repo, new Date().toISOString());
  }

  private emit(signal: GitHubSignal) {
    this.signalQueue.push(signal);
    for (const handler of this.handlers.values()) {
      try { handler(signal); } catch (e) {}
    }
    console.log(`[GitHub] 📡 ${signal.type} from ${signal.repo}: "${signal.title}" (labels: ${signal.labels.join(", ") || "none"})`);
  }
}
