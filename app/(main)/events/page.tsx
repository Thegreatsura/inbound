"use client"

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import Webhook from '@/components/icons/webhook'
import CircleWarning2 from '@/components/icons/circle-warning-2'
import CircleCheck from '@/components/icons/circle-check'
import TabClose from '@/components/icons/tab-close'
import Clock2 from '@/components/icons/clock-2'
import CirclePlus from '@/components/icons/circle-plus'
import Trash2 from '@/components/icons/trash-2'
import ExternalLink2 from '@/components/icons/external-link-2'
import ShieldCheck from '@/components/icons/shield-check'
import Clipboard2 from '@/components/icons/clipboard-2'
import Gear2 from '@/components/icons/gear-2'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useQueryState, parseAsStringLiteral } from 'nuqs'

// ============================================================================
// Types
// ============================================================================

interface DeliveryEvent {
  id: string
  eventType: string
  bounceType: string | null
  bounceSubType: string | null
  statusCode: string | null
  failedRecipient: string
  failedRecipientDomain: string
  originalSubject: string | null
  originalFrom: string | null
  userId: string | null
  domainName: string | null
  tenantName: string | null
  addedToBlocklist: boolean
  createdAt: string
}

interface WebhookEndpoint {
  id: string
  url: string
  description?: string
  filterTypes?: string[]
  disabled: boolean
  createdAt: string
}

interface WebhooksResponse {
  enabled: boolean
  endpoints: WebhookEndpoint[]
  eventTypes: string[]
}

// ============================================================================
// API Functions
// ============================================================================

async function fetchDeliveryEvents(): Promise<DeliveryEvent[]> {
  const response = await fetch('/api/delivery-events')
  if (!response.ok) {
    throw new Error('Failed to fetch delivery events')
  }
  return response.json()
}

async function fetchWebhooks(): Promise<WebhooksResponse> {
  const response = await fetch('/api/events/webhooks')
  if (!response.ok) {
    throw new Error('Failed to fetch webhooks')
  }
  return response.json()
}

async function createWebhook(data: { url: string; description?: string; filterTypes?: string[] }) {
  const response = await fetch('/api/events/webhooks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to create webhook')
  }
  return response.json()
}

