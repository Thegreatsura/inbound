"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import SidebarToggleButton from '@/components/sidebar-toggle-button'
import ShieldCheck from '@/components/icons/shield-check'
import Ban2 from '@/components/icons/ban-2'
import CircleCheck from '@/components/icons/circle-check'
import ShieldAlert from '@/components/icons/shield-alert'

export default function GuardPage() {
  return (
    <div className="min-h-screen p-4">
      <div className="max-w-5xl mx-auto px-2">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SidebarToggleButton />
              <div>
                <h2 className="text-2xl font-semibold text-foreground mb-1 tracking-tight">
                  Guard
                </h2>
                <p className="text-muted-foreground text-sm font-medium">
                  Email security and protection settings
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-6">
          <div className="h-4 border-b border-slate-800"></div>

          {/* Security Status */}
          <Card className="border-none bg-transparent">
            <CardHeader className="p-0 mb-4">
              <CardTitle>Security Status</CardTitle>
              <CardDescription>
                Overview of your email security and protection settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/10 rounded-lg">
                    <ShieldCheck width="20" height="20" className="text-green-600" />
                  </div>
                  <div>
                    <div className="font-medium">Spam Protection</div>
                    <div className="text-sm text-muted-foreground">Active</div>
                  </div>
                </div>
                <Badge variant="default">Enabled</Badge>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/10 rounded-lg">
                    <CircleCheck width="20" height="20" className="text-green-600" />
                  </div>
                  <div>
                    <div className="font-medium">DKIM Verification</div>
                    <div className="text-sm text-muted-foreground">Active</div>
                  </div>
                </div>
                <Badge variant="default">Enabled</Badge>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/10 rounded-lg">
                    <CircleCheck width="20" height="20" className="text-green-600" />
                  </div>
                  <div>
                    <div className="font-medium">SPF Verification</div>
                    <div className="text-sm text-muted-foreground">Active</div>
                  </div>
                </div>
                <Badge variant="default">Enabled</Badge>
              </div>
            </CardContent>
          </Card>

          <div className="h-4 border-b border-slate-800"></div>

          {/* Blocked Senders */}
          <Card className="border-none bg-transparent">
            <CardHeader className="p-0 mb-4">
              <CardTitle>Blocked Senders</CardTitle>
              <CardDescription>
                Manage your blocked email addresses and domains
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="text-center py-8 text-muted-foreground">
                <Ban2 width="32" height="32" className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">No blocked senders</p>
                <Button variant="outline" size="sm" className="mt-4">
                  Add Blocked Sender
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="h-4 border-b border-slate-800"></div>

          {/* Security Alerts */}
          <Card className="border-none bg-transparent">
            <CardHeader className="p-0 mb-4">
              <CardTitle>Security Alerts</CardTitle>
              <CardDescription>
                Recent security events and notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="text-center py-8 text-muted-foreground">
                <ShieldAlert width="32" height="32" className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">No recent security alerts</p>
                <p className="text-xs mt-2">You'll be notified of any suspicious activity</p>
              </div>
            </CardContent>
          </Card>

          <div className="h-4 border-b border-slate-800"></div>

          {/* Advanced Protection */}
          <Card className="border-none bg-transparent">
            <CardHeader className="p-0 mb-4">
              <CardTitle>Advanced Protection</CardTitle>
              <CardDescription>
                Configure advanced security and protection features
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-0">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Attachment Scanning</div>
                  <div className="text-sm text-muted-foreground">Scan attachments for malware</div>
                </div>
                <Button variant="outline" size="sm">
                  Configure
                </Button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Link Protection</div>
                  <div className="text-sm text-muted-foreground">Check URLs for threats</div>
                </div>
                <Button variant="outline" size="sm">
                  Configure
                </Button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Rate Limiting</div>
                  <div className="text-sm text-muted-foreground">Limit incoming email rate</div>
                </div>
                <Button variant="outline" size="sm">
                  Configure
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

