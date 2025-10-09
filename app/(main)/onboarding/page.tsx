"use client"

import { useState, useEffect } from 'react'
import { useSession } from '@/lib/auth/auth-client'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import ArrowBoldRight from '@/components/icons/arrow-bold-right'
import CircleCheck from '@/components/icons/circle-check'
import Key2 from '@/components/icons/key-2'
import View from '@/components/icons/view'
import Hide from '@/components/icons/hide'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCreateApiKeyMutation } from '@/features/settings/hooks'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { completeOnboarding, skipOnboarding } from '@/app/actions/onboarding'
import { trackSignupConversion } from '@/lib/utils/twitter-tracking'
import Copy2 from '@/components/icons/copy-2'
import Code2 from '@/components/icons/code-2'
import CirclePlay from '@/components/icons/circle-play'
import ChevronDown from '@/components/icons/chevron-down'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function OnboardingPage() {
  const { data: session, isPending } = useSession()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [isCompleting, setIsCompleting] = useState(false)
  const [isSkipping, setIsSkipping] = useState(false)

  // Step state
  const [activeStep, setActiveStep] = useState<1 | 2>(1)

  // API key creation state
  const createApiKeyMutation = useCreateApiKeyMutation()
  const [apiKeyPlain, setApiKeyPlain] = useState<string | null>(null)
  const [showApiKey, setShowApiKey] = useState(false)

  // Demo email state
  const [demoEmail, setDemoEmail] = useState('')
  const [isRunningDemo, setIsRunningDemo] = useState(false)
  const [demoOutput, setDemoOutput] = useState<string | null>(null)
  const [isListeningForReply, setIsListeningForReply] = useState(false)
  const [pollTimeLeft, setPollTimeLeft] = useState(0)
  const [showManualCheck, setShowManualCheck] = useState(false)
  const [isManualChecking, setIsManualChecking] = useState(false)
  const [pollEndTime, setPollEndTime] = useState<number | null>(null)
  const [replyReceived, setReplyReceived] = useState<{
    from: string
    subject: string
    body: string
    receivedAt: string
  } | null>(null)

  // Set default demo email when session loads
  useEffect(() => {
    if (session?.user?.email && !demoEmail) {
      setDemoEmail(session.user.email)
    }
  }, [session?.user?.email, demoEmail])

  // Redirect if not authenticated
  useEffect(() => {
    if (!isPending && !session?.user) {
      router.push('/login')
    }
  }, [session, isPending, router])

  // Check polling status on mount (in case user navigated back)
  useEffect(() => {
    if (pollEndTime) {
      updateCountdown()
      
      // If we're past the end time, show manual check
      if (!shouldStillPoll() && isListeningForReply) {
        console.log('🔄 [MOUNT] Polling time elapsed while away - showing manual check')
        setIsListeningForReply(false)
        setShowManualCheck(true)
        setPollEndTime(null)
      }
    }
  }, []) // Only run on mount

  const handleCreateApiKey = async () => {
    try {
      const result = await createApiKeyMutation.mutateAsync({})
      if (result?.key) {
        setApiKeyPlain(result.key)
        setShowApiKey(false)
        toast.success('API key created')
        setActiveStep(2)
      } else {
        toast.error('Failed to create API key')
      }
    } catch (error) {
      console.error('Error creating API key:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create API key')
    }
  }

  const handleRunDemo = async () => {
    if (!apiKeyPlain || !demoEmail) return

    setIsRunningDemo(true)
    setDemoOutput('Running demo...')

    try {
      const response = await fetch('/api/v2/onboarding/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: apiKeyPlain,
          to: demoEmail
        })
      })

      const result = await response.json()

      if (response.ok) {
        console.log('✅ [DEMO] Email sent successfully:', {
          emailId: result.id,
          sentTo: demoEmail,
          userEmail: session?.user?.email
        })
        
        setDemoOutput(`✅ Success!\nEmail sent to ${demoEmail} with ID: ${result.id}, check your inbox!\n\n🎯 Waiting for your reply...\n\n$ inbound.emails.awaitReply( {demoEmail} )`)
        setIsListeningForReply(true)
        
        console.log('🎯 [DEMO] Starting reply polling system...')
        startListeningForReply()
      } else {
        console.error('❌ [DEMO] Failed to send email:', result)
        setDemoOutput(`❌ Error: ${result.error || 'Unknown error'}`)
      }
    } catch (error) {
      setDemoOutput(`❌ Network error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsRunningDemo(false)
    }
  }

  // Check if we should still be polling based on timestamp
  const shouldStillPoll = () => {
    if (!pollEndTime) return false
    return Date.now() < pollEndTime
  }

  // Update countdown timer based on timestamp
  const updateCountdown = () => {
    if (!pollEndTime) {
      setPollTimeLeft(0)
      return
    }
    
    const timeLeft = Math.max(0, Math.ceil((pollEndTime - Date.now()) / 1000))
    setPollTimeLeft(timeLeft)
    
    if (timeLeft === 0 && isListeningForReply) {
      console.log('⏰ [POLLING] 60 seconds elapsed - stopping automatic polling')
      setIsListeningForReply(false)
      setShowManualCheck(true)
      setPollEndTime(null)
    }
  }

  // Timer effect to update countdown and check polling status
  useEffect(() => {
    if (!pollEndTime) return

    const interval = setInterval(() => {
      updateCountdown()
    }, 1000)

    return () => clearInterval(interval)
  }, [pollEndTime, isListeningForReply])

  const startListeningForReply = () => {
    console.log('🎯 [ONBOARDING] Starting reply listener - will poll for 60 seconds')
    console.log('🎯 [ONBOARDING] User email:', session?.user?.email)
    console.log('🎯 [ONBOARDING] Demo email sent to:', demoEmail)
    
    // Set end time 60 seconds in the future
    const endTime = Date.now() + (60 * 1000)
    setPollEndTime(endTime)
    setIsListeningForReply(true)
    setPollTimeLeft(60)
    setShowManualCheck(false)
    
    console.log('🕐 [POLLING] Poll will end at:', new Date(endTime).toISOString())
    
    const checkForReply = async () => {
      const now = Date.now()
      const timeLeft = Math.max(0, Math.ceil((endTime - now) / 1000))
      
      console.log('🔄 [POLLING] Checking for reply...', new Date().toISOString())
      console.log('🔄 [POLLING] Time left:', timeLeft, 'seconds')
      console.log('🔄 [POLLING] Should still poll:', shouldStillPoll())
      
      try {
        const response = await fetch('/api/v2/onboarding/check-reply')
        console.log('📡 [POLLING] Response status:', response.status, response.statusText)
        
        if (response.ok) {
          const data = await response.json()
          console.log('📋 [POLLING] Response data:', JSON.stringify(data, null, 2))
          
          if (data.hasReply && data.reply) {
            console.log('🎉 [POLLING] Reply found! Details:', {
              from: data.reply.from,
              subject: data.reply.subject,
              bodyLength: data.reply.body?.length || 0,
              receivedAt: data.reply.receivedAt
            })
            
            setReplyReceived(data.reply)
            setIsListeningForReply(false)
            setShowManualCheck(false)
            setPollEndTime(null)
            setPollTimeLeft(0)
            setDemoOutput(prev => `${prev}\n\n🎉 Reply received!\n\nIt looks like you like the ${data.reply.body} mail client! \n\n`)
            console.log('✅ [POLLING] Stopping polling - reply received and processed')
            return
          } else {
            console.log('📭 [POLLING] No reply yet, will continue polling...')
          }
        } else {
          console.error('❌ [POLLING] API error:', response.status, response.statusText)
        }
      } catch (error) {
        console.error('❌ [POLLING] Network error checking for reply:', error)
        console.error('❌ [POLLING] Error details:', {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        })
      }
      
      // Continue polling if time hasn't elapsed
      if (now < endTime) {
        console.log('⏰ [POLLING] Scheduling next check in 3 seconds...')
        setTimeout(checkForReply, 3000) // Poll every 3 seconds
      } else {
        console.log('🛑 [POLLING] Stopping polling - time elapsed')
        setIsListeningForReply(false)
        setShowManualCheck(true)
        setPollEndTime(null)
      }
    }
    
    // Start the first check
    console.log('🚀 [POLLING] Starting first reply check...')
    checkForReply()
  }

  const handleManualCheck = async () => {
    console.log('🔍 [MANUAL] Manual check for reply triggered')
    setIsManualChecking(true)
    
    try {
      const response = await fetch('/api/v2/onboarding/check-reply')
      console.log('📡 [MANUAL] Response status:', response.status, response.statusText)
      
      if (response.ok) {
        const data = await response.json()
        console.log('📋 [MANUAL] Response data:', JSON.stringify(data, null, 2))
        
        if (data.hasReply && data.reply) {
          console.log('🎉 [MANUAL] Reply found!')
          setReplyReceived(data.reply)
          setShowManualCheck(false)
          setDemoOutput(prev => `${prev}\n\n🎉 Reply received!\nFrom: ${data.reply.from}\nSubject: ${data.reply.subject}`)
        } else {
          console.log('📭 [MANUAL] No reply found yet')
          setDemoOutput(prev => `${prev}\n\n📭 No reply yet - check again after replying to the email`)
        }
      } else {
        console.error('❌ [MANUAL] API error:', response.status, response.statusText)
      }
    } catch (error) {
      console.error('❌ [MANUAL] Error checking for reply:', error)
    } finally {
      setIsManualChecking(false)
    }
  }

  const handleCompleteOnboarding = async () => {
    if (!session?.user?.id) return

    setIsCompleting(true)
    try {
      const result = await completeOnboarding(session.user.id)

      if (!result.success) {
        throw new Error(result.error || 'Failed to complete onboarding')
      }

      // Invalidate onboarding status to update the cache
      queryClient.invalidateQueries({ queryKey: ['onboarding-status'] })

      // Track user signup conversion for Twitter ads
      if (session.user.email) {
        trackSignupConversion(session.user.email, session.user.id)
      }

      toast.success('Welcome to Inbound! 🎉')
      router.push('/add?onboarding=true')
    } catch (error) {
      console.error('Error completing onboarding:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to complete onboarding')
    } finally {
      setIsCompleting(false)
    }
  }

  const handleSkipOnboarding = async () => {
    if (!session?.user?.id) return

    setIsSkipping(true)
    try {
      const result = await skipOnboarding(session.user.id)

      if (!result.success) {
        throw new Error(result.error || 'Failed to skip onboarding')
      }

      // Invalidate onboarding status to update the cache
      queryClient.invalidateQueries({ queryKey: ['onboarding-status'] })

      // Track user signup conversion for Twitter ads (same as completing)
      if (session.user.email) {
        trackSignupConversion(session.user.email, session.user.id)
      }

      toast.success('Onboarding skipped. Welcome to Inbound! 🎉')
      router.push('/add?onboarding=true')
    } catch (error) {
      console.error('Error skipping onboarding:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to skip onboarding')
    } finally {
      setIsSkipping(false)
    }
  }

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!session?.user) {
    return null
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-4xl mx-auto mt-10">
        {/* Header */}
        <div className="mb-6 flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-semibold text-foreground mb-1 tracking-tight">
              Welcome to Inbound, {session.user.name || session.user.email?.split('@')[0]}!
            </h2>
            <p className="text-muted-foreground text-sm font-medium">Follow these quick steps to send your first email.</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSkipOnboarding}
            disabled={isSkipping || isCompleting}
            className="text-muted-foreground hover:text-foreground"
          >
            {isSkipping ? 'Skipping...' : 'Skip onboarding'}
          </Button>
        </div>

        {/* Video Tutorial Card */}
        <Alert className="mb-6 bg-primary/5 border-primary/20">
          <AlertDescription className="flex items-start gap-3">
            <CirclePlay className="h-5 w-5 mt-0.5 text-primary flex-shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-sm mb-2">Prefer to watch a video?</p>
              <a 
                href="https://youtu.be/MOi19cSQdRI" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline inline-flex items-center gap-1"
              >
                Watch our setup tutorial video
                <span className="text-xs">↗</span>
              </a>
            </div>
          </AlertDescription>
        </Alert>

        {/* Step 1: Create an API key */}
        <Card className="rounded-xl mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Key2 width="20" height="20" />
              Create an API Key
            </CardTitle>
            <CardDescription>Generate a key to authenticate API requests.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!apiKeyPlain ? (
              <Button
                onClick={handleCreateApiKey}
                disabled={createApiKeyMutation.isPending}
              >
                {createApiKeyMutation.isPending ? 'Creating…' : 'Create API Key'}
              </Button>
            ) : (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <Badge variant="secondary"><CircleCheck className="h-3 w-3 mr-1" /> Created</Badge>
                  <span>This key is shown only once. Store it securely.</span>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKeyPlain}
                    readOnly
                    className="font-mono"
                  />
                  <Button variant="secondary" onClick={() => setShowApiKey(v => !v)}>
                    {showApiKey ? <Hide width="16" height="16" /> : <View width="16" height="16" />}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={async () => { if (apiKeyPlain) { await navigator.clipboard.writeText(apiKeyPlain); toast.success('Copied'); } }}
                  >
                    <Copy2 width="16" height="16" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 2: Send an email (JS) */}

        <div className="flex justify-center">
          <ChevronDown width="20" height="20" className="text-muted-foreground" />
        </div>

        {/* Code block with Run button */}
        <div className={`mt-4 relative transition-opacity ${!apiKeyPlain ? 'opacity-50' : ''}`}>
          <pre className="bg-[#272822] text-[#F8F8F2] p-4 rounded-md overflow-x-auto text-xs border font-mono shadow-lg-bottom" >
            <code>
              <span className="text-[#75715E]">// Now you can send your first email!</span>
              {'\n'}
              <span className="text-[#75715E]">// Just click the run button below!</span>
              {'\n\n'}
              <span className="text-[#F92672]">import</span> <span className="text-[#F8F8F2]">{'{'}</span> <span className="text-[#66D9EF]">Inbound</span> <span className="text-[#F8F8F2]">{'}'}</span> <span className="text-[#F92672]">from</span> <span className="text-[#E6DB74]">'@inboundemail/sdk'</span>
              {'\n\n'}
              <span className="text-[#F92672]">const</span> <span className="text-[#F8F8F2]">inbound</span> <span className="text-[#F92672]">=</span> <span className="text-[#F92672]">new</span> <span className="text-[#A6E22E]">Inbound</span><span className="text-[#F8F8F2]">({'{'}</span> <span className="text-[#F8F8F2]">apiKey</span><span className="text-[#F92672]">:</span> <span className="text-[#E6DB74]">'{apiKeyPlain ? apiKeyPlain.slice(0, 8) + '...' : 'process.env.INBOUND_API_KEY!'}'</span> <span className="text-[#F8F8F2]">{'})'}</span>
              {'\n\n'}
              <span className="text-[#75715E]">// Simple email</span>
              {'\n'}
              <span className="text-[#F92672]">const</span> <span className="text-[#F8F8F2]">{'{'}</span> <span className="text-[#F8F8F2]">id</span> <span className="text-[#F8F8F2]">{'}'}</span> <span className="text-[#F92672]">=</span> <span className="text-[#F92672]">await</span> <span className="text-[#F8F8F2]">inbound</span><span className="text-[#F92672]">.</span><span className="text-[#F8F8F2]">emails</span><span className="text-[#F92672]">.</span><span className="text-[#A6E22E]">send</span><span className="text-[#F8F8F2]">({'{'}</span>
              {'\n'}
              {'  '}<span className="text-[#F8F8F2]">from</span><span className="text-[#F92672]">:</span> <span className="text-[#E6DB74]">'agent@inbnd.dev'</span><span className="text-[#F8F8F2]">,</span>
              {'\n'}
              {'  '}<span className="text-[#F8F8F2]">to</span><span className="text-[#F92672]">:</span>
              <span className="text-[#E6DB74]">
                <Input
                  id="demo-email"
                  type="email"
                  value={demoEmail}
                  onChange={(e) => setDemoEmail(e.target.value)}
                  placeholder="you@example.com"
                  disabled={activeStep !== 2}
                  style={{
                    fontSize: '.75rem',
                    lineHeight: '1rem',
                  }}
                  className="inline-block w-60 h-4 bg-[#272822] border border-[#49483E] text-[#E6DB74] rounded text-left"
                />
              </span>
              <span className="text-[#F8F8F2]">,</span>
              {'\n'}
              {'  '}<span className="text-[#F8F8F2]">subject</span><span className="text-[#F92672]">:</span> <span className="text-[#E6DB74]">'Welcome to Inbound'</span><span className="text-[#F8F8F2]">,</span>
              {'\n'}
              {'  '}<span className="text-[#F8F8F2]">text</span><span className="text-[#F92672]">:</span> <span className="text-[#E6DB74]">'Thanks for signing up! What is your favorite email client?'</span><span className="text-[#F8F8F2]">,</span>
              {'\n'}
              {'  '}<span className="text-[#F8F8F2]">html</span><span className="text-[#F92672]">:</span> <span className="text-[#E6DB74]">'&lt;p&gt;Thanks for signing up! What is your favorite email client?&lt;/p&gt;'</span>
              {'\n'}
              <span className="text-[#F8F8F2]">{'})'}</span>
              {'\n\n'}
              <span className="text-[#F8F8F2]">console</span><span className="text-[#F92672]">.</span><span className="text-[#A6E22E]">log</span><span className="text-[#F8F8F2]">(</span><span className="text-[#E6DB74]">'Email sent:'</span><span className="text-[#F8F8F2]">,</span> <span className="text-[#F8F8F2]">id</span><span className="text-[#F8F8F2]">)</span>
            </code>
          </pre>
          <Button
            onClick={handleRunDemo}
            disabled={!apiKeyPlain || !demoEmail || isRunningDemo}
            size="sm"
            className="absolute bottom-4 right-4"
          >
            <CirclePlay width="14" height="14" className="mr-1" />
            {isRunningDemo ? 'Running...' : 'Run'}
          </Button>
        </div>

        {/* Terminal output */}
        {demoOutput && (
          <div className="bg-[#272822] text-white-400 p-4 rounded-md rounded-t-none font-mono text-xs border border-t-0 -mt-4">
            <div className="text-muted-foreground mb-1 mt-3">$ inbound.emails.send( {demoEmail} )</div>
            <div className="whitespace-pre-wrap">{demoOutput}</div>
            {isListeningForReply && (
              <div className="flex items-center gap-2 mt-2">
                <div className="animate-pulse w-2 h-2 bg-yellow-400 rounded-full"></div>
                <span className="text-yellow-400">Listening for reply... ({pollTimeLeft}s remaining)</span>
              </div>
            )}
            {showManualCheck && !replyReceived && (
              <div className="mt-2">
                <Button
                  onClick={handleManualCheck}
                  disabled={isManualChecking}
                  size="sm"
                  variant="outline"
                  className="text-xs"
                >
                  {isManualChecking ? 'Checking...' : 'Check for Reply'}
                </Button>
              </div>
            )}
            {replyReceived && (
                             <div className="mt-3 bg-[#272822] border border-[#49483E] rounded p-3 font-mono">
                 <div className="text-[#A6E22E] text-xs font-bold mb-2 flex items-center gap-2">
                   📧 Reply Details
                 </div>
                 <div className="text-[#F8F8F2] text-xs space-y-1">
                   <div className="flex gap-2">
                     <span className="text-[#66D9EF] font-medium min-w-[50px]">From:</span>
                     <span className="text-[#E6DB74]">{replyReceived.from}</span>
                   </div>
                   <div className="flex gap-2">
                     <span className="text-[#66D9EF] font-medium min-w-[50px]">Subject:</span>
                     <span className="text-[#E6DB74]">{replyReceived.subject}</span>
                   </div>
                   <div className="flex gap-2">
                     <span className="text-[#66D9EF] font-medium min-w-[50px]">Body:</span>
                     <span className="text-[#F8F8F2] break-words">
                       {replyReceived.body.split('\n\n').slice(0, 5).join('\n\n')}
                     </span>
                   </div>
                 </div>
               </div>
            )}
          </div>
        )}

        {/* Action Button */}
        
        {demoOutput && demoOutput.includes('✅ Success!') && (
          <div className="text-center mt-4">
            <Button
              onClick={handleCompleteOnboarding}
              disabled={isCompleting}
              size="lg"
            >
              {isCompleting ? 'Completing setup...' : (
                <>
                  Continue to Domain Setup
                  <ArrowBoldRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              This will mark your onboarding as complete and take you to add your first domain.
            </p>
          </div>
        )}


      </div>
    </div>
  )
} 