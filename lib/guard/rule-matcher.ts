import { db } from '@/lib/db';
import { guardRules, structuredEmails } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import type { 
  CheckRuleMatchResponse, 
  ExplicitRuleConfig, 
  AiPromptRuleConfig,
  GuardRule,
  RuleActionConfig 
} from '@/features/guard/types';

export interface GuardEvaluationResult {
  shouldBlock: boolean;
  routeToEndpointId?: string;
  matchedRule?: GuardRule;
  action?: 'allow' | 'block' | 'route';
}

/**
 * Check if a guard rule matches a structured email
 * @param ruleId - The ID of the guard rule to check
 * @param structuredEmailId - The ID of the structured email to check against
 * @param userId - The user ID for authorization
 * @returns Match result with details
 */
export async function checkRuleMatch(
  ruleId: string,
  structuredEmailId: string,
  userId: string
): Promise<CheckRuleMatchResponse> {
  try {
    // Fetch the rule
    const [rule] = await db
      .select()
      .from(guardRules)
      .where(and(
        eq(guardRules.id, ruleId),
        eq(guardRules.userId, userId)
      ))
      .limit(1);

    if (!rule) {
      return {
        matched: false,
        error: 'Rule not found',
      };
    }

    // Fetch the email
    const [email] = await db
      .select()
      .from(structuredEmails)
      .where(and(
        eq(structuredEmails.id, structuredEmailId),
        eq(structuredEmails.userId, userId)
      ))
      .limit(1);

    if (!email) {
      return {
        matched: false,
        error: 'Email not found',
      };
    }

    // Parse the rule config
    let config: ExplicitRuleConfig | AiPromptRuleConfig;
    try {
      config = JSON.parse(rule.config);
    } catch (error) {
      return {
        matched: false,
        error: 'Invalid rule configuration',
      };
    }

    // Check based on rule type
    if (rule.type === 'explicit') {
      return await checkExplicitRule(config as ExplicitRuleConfig, email);
    } else if (rule.type === 'ai_prompt') {
      return await checkAiPromptRule(config as AiPromptRuleConfig, email);
    }

    return {
      matched: false,
      error: 'Unknown rule type',
    };
  } catch (error) {
    console.error('Error checking rule match:', error);
    return {
      matched: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check if an explicit rule matches an email
 */
async function checkExplicitRule(
  config: ExplicitRuleConfig,
  email: typeof structuredEmails.$inferSelect
): Promise<CheckRuleMatchResponse> {
  const matchDetails: Array<{ criteria: string; value: string }> = [];
  let allCriteriaMatch = true;

  // Check subject criteria
  if (config.subject) {
    const emailSubject = email.subject?.toLowerCase() || '';
    const subjectMatches = checkStringCriteria(
      emailSubject,
      config.subject.values,
      config.subject.operator
    );
    
    if (subjectMatches) {
      matchDetails.push({
        criteria: 'subject',
        value: `Matched with ${config.subject.operator} logic`,
      });
    } else {
      allCriteriaMatch = false;
    }
  }

  // Check from criteria
  if (config.from) {
    const fromData = email.fromData ? JSON.parse(email.fromData) : null;
    const fromAddresses = fromData?.addresses?.map((addr: any) => 
      addr.address?.toLowerCase() || ''
    ) || [];
    
    const fromMatches = checkEmailCriteria(
      fromAddresses,
      config.from.values,
      config.from.operator
    );
    
    if (fromMatches) {
      matchDetails.push({
        criteria: 'from',
        value: `Matched with ${config.from.operator} logic`,
      });
    } else {
      allCriteriaMatch = false;
    }
  }

  // Check attachment criteria
  if (config.hasAttachment !== undefined) {
    const attachments = email.attachments ? JSON.parse(email.attachments) : [];
    const hasAttachments = Array.isArray(attachments) && attachments.length > 0;
    
    if (hasAttachments === config.hasAttachment) {
      matchDetails.push({
        criteria: 'hasAttachment',
        value: `Email ${hasAttachments ? 'has' : 'does not have'} attachments`,
      });
    } else {
      allCriteriaMatch = false;
    }
  }

  // Check hasWords criteria (searches in text and HTML body)
  if (config.hasWords) {
    const textBody = email.textBody?.toLowerCase() || '';
    const htmlBody = email.htmlBody?.toLowerCase() || '';
    const combinedContent = `${textBody} ${htmlBody}`;
    
    const wordsMatch = checkStringCriteria(
      combinedContent,
      config.hasWords.values,
      config.hasWords.operator
    );
    
    if (wordsMatch) {
      matchDetails.push({
        criteria: 'hasWords',
        value: `Matched with ${config.hasWords.operator} logic`,
      });
    } else {
      allCriteriaMatch = false;
    }
  }

  return {
    matched: allCriteriaMatch && matchDetails.length > 0,
    matchDetails: allCriteriaMatch ? matchDetails : undefined,
  };
}

/**
 * Check string-based criteria (subject, hasWords)
 */
function checkStringCriteria(
  content: string,
  values: string[],
  operator: 'OR' | 'AND'
): boolean {
  if (operator === 'OR') {
    return values.some(value => content.includes(value.toLowerCase()));
  } else {
    return values.every(value => content.includes(value.toLowerCase()));
  }
}

/**
 * Check email-based criteria (from) with wildcard support
 */
function checkEmailCriteria(
  emailAddresses: string[],
  patterns: string[],
  operator: 'OR' | 'AND'
): boolean {
  const matches = patterns.map(pattern => {
    const lowerPattern = pattern.toLowerCase();
    
    // Handle wildcard patterns like *@domain.com
    if (lowerPattern.startsWith('*@')) {
      const domain = lowerPattern.substring(2);
      return emailAddresses.some(email => email.endsWith(`@${domain}`));
    }
    
    // Exact match
    return emailAddresses.some(email => email === lowerPattern);
  });

  if (operator === 'OR') {
    return matches.some(match => match);
  } else {
    return matches.every(match => match);
  }
}

/**
 * Check if an AI prompt rule matches an email
 * TODO: Implement AI-based matching using AI gateway
 */
async function checkAiPromptRule(
  config: AiPromptRuleConfig,
  email: typeof structuredEmails.$inferSelect
): Promise<CheckRuleMatchResponse> {
  // Stub implementation - will be implemented later with AI gateway
  return {
    matched: false,
    matchDetails: [],
    error: 'AI prompt matching not yet implemented',
  };
}

/**
 * Evaluate all active guard rules for a user against a structured email
 * Returns the action to take based on the highest priority matching rule
 */
export async function evaluateGuardRules(
  structuredEmailId: string,
  userId: string
): Promise<GuardEvaluationResult> {
  try {
    console.log(`🛡️ Guard - Evaluating rules for email ${structuredEmailId}`)

    // Fetch all active guard rules for this user, ordered by priority (highest first)
    const activeRules = await db
      .select()
      .from(guardRules)
      .where(and(
        eq(guardRules.userId, userId),
        eq(guardRules.isActive, true)
      ))
      .orderBy(desc(guardRules.priority));

    if (activeRules.length === 0) {
      console.log(`🛡️ Guard - No active rules found, allowing email`)
      return { shouldBlock: false, action: 'allow' };
    }

    console.log(`🛡️ Guard - Found ${activeRules.length} active rules to evaluate`)

    // Fetch the email
    const [email] = await db
      .select()
      .from(structuredEmails)
      .where(and(
        eq(structuredEmails.id, structuredEmailId),
        eq(structuredEmails.userId, userId)
      ))
      .limit(1);

    if (!email) {
      console.error(`🛡️ Guard - Email ${structuredEmailId} not found`)
      return { shouldBlock: false, action: 'allow' };
    }

    // Evaluate rules in priority order (highest first)
    for (const rule of activeRules) {
      try {
        let config: ExplicitRuleConfig | AiPromptRuleConfig;
        try {
          config = JSON.parse(rule.config);
        } catch (error) {
          console.error(`🛡️ Guard - Invalid config for rule ${rule.id}, skipping`)
          continue;
        }

        // Check if rule matches
        let matchResult: CheckRuleMatchResponse;
        if (rule.type === 'explicit') {
          matchResult = await checkExplicitRule(config as ExplicitRuleConfig, email);
        } else if (rule.type === 'ai_prompt') {
          matchResult = await checkAiPromptRule(config as AiPromptRuleConfig, email);
        } else {
          continue;
        }

        if (matchResult.matched) {
          console.log(`🛡️ Guard - Rule "${rule.name}" (${rule.id}) matched!`)

          // Update rule trigger stats
          await db
            .update(guardRules)
            .set({
              triggerCount: (rule.triggerCount || 0) + 1,
              lastTriggeredAt: new Date(),
            })
            .where(eq(guardRules.id, rule.id));

          // Parse and return the action
          let actionConfig: RuleActionConfig;
          try {
            actionConfig = JSON.parse(rule.actions || '{"action":"allow"}');
          } catch (error) {
            console.error(`🛡️ Guard - Invalid action config for rule ${rule.id}, defaulting to allow`)
            actionConfig = { action: 'allow' };
          }

          const result: GuardEvaluationResult = {
            shouldBlock: actionConfig.action === 'block',
            action: actionConfig.action,
            matchedRule: rule,
            routeToEndpointId: actionConfig.action === 'route' ? actionConfig.endpointId : undefined,
          };

          console.log(`🛡️ Guard - Action: ${actionConfig.action}${actionConfig.action === 'route' ? ` to endpoint ${actionConfig.endpointId}` : ''}`)
          return result;
        }
      } catch (error) {
        console.error(`🛡️ Guard - Error evaluating rule ${rule.id}:`, error)
        continue;
      }
    }

    // No rules matched - allow by default
    console.log(`🛡️ Guard - No rules matched, allowing email`)
    return { shouldBlock: false, action: 'allow' };

  } catch (error) {
    console.error(`🛡️ Guard - Error evaluating guard rules:`, error)
    // On error, fail open (allow) to prevent blocking legitimate emails
    return { shouldBlock: false, action: 'allow' };
  }
}

