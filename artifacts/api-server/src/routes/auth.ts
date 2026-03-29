import { Router } from "express";

const router = Router();

const SCOPES = "https://www.googleapis.com/auth/business.manage";

function getRedirectUri(): string {
  const domain = process.env.REPLIT_DOMAINS?.split(",")[0];
  return `https://${domain}/api/auth/gbp/callback`;
}

router.get("/auth/gbp", (req, res) => {
  const clientId = process.env.GBP_CLIENT_ID;
  if (!clientId) {
    return res.status(500).send("GBP_CLIENT_ID is not set");
  }

  const redirectUri = getRedirectUri();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

router.get("/auth/gbp/callback", async (req, res) => {
  const { code, error } = req.query as Record<string, string>;

  if (error) {
    return res.status(400).send(`
      <html><body style="font-family:monospace;background:#0a0a0a;color:#ff4d4d;padding:40px;">
        <h2>OAuth Error</h2>
        <pre>${error}</pre>
      </body></html>
    `);
  }

  if (!code) {
    return res.status(400).send("No authorization code received");
  }

  const clientId = process.env.GBP_CLIENT_ID;
  const clientSecret = process.env.GBP_CLIENT_SECRET;
  const redirectUri = getRedirectUri();

  if (!clientId || !clientSecret) {
    return res.status(500).send("GBP_CLIENT_ID or GBP_CLIENT_SECRET is not set");
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const data = await tokenRes.json() as any;

    if (!tokenRes.ok || data.error) {
      req.log.error({ data }, "GBP token exchange failed");
      return res.status(500).send(`Token exchange failed: ${JSON.stringify(data)}`);
    }

    const refreshToken = data.refresh_token;
    const accessToken = data.access_token;

    console.log("\n========================================");
    console.log("GBP REFRESH TOKEN:");
    console.log(refreshToken);
    console.log("========================================\n");

    req.log.info({ refreshToken }, "GBP OAuth: refresh token received");

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>GBP Refresh Token</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: 'JetBrains Mono', 'Courier New', monospace;
            background: #0a0a0a;
            color: #ffffff;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
          }
          .card {
            background: #1a1a1a;
            border: 1px solid #222;
            border-radius: 16px;
            padding: 40px;
            max-width: 700px;
            width: 100%;
          }
          .label {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            color: #888;
            margin-bottom: 8px;
          }
          .token-box {
            background: #0a0a0a;
            border: 1px solid #333;
            border-radius: 10px;
            padding: 16px;
            font-size: 13px;
            color: #00c2ff;
            word-break: break-all;
            margin-bottom: 24px;
            position: relative;
          }
          .copy-btn {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: #00c2ff;
            color: #000;
            border: none;
            border-radius: 100px;
            padding: 10px 20px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            margin-bottom: 16px;
            transition: opacity 0.15s;
          }
          .copy-btn:hover { opacity: 0.85; }
          .note {
            font-size: 12px;
            color: #888;
            line-height: 1.6;
            border-top: 1px solid #222;
            padding-top: 20px;
            margin-top: 8px;
          }
          .success { color: #00e5a0; font-size: 14px; margin-bottom: 24px; }
          h2 { font-size: 20px; margin-bottom: 8px; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>✅ Google Business Profile</h2>
          <p class="success">Authorization successful — refresh token captured.</p>

          <div class="label">Refresh Token (save this as GBP_REFRESH_TOKEN)</div>
          <div class="token-box" id="token">${refreshToken ?? "No refresh token returned — you may need to revoke access and try again."}</div>

          <button class="copy-btn" onclick="copyToken()">📋 Copy Refresh Token</button>

          ${accessToken ? `
          <div class="label" style="margin-top:8px;">Access Token (temporary)</div>
          <div class="token-box" style="color:#888;font-size:11px;">${accessToken}</div>
          ` : ""}

          <div class="note">
            <strong>Next step:</strong> Copy the refresh token above and save it as the
            <code>GBP_REFRESH_TOKEN</code> secret in your Replit Secrets tab.
            The token has also been printed to the API server console logs.
            <br/><br/>
            <strong>Note:</strong> If no refresh token appeared, revoke access at
            <a href="https://myaccount.google.com/permissions" style="color:#00c2ff;">myaccount.google.com/permissions</a>
            and run the OAuth flow again.
          </div>
        </div>
        <script>
          function copyToken() {
            const text = document.getElementById('token').innerText;
            navigator.clipboard.writeText(text).then(() => {
              const btn = document.querySelector('.copy-btn');
              btn.textContent = '✓ Copied!';
              setTimeout(() => btn.innerHTML = '📋 Copy Refresh Token', 2000);
            });
          }
        </script>
      </body>
      </html>
    `);
  } catch (err: any) {
    req.log.error({ err }, "GBP OAuth callback error");
    res.status(500).send(`Error: ${err.message}`);
  }
});

export default router;
