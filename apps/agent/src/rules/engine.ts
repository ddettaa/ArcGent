// Rule Evaluation Engine
// Compares signal data against rule conditions
// Returns { approved, reason, matchedConditions, confidence }

export interface RuleEvaluation {
  approved: boolean;
  reason: string;
  matchedConditions: number;
  totalConditions: number;
  confidence: number;
}

export class RuleEngine {
  /**
   * Evaluate a rule against a signal payload.
   * @returns whether the rule's conditions are met
   */
  evaluateRule(rule: { signal: { conditions: Record<string, any> } }, signalData: any): RuleEvaluation {
    const conditions = rule.signal.conditions || {};
    const entries = Object.entries(conditions);
    let matched = 0;

    for (const [key, expectedValue] of entries) {
      const actualValue = this.resolveValue(signalData, key);
      if (this.compareValues(actualValue, expectedValue)) {
        matched++;
      }
    }

    const allMatched = matched === entries.length;
    return {
      approved: allMatched,
      reason: allMatched
        ? `All ${matched}/${entries.length} conditions met`
        : `Only ${matched}/${entries.length} conditions met`,
      matchedConditions: matched,
      totalConditions: entries.length,
      confidence: entries.length > 0 ? matched / entries.length : 1.0,
    };
  }

  /** Legacy alias */
  evaluate(rule: any, signalData: any): RuleEvaluation {
    return this.evaluateRule(rule, signalData);
  }

  private resolveValue(data: any, path: string): any {
    // Resolve nested paths like "labels", "type", "delay_hours"
    // Also handle GitHub-specific structure
    if (data && typeof data === 'object') {
      // First try direct path resolution
      const direct = path.split('.').reduce((obj, key) => obj?.[key], data);
      if (direct !== undefined) return direct;

      // Handle GitHubSignal special fields
      if (path === 'label' && Array.isArray(data.labels)) {
        return data.labels;
      }
      if (path === 'labels' && Array.isArray(data.labels)) {
        return data.labels;
      }
    }
    return undefined;
  }

  private compareValues(actual: any, expected: any): boolean {
    // Undefined means condition not found in signal
    if (actual === undefined) return false;

    // Number comparison (threshold)
    if (typeof expected === 'number') {
      if (typeof actual === 'number') return actual >= expected;
      return false;
    }

    // Boolean
    if (typeof expected === 'boolean') {
      return actual === expected;
    }

    // String: substring match
    if (typeof expected === 'string') {
      if (typeof actual === 'string') {
        return actual.toLowerCase().includes(expected.toLowerCase());
      }
      // Array of strings (like labels)
      if (Array.isArray(actual)) {
        return actual.some(item =>
          typeof item === 'string' && item.toLowerCase().includes(expected.toLowerCase())
        );
      }
      return false;
    }

    // Array
    if (Array.isArray(expected)) {
      return expected.includes(actual);
    }

    return actual === expected;
  }
}
