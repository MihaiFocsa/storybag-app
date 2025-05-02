// Follow this setup guide to integrate the Deno runtime and Supabase functions: https://supabase.com/docs/guides/functions/getting-started
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

/**
 * Creates a redirect HTML page with platform-specific handling for deep links
 * @param redirectUrl The URL to redirect to (typically a deep link)
 * @param sessionId The session ID from Stripe
 * @param message The message to display to the user
 * @param userAgent The user agent string for platform detection
 */
function createRedirectPage(redirectUrl: string, sessionId: string | null, message: string, userAgent: string) {
  // Ensure the session ID is part of the redirect URL
  let finalRedirectUrl = redirectUrl;
  if (sessionId && !redirectUrl.includes('session_id=')) {
    finalRedirectUrl = redirectUrl + (redirectUrl.includes('?') ? '&' : '?') + `session_id=${sessionId}`;
  }

  // Detect platform
  const isAndroid = /android/i.test(userAgent);
  const isIOS = /iphone|ipad|ipod/i.test(userAgent);
  
  // Create platform-specific JavaScript
  let platformSpecificJS = '';
  
  if (isAndroid) {
    platformSpecificJS = `
      // Android-specific deep link handling
      function tryAndroidDeepLink() {
        // First try window.location approach
        window.location.href = "${finalRedirectUrl}";
        
        // Set a timeout to try intent format if the above doesn't work
        setTimeout(function() {
          window.location.href = "intent://${finalRedirectUrl.replace('storybag://', '')}#Intent;scheme=storybag;package=com.storybag.app;end;";
        }, 500);
        
        // Fallback to Play Store after another delay
        setTimeout(function() {
          window.location.href = "https://play.google.com/store/apps/details?id=com.storybag.app";
        }, 2000);
      }
      tryAndroidDeepLink();
    `;
  } else if (isIOS) {
    platformSpecificJS = `
      // iOS-specific deep link handling
      function tryIOSDeepLink() {
        window.location.href = "${finalRedirectUrl}";
        
        // Fallback to App Store after a delay
        setTimeout(function() {
          window.location.href = "https://apps.apple.com/app/storybag/id123456789";
        }, 2000);
      }
      tryIOSDeepLink();
    `;
  } else {
    // Desktop or unknown platform
    platformSpecificJS = `
      // Generic deep link handling - just try the redirect
      window.location.href = "${finalRedirectUrl}";
      
      // Show a message after a delay if the redirect didn't work
      setTimeout(function() {
        document.getElementById('redirect-message').innerHTML += '<br><br>Deep link may not be supported on this device. Please open the StoryBag app manually.';
      }, 2000);
    `;
  }

  // Create the HTML page with both meta refresh and JavaScript redirection
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Redirecting to StoryBag...</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="3; url=${finalRedirectUrl}">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 500px;
      margin: 0 auto;
      padding: 20px;
      text-align: center;
      background-color: #f9f9f9;
    }
    .container {
      margin-top: 50px;
      border: 1px solid #ddd;
      border-radius: 10px;
      padding: 30px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      background-color: white;
    }
    .logo {
      max-width: 150px;
      margin-bottom: 20px;
    }
    h1 {
      font-size: 24px;
      margin: 0 0 20px 0;
      color: #6a3de8;
    }
    p {
      margin: 0 0 20px 0;
    }
    .spinner {
      display: inline-block;
      width: 50px;
      height: 50px;
      border: 3px solid rgba(106, 61, 232, 0.3);
      border-radius: 50%;
      border-top-color: #6a3de8;
      animation: spin 1s ease-in-out infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .session-id {
      margin-top: 20px;
      font-size: 12px;
      color: #999;
    }
    .debug-info {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #eee;
      font-size: 12px;
      color: #999;
      text-align: left;
    }
  </style>
</head>
<body>
  <div class="container">
    <img src="https://storybag.app/logo.png" alt="StoryBag Logo" class="logo" onerror="this.style.display='none'">
    <h1>Redirecting to StoryBag</h1>
    <p id="redirect-message">${message}</p>
    <div class="spinner"></div>
    ${sessionId ? `<div class="session-id">Session ID: ${sessionId}</div>` : ''}
  </div>
  
  <script>
    // Execute platform-specific deep link handling
    document.addEventListener('DOMContentLoaded', function() {
      ${platformSpecificJS}
    });
  </script>
</body>
</html>
  `;
}

serve(async (req) => {
  const url = new URL(req.url);
  const userAgent = req.headers.get('user-agent') || '';
  
  // Extract path segments and query parameters
  const pathSegments = url.pathname.split('/').filter(Boolean);
  const params = url.searchParams;
  
  // Check if we're on a success or cancel path
  const isSuccess = pathSegments.includes('success');
  const isCancel = pathSegments.includes('cancel');
  
  try {
    // Get the redirect URL from query params
    const redirectUrl = params.get('redirect');
    const sessionId = params.get('session_id');

    // Validate redirect URL
    if (!redirectUrl) {
      return new Response(
        createRedirectPage(
          'storybag://',
          sessionId,
          'Error: Missing redirect URL. Redirecting to StoryBag app...',
          userAgent
        ),
        {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
          status: 400,
        }
      );
    }

    // Create appropriate message based on path
    let message = 'Redirecting to StoryBag app...';
    if (isSuccess) {
      message = 'Payment successful! Redirecting to StoryBag app...';
    } else if (isCancel) {
      message = 'Payment cancelled. Redirecting to StoryBag app...';
    }

    // Return the HTML page that will handle the redirection
    return new Response(
      createRedirectPage(redirectUrl, sessionId, message, userAgent),
      {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }
    );
  } catch (error) {
    console.error('Error in payment-redirect function:', error);
    
    // Return a helpful error page
    return new Response(
      createRedirectPage(
        'storybag://',
        null,
        `An error occurred: ${error.message}. Redirecting to StoryBag app...`,
        userAgent
      ),
      {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        status: 500,
      }
    );
  }
})