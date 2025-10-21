"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useCreateGuardRuleMutation, useGenerateRulesMutation } from '@/features/guard/hooks/useGuardHooks'
import { useEndpointsQuery } from '@/features/endpoints/hooks'
import type { ExplicitRuleConfig, AiEvaluatedRuleConfig, LogicOperator, RuleAction, RuleActionConfig } from '@/features/guard/types'
import type { EndpointWithStats } from '@/features/endpoints/types'

// Import icons
import ArrowBoldLeft from '@/components/icons/arrow-bold-left'
import CirclePlus from '@/components/icons/circle-plus'
import Code2 from '@/components/icons/code-2'
import BoltLightning from '@/components/icons/bolt-lightning'
import Trash2 from '@/components/icons/trash-2'
import SidebarToggleButton from '@/components/sidebar-toggle-button'
import Refresh2 from '@/components/icons/refresh-2'

export default function CreateGuardRulePage() {
  const router = useRouter()
  const createMutation = useCreateGuardRuleMutation()
  const generateMutation = useGenerateRulesMutation()
  const { data: endpoints } = useEndpointsQuery()

  // Basic form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [ruleType, setRuleType] = useState<'explicit' | 'ai_evaluated'>('explicit')
  const [priority, setPriority] = useState(0)

  // Action state
  const [action, setAction] = useState<RuleAction>('allow')
  const [routeEndpointId, setRouteEndpointId] = useState<string>('')

  // Explicit rule state
  const [explicitMode, setExplicitMode] = useState<'simple' | 'advanced'>('simple')
  const [simplePrompt, setSimplePrompt] = useState('')
  const [generatedConfig, setGeneratedConfig] = useState<ExplicitRuleConfig | null>(null)

  // Advanced explicit rule state
  const [subjectOperator, setSubjectOperator] = useState<LogicOperator>('OR')
  const [subjectValues, setSubjectValues] = useState<string[]>([''])
  const [fromOperator, setFromOperator] = useState<LogicOperator>('OR')
  const [fromValues, setFromValues] = useState<string[]>([''])
  const [hasAttachment, setHasAttachment] = useState<boolean | undefined>(undefined)
  const [wordsOperator, setWordsOperator] = useState<LogicOperator>('OR')
  const [wordsValues, setWordsValues] = useState<string[]>([''])

  // AI evaluated state
  const [aiMode, setAiMode] = useState<'simple' | 'advanced'>('simple')
  const [aiPrompt, setAiPrompt] = useState('')

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({})

  const activeEndpoints = (endpoints || []).filter((e: EndpointWithStats) => e.isActive)

  const handleAddValue = (
    values: string[],
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setter([...values, ''])
  }

  const handleRemoveValue = (
    index: number,
    values: string[],
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    if (values.length > 1) {
      setter(values.filter((_, i) => i !== index))
    }
  }

  const handleValueChange = (
    index: number,
    value: string,
    values: string[],
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    const newValues = [...values]
    newValues[index] = value
    setter(newValues)
  }

  const handleGenerateRules = async () => {
    if (!simplePrompt.trim()) {
      setErrors({ simplePrompt: 'Please enter a description' })
      return
    }

    try {
      const result = await generateMutation.mutateAsync(simplePrompt)
      if (result.config) {
        setGeneratedConfig(result.config)
        setErrors({})
      } else if (result.error) {
        setErrors({ simplePrompt: result.error })
      }
    } catch (error) {
      // Error handled by mutation
    }
  }

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!name.trim()) {
      newErrors.name = 'Rule name is required'
    }

    // Validate action
    if (action === 'route' && !routeEndpointId) {
      newErrors.action = 'Please select an endpoint for routing'
    }

    if (ruleType === 'explicit') {
      if (explicitMode === 'simple') {
        if (!generatedConfig && !simplePrompt.trim()) {
          newErrors.config = 'Please describe the rule or generate rules'
        }
        if (!generatedConfig && simplePrompt.trim()) {
          newErrors.config = 'Please generate rules before creating'
        }
      } else {
        const hasAnyConfig = 
          subjectValues.some(v => v.trim()) ||
          fromValues.some(v => v.trim()) ||
          hasAttachment !== undefined ||
          wordsValues.some(v => v.trim())

        if (!hasAnyConfig) {
          newErrors.config = 'At least one criteria must be configured'
        }
      }
    } else {
      if (!aiPrompt.trim()) {
        newErrors.aiPrompt = 'AI prompt is required'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return

    let config: ExplicitRuleConfig | AiEvaluatedRuleConfig

    if (ruleType === 'explicit') {
      if (explicitMode === 'simple' && generatedConfig) {
        config = { ...generatedConfig, mode: 'simple' }
      } else {
        config = {
          mode: 'advanced',
          ...(subjectValues.some(v => v.trim()) && {
            subject: {
              operator: subjectOperator,
              values: subjectValues.filter(v => v.trim()),
            },
          }),
          ...(fromValues.some(v => v.trim()) && {
            from: {
              operator: fromOperator,
              values: fromValues.filter(v => v.trim()),
            },
          }),
          ...(hasAttachment !== undefined && { hasAttachment }),
          ...(wordsValues.some(v => v.trim()) && {
            hasWords: {
              operator: wordsOperator,
              values: wordsValues.filter(v => v.trim()),
            },
          }),
        } as ExplicitRuleConfig
      }
    } else {
      config = {
        mode: aiMode,
        prompt: aiPrompt,
      } as AiEvaluatedRuleConfig
    }

    const actionConfig: RuleActionConfig = {
      action,
      ...(action === 'route' && { endpointId: routeEndpointId }),
    }

    try {
      const result = await createMutation.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        type: ruleType,
        config,
        priority,
        action: actionConfig,
      })

      router.push(`/guard/rules/${result.id}`)
    } catch (error) {
      // Error handled by mutation
    }
  }

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
          <div className="flex items-center gap-2">
            <SidebarToggleButton />
            <div>
              <h2 className="text-2xl font-semibold text-foreground mb-1 tracking-tight">
                Create Guard Rule
              </h2>
              <p className="text-muted-foreground text-sm font-medium">
                Configure a new email filtering rule
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>
                Give your rule a name and description
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Rule Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My filtering rule"
                  className={errors.name ? 'border-destructive' : ''}
                />
                {errors.name && (
                  <p className="text-sm text-destructive mt-1">{errors.name}</p>
                )}
              </div>

              <div>
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What does this rule do?"
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="priority">Priority</Label>
                <Input
                  id="priority"
                  type="number"
                  value={priority}
                  onChange={(e) => setPriority(parseInt(e.target.value) || 0)}
                  placeholder="0"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Higher priority rules are evaluated first
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Rule Configuration (Type + Config Combined) */}
          <Card>
            <CardHeader>
              <CardTitle>Rule Configuration</CardTitle>
              <CardDescription>
                Choose how you want to match and filter emails
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Rule Type Selection */}
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setRuleType('explicit')}
                  className={`p-4 border rounded-lg text-left transition-colors ${
                    ruleType === 'explicit'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                      : 'border-border hover:border-blue-300'
                  }`}
                >
                  <Code2 width="24" height="24" className="text-blue-600 mb-2" />
                  <div className="font-medium mb-1">Explicit Rules</div>
                  <p className="text-sm text-muted-foreground">
                    Define specific criteria like subject, sender, or keywords
                  </p>
                </button>

                <button
                  onClick={() => setRuleType('ai_evaluated')}
                  className={`p-4 border rounded-lg text-left transition-colors ${
                    ruleType === 'ai_evaluated'
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-950'
                      : 'border-border hover:border-purple-300'
                  }`}
                >
                  <BoltLightning width="24" height="24" className="text-purple-600 mb-2" />
                  <div className="font-medium mb-1">AI Evaluated</div>
                  <p className="text-sm text-muted-foreground">
                    Use AI to scan and interpret email meaning and context for filtering rules
                  </p>
                </button>
              </div>

              <Separator />

              {/* Configuration based on type */}
              {ruleType === 'explicit' ? (
                <div className="space-y-4">
                  {/* Simple/Advanced Mode Toggle */}
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setExplicitMode('simple')}
                      className={`px-4 py-2 border rounded-lg ${
                        explicitMode === 'simple' ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' : 'border-border'
                      }`}
                    >
                      Simple Mode
                    </button>
                    <button
                      onClick={() => setExplicitMode('advanced')}
                      className={`px-4 py-2 border rounded-lg ${
                        explicitMode === 'advanced' ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' : 'border-border'
                      }`}
                    >
                      Advanced Mode
                    </button>
                  </div>

                  {explicitMode === 'simple' ? (
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="simple-prompt">Describe your filtering rule *</Label>
                        <Textarea
                          id="simple-prompt"
                          value={simplePrompt}
                          onChange={(e) => setSimplePrompt(e.target.value)}
                          placeholder="Describe the emails you want to filter in plain English...&#10;Example: Block emails from spam@example.com with subject containing urgent"
                          rows={5}
                          className={errors.simplePrompt ? 'border-destructive' : ''}
                        />
                        {errors.simplePrompt && (
                          <p className="text-sm text-destructive mt-1">{errors.simplePrompt}</p>
                        )}
                        {errors.config && (
                          <p className="text-sm text-destructive mt-1">{errors.config}</p>
                        )}
                      </div>

                      <Button
                        onClick={handleGenerateRules}
                        disabled={generateMutation.isPending || !simplePrompt.trim()}
                        variant="secondary"
                      >
                        {generateMutation.isPending ? (
                          <>
                            <Refresh2 width="16" height="16" className="mr-2 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          'Generate Rules'
                        )}
                      </Button>

                      {generatedConfig && (
                        <div className="mt-4 p-4 bg-muted rounded-lg">
                          <div className="font-medium mb-2 text-sm">Generated Rule Preview:</div>
                          <pre className="text-xs overflow-auto">
                            {JSON.stringify(generatedConfig, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  ) : (
                    // Advanced Mode - existing detailed form
                    <div className="space-y-6">
                      {/* Subject */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label>Subject Contains</Label>
                          <Select value={subjectOperator} onValueChange={(v) => setSubjectOperator(v as LogicOperator)}>
                            <SelectTrigger className="w-24">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="OR">OR</SelectItem>
                              <SelectItem value="AND">AND</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {subjectValues.map((value, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <Input
                              value={value}
                              onChange={(e) => handleValueChange(index, e.target.value, subjectValues, setSubjectValues)}
                              placeholder="Search term..."
                            />
                            {subjectValues.length > 1 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveValue(index, subjectValues, setSubjectValues)}
                              >
                                <Trash2 width="16" height="16" />
                              </Button>
                            )}
                          </div>
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAddValue(subjectValues, setSubjectValues)}
                        >
                          <CirclePlus width="16" height="16" className="mr-2" />
                          Add Value
                        </Button>
                      </div>

                      <Separator />

                      {/* From */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label>From (Email Address)</Label>
                          <Select value={fromOperator} onValueChange={(v) => setFromOperator(v as LogicOperator)}>
                            <SelectTrigger className="w-24">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="OR">OR</SelectItem>
                              <SelectItem value="AND">AND</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {fromValues.map((value, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <Input
                              value={value}
                              onChange={(e) => handleValueChange(index, e.target.value, fromValues, setFromValues)}
                              placeholder="email@domain.com or *@domain.com"
                            />
                            {fromValues.length > 1 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveValue(index, fromValues, setFromValues)}
                              >
                                <Trash2 width="16" height="16" />
                              </Button>
                            )}
                          </div>
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAddValue(fromValues, setFromValues)}
                        >
                          <CirclePlus width="16" height="16" className="mr-2" />
                          Add Value
                        </Button>
                        <p className="text-sm text-muted-foreground">
                          Supports wildcards like *@domain.com
                        </p>
                      </div>

                      <Separator />

                      {/* Has Attachment */}
                      <div className="space-y-3">
                        <Label>Has Attachment</Label>
                        <div className="flex items-center gap-4">
                          <button
                            onClick={() => setHasAttachment(true)}
                            className={`px-4 py-2 border rounded-lg ${
                              hasAttachment === true ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' : 'border-border'
                            }`}
                          >
                            Must have attachment
                          </button>
                          <button
                            onClick={() => setHasAttachment(false)}
                            className={`px-4 py-2 border rounded-lg ${
                              hasAttachment === false ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' : 'border-border'
                            }`}
                          >
                            Must not have attachment
                          </button>
                          <button
                            onClick={() => setHasAttachment(undefined)}
                            className={`px-4 py-2 border rounded-lg ${
                              hasAttachment === undefined ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' : 'border-border'
                            }`}
                          >
                            Don't check
                          </button>
                        </div>
                      </div>

                      <Separator />

                      {/* Has Words */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label>Email Body Contains</Label>
                          <Select value={wordsOperator} onValueChange={(v) => setWordsOperator(v as LogicOperator)}>
                            <SelectTrigger className="w-24">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="OR">OR</SelectItem>
                              <SelectItem value="AND">AND</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {wordsValues.map((value, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <Input
                              value={value}
                              onChange={(e) => handleValueChange(index, e.target.value, wordsValues, setWordsValues)}
                              placeholder="Word or phrase..."
                            />
                            {wordsValues.length > 1 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveValue(index, wordsValues, setWordsValues)}
                              >
                                <Trash2 width="16" height="16" />
                              </Button>
                            )}
                          </div>
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAddValue(wordsValues, setWordsValues)}
                        >
                          <CirclePlus width="16" height="16" className="mr-2" />
                          Add Value
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                // AI Evaluated Configuration
                <div className="space-y-4">
                  {/* Mode Toggle */}
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setAiMode('simple')}
                      className={`px-4 py-2 border rounded-lg ${
                        aiMode === 'simple' ? 'border-purple-500 bg-purple-50 dark:bg-purple-950' : 'border-border'
                      }`}
                    >
                      Simple Mode
                    </button>
                    <button
                      onClick={() => setAiMode('advanced')}
                      className={`px-4 py-2 border rounded-lg ${
                        aiMode === 'advanced' ? 'border-purple-500 bg-purple-50 dark:bg-purple-950' : 'border-border'
                      }`}
                    >
                      Advanced Mode
                    </button>
                  </div>

                  {/* Prompt Input */}
                  {aiMode === 'simple' ? (
                    <div>
                      <Label htmlFor="ai-prompt">AI Prompt *</Label>
                      <div className="mt-2 space-y-2">
                        <p className="text-sm text-muted-foreground">
                          The AI will hit on this rule if the email...
                        </p>
                        <Input
                          id="ai-prompt"
                          value={aiPrompt}
                          onChange={(e) => setAiPrompt(e.target.value)}
                          placeholder="contains something about NextJS and Vercel CEO"
                          className={errors.aiPrompt ? 'border-destructive' : ''}
                        />
                      </div>
                      {errors.aiPrompt && (
                        <p className="text-sm text-destructive mt-1">{errors.aiPrompt}</p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <Label htmlFor="ai-prompt-advanced">AI Prompt *</Label>
                      <Textarea
                        id="ai-prompt-advanced"
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        placeholder="Write a detailed prompt describing the emails to match..."
                        rows={8}
                        className={errors.aiPrompt ? 'border-destructive' : ''}
                      />
                      {errors.aiPrompt && (
                        <p className="text-sm text-destructive mt-1">{errors.aiPrompt}</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Rule Action */}
          <Card>
            <CardHeader>
              <CardTitle>Rule Action</CardTitle>
              <CardDescription>
                What should happen when an email matches this rule?
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <button
                  onClick={() => setAction('allow')}
                  className={`w-full flex items-center space-x-2 p-3 border rounded-lg text-left transition-colors ${
                    action === 'allow' ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' : 'border-border hover:border-blue-300'
                  }`}
                >
                  <div className="flex-1">
                    <div className="font-medium">ALLOW</div>
                    <div className="text-sm text-muted-foreground">
                      Email will be routed to the original endpoint
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setAction('block')}
                  className={`w-full flex items-center space-x-2 p-3 border rounded-lg text-left transition-colors ${
                    action === 'block' ? 'border-red-500 bg-red-50 dark:bg-red-950' : 'border-border hover:border-red-300'
                  }`}
                >
                  <div className="flex-1">
                    <div className="font-medium">BLOCK</div>
                    <div className="text-sm text-muted-foreground">
                      Email will be accepted but not sent to any endpoint (logged only)
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setAction('route')}
                  className={`w-full flex items-center space-x-2 p-3 border rounded-lg text-left transition-colors ${
                    action === 'route' ? 'border-purple-500 bg-purple-50 dark:bg-purple-950' : 'border-border hover:border-purple-300'
                  }`}
                >
                  <div className="flex-1">
                    <div className="font-medium">ROUTE</div>
                    <div className="text-sm text-muted-foreground">
                      Email will be routed to a specific endpoint
                    </div>
                  </div>
                </button>
              </div>

              {action === 'route' && (
                <div>
                  <Label htmlFor="endpoint">Select Endpoint *</Label>
                  <Select value={routeEndpointId} onValueChange={setRouteEndpointId}>
                    <SelectTrigger className={errors.action ? 'border-destructive' : ''}>
                      <SelectValue placeholder="Choose an endpoint..." />
                    </SelectTrigger>
                    <SelectContent>
                      {activeEndpoints.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground">
                          No active endpoints available
                        </div>
                      ) : (
                        activeEndpoints.map((endpoint: EndpointWithStats) => (
                          <SelectItem key={endpoint.id} value={endpoint.id}>
                            {endpoint.name} ({endpoint.type})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {errors.action && (
                    <p className="text-sm text-destructive mt-1">{errors.action}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => router.push('/guard')}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? 'Creating...' : 'Create Rule'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
