import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { guardRules } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { validateRequest } from '../../helper/main';
import type { UpdateGuardRuleRequest } from '@/features/guard/types';

// GET /api/v2/guard/[id] - Get a single guard rule
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId, error: authError } = await validateRequest(request);
    if (authError || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ruleId = params.id;

    const [rule] = await db
      .select()
      .from(guardRules)
      .where(and(
        eq(guardRules.id, ruleId),
        eq(guardRules.userId, userId)
      ))
      .limit(1);

    if (!rule) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    return NextResponse.json(rule);
  } catch (error) {
    console.error('Error fetching guard rule:', error);
    return NextResponse.json(
      { error: 'Failed to fetch guard rule' },
      { status: 500 }
    );
  }
}

// PUT /api/v2/guard/[id] - Update a guard rule
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId, error: authError } = await validateRequest(request);
    if (authError || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ruleId = params.id;
    const body: UpdateGuardRuleRequest = await request.json();

    // Check if rule exists and belongs to user
    const [existingRule] = await db
      .select()
      .from(guardRules)
      .where(and(
        eq(guardRules.id, ruleId),
        eq(guardRules.userId, userId)
      ))
      .limit(1);

    if (!existingRule) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    // Build update object
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.config !== undefined) updateData.config = JSON.stringify(body.config);
    if (body.isActive !== undefined) updateData.isActive = body.isActive;
    if (body.priority !== undefined) updateData.priority = body.priority;
    if (body.action !== undefined) updateData.actions = JSON.stringify(body.action);

    // Update the rule
    const [updatedRule] = await db
      .update(guardRules)
      .set(updateData)
      .where(and(
        eq(guardRules.id, ruleId),
        eq(guardRules.userId, userId)
      ))
      .returning();

    return NextResponse.json(updatedRule);
  } catch (error) {
    console.error('Error updating guard rule:', error);
    return NextResponse.json(
      { error: 'Failed to update guard rule' },
      { status: 500 }
    );
  }
}

// DELETE /api/v2/guard/[id] - Delete a guard rule
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId, error: authError } = await validateRequest(request);
    if (authError || !userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ruleId = params.id;

    // Check if rule exists and belongs to user
    const [existingRule] = await db
      .select()
      .from(guardRules)
      .where(and(
        eq(guardRules.id, ruleId),
        eq(guardRules.userId, userId)
      ))
      .limit(1);

    if (!existingRule) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    // Delete the rule
    await db
      .delete(guardRules)
      .where(and(
        eq(guardRules.id, ruleId),
        eq(guardRules.userId, userId)
      ));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting guard rule:', error);
    return NextResponse.json(
      { error: 'Failed to delete guard rule' },
      { status: 500 }
    );
  }
}

// Export types
export type GetGuardRuleResponse = typeof guardRules.$inferSelect;
export type UpdateGuardRuleResponse = typeof guardRules.$inferSelect;
export interface DeleteGuardRuleResponse {
  success: boolean;
}

