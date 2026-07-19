// Simple logger with timestamps
export class Logger {
    private prefix: string;

    constructor(prefix: string) {
        this.prefix = prefix;
    }

    private getTimestamp(): string {
        return new Date().toISOString();
    }

    info(message: string, ...args: any[]) {
        console.log(`[${this.getTimestamp()}] [${this.prefix}] ℹ️  ${message}`, ...args);
    }

    warn(message: string, ...args: any[]) {
        console.warn(`[${this.getTimestamp()}] [${this.prefix}] ⚠️  ${message}`, ...args);
    }

    error(message: string, ...args: any[]) {
        console.error(`[${this.getTimestamp()}] [${this.prefix}] ❌ ${message}`, ...args);
    }

    success(message: string, ...args: any[]) {
        console.log(`[${this.getTimestamp()}] [${this.prefix}] ✅ ${message}`, ...args);
    }

    debug(message: string, ...args: any[]) {
        if (process.env.DEBUG) {
            console.log(`[${this.getTimestamp()}] [${this.prefix}] 🔍 ${message}`, ...args);
        }
    }
}
