/**
 * RFC-compliant domain validation using the Public Suffix List
 * Properly handles multi-level TLDs (e.g., .co.uk, .com.au)
 * Works on both client and server side
 */

// @ts-expect-error - psl package has type definitions but they're not properly exported in package.json
import { parse } from 'psl'

export interface DomainValidationResult {
  isValid: boolean
  domain: string
  normalizedDomain: string | null
  error: string | null
  rootDomain: string | null
  isSubdomain: boolean
}

/**
 * Validates a domain according to RFC 1035 and RFC 5321 specifications
 * Uses the Public Suffix List for proper TLD handling
 * 
 * @param domain - The domain string to validate
 * @returns DomainValidationResult with validation details
 * 
 * @example
 * validateDomain('example.com') // { isValid: true, ... }
 * validateDomain('mail.example.co.uk') // { isValid: true, isSubdomain: true, ... }
 * validateDomain('invalid') // { isValid: false, error: 'Invalid domain format' }
 */
export function validateDomain(domain: string): DomainValidationResult {
  // Normalize: lowercase and trim
  const normalizedDomain = domain?.toLowerCase().trim() || ''

  // Empty check
  if (!normalizedDomain) {
    return {
      isValid: false,
      domain,
      normalizedDomain: null,
      error: 'Domain is required',
      rootDomain: null,
      isSubdomain: false,
    }
  }

  // RFC 1035: Maximum domain length is 253 characters
  if (normalizedDomain.length > 253) {
    return {
      isValid: false,
      domain,
      normalizedDomain,
      error: 'Domain exceeds maximum length of 253 characters',
      rootDomain: null,
      isSubdomain: false,
    }
  }

  // RFC 1035: Each label must be 1-63 characters
  const labels = normalizedDomain.split('.')
  for (const label of labels) {
    if (label.length === 0) {
      return {
        isValid: false,
        domain,
        normalizedDomain,
        error: 'Domain contains empty label',
        rootDomain: null,
        isSubdomain: false,
      }
    }
    if (label.length > 63) {
      return {
        isValid: false,
        domain,
        normalizedDomain,
        error: 'Domain label exceeds maximum length of 63 characters',
        rootDomain: null,
        isSubdomain: false,
      }
    }
  }

  // RFC 1035: Labels must start with alphanumeric, can contain hyphens, must end with alphanumeric
  // Exception: numeric-only labels are allowed (for reverse DNS)
  const labelRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/
  for (const label of labels) {
    if (!labelRegex.test(label)) {
      // Check if it's a single character (valid)
      if (label.length === 1 && /^[a-z0-9]$/.test(label)) {
        continue
      }
      return {
        isValid: false,
        domain,
        normalizedDomain,
        error: 'Domain contains invalid characters. Use only letters, numbers, and hyphens.',
        rootDomain: null,
        isSubdomain: false,
      }
    }
    // RFC 1035: Labels cannot start or end with hyphen
    if (label.startsWith('-') || label.endsWith('-')) {
      return {
        isValid: false,
        domain,
        normalizedDomain,
        error: 'Domain labels cannot start or end with a hyphen',
        rootDomain: null,
        isSubdomain: false,
      }
    }
  }

  // Use Public Suffix List to validate TLD and extract root domain
  try {
    const parsed = parse(normalizedDomain)
    
    // Check for PSL errors
    if ('error' in parsed) {
      return {
        isValid: false,
        domain,
        normalizedDomain,
        error: getReadableError(parsed.error),
        rootDomain: null,
        isSubdomain: false,
      }
    }

    // Check if TLD is recognized AND listed in the Public Suffix List
    // The `listed` property indicates if the TLD is actually in the PSL
    if (!parsed.tld || parsed.listed === false) {
      return {
        isValid: false,
        domain,
        normalizedDomain,
        error: 'Invalid or unrecognized top-level domain (TLD)',
        rootDomain: null,
        isSubdomain: false,
      }
    }

    // Check if domain is valid (has SLD)
    if (!parsed.domain) {
      return {
        isValid: false,
        domain,
        normalizedDomain,
        error: 'Domain must have a valid second-level domain',
        rootDomain: null,
        isSubdomain: false,
      }
    }

    // Success - domain is valid
    const isSubdomain = parsed.subdomain !== null && parsed.subdomain.length > 0

    return {
      isValid: true,
      domain,
      normalizedDomain,
      error: null,
      rootDomain: parsed.domain,
      isSubdomain,
    }
  } catch (error) {
    return {
      isValid: false,
      domain,
      normalizedDomain,
      error: 'Unable to validate domain format',
      rootDomain: null,
      isSubdomain: false,
    }
  }
}

/**
 * Convert PSL error codes to readable messages
 */
function getReadableError(errorCode: string): string {
  const errorMap: Record<string, string> = {
    'DOMAIN_TOO_SHORT': 'Domain name is too short',
    'DOMAIN_TOO_LONG': 'Domain name is too long',
    'LABEL_STARTS_WITH_DASH': 'Domain labels cannot start with a hyphen',
    'LABEL_ENDS_WITH_DASH': 'Domain labels cannot end with a hyphen',
    'LABEL_TOO_LONG': 'Domain label is too long (max 63 characters)',
    'LABEL_TOO_SHORT': 'Domain label is too short',
    'LABEL_INVALID_CHARS': 'Domain contains invalid characters',
  }
  return errorMap[errorCode] || 'Invalid domain format'
}

/**
 * Quick check if a domain is valid (boolean only)
 * Useful for simple validation without detailed error info
 */
export function isValidDomain(domain: string): boolean {
  return validateDomain(domain).isValid
}