async function deleteWebhook(endpointId: string) {
  const response = await fetch(`/api/events/webhooks/${endpointId}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    throw new Error('Failed to delete webhook')
  }
  return response.json()
}

async function updateWebhook(endpointId: string, data: { url?: string; description?: string; filterTypes?: string[]; disabled?: boolean }) {
  const response = await fetch(`/api/events/webhooks/${endpointId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to update webhook')
  }
  return response.json()
}

async function getPortalUrl(): Promise<string> {
  const response = await fetch('/api/events/webhooks/portal')
  if (!response.ok) {
    throw new Error('Failed to get portal URL')
  }
  const data = await response.json()
  return data.url
}

// ============================================================================
// Stats Component
// ============================================================================

function EventsStatsInternal() {
  const { data: events = [], isLoading } = useQuery({
    queryKey: ['delivery-events'],
    queryFn: fetchDeliveryEvents,
  })

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const bounces = events.filter(e => e.eventType === 'bounce')
  const hardBounces = bounces.filter(e => e.bounceType === 'hard')
  const softBounces = bounces.filter(e => e.bounceType === 'soft')
  const complaints = events.filter(e => e.eventType === 'complaint')

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardDescription className="text-sm font-medium">Total Events</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{events.length}</div>
          <p className="text-xs text-muted-foreground">All delivery events</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardDescription className="text-sm font-medium">Hard Bounces</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">{hardBounces.length}</div>
          <p className="text-xs text-muted-foreground">Permanent failures</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardDescription className="text-sm font-medium">Soft Bounces</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-amber-600">{softBounces.length}</div>
          <p className="text-xs text-muted-foreground">Temporary failures</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardDescription className="text-sm font-medium">Complaints</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-orange-600">{complaints.length}</div>
          <p className="text-xs text-muted-foreground">Spam reports</p>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================================
// Events List Component
// ============================================================================

function EventsListInternal() {
  const { data: events = [], isLoading, error, refetch } = useQuery({
    queryKey: ['delivery-events'],
    queryFn: fetchDeliveryEvents,
  })

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <Card className="border-destructive/50 bg-destructive/10">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-destructive">
            <TabClose className="h-4 w-4" />
            <span>Failed to load events</span>
            <Button variant="ghost" size="sm" onClick={() => refetch()} className="ml-auto">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (events.length === 0) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
              <CircleCheck className="h-6 w-6 text-emerald-600" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No delivery events</h3>
            <p className="text-sm text-muted-foreground">
              When emails bounce or receive complaints, they'll appear here.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {events.map((event) => (
        <Card key={event.id} className="hover:bg-accent/5 transition-colors">
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                event.bounceType === 'hard' ? 'bg-red-100 dark:bg-red-900/30' :
                event.bounceType === 'soft' ? 'bg-amber-100 dark:bg-amber-900/30' :
                event.eventType === 'complaint' ? 'bg-orange-100 dark:bg-orange-900/30' :
                'bg-gray-100 dark:bg-gray-800'
              }`}>
                {event.bounceType === 'hard' ? (
                  <TabClose className="h-5 w-5 text-red-600" />
                ) : event.bounceType === 'soft' ? (
                  <Clock2 className="h-5 w-5 text-amber-600" />
                ) : event.eventType === 'complaint' ? (
                  <CircleWarning2 className="h-5 w-5 text-orange-600" />
                ) : (
                  <Webhook className="h-5 w-5 text-gray-600" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm truncate">
                    {event.failedRecipient}
                  </span>
                  <Badge variant={
                    event.bounceType === 'hard' ? 'destructive' :
                    event.bounceType === 'soft' ? 'secondary' :
                    event.eventType === 'complaint' ? 'outline' : 'secondary'
                  } className="text-xs">
                    {event.bounceType ? `${event.bounceType} bounce` : event.eventType}
                  </Badge>
                  {event.addedToBlocklist && (
                    <Badge variant="outline" className="text-xs text-red-600 border-red-200">
                      Blocklisted
                    </Badge>
                  )}
                </div>
                
                <div className="text-xs text-muted-foreground space-y-0.5">
                  {event.bounceSubType && (
                    <p>Reason: {event.bounceSubType.replace(/_/g, ' ')}</p>
                  )}
                  {event.statusCode && (
                    <p>Status: {event.statusCode}</p>
                  )}
                  {event.originalSubject && (
                    <p className="truncate">Subject: {event.originalSubject}</p>
                  )}
                  {event.domainName && (
                    <p>Domain: {event.domainName}</p>
                  )}
                </div>
              </div>
              
              <div className="text-xs text-muted-foreground">
                {event.createdAt && formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ============================================================================
// Add Webhook Dialog
// ============================================================================

function AddWebhookDialog({ eventTypes, onSuccess }: { eventTypes: string[]; onSuccess: () => void }) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [description, setDescription] = useState('')
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [createdSecret, setCreatedSecret] = useState<string | null>(null)
  
  const createMutation = useMutation({
    mutationFn: createWebhook,
    onSuccess: (data) => {
      setCreatedSecret(data.secret)
      onSuccess()
      toast.success('Webhook created successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createMutation.mutate({
      url,
      description: description || undefined,
      filterTypes: selectedTypes.length > 0 ? selectedTypes : undefined,
    })
  }

  const handleClose = () => {
    setOpen(false)
    setUrl('')
    setDescription('')
    setSelectedTypes([])
    setCreatedSecret(null)
  }

  const copySecret = async () => {
    if (createdSecret) {
      await navigator.clipboard.writeText(createdSecret)
      toast.success('Secret copied to clipboard')
    }
  }

  const toggleEventType = (type: string) => {
    setSelectedTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    )
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => isOpen ? setOpen(true) : handleClose()}>
      <DialogTrigger asChild>
        <Button>
          <CirclePlus className="h-4 w-4 mr-2" />
          Add Webhook
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        {createdSecret ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CircleCheck className="h-5 w-5 text-emerald-600" />
                Webhook Created
              </DialogTitle>
              <DialogDescription>
                Save this signing secret — you won't be able to see it again.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label className="text-sm font-medium">Signing Secret</Label>
                <div className="flex items-center gap-2 mt-1.5">
                  <code className="flex-1 p-2 bg-muted rounded-md text-sm font-mono break-all">
                    {createdSecret}
                  </code>
                  <Button variant="outline" size="sm" onClick={copySecret}>
                    <Clipboard2 className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Use this secret to verify webhook signatures in your endpoint.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Add Webhook Endpoint</DialogTitle>
              <DialogDescription>
                Receive real-time notifications when emails bounce, fail to deliver, or receive complaints.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="url">Endpoint URL</Label>
                  <Input
                    id="url"
                    type="url"
                    placeholder="https://your-app.com/webhooks/email-events"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description (optional)</Label>
                  <Input
                    id="description"
                    placeholder="Production webhook for bounce handling..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Event Types</Label>
                    {selectedTypes.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedTypes([])}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {selectedTypes.length === 0 
                      ? 'Receiving all events. Select to filter specific events.'
                      : `Receiving ${selectedTypes.length} event type${selectedTypes.length > 1 ? 's' : ''}.`
                    }
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {eventTypes.map((type) => (
                      <label
                        key={type}
                        className="flex items-center gap-2.5 p-2.5 rounded-md border cursor-pointer hover:bg-accent/50 transition-colors"
                      >
                        <Checkbox
                          checked={selectedTypes.includes(type)}
                          onCheckedChange={() => toggleEventType(type)}
                        />
                        <span className="text-sm font-mono">{type}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Creating...' : 'Create Webhook'}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// Edit Webhook Dialog
// ============================================================================

function EditWebhookDialog({ 
  endpoint, 
  eventTypes, 
  onSuccess,
  open,
  onOpenChange,
}: { 
  endpoint: WebhookEndpoint
  eventTypes: string[]
  onSuccess: () => void
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [url, setUrl] = useState(endpoint.url)
  const [description, setDescription] = useState(endpoint.description || '')
  const [selectedTypes, setSelectedTypes] = useState<string[]>(endpoint.filterTypes || [])
  
  const updateMutation = useMutation({
    mutationFn: (data: { url?: string; description?: string; filterTypes?: string[] }) => 
      updateWebhook(endpoint.id, data),
    onSuccess: () => {
      onSuccess()
      onOpenChange(false)
      toast.success('Webhook updated successfully')
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateMutation.mutate({
      url,
      description: description || undefined,
      filterTypes: selectedTypes.length > 0 ? selectedTypes : undefined,
    })
  }

  const toggleEventType = (type: string) => {
    setSelectedTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    )
  }

  // Reset form when endpoint changes
  React.useEffect(() => {
    setUrl(endpoint.url)
    setDescription(endpoint.description || '')
    setSelectedTypes(endpoint.filterTypes || [])
  }, [endpoint])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Webhook</DialogTitle>
          <DialogDescription>
            Update your webhook endpoint settings.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-url">Endpoint URL</Label>
              <Input
                id="edit-url"
                type="url"
                placeholder="https://your-app.com/webhooks/email-events"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description (optional)</Label>
              <Input
                id="edit-description"
                placeholder="Production webhook for bounce handling..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Event Types</Label>
                {selectedTypes.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedTypes([])}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Clear all
                  </button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedTypes.length === 0 
                  ? 'Receiving all events. Select to filter specific events.'
                  : `Receiving ${selectedTypes.length} event type${selectedTypes.length > 1 ? 's' : ''}.`
                }
              </p>
              <div className="grid grid-cols-2 gap-2">
                {eventTypes.map((type) => (
                  <label
                    key={type}
                    className="flex items-center gap-2.5 p-2.5 rounded-md border cursor-pointer hover:bg-accent/50 transition-colors"
                  >
                    <Checkbox
                      checked={selectedTypes.includes(type)}
                      onCheckedChange={() => toggleEventType(type)}
                    />
                    <span className="text-sm font-mono">{type}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// Webhooks List Component
// ============================================================================

function WebhooksListInternal() {
  const queryClient = useQueryClient()
  const [editingEndpoint, setEditingEndpoint] = useState<WebhookEndpoint | null>(null)
  
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['event-webhooks'],
    queryFn: fetchWebhooks,
  })

  const deleteMutation = useMutation({
    mutationFn: deleteWebhook,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-webhooks'] })
      toast.success('Webhook deleted')
    },
    onError: () => {
      toast.error('Failed to delete webhook')
    },
  })

  const portalMutation = useMutation({
    mutationFn: getPortalUrl,
    onSuccess: (url) => {
      window.open(url, '_blank')
    },
    onError: () => {
      toast.error('Failed to open webhook portal')
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(2)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <Card className="border-destructive/50 bg-destructive/10">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-destructive">
            <TabClose className="h-4 w-4" />
            <span>Failed to load webhooks</span>
            <Button variant="ghost" size="sm" onClick={() => refetch()} className="ml-auto">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!data?.enabled) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
              <CircleWarning2 className="h-6 w-6 text-amber-600" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Webhooks not configured</h3>
            <p className="text-sm text-muted-foreground">
              Contact support to enable webhook notifications for your account.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const endpoints = data.endpoints || []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Your Webhooks</h3>
          <p className="text-sm text-muted-foreground">
            Receive real-time notifications about email delivery events.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => portalMutation.mutate()}
            disabled={portalMutation.isPending}
          >
            <ExternalLink2 className="h-4 w-4 mr-2" />
            {portalMutation.isPending ? 'Opening...' : 'Open Portal'}
          </Button>
          <AddWebhookDialog
            eventTypes={data.eventTypes}
            onSuccess={() => queryClient.invalidateQueries({ queryKey: ['event-webhooks'] })}
          />
        </div>
      </div>

      {endpoints.length === 0 ? (
        <Card>
          <CardContent className="p-8">
            <div className="text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <Webhook className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No webhooks configured</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Add a webhook endpoint to receive real-time notifications about bounces and complaints.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {endpoints.map((endpoint) => (
            <Card key={endpoint.id} className="hover:bg-accent/5 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                    <Webhook className="h-5 w-5 text-purple-600" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm truncate font-mono">
                        {new URL(endpoint.url).hostname}
                      </span>
                      <Badge variant={endpoint.disabled ? 'secondary' : 'default'} className="text-xs">
                        {endpoint.disabled ? 'Disabled' : 'Active'}
                      </Badge>
                      <div className="flex items-center gap-1 text-emerald-600">
                        <ShieldCheck className="h-3 w-3" />
                        <span className="text-xs">Signed</span>
                      </div>
                    </div>
                    
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <p className="truncate">{endpoint.url}</p>
                      {endpoint.description && (
                        <p>{endpoint.description}</p>
                      )}
                      {endpoint.filterTypes && endpoint.filterTypes.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap mt-1">
                          {endpoint.filterTypes.map((type) => (
                            <Badge key={type} variant="outline" className="text-xs">
                              {type}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {endpoint.createdAt && formatDistanceToNow(new Date(endpoint.createdAt), { addSuffix: true })}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingEndpoint(endpoint)}
                    >
                      <Gear2 className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate(endpoint.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Webhook Dialog */}
      {editingEndpoint && (
        <EditWebhookDialog
          endpoint={editingEndpoint}
          eventTypes={data?.eventTypes || []}
          open={!!editingEndpoint}
          onOpenChange={(open) => !open && setEditingEndpoint(null)}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['event-webhooks'] })}
        />
      )}
    </div>
  )
}

// ============================================================================
// Main Page Component
// ============================================================================

const tabOptions = ['events', 'webhooks'] as const

export default function EventsPage() {
  const [tab, setTab] = useQueryState(
    'tab',
    parseAsStringLiteral(tabOptions).withDefault('events')
  )

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Delivery Events</h1>
            <p className="text-muted-foreground text-sm">
              Track bounces, complaints, and delivery failures. Configure webhooks to receive real-time notifications.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tabOptions[number])} className="space-y-6">
          <TabsList>
            <TabsTrigger value="events">Events</TabsTrigger>
            <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          </TabsList>

          <TabsContent value="events" className="space-y-6">
            {/* Stats */}
            <EventsStatsInternal />

            {/* Events List */}
            <div>
              <h2 className="text-lg font-semibold mb-4">Recent Events</h2>
              <EventsListInternal />
            </div>
          </TabsContent>

          <TabsContent value="webhooks">
            <WebhooksListInternal />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
