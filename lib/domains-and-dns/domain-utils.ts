/**
 * Domain parsing and utility functions
 * Handles root domain extraction and subdomain detection
 */

import psl from 'psl'

/**
 * Get the root domain from a domain string using the Public Suffix List
 * Handles multi-level TLDs correctly (e.g., example.co.uk)
 * 
 * @example
 * getRootDomain('mail.example.com') // 'example.com'
 * getRootDomain('docs.app.example.com') // 'example.com'
 * getRootDomain('app.example.com') // 'example.com'
 * getRootDomain('example.com') // 'example.com'
 * getRootDomain('mail.example.co.uk') // 'example.co.uk' (correctly handles multi-level TLD)
 */
export function getRootDomain(domain: string): string | null {
  try {
    const parsed = psl.parse(domain)
    if (parsed.domain) {
      return parsed.domain
    }
    return null
  } catch (error) {
    console.error(`Error parsing domain ${domain} with PSL:`, error)
    return null
  }
}

/**
 * Check if a domain is a root domain (exactly 2 parts)
 * 
 * @example
 * isRootDomain('example.com') // true
 * isRootDomain('mail.example.com') // false
 */
export function isRootDomain(domain: string): boolean {
  const parts = domain.split('.')
  return parts.length === 2 // example.com = true, mail.example.com = false
}

/**
 * Check if a domain is a subdomain (more than 2 parts)
 * 
 * @example
 * isSubdomain('mail.example.com') // true
 * isSubdomain('docs.app.example.com') // true
 * isSubdomain('example.com') // false
 */
export function isSubdomain(domain: string): boolean {
  const parts = domain.split('.')
  return parts.length > 2
}

