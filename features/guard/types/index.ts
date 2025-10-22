import { guardRules } from '@/lib/db/schema';

// Infer types from schema
export type GuardRule = typeof guardRules.$inferSelect;
export type NewGuardRule = typeof guardRules.$inferInsert;

// Rule type
export type RuleType = 'explicit' | 'ai_prompt';

// Logic operators for explicit rules
export type LogicOperator = 'OR' | 'AND';

// Explicit rule mode
export type ExplicitRuleMode = 'simple' | 'advanced';

// Rule actions
export type RuleAction = 'allow' | 'block' | 'route';

// Rule action configuration
export interface RuleActionConfig {
  action: RuleAction;
  endpointId?: string; // Required when action is 'route'
}

// Explicit rule configuration
export interface ExplicitRuleConfig {
  mode?: ExplicitRuleMode;
  subject?: {
    operator: LogicOperator;
    values: string[];
  };
  from?: {
    operator: LogicOperator;
    values: string[]; // Supports wildcards like *@domain.com
  };
  hasAttachment?: boolean;
  hasWords?: {
    operator: LogicOperator;
    values: string[];
  };
}

// AI prompt rule configuration
export interface AiPromptRuleConfig {
  mode: 'simple' | 'advanced';
  prompt: string;
}

// Union type for all rule configurations
export type RuleConfig = ExplicitRuleConfig | AiPromptRuleConfig;

// API Request/Response types
export interface CreateGuardRuleRequest {
  name: string;
  description?: string;
  type: RuleType;
  config: RuleConfig;
  priority?: number;
  action: RuleActionConfig;
}

export interface UpdateGuardRuleRequest {
  name?: string;
  description?: string;
  config?: RuleConfig;
  isActive?: boolean;
  priority?: number;
  action?: RuleActionConfig;
}

export interface CheckRuleMatchRequest {
  structuredEmailId: string;
}

export interface CheckRuleMatchResponse {
  matched: boolean;
  matchDetails?: Array<{
    criteria: string;
    value: string;
  }>;
  error?: string;
}

export interface GuardRuleWithStats extends GuardRule {
  // Future: Add computed stats if needed
}

// AI Generation types
export interface GenerateExplicitRulesRequest {
  prompt: string;
}

export interface GenerateExplicitRulesResponse {
  config: ExplicitRuleConfig;
  error?: string;
}

