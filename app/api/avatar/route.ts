import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

/**
 * GET /api/avatar
 * 
 * Smart avatar fetching with multiple fallbacks:
 * 1. BIMI (company logos from email domain)
 * 2. Gravatar (personal avatars)
 * 3. unavatar.io (aggregated sources)
 * 4. useravatar.vercel.app (generated initials)
 * 
 * Query params:
 * - email: User's email address (for all lookups)
 * - name: User's name (for initials fallback)
 * 
 * @example
 * /api/avatar?email=user@example.com&name=John Doe
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get("email");
    const name = searchParams.get("name");

    if (!email && !name) {
      return NextResponse.json(
        { error: "Either email or name parameter is required" },
        { status: 400 }
      );
    }

    // Try each service in order if email is provided
    if (email) {
      // 1. Try BIMI (company logos)
      const bimiUrl = await tryBimi(email);
      if (bimiUrl) {
        return NextResponse.redirect(bimiUrl, {
          status: 302,
          headers: {
            "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
          },
        });
      }

      // 2. Try Gravatar
      const gravatarUrl = await tryGravatar(email);
      if (gravatarUrl) {
        return NextResponse.redirect(gravatarUrl, {
          status: 302,
          headers: {
            "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
          },
        });
      }

      // 3. Try unavatar (aggregates multiple sources)
      const unavatarUrl = await tryUnavatar(email);
      if (unavatarUrl) {
        return NextResponse.redirect(unavatarUrl, {
          status: 302,
          headers: {
            "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
          },
        });
      }
    }

    // 4. Final fallback to useravatar.vercel.app (generated initials)
    const initials = getInitials(name || email || "?");
    const avatarUrl = `https://useravatar.vercel.app/api/logo?text=${encodeURIComponent(
      initials
    )}&width=500&height=500&fontSize=200&font=Inter`;

    return NextResponse.redirect(avatarUrl, {
      status: 302,
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  } catch (error) {
    console.error("Avatar API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch avatar" },
      { status: 500 }
    );
  }
}

/**
 * Try to fetch BIMI logo from email domain
 * BIMI (Brand Indicators for Message Identification) provides company logos
 */
async function tryBimi(email: string): Promise<string | null> {
  try {
    const domain = email.split("@")[1];
    if (!domain) return null;

    // BIMI logos are typically accessed via a well-known URL pattern
    // Try common BIMI logo locations
    const bimiUrls = [
      `https://${domain}/.well-known/bimi/logo.svg`,
      `https://bimi.${domain}/logo.svg`,
    ];

    for (const url of bimiUrls) {
      try {
        const response = await fetch(url, {
          method: "HEAD",
          signal: AbortSignal.timeout(2000),
        });

        if (response.ok) {
          return url;
        }
      } catch {
        continue;
      }
    }

    return null;
  } catch (error) {
    console.warn("BIMI fetch failed:", error);
    return null;
  }
}

/**
 * Try to fetch Gravatar
 * Uses SHA-256 hash of email address (Web Crypto API for edge runtime)
 */
async function tryGravatar(email: string): Promise<string | null> {
  try {
    const normalizedEmail = email.trim().toLowerCase();
    
    // Use Web Crypto API with SHA-256 (edge runtime compatible)
    const encoder = new TextEncoder();
    const data = encoder.encode(normalizedEmail);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    
    // Convert buffer to hex string
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
    
    // d=404 returns 404 if no gravatar exists
    const gravatarUrl = `https://www.gravatar.com/avatar/${hash}?s=500&d=404`;
    
    const response = await fetch(gravatarUrl, {
      method: "HEAD",
      signal: AbortSignal.timeout(3000),
    });

    if (response.ok) {
      return gravatarUrl;
    }

    return null;
  } catch (error) {
    console.warn("Gravatar fetch failed:", error);
    return null;
  }
}

/**
 * Try unavatar.io (aggregates multiple avatar sources)
 * unavatar checks GitHub, Twitter, Google, and more
 */
async function tryUnavatar(email: string): Promise<string | null> {
  try {
    // unavatar.io can use email or domain
    const unavatarUrl = `https://unavatar.io/${encodeURIComponent(email)}`;
    
    const response = await fetch(unavatarUrl, {
      method: "HEAD",
      signal: AbortSignal.timeout(3000),
    });

    // unavatar returns 200 even for fallbacks, so check content-type
    const contentType = response.headers.get("content-type");
    
    if (response.ok && contentType?.startsWith("image/")) {
      return unavatarUrl;
    }

    return null;
  } catch (error) {
    console.warn("unavatar fetch failed:", error);
    return null;
  }
}

/**
 * Extracts initials from a name
 * Takes first letter of first word and first letter of last word
 * Maximum 2 characters
 */
function getInitials(text: string): string {
  const cleaned = text.trim();
  
  // Remove email domain if present
  const nameOnly = cleaned.includes("@") 
    ? cleaned.split("@")[0] 
    : cleaned;
  
  const words = nameOnly
    .split(/[\s._-]+/)
    .filter(word => word.length > 0);

  if (words.length === 0) {
    return "?";
  }

  if (words.length === 1) {
    // Single word: take first 2 characters
    return words[0].substring(0, 2).toUpperCase();
  }

  // Multiple words: first letter of first word + first letter of last word
  const firstInitial = words[0][0];
  const lastInitial = words[words.length - 1][0];
  return (firstInitial + lastInitial).toUpperCase();
}

