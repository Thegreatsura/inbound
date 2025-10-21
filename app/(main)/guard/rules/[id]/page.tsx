"use client"

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  useGuardRuleQuery,
  useUpdateGuardRuleMutation,
  useDeleteGuardRuleMutation,
  useGuardRuleCheckMutation,
} from '@/features/guard/hooks/useGuardHooks'
import type { ExplicitRuleConfig, AiEvaluatedRuleConfig, LogicOperator, RuleActionConfig } from '@/features/guard/types'
import { format } from 'date-fns'
import { toast } from 'sonner'

// Import icons
import ArrowBoldLeft from '@/components/icons/arrow-bold-left'
import CirclePlus from '@/components/icons/circle-plus'
import Code2 from '@/components/icons/code-2'
import BoltLightning from '@/components/icons/bolt-lightning'
import Trash2 from '@/components/icons/trash-2'
import SidebarToggleButton from '@/components/sidebar-toggle-button'
import CircleCheck from '@/components/icons/circle-check'
import CircleXmark from '@/components/icons/circle-xmark'
import { ApiIdLabel } from '@/components/api-id-label'
import { DeleteConfirmationDialog } from '@/components/ui/delete-confirmation-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export default function GuardRuleDetailPage() {
  const params = useParams()
  const router = useRouter()
  const ruleId = params.id as string

  const { data: rule, isLoading, error } = useGuardRuleQuery(ruleId)
  const updateMutation = useUpdateGuardRuleMutation()
  const deleteMutation = useDeleteGuardRuleMutation()
  const checkMutation = useGuardRuleCheckMutation()

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState(0)
  const [isActive, setIsActive] = useState(true)
  const [config, setConfig] = useState<ExplicitRuleConfig | AiEvaluatedRuleConfig | null>(null)
  const [actionConfig, setActionConfig] = useState<RuleActionConfig | null>(null)

  // Test state
  const [testEmailId, setTestEmailId] = useState('')
  const [testResult, setTestResult] = useState<{ matched: boolean; matchDetails?: any[]; error?: string } | null>(null)

  // Delete confirmation
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  // Load rule data
  useEffect(() => {
    if (rule) {
      setName(rule.name)
      setDescription(rule.description || '')
      setPriority(rule.priority || 0)
      setIsActive(rule.isActive || true)
      
      try {
        setConfig(JSON.parse(rule.config))
      } catch (e) {
        console.error('Failed to parse config:', e)
      }

      try {
        if (rule.actions) {
          setActionConfig(JSON.parse(rule.actions))
        }
      } catch (e) {
        console.error('Failed to parse actions:', e)
      }
    }
  }, [rule])

  const handleSave = async () => {
    if (!rule || !config) return

    try {
      await updateMutation.mutateAsync({
        ruleId: rule.id,
        data: {
          name,
          description: description || undefined,
          priority,
          isActive,
          config,
        },
      })
    } catch (error) {
      // Error handled by mutation
    }
  }

  const handleDelete = async () => {
    if (!rule) return

    try {
      await deleteMutation.mutateAsync(rule.id)
      router.push('/guard')
    } catch (error) {
      // Error handled by mutation
    }
  }

  const handleTest = async () => {
    if (!testEmailId.trim()) {
      toast.error('Please enter an email ID to test')
      return
    }

    try {
      const result = await checkMutation.mutateAsync({
        ruleId,
        data: { structuredEmailId: testEmailId },
      })
      setTestResult(result)
    } catch (error) {
      setTestResult({
        matched: false,
        error: error instanceof Error ? error.message : 'Test failed',
      })
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen p-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-center py-20">
            <div className="text-muted-foreground">Loading rule...</div>
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (error || !rule) {
    return (
      <div className="min-h-screen p-4">
        <div className="max-w-3xl mx-auto">
          <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-6">
            <div className="flex items-center gap-2 text-destructive">
              <CircleXmark width="16" height="16" />
              <span>{error?.message || 'Rule not found'}</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const RuleIcon = rule.type === 'explicit' ? Code2 : BoltLightning
  const iconColor = rule.type === 'explicit' ? '#3b82f6' : '#8b5cf6'

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-3xl mx-auto px-2">
        {/* Back Button */}
        <div className="flex items-center mb-6">
          <Link
            href="/guard"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowBoldLeft width="16" height="16" />
            Back to Guard Rules
          </Link>
        </div>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-2 rounded-md bg-muted">
              <RuleIcon width="32" height="32" style={{ color: iconColor }} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-2xl font-semibold text-foreground tracking-tight">
                  {rule.name}
                </h2>
                <Badge variant={rule.type === 'explicit' ? 'secondary' : 'default'}>
                  {rule.type === 'explicit' ? 'Explicit' : 'AI Evaluated'}
                </Badge>
                <Badge variant={rule.isActive ? 'default' : 'secondary'}>
                  {rule.isActive ? 'Active' : 'Inactive'}
                </Badge>
                {actionConfig && (
                  <Badge variant="outline">
                    {actionConfig.action.toUpperCase()}
                  </Badge>
                )}
              </div>
              <ApiIdLabel id={rule.id} size="sm" />
            </div>
          </div>
        </div>

        {/* Metadata */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Created</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold">
                {rule.createdAt ? format(new Date(rule.createdAt), 'MMM d, yyyy') : 'N/A'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Triggers</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold">{rule.triggerCount || 0}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Last Triggered</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold">
                {rule.lastTriggeredAt ? format(new Date(rule.lastTriggeredAt), 'MMM d, yyyy') : 'Never'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Form */}
        <div className="space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Rule Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="priority">Priority</Label>
                  <Input
                    id="priority"
                    type="number"
                    value={priority}
                    onChange={(e) => setPriority(parseInt(e.target.value) || 0)}
                  />
                </div>

                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select value={isActive ? 'active' : 'inactive'} onValueChange={(v) => setIsActive(v === 'active')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Configuration */}
          {actionConfig && (
            <Card>
              <CardHeader>
                <CardTitle>Action Configuration</CardTitle>
                <CardDescription>
                  What happens when an email matches this rule
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Action:</span>
                    <Badge variant={
                      actionConfig.action === 'allow' ? 'default' :
                      actionConfig.action === 'block' ? 'destructive' :
                      'secondary'
                    }>
                      {actionConfig.action.toUpperCase()}
                    </Badge>
                  </div>
                  {actionConfig.action === 'allow' && (
                    <p className="text-sm text-muted-foreground">
                      Email will be routed to the original endpoint
                    </p>
                  )}
                  {actionConfig.action === 'block' && (
                    <p className="text-sm text-muted-foreground">
                      Email will be accepted but not sent to any endpoint (logged only)
                    </p>
                  )}
                  {actionConfig.action === 'route' && (
                    <>
                      <p className="text-sm text-muted-foreground">
                        Email will be routed to a specific endpoint
                      </p>
                      {actionConfig.endpointId && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">Endpoint ID:</span>
                          <span className="text-sm font-mono text-muted-foreground">
                            {actionConfig.endpointId}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Rule Configuration (Read-only for now) */}
          <Card>
            <CardHeader>
              <CardTitle>Rule Configuration</CardTitle>
              <CardDescription>
                View the configured matching criteria (editing not yet implemented)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="p-4 bg-muted rounded-lg overflow-auto text-sm">
                {JSON.stringify(config, null, 2)}
              </pre>
            </CardContent>
          </Card>

          {/* Test Section */}
          <Card>
            <CardHeader>
              <CardTitle>Test Rule</CardTitle>
              <CardDescription>
                Test if this rule matches a specific email
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Enter structured email ID..."
                  value={testEmailId}
                  onChange={(e) => setTestEmailId(e.target.value)}
                />
                <Button
                  onClick={handleTest}
                  disabled={checkMutation.isPending}
                >
                  {checkMutation.isPending ? 'Testing...' : 'Test'}
                </Button>
              </div>

              {testResult && (
                <div className={`p-4 rounded-lg border ${
                  testResult.matched
                    ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800'
                    : 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {testResult.matched ? (
                      <>
                        <CircleCheck width="20" height="20" className="text-green-600" />
                        <span className="font-semibold text-green-600">Rule Matched!</span>
                      </>
                    ) : (
                      <>
                        <CircleXmark width="20" height="20" className="text-red-600" />
                        <span className="font-semibold text-red-600">No Match</span>
                      </>
                    )}
                  </div>

                  {testResult.error && (
                    <p className="text-sm text-muted-foreground">Error: {testResult.error}</p>
                  )}

                  {testResult.matchDetails && testResult.matchDetails.length > 0 && (
                    <div className="mt-2">
                      <p className="text-sm font-medium mb-1">Match Details:</p>
                      <ul className="list-disc list-inside text-sm space-y-1">
                        {testResult.matchDetails.map((detail, i) => (
                          <li key={i}>
                            <span className="font-medium">{detail.criteria}:</span> {detail.value}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <Button
              variant="destructive"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 width="16" height="16" className="mr-2" />
              Delete Rule
            </Button>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => router.push('/guard')}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </div>

        {/* Delete Confirmation Dialog */}
        <DeleteConfirmationDialog
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          onConfirm={handleDelete}
          title="Delete Guard Rule"
          itemName={rule.name}
          itemType="guard rule"
          isLoading={deleteMutation.isPending}
        />
      </div>
    </div>
  )
}

