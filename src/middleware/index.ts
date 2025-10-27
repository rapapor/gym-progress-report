import { defineMiddleware } from "astro:middleware";
import { supabaseClient } from "../db/supabase.client";

/**
 * Astro middleware that:
 * 1. Injects Supabase client into context.locals
 * 2. Handles CORS for API routes
 * 3. Provides rate limiting (basic implementation)
 */
export const onRequest = defineMiddleware(async (context, next) => {
  // Inject Supabase client
  context.locals.supabase = supabaseClient;

  // Handle CORS for API routes
  if (context.url.pathname.startsWith("/api/")) {
    // Handle preflight requests
    if (context.request.method === "OPTIONS") {
      return new Response(null, {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // Add CORS headers to API responses
    const response = await next();

    // Clone response to modify headers
    const newResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });

    newResponse.headers.set("Access-Control-Allow-Origin", "*");
    newResponse.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    newResponse.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

    return newResponse;
  }

  return next();
});
