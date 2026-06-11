'use client'

import * as Sentry from "@sentry/nextjs";
import React from 'react';

// myUndefinedFunction is intentionally not defined to test Sentry error tracking
// This will throw a ReferenceError when called

export const SentryTest: React.FC = () => {
  const handleTestError = () => {
    try {
      // This will throw an error that should be captured by Sentry
                 // @ts-expect-error - Intentionally calling undefined function for testing
      myUndefinedFunction();
    } catch (error) {
      // Capture the exception in Sentry
      Sentry.captureException(error);
      console.error('Error captured by Sentry:', error);
    }
  };

  const handleTestSpan = () => {
    // Create a span to measure performance
    Sentry.startSpan(
      {
        op: "ui.click",
        name: "Test Button Click",
      },
      (span) => {
        const value = "test config";
        const metric = "test metric";

        // Metrics can be added to the span
        span.setAttribute("config", value);
        span.setAttribute("metric", metric);

        // Simulate some work
        setTimeout(() => {
          console.log("Span work completed");
        }, 100);
      },
    );
  };

  const handleTestLog = () => {
    const { logger } = Sentry;
    
    logger.info("Test log message", {
      component: "SentryTest",
      action: "test_log",
      timestamp: new Date().toISOString(),
    });
  };

  const handleTestAPI = async () => {
    try {
      const response = await fetch('/api/sentry-test', {
        method: 'POST',
      });
      const data = await response.json();
      console.log('API test response:', data);
    } catch (error) {
      console.error('API test error:', error);
    }
  };

  return (
    <div className="p-6 border rounded-lg bg-gray-50">
      <h2 className="text-xl font-bold mb-4">Sentry Test Component</h2>
      <div className="space-y-4">
        <button
          onClick={handleTestError}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          Test Error (myUndefinedFunction)
        </button>
        
        <button
          onClick={handleTestSpan}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Test Span
        </button>
        
        <button
          onClick={handleTestLog}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
        >
          Test Log
        </button>
        
        <button
          onClick={handleTestAPI}
          className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
        >
          Test API Error
        </button>
      </div>
      
      <div className="mt-4 text-sm text-gray-600">
        <p>Click the buttons above to test different Sentry features:</p>
        <ul className="list-disc list-inside mt-2">
          <li><strong>Test Error:</strong> Calls myUndefinedFunction() which will throw an error</li>
          <li><strong>Test Span:</strong> Creates a performance span for monitoring</li>
          <li><strong>Test Log:</strong> Sends a structured log message to Sentry</li>
          <li><strong>Test API Error:</strong> Calls server-side API that throws an error</li>
        </ul>
      </div>
    </div>
  );
}; 