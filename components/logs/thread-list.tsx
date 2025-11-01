"use client"

import { useState } from 'react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import ArrowBoldRight from '@/components/icons/arrow-bold-right'
import ArchiveDownload from '@/components/icons/archive-download'
import ArchiveExport from '@/components/icons/archive-export'
import { CopyIdInline } from '@/components/logs/copy-id-inline'
import ChevronDown from '@/components/icons/chevron-down'
import ChevronUp from '@/components/icons/chevron-up'

type ThreadMember = {
  id: string
  type: "inbound" | "outbound"
  order: number
  from: string
  to: string
  timestamp: Date | null
  isCurrent: boolean
}

interface ThreadListProps {
  threadMembers: ThreadMember[]
}

export function ThreadList({ threadMembers }: ThreadListProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  // Show newest first (reverse chronological)
  const sortedMembers = [...threadMembers].reverse()
  
  // Show first 4 when collapsed, all when expanded
  const visibleMembers = isExpanded ? sortedMembers : sortedMembers.slice(0, 4)
  const hasMore = sortedMembers.length > 4
  
  return (
    <div className="relative">
      <div className="space-y-0">
        {visibleMembers.map((member, idx) => {
          const isOutbound = member.type === "outbound"
          const isCurrent = member.isCurrent
          const isLastInList = idx === visibleMembers.length - 1
          const isFirstInList = idx === 0
          
          return (
            <div key={member.id} className="relative">
              {/* Top connecting line */}
              {isFirstInList ? (
                // Fade in for first item (newest)
                <div className="absolute left-[19px] top-0 w-[2px] h-[16px] bg-gradient-to-b from-transparent to-purple-200/50" />
              ) : (
                // Solid line for middle and last items
                <div 
                  className="absolute left-[19px] top-0 w-[2px] h-[16px]" 
                  style={{ 
                    background: 'linear-gradient(180deg, rgba(139, 92, 246, 0.3) 0%, rgba(59, 130, 246, 0.3) 50%, rgba(139, 92, 246, 0.3) 100%)'
                  }} 
                />
              )}
              
              {/* Vertical connecting line to next item */}
              {!isLastInList && (
                <div 
                  className="absolute left-[19px] top-[52px] bottom-0 w-[2px]" 
                  style={{ 
                    background: 'linear-gradient(180deg, rgba(139, 92, 246, 0.3) 0%, rgba(59, 130, 246, 0.3) 50%, rgba(139, 92, 246, 0.3) 100%)'
                  }} 
                />
              )}
              
              <Link
                href={`/logs/${member.id}`}
                className="block group"
                prefetch={true}
              >
                <div className="relative flex items-start gap-4 py-3 px-3 -ml-3 rounded-lg transition-all duration-200 hover:bg-muted/30">
                  {/* Timeline node */}
                  <div className="relative z-10 flex-shrink-0 mt-1">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 ${
                      isCurrent
                        ? isOutbound
                          ? 'bg-blue-500 shadow-lg shadow-blue-500/30 ring-4 ring-blue-100'
                          : 'bg-purple-500 shadow-lg shadow-purple-500/30 ring-4 ring-purple-100'
                        : isOutbound 
                          ? 'bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-300 group-hover:border-blue-400 group-hover:shadow-md'
                          : 'bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-300 group-hover:border-purple-400 group-hover:shadow-md'
                    }`}>
                      {isOutbound ? (
                        <ArchiveExport 
                          width="16" 
                          height="16" 
                          className={isCurrent ? "text-white" : "text-blue-600"}
                        />
                      ) : (
                        <ArchiveDownload 
                          width="16" 
                          height="16" 
                          className={isCurrent ? "text-white" : "text-purple-600"}
                        />
                      )}
                    </div>
                  </div>
                    
                  {/* Message content */}
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        isOutbound 
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-purple-100 text-purple-700'
                      }`}>
                        {isOutbound ? "Sent" : "Received"}
                      </span>
                      {isCurrent && (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full text-white shadow-sm ${
                          isOutbound ? 'bg-blue-500' : 'bg-purple-500'
                        }`}>
                          Current
                        </span>
                      )}
                      <span className="text-xs font-mono text-muted-foreground">
                        #{sortedMembers.length - idx}
                      </span>
                    </div>
                    
                    <div className="mb-2">
                      <div className="flex items-center gap-2 text-sm break-all">
                        <span className="font-semibold text-foreground">
                          {member.from}
                        </span>
                        <ArrowBoldRight width="14" height="14" className="text-muted-foreground flex-shrink-0" />
                        <span className="font-medium text-muted-foreground">
                          {member.to}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {member.timestamp && (
                        <span className="flex items-center gap-1">
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="opacity-60">
                            <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.5"/>
                            <path d="M6 3v3l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                          </svg>
                          {formatDistanceToNow(new Date(member.timestamp), { addSuffix: true })}
                        </span>
                      )}
                      <CopyIdInline id={member.id} />
                    </div>
                  </div>
                  
                  {/* Hover arrow */}
                  <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowBoldRight 
                      width="18" 
                      height="18" 
                      className="text-muted-foreground mt-2"
                    />
                  </div>
                </div>
              </Link>
            </div>
          )
        })}
      </div>

      {hasMore && (
        <div className="mt-4 pl-14">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.preventDefault()
              setIsExpanded(!isExpanded)
            }}
            className="text-xs text-muted-foreground hover:text-foreground h-auto py-1.5 px-2"
          >
            {isExpanded ? (
              <>
                <ChevronUp width="14" height="14" className="mr-1.5" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown width="14" height="14" className="mr-1.5" />
                Show {sortedMembers.length - 4} more message{sortedMembers.length - 4 !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
