import * as Sentry from "@sentry/nextjs";
import { NextRequest, NextResponse } from "next/server";

export async function GET(_request: NextRequest) {
  // Only allow access in development and preview environments
  if (process.env.NODE_ENV === 'production' && process.env.VERCEL_ENV === 'production') {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  try {
    // Test Sentry logging
    const { logger } = Sentry;
    logger.info("API route accessed", {
      route: "/api/sentry-test",
      method: "GET",
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({ 
      message: "Sentry test API route working",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    Sentry.captureException(error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(_request: NextRequest) {
  // Only allow access in development and preview environments
  if (process.env.NODE_ENV === 'production' && process.env.VERCEL_ENV === 'production') {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    // Intentionally throw an error to test Sentry
    // myUndefinedFunction is intentionally not defined to test Sentry error tracking
               // @ts-expect-error - Intentionally calling undefined function for testing
    myUndefinedFunction();

    return NextResponse.json({ message: "This should not be reached" });
  } catch (error) {
    // Capture the exception in Sentry
    Sentry.captureException(error);
    
    return NextResponse.json({ 
      error: "Error captured by Sentry",
      message: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
} 