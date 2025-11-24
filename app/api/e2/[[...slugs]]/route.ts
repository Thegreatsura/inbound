import { Elysia } from "elysia"
import { openapi } from "@elysiajs/openapi"
import { listDomains } from "../domains/list"
import { createDomain } from "../domains/create"
import { getDomain } from "../domains/get"
import { updateDomain } from "../domains/update"
import { deleteDomain } from "../domains/delete"
import { AuthError } from "../lib/auth"

const app = new Elysia({ prefix: "/api/e2" })
  .use(
    openapi({
      documentation: {
        info: {
          title: "Inbound E2 API",
          version: "2.0.0",
          description: "Elysia-powered API for Inbound email management",
        },
        tags: [
          {
            name: "Domains",
            description: "Domain management endpoints",
          },
        ],
      },
      path: "/docs", // OpenAPI documentation UI endpoint (becomes /api/e2/docs with prefix)
      specPath: "/openapi.json", // OpenAPI JSON spec endpoint (becomes /api/e2/openapi.json with prefix)
    })
  )
  // Global error handler for RFC-compliant error responses
  .onError(({ code, error, set }) => {
    console.log("🔥 Error handler triggered:", {
      code,
      error: error instanceof Error ? error.message : "Unknown error",
    })

    // Handle AuthError with RFC-compliant formatting
    if (error instanceof AuthError) {
      // Headers are already set by validateAndRateLimit
      return error.response
    }

    // Handle other Elysia errors
    if (code === "VALIDATION") {
      set.status = 400
      return {
        error: "Bad Request",
        message: "Validation failed. Check your request parameters.",
        statusCode: 400,
      }
    }

    if (code === "NOT_FOUND") {
      set.status = 404
      return {
        error: "Not Found",
        message: "The requested resource was not found.",
        statusCode: 404,
      }
    }

    // Generic error handler
    set.status = 500
    return {
      error: "Internal Server Error",
      message: "An unexpected error occurred.",
      statusCode: 500,
    }
  })
  // Domain routes
  .use(listDomains)
  .use(createDomain)
  .use(getDomain)
  .use(updateDomain)
  .use(deleteDomain)

export const GET = app.fetch
export const POST = app.fetch
export const PUT = app.fetch
export const PATCH = app.fetch
export const DELETE = app.fetch

export type App = typeof app
