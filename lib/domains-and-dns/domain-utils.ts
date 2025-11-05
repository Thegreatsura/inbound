/**
 * Domain parsing and utility functions
 * Handles root domain extraction and subdomain detection
 */

// @ts-expect-error - psl package has type definitions but they're not properly exported in package.json
import { parse, type ParsedDomain, type ErrorResult } from 'psl'

/**
 * Get the root domain from a domain string using the Public Suffix List
 * Correctly handles multi-level TLDs (e.g., example.co.uk)
 * 
 * @example
 * getRootDomain('mail.example.com') // 'example.com'
 * getRootDomain('docs.app.example.com') // 'example.com'
 * getRootDomain('app.example.com') // 'example.com'
 * getRootDomain('example.com') // 'example.com'
 * getRootDomain('mail.example.co.uk') // 'example.co.uk'
 */
export function getRootDomain(domain: string): string | null {
  try {
    const parsed = parse(domain)
    // Check if it's an error result (has 'error' property)
    if ('error' in parsed) {
      return null
    }
    // Check if domain is null or empty
    if (!parsed.domain) {
      return null
    }
    return parsed.domain
  } catch (error) {
    // If psl.parse throws an error or returns invalid result, return null
    return null
  }
}

/**
 * Check if a domain is a root domain (no subdomain prefix)
 * Correctly handles multi-level TLDs using the Public Suffix List
 * 
 * @example
 * isRootDomain('example.com') // true
 * isRootDomain('example.co.uk') // true
 * isRootDomain('mail.example.com') // false
 * isRootDomain('mail.example.co.uk') // false
 */
export function isRootDomain(domain: string): boolean {
  const rootDomain = getRootDomain(domain)
  return rootDomain === domain
}

/**
 * Check if a domain is a subdomain (has a prefix before the root domain)
 * Correctly handles multi-level TLDs using the Public Suffix List
 * 
 * @example
 * isSubdomain('mail.example.com') // true
 * isSubdomain('docs.app.example.com') // true
 * isSubdomain('mail.example.co.uk') // true
 * isSubdomain('example.com') // false
 * isSubdomain('example.co.uk') // false
 */
export function isSubdomain(domain: string): boolean {
  const rootDomain = getRootDomain(domain)
  if (!rootDomain) return false
  return domain !== rootDomain && domain.endsWith('.' + rootDomain)
}

