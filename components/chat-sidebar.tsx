"use client"

import type React from "react"

import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Send, X, MessageSquare } from "lucide-react"

export function ChatSidebar() {
  const [isOpen, setIsOpen] = useState(true)
  const [inputValue, setInputValue] = useState("")

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim() || status === "in_progress") return
    sendMessage({ text: inputValue })
    setInputValue("")
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed right-3 top-3 p-1.5 bg-background border border-border rounded-sm hover:bg-muted"
      >
        <MessageSquare className="h-4 w-4" />
      </button>
    )
  }

  return (
    <div className="w-72 border-l border-border bg-background flex flex-col h-screen">
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-border">
        <span className="text-xs font-medium">AI Assistant</span>
        <button onClick={() => setIsOpen(false)} className="p-0.5 hover:bg-muted rounded-sm">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {messages.length === 0 && (
          <p className="text-[10px] text-muted-foreground">
            Ask about tenant data, email metrics, or identity management...
          </p>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`text-xs p-1.5 rounded-sm ${
              message.role === "user" ? "bg-primary text-primary-foreground ml-4" : "bg-muted mr-4"
            }`}
          >
            {message.parts.map((part, i) => {
              if (part.type === "text") {
                return <span key={i}>{part.text}</span>
              }
              return null
            })}
          </div>
        ))}
        {status === "in_progress" && <div className="text-[10px] text-muted-foreground">Thinking...</div>}
      </div>

      <form onSubmit={handleSubmit} className="p-2 border-t border-border flex gap-1">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Ask about your data..."
          className="h-7 text-xs rounded-sm"
          disabled={status === "in_progress"}
        />
        <Button type="submit" size="sm" className="h-7 w-7 p-0 rounded-sm" disabled={status === "in_progress"}>
          <Send className="h-3 w-3" />
        </Button>
      </form>
    </div>
  )
}
