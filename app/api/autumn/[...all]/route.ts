// app/api/autumn/[...all]/route.ts

import { autumnHandler } from "autumn-js/next";
import { auth } from "@/lib/auth/auth";

export const { GET, POST } = autumnHandler({
  identify: async (request) => {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    // Only include customerId if user is authenticated to prevent 500 errors
    // When customerId is omitted, Autumn treats the request as unauthenticated
    if (!session?.user?.id) {
      return {};
    }

    return {
      customerId: session.user.id,
      customerData: {
        name: session.user.name,
        email: session.user.email,
      },
    };
  },
});