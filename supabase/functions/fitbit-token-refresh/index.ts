import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

interface RefreshRequest {
  refresh_token: string
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
    const { refresh_token } = await req.json() as RefreshRequest

    const response = await fetch(FITBIT_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)}`
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token
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
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
