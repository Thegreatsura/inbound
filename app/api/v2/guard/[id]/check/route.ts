import { NextRequest, NextResponse } from 'next/server';
import { validateRequest } from '../../../helper/main';
import { checkRuleMatch } from '@/lib/guard/rule-matcher';
import type { CheckRuleMatchRequest, CheckRuleMatchResponse } from '@/features/guard/types';

// POST /api/v2/guard/[id]/check - Check if a rule matches a structured email
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, error: authError } = await validateRequest(request);
    if (authError || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: ruleId } = await params;
    const body: CheckRuleMatchRequest = await request.json();

    if (!body.structuredEmailId) {
      return NextResponse.json(
        { error: 'Missing required field: structuredEmailId' },
        { status: 400 }
      );
    }

    // Call the lib function
    const result = await checkRuleMatch(
      ruleId,
      body.structuredEmailId,
      userId
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error checking rule match:', error);
    return NextResponse.json(
      { 
        matched: false,
        error: error instanceof Error ? error.message : 'Failed to check rule match'
      } as CheckRuleMatchResponse,
      { status: 500 }
    );
  }
}

