// ArcGent Real Signal Sources
// GitHub PR merged, flight delayed, weather bad, page views

import { EventEmitter } from "events";

export interface RealSignal {
  type: string;
  source: string;
  data: Record<string, any>;
  timestamp: string;
}

// --- GITHUB ---
export class GitHubRealListener extends EventEmitter {
  private token: string;
  private repos: string[];
  private intervalMs: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastPRCheck: Map<string, number> = new Map();
  private lastIssueCheck: Map<string, number> = new Map();

  constructor(token: string, repos: string[], intervalMs = 30000) {
    super();
    this.token = token;
    this.repos = repos;
    this.intervalMs = intervalMs;
  }

  async start() {
    console.log(`[GitHubReal] Listening to ${this.repos.length} repos every ${this.intervalMs}ms`);
    this.poll();
    this.timer = setInterval(() => this.poll(), this.intervalMs);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }

  private async poll() {
    for (const repo of this.repos) {
      await this.checkPRs(repo);
      await this.checkIssues(repo);
    }
  }

  private async checkPRs(repo: string) {
    try {
      const lastCheck = this.lastPRCheck.get(repo) || 0;
      const res = await fetch(
        `https://api.github.com/repos/${repo}/pulls?state=closed&sort=updated&direction=desc&per_page=10`,
        {
          headers: {
            Authorization: `Bearer ${this.token}`,
            Accept: "application/vnd.github.v3+json",
          },
        }
      );
      const prs = await res.json();

      for (const pr of prs) {
        if (!pr.merged_at) continue;
        const mergedAt = new Date(pr.merged_at).getTime();
        if (mergedAt <= lastCheck) continue;

        // Check if any label matches
        const labels = pr.labels?.map((l: any) => l.name) || [];

        this.emit("signal", {
          type: "pull_request.merged",
          source: "github",
          data: {
            repo,
            prNumber: pr.number,
            title: pr.title,
            mergedAt: pr.merged_at,
            labels,
            author: pr.user?.login,
            url: pr.html_url,
          },
          timestamp: new Date().toISOString(),
        });
      }

      this.lastPRCheck.set(repo, Date.now());
    } catch (e) {
      console.error(`[GitHubReal] PR check failed for ${repo}:`, e);
    }
  }

  private async checkIssues(repo: string) {
    try {
      const lastCheck = this.lastIssueCheck.get(repo) || 0;
      const res = await fetch(
        `https://api.github.com/repos/${repo}/issues?state=closed&sort=updated&direction=desc&per_page=10`,
        {
          headers: {
            Authorization: `Bearer ${this.token}`,
            Accept: "application/vnd.github.v3+json",
          },
        }
      );
      const issues = await res.json();

      for (const issue of issues) {
        if (!issue.closed_at) continue;
        const closedAt = new Date(issue.closed_at).getTime();
        if (closedAt <= lastCheck) continue;

        const labels = issue.labels?.map((l: any) => l.name) || [];

        this.emit("signal", {
          type: "issues.closed",
          source: "github",
          data: {
            repo,
            issueNumber: issue.number,
            title: issue.title,
            closedAt: issue.closed_at,
            labels,
            author: issue.user?.login,
            url: issue.html_url,
          },
          timestamp: new Date().toISOString(),
        });
      }

      this.lastIssueCheck.set(repo, Date.now());
    } catch (e) {
      console.error(`[GitHubReal] Issue check failed for ${repo}:`, e);
    }
  }
}

// --- FLIGHT ---
export class FlightSignal extends EventEmitter {
  private apiKey: string;
  private checkInterval: ReturnType<typeof setInterval> | null = null;

  constructor(apiKey: string) {
    super();
    this.apiKey = apiKey;
  }

  async checkFlight(flightNumber: string): Promise<RealSignal | null> {
    try {
      // Using AviationStack API (free tier)
      const res = await fetch(
        `http://api.aviationstack.com/v1/flights?access_key=${this.apiKey}&flight_iata=${flightNumber}`
      );
      const data = await res.json();

      if (data.data?.[0]) {
        const flight = data.data[0];
        const delay = flight.departure?.delay || 0;

        if (delay >= 120) { // 2+ hours delay
          return {
            type: "flight.delayed",
            source: "flight",
            data: {
              flightNumber,
              airline: flight.airline?.name,
              departure: flight.departure?.airport,
              arrival: flight.arrival?.airport,
              delayMinutes: delay,
              status: flight.flight_status,
            },
            timestamp: new Date().toISOString(),
          };
        }
      }
      return null;
    } catch (e) {
      console.error("[Flight] Check failed:", e);
      return null;
    }
  }
}

// --- WEATHER ---
export class WeatherSignal extends EventEmitter {
  private apiKey: string;

  constructor(apiKey: string) {
    super();
    this.apiKey = apiKey;
  }

  async checkWeather(lat: number, lon: number): Promise<RealSignal | null> {
    try {
      const res = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${this.apiKey}&units=metric`
      );
      const data = await res.json();

      const condition = data.weather?.[0]?.main?.toLowerCase();
      const isBad = ["rain", "storm", "snow", "thunderstorm"].includes(condition);

      if (isBad) {
        return {
          type: "weather.bad",
          source: "weather",
          data: {
            condition,
            temp: data.main?.temp,
            humidity: data.main?.humidity,
            location: data.name,
            description: data.weather?.[0]?.description,
          },
          timestamp: new Date().toISOString(),
        };
      }
      return null;
    } catch (e) {
      console.error("[Weather] Check failed:", e);
      return null;
    }
  }
}

// --- PAGE VIEWS ---
export class PageViewSignal extends EventEmitter {
  private views: Map<string, number> = new Map();
  private milestones: number[] = [100, 500, 1000, 5000, 10000];

  recordView(pageId: string): RealSignal | null {
    const current = (this.views.get(pageId) || 0) + 1;
    this.views.set(pageId, current);

    const milestone = this.milestones.find(m => current === m);
    if (milestone) {
      return {
        type: "views.milestone",
        source: "views",
        data: {
          pageId,
          views: current,
          milestone,
        },
        timestamp: new Date().toISOString(),
      };
    }
    return null;
  }

  getViews(pageId: string): number {
    return this.views.get(pageId) || 0;
  }
}

// --- UNIFIED SIGNAL MANAGER ---
export class SignalManager extends EventEmitter {
  private github: GitHubRealListener | null = null;
  private flight: FlightSignal | null = null;
  private weather: WeatherSignal | null = null;
  private pageViews: PageViewSignal;

  constructor() {
    super();
    this.pageViews = new PageViewSignal();
  }

  initGitHub(token: string, repos: string[], intervalMs = 30000) {
    this.github = new GitHubRealListener(token, repos, intervalMs);
    this.github.on("signal", (s) => this.emit("signal", s));
    return this.github;
  }

  initFlight(apiKey: string) {
    this.flight = new FlightSignal(apiKey);
    return this.flight;
  }

  initWeather(apiKey: string) {
    this.weather = new WeatherSignal(apiKey);
    return this.weather;
  }

  getPageViews(): PageViewSignal {
    return this.pageViews;
  }

  async startAll() {
    if (this.github) await this.github.start();
  }

  stopAll() {
    if (this.github) this.github.stop();
  }
}

// Singleton
let _signalManager: SignalManager | null = null;
export function getSignalManager(): SignalManager {
  if (!_signalManager) _signalManager = new SignalManager();
  return _signalManager;
}
