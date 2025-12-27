import { consumeStream, convertToModelMessages, streamText, type UIMessage } from "ai"
import { getModel } from '@/lib/ai/provider'

export const maxDuration = 30

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json()

  const prompt = convertToModelMessages(messages)

  const result = streamText({
    model: getModel('gpt-4o-mini'),
    system: `You are a helpful assistant that helps users analyze tenant and email identity data. You have access to information about email service tenants, their domains/identities, and metrics like complaint scores, bounce rates, spam scores, and email volumes. Help users understand their data and provide insights.`,
    prompt,
    abortSignal: req.signal,
  })

  return result.toUIMessageStreamResponse({
    consumeSseStream: consumeStream,
  })
}
