"use client"

import * as React from "react"
import { useState } from "react"
import ChatBubble2 from "@/components/icons/chat-bubble-2"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  SidebarMenuButton,
} from "@/components/ui/sidebar"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { sendFeedbackAction } from "@/app/actions/feedback"
import Image from "next/image"
import { initBrowserLogCollector, getBrowserLogsText } from "@/lib/utils/browser-logs"
import { Checkbox } from "@/components/ui/checkbox"

interface FeedbackDialogProps {
  children?: React.ReactNode
}

export function FeedbackDialog({ children }: FeedbackDialogProps) {
  const [open, setOpen] = useState(false)
  const [feedback, setFeedback] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [includeLogs, setIncludeLogs] = useState(true)

  // initialize collector once on client
  React.useEffect(() => {
    initBrowserLogCollector()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!feedback.trim()) {
      toast.error("Please enter your feedback")
      return
    }

    if (feedback.length > 5000) {
      toast.error("Feedback is too long (max 5000 characters)")
      return
    }

    setIsSubmitting(true)

    try {
      const browserLogs = includeLogs ? getBrowserLogsText() : undefined
      const result = await sendFeedbackAction({ feedback: feedback.trim(), browserLogs })
      
      if (result.success) {
        toast.success("Thank you! Your feedback has been sent to Ryan.")
        setFeedback("")
        setIncludeLogs(true)
        setOpen(false)
      } else {
        toast.error(result.error || "Failed to send feedback")
      }
    } catch (error) {
      console.error("Error sending feedback:", error)
      toast.error("An unexpected error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && e.metaKey) {
      e.preventDefault()
      if (feedback.trim() && !isSubmitting) {
        handleSubmit(e as any)
      }
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (!newOpen) {
      // Reset form when dialog closes
      setFeedback("")
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {children || (
          <SidebarMenuButton tooltip="Send Feedback" className="w-full">
            <ChatBubble2 className="h-4 w-4" />
            <span>Send Feedback</span>
          </SidebarMenuButton>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ChatBubble2 className="h-5 w-5 text-primary" />
            Send Feedback to Developer Team
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex-row items-center">
            <p className="font-medium text-foreground mb-1 tracking-tight">Remember, this goes to a real human being, mind your manners.</p>
            <p className="text-muted-foreground text-sm">Your feedback helps make inbound better. We will auto attach your account information as well as current browser logs.</p>
          </div>
          <div className="space-y-2">
            <Textarea
              placeholder="What's on your mind? Share your feedback, suggestions, or any issues you've encountered..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              onKeyDown={handleKeyDown}
              className="min-h-[120px] resize-none"
              maxLength={5000}
              disabled={isSubmitting}
            />
            <div className="text-xs text-muted-foreground text-right">
              {feedback.length}/5000 characters
            </div>
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-muted-foreground select-none cursor-pointer">
              <Checkbox
                checked={includeLogs}
                onCheckedChange={(v) => setIncludeLogs(Boolean(v))}
                className="mr-1"
              />
              Include recent browser logs (recommended)
            </label>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !feedback.trim()}
              className="min-w-[100px]"
            >
              {isSubmitting ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Sending...
                </>
              ) : (
                "Send Feedback"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
} 