import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

/**
 * GET /api/avatar
 * 
 * Fetches user avatar from Gravatar first, falls back to useravatar.vercel.app
 * 
 * Query params:
 * - email: User's email address (for Gravatar lookup)
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

    // Try Gravatar first if email is provided
    if (email) {
      const gravatarUrl = await getGravatarUrl(email);
      
      try {
        const gravatarResponse = await fetch(gravatarUrl, {
          method: "HEAD",
          signal: AbortSignal.timeout(3000), // 3 second timeout
        });

        if (gravatarResponse.ok) {
          // Redirect to Gravatar image with caching
          return NextResponse.redirect(gravatarUrl, {
            status: 302,
            headers: {
              "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
            },
          });
        }
      } catch (error) {
        console.warn("Gravatar fetch failed:", error);
        // Continue to fallback
      }
    }

    // Fallback to useravatar.vercel.app
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
 * Generates Gravatar URL for given email
 * Uses SHA-256 hash of email address (via Web Crypto API for edge runtime)
 * Note: Gravatar supports both MD5 and SHA-256 hashes
 */
async function getGravatarUrl(email: string): Promise<string> {
  const normalizedEmail = email.trim().toLowerCase();
  
  // Use Web Crypto API with SHA-256 (edge runtime compatible)
  const encoder = new TextEncoder();
  const data = encoder.encode(normalizedEmail);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  
  // Convert buffer to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  
  // d=404 returns 404 if no gravatar exists (allows us to detect and fallback)
  // s=500 sets size to 500px
  return `https://www.gravatar.com/avatar/${hash}?s=500&d=404`;
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

