'use client';

import { useEffect } from 'react';

/**
 * Global error handler to prevent page reloads on unhandled errors
 */
export function ErrorHandler() {
  useEffect(() => {
    // Prevent unhandled promise rejections from causing page reloads
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason);
      event.preventDefault(); // Prevent default browser behavior (page reload)
      event.stopPropagation(); // Stop the event from propagating
      return false; // Return false to prevent default
    };
    
    const handleError = (event: ErrorEvent) => {
      console.error('Global error:', event.error);
      // Prevent the error from causing a page reload
      event.preventDefault();
      event.stopPropagation();
      return false; // Return false to prevent default
    };
    
    // Also catch errors at the window level
    const originalError = window.onerror;
    window.onerror = (message, source, lineno, colno, error) => {
      console.error('Window error:', { message, source, lineno, colno, error });
      // Don't let the error propagate
      return true; // Return true to indicate we handled it
    };
    
    window.addEventListener('unhandledrejection', handleUnhandledRejection, true);
    window.addEventListener('error', handleError, true);
    
    // Prevent Next.js Fast Refresh from reloading on errors
    if (typeof window !== 'undefined') {
      // Disable Next.js error overlay that causes reloads
      if ((window as any).__NEXT_DATA__) {
        // Override any Next.js error handling that might cause reloads
        const originalConsoleError = console.error;
        console.error = (...args) => {
          originalConsoleError.apply(console, args);
          // Don't let console errors trigger reloads
        };
      }
      
      // Prevent any navigation/reload attempts
      const preventReload = (e: BeforeUnloadEvent) => {
        // Only prevent if we're in an error state
        // For now, we'll let normal navigation work
      };
      
      // Prevent Next.js Fast Refresh from detecting errors and reloading
      // We'll intercept errors before they reach Next.js's error handling
      
      // Store a flag to prevent multiple error handlers
      let errorHandled = false;
      
      // Enhanced error handlers that prevent propagation
      const enhancedHandleError = (event: ErrorEvent) => {
        if (!errorHandled) {
          errorHandled = true;
          handleError(event);
          // Reset flag after a short delay
          setTimeout(() => {
            errorHandled = false;
          }, 100);
        }
      };
      
      const enhancedHandleRejection = (event: PromiseRejectionEvent) => {
        if (!errorHandled) {
          errorHandled = true;
          handleUnhandledRejection(event);
          // Reset flag after a short delay
          setTimeout(() => {
            errorHandled = false;
          }, 100);
        }
      };
      
      // Replace the original handlers with enhanced ones
      window.removeEventListener('unhandledrejection', handleUnhandledRejection, true);
      window.removeEventListener('error', handleError, true);
      window.addEventListener('unhandledrejection', enhancedHandleRejection, true);
      window.addEventListener('error', enhancedHandleError, true);
      
      // Cleanup function
      const cleanup = () => {
        window.removeEventListener('unhandledrejection', enhancedHandleRejection, true);
        window.removeEventListener('error', enhancedHandleError, true);
        window.removeEventListener('unhandledrejection', handleUnhandledRejection, true);
        window.removeEventListener('error', handleError, true);
        if (originalError) {
          window.onerror = originalError;
        }
      };
      
      return cleanup;
    }
    
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection, true);
      window.removeEventListener('error', handleError, true);
      if (originalError) {
        window.onerror = originalError;
      }
    };
  }, []);
  
  return null;
}

