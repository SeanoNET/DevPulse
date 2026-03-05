import { createServer, type Server } from 'http'

interface OAuthCallbackResult {
  code: string
  state: string
}

export async function createOAuthCallbackServer(): Promise<{
  port: number
  waitForCallback: () => Promise<OAuthCallbackResult>
}> {
  return new Promise((resolveSetup) => {
    let resolveCallback: (result: OAuthCallbackResult) => void
    let server: Server

    const callbackPromise = new Promise<OAuthCallbackResult>((resolve) => {
      resolveCallback = resolve
    })

    server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', `http://localhost`)
      if (url.pathname !== '/callback') {
        res.writeHead(404)
        res.end()
        return
      }

      const code = url.searchParams.get('code')
      const state = url.searchParams.get('state')

      if (!code || !state) {
        res.writeHead(400)
        res.end('Missing code or state parameter')
        return
      }

      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(`
        <html>
          <body style="font-family: system-ui; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0a0a0a; color: #fafafa;">
            <div style="text-align: center;">
              <h2>Connected to DevPulse</h2>
              <p>You can close this window.</p>
            </div>
          </body>
        </html>
      `)

      resolveCallback({ code, state })

      setTimeout(() => server.close(), 1000)
    })

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      const port = typeof addr === 'object' && addr ? addr.port : 0

      resolveSetup({
        port,
        waitForCallback: () => callbackPromise
      })
    })

    // Auto-close after 5 minutes if no callback received
    setTimeout(() => server.close(), 300_000)
  })
}
