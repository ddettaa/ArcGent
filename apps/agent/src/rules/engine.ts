// Rule evaluation engine
import { Logger } from '../utils/logger.js';

const logger = new Logger('RuleEngine');

interface RuleEvaluation {
    approved: boolean;
    reason: string;
    conditionsMet: Record<string, boolean>;
    confidence: number;
}

export class RuleEngine {
    async evaluate(rule: any, signalData: any): Promise<RuleEvaluation> {
        const conditionsMet: Record<string, boolean> = {};
        let allMet = true;

        // Evaluate each condition
        for (const [key, expectedValue] of Object.entries(rule.signal.conditions)) {
            const actualValue = this.resolveValue(signalData, key);
            const met = this.compareValues(actualValue, expectedValue);
            conditionsMet[key] = met;
            
            if (!met) allMet = false;
        }

        const result: RuleEvaluation = {
            approved: allMet,
            reason: allMet 
                ? `All ${Object.keys(conditionsMet).length} conditions met` 
                : 'Some conditions not met',
            conditionsMet,
            confidence: allMet ? 1.0 : 0.0,
        };

        logger.debug(`Rule "${rule.name}" evaluation:`, result);
        return result;
    }

    private resolveValue(data: any, path: string): any {
        // Resolve nested paths like "pr.merged", "flight.delay_hours"
        return path.split('.').reduce((obj, key) => obj?.[key], data);
    }

    private compareValues(actual: any, expected: any): boolean {
        if (typeof expected === 'number') {
            if (typeof actual === 'number') {
                return actual >= expected;
            }
            return false;
        }
        if (typeof expected === 'boolean') {
            return actual === expected;
        }
        if (typeof expected === 'string') {
            if (typeof actual === 'string') {
                return actual.toLowerCase().includes(expected.toLowerCase());
            }
            if (Array.isArray(actual)) {
                return actual.some(item => 
                    typeof item === 'string' && item.toLowerCase().includes(expected.toLowerCase())
                );
            }
            return false;
        }
        if (Array.isArray(expected)) {
            return expected.includes(actual);
        }
        return actual === expected;
    }
}
