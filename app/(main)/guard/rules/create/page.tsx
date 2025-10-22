"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useCreateGuardRuleMutation } from '@/features/guard/hooks/useGuardHooks'
import { useEndpointsQuery } from '@/features/endpoints/hooks'
import type { ExplicitRuleConfig, AiPromptRuleConfig, LogicOperator, RuleAction, RuleActionConfig } from '@/features/guard/types'
import type { EndpointWithStats } from '@/features/endpoints/types'

// Import icons
import ArrowBoldLeft from '@/components/icons/arrow-bold-left'
import CirclePlus from '@/components/icons/circle-plus'
import Code2 from '@/components/icons/code-2'
import BoltLightning from '@/components/icons/bolt-lightning'
import Trash2 from '@/components/icons/trash-2'
import SidebarToggleButton from '@/components/sidebar-toggle-button'

export default function CreateGuardRulePage() {
  const router = useRouter()
  const createMutation = useCreateGuardRuleMutation()
  const { data: endpoints } = useEndpointsQuery()

  // Basic form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [ruleType, setRuleType] = useState<'explicit' | 'ai_prompt'>('explicit')
  const [priority, setPriority] = useState(0)

  // Action state
  const [action, setAction] = useState<RuleAction>('allow')
  const [routeEndpointId, setRouteEndpointId] = useState<string>('')

  // Explicit rule state
  const [subjectOperator, setSubjectOperator] = useState<LogicOperator>('OR')
  const [subjectValues, setSubjectValues] = useState<string[]>([''])
  const [fromOperator, setFromOperator] = useState<LogicOperator>('OR')
  const [fromValues, setFromValues] = useState<string[]>([''])
  const [hasAttachment, setHasAttachment] = useState<boolean | undefined>(undefined)
  const [wordsOperator, setWordsOperator] = useState<LogicOperator>('OR')
  const [wordsValues, setWordsValues] = useState<string[]>([''])

  // AI evaluated state
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
      // Check if any meaningful criteria is configured
      // Note: hasAttachment can be true, false, or undefined
      // We need to check explicitly for boolean values, not just truthiness
      const hasSubject = subjectValues.some(v => v.trim());
      const hasFrom = fromValues.some(v => v.trim());
      const hasAttachmentCriteria = typeof hasAttachment === 'boolean';
      const hasWords = wordsValues.some(v => v.trim());
      
      const hasAnyConfig = hasSubject || hasFrom || hasAttachmentCriteria || hasWords;

      if (!hasAnyConfig) {
        newErrors.config = 'At least one criteria must be configured';
      }
    } else {
      if (!aiPrompt.trim()) {
        newErrors.aiPrompt = 'AI prompt is required';
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return

    let config: ExplicitRuleConfig | AiPromptRuleConfig

    if (ruleType === 'explicit') {
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
    } else {
      config = {
        mode: 'advanced',
        prompt: aiPrompt,
      } as AiPromptRuleConfig
    }

    // Build action config with discriminated union type
    let actionConfig: RuleActionConfig;
    if (action === 'allow') {
      actionConfig = { action: 'allow' };
    } else if (action === 'block') {
      actionConfig = { action: 'block' };
    } else {
      actionConfig = { action: 'route', endpointId: routeEndpointId };
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
      // Error toast is already shown by mutation onError handler
      console.error('Failed to create guard rule:', error);
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
        <div className="mb-4 flex items-center gap-2">
          <SidebarToggleButton />
          <h2 className="text-xl font-semibold tracking-tight">Create Guard Rule</h2>
        </div>

        {/* Form */}
        <div className="space-y-3">
          {/* Basic Info */}
          <section className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">Basic information</h3>
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
          </section>

          {/* Rule Configuration (Type + Config Combined) */}
          <section className="space-y-3">
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">Rule configuration</h3>
              <ToggleGroup type="single" value={ruleType} onValueChange={(v) => {
                if (v === 'explicit' || v === 'ai_prompt') {
                  setRuleType(v);
                }
              }} className="flex items-center gap-2 justify-start">
                <ToggleGroupItem value="explicit" className="h-8 rounded-full px-4 border data-[state=on]:bg-primary data-[state=on]:text-white">Explicit</ToggleGroupItem>
                <ToggleGroupItem value="ai_prompt" className="h-8 rounded-full px-4 border data-[state=on]:bg-primary data-[state=on]:text-white">AI</ToggleGroupItem>
              </ToggleGroup>
            </div>
            {ruleType === 'explicit' ? (
              <div className="space-y-3">
                <div className="space-y-4">
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
                        <ToggleGroup 
                          type="single" 
                          value={hasAttachment === true ? 'yes' : hasAttachment === false ? 'no' : 'any'} 
                          onValueChange={(v) => {
                            if (v === 'yes') setHasAttachment(true);
                            else if (v === 'no') setHasAttachment(false);
                            else setHasAttachment(undefined);
                          }} 
                          className="flex items-center gap-2 justify-start"
                        >
                          <ToggleGroupItem value="yes" className="h-8 rounded-full px-4 border data-[state=on]:bg-primary data-[state=on]:text-white">Has attachment</ToggleGroupItem>
                          <ToggleGroupItem value="no" className="h-8 rounded-full px-4 border data-[state=on]:bg-primary data-[state=on]:text-white">No attachment</ToggleGroupItem>
                          <ToggleGroupItem value="any" className="h-8 rounded-full px-4 border data-[state=on]:bg-primary data-[state=on]:text-white">Any</ToggleGroupItem>
                        </ToggleGroup>
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
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="ai-prompt">AI Prompt *</Label>
                  <Textarea
                    id="ai-prompt"
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="Write a detailed prompt describing the emails to match…"
                    rows={8}
                    className={errors.aiPrompt ? 'border-destructive' : ''}
                  />
                  {errors.aiPrompt && (
                    <p className="text-sm text-destructive mt-1">{errors.aiPrompt}</p>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* Rule Action */}
          <section className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">Rule action</h3>
            <ToggleGroup type="single" value={action} onValueChange={(v) => {
              if (v === 'allow' || v === 'block' || v === 'route') {
                setAction(v);
              }
            }} className="flex items-center gap-2 justify-start">
              <ToggleGroupItem value="allow" className="h-8 rounded-full px-4 border data-[state=on]:bg-primary data-[state=on]:text-white">ALLOW</ToggleGroupItem>
              <ToggleGroupItem value="block" className="h-8 rounded-full px-4 border data-[state=on]:bg-primary data-[state=on]:text-white">BLOCK</ToggleGroupItem>
              <ToggleGroupItem value="route" className="h-8 rounded-full px-4 border data-[state=on]:bg-primary data-[state=on]:text-white">ROUTE</ToggleGroupItem>
            </ToggleGroup>
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
          </section>

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
