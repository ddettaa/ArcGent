// GitHub signal listener
// Monitors GitHub events: PR merged, issues closed, pushes, etc.
import { Logger } from '../utils/logger.js';

const logger = new Logger('GitHubSignal');

export class GitHubSignal {
    private token: string;
    private baseUrl: string = 'https://api.github.com';
    private registeredTriggers: Map<string, any> = new Map();

    constructor() {
        this.token = process.env.GITHUB_TOKEN || '';
    }

    async register(trigger: string, conditions: any) {
        this.registeredTriggers.set(trigger, conditions);
        logger.info(`Registered GitHub trigger: ${trigger}`);
    }

    async check(trigger: string, conditions: any): Promise<any> {
        switch (trigger) {
            case 'pull_request.merged':
                return await this.checkPRMerged(conditions);
            case 'issue.closed':
                return await this.checkIssueClosed(conditions);
            case 'push':
                return await this.checkPush(conditions);
            default:
                logger.warn(`Unknown trigger: ${trigger}`);
                return null;
        }
    }

    private async checkPRMerged(conditions: any): Promise<any> {
        try {
            const repo = conditions.repo;
            if (!repo) return null;

            const url = `${this.baseUrl}/repos/${repo}/pulls?state=closed&per_page=5`;
            const headers: Record<string, string> = {
                'Accept': 'application/vnd.github.v3+json',
            };
            if (this.token) {
                headers['Authorization'] = `token ${this.token}`;
            }

            const response = await fetch(url, { headers });
            if (!response.ok) return null;

            const prs = await response.json();
            
            for (const pr of prs) {
                // Check if PR was merged (not just closed)
                if (pr.merged_at) {
                    // Check conditions
                    let match = true;
                    
                    if (conditions.label) {
                        const labels = pr.labels.map((l: any) => l.name.toLowerCase());
                        if (!labels.some((l: string) => l.includes(conditions.label.toLowerCase()))) {
                            match = false;
                        }
                    }

                    if (match) {
                        logger.info(`Found merged PR: #${pr.number} — ${pr.title}`);
                        return {
                            pr: {
                                number: pr.number,
                                title: pr.title,
                                merged_at: pr.merged_at,
                                user: pr.user.login,
                                labels: pr.labels.map((l: any) => l.name),
                            },
                        };
                    }
                }
            }

            return null;
        } catch (error) {
            logger.error('GitHub check failed:', error);
            return null;
        }
    }

    private async checkIssueClosed(conditions: any): Promise<any> {
        // Similar to PR check but for issues
        try {
            const repo = conditions.repo;
            if (!repo) return null;

            const url = `${this.baseUrl}/repos/${repo}/issues?state=closed&per_page=5`;
            const headers: Record<string, string> = {
                'Accept': 'application/vnd.github.v3+json',
            };
            if (this.token) {
                headers['Authorization'] = `token ${this.token}`;
            }

            const response = await fetch(url, { headers });
            if (!response.ok) return null;

            const issues = await response.json();
            
            for (const issue of issues) {
                if (!issue.pull_request) { // Real issue, not PR
                    let match = true;
                    
                    if (conditions.label) {
                        const labels = issue.labels.map((l: any) => l.name.toLowerCase());
                        if (!labels.some((l: string) => l.includes(conditions.label.toLowerCase()))) {
                            match = false;
                        }
                    }

                    if (match) {
                        return { issue };
                    }
                }
            }

            return null;
        } catch (error) {
            logger.error('GitHub issue check failed:', error);
            return null;
        }
    }

    private async checkPush(conditions: any): Promise<any> {
        try {
            const repo = conditions.repo;
            const branch = conditions.branch || 'main';
            if (!repo) return null;

            const url = `${this.baseUrl}/repos/${repo}/commits?sha=${branch}&per_page=1`;
            const headers: Record<string, string> = {
                'Accept': 'application/vnd.github.v3+json',
            };
            if (this.token) {
                headers['Authorization'] = `token ${this.token}`;
            }

            const response = await fetch(url, { headers });
            if (!response.ok) return null;

            const commits = await response.json();
            
            if (commits.length > 0) {
                const latest = commits[0];
                return {
                    push: {
                        sha: latest.sha,
                        message: latest.commit.message,
                        author: latest.commit.author.name,
                        date: latest.commit.author.date,
                    },
                };
            }

            return null;
        } catch (error) {
            logger.error('GitHub push check failed:', error);
            return null;
        }
    }
}
