import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

interface TokenRequest {
  code: string
  redirectUri: string
  codeVerifier: string
}

interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
}

const FITBIT_TOKEN_URL = 'https://api.fitbit.com/oauth2/token'
const CLIENT_ID = Deno.env.get('FITBIT_CLIENT_ID')
const CLIENT_SECRET = Deno.env.get('FITBIT_CLIENT_SECRET')

serve(async (req: Request) => {
  try {
    const { code, redirectUri, codeVerifier } = await req.json() as TokenRequest

    const response = await fetch(FITBIT_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)}`
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier
      }).toString()
    })

    if (!response.ok) {
      throw new Error(`Fitbit API error: ${response.status}`)
    }

    const data = await response.json() as TokenResponse
    
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error: unknown) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
