import { createOpenAI } from '@ai-sdk/openai'

/**
 * Centralized OpenAI provider configuration
 * Uses your OPENAI_API_KEY directly instead of Vercel AI Gateway
 *
 * Usage:
 *   import { openai, getModel, getModelName } from '@/lib/ai/provider'
 *
 *   // Use default model
 *   const result = await generateText({ model: getModel(), prompt: '...' })
 *
 *   // Use specific model
 *   const result = await generateText({ model: openai('gpt-4o'), prompt: '...' })
 *
 *   // Get model name for logging/storage
 *   const modelName = getModelName() // 'gpt-4o-mini'
 */

export const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  compatibility: 'strict',
})

// Model name mapping - strips 'openai/' prefix if present for backwards compatibility
function normalizeModelName(model: string): string {
  return model.startsWith('openai/') ? model.slice(7) : model
}

// Default model configuration
export const DEFAULT_MODEL = 'gpt-4o-mini'

/**
 * Get the configured AI model instance
 * Supports GUARD_AI_MODEL env var for model selection
 *
 * @param modelOverride - Optional model name override (e.g., 'gpt-4o', 'gpt-4o-mini')
 */
export function getModel(modelOverride?: string) {
  const modelName = modelOverride
    ? normalizeModelName(modelOverride)
    : normalizeModelName(process.env.GUARD_AI_MODEL || DEFAULT_MODEL)

  return openai(modelName)
}

/**
 * Get a specific model by name
 * Handles 'openai/model-name' format for backwards compatibility
 */
export function getModelByName(name: string) {
  return openai(normalizeModelName(name))
}

/**
 * Get the current model name string (for logging/database storage)
 */
export function getModelName(modelOverride?: string): string {
  return modelOverride
    ? normalizeModelName(modelOverride)
    : normalizeModelName(process.env.GUARD_AI_MODEL || DEFAULT_MODEL)
}
