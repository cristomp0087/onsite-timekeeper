import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's subscription info
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_subscription_id, subscription_status')
      .eq('id', user.id)
      .single()

    if (!profile?.stripe_subscription_id) {
      return NextResponse.json({ error: 'No active subscription' }, { status: 400 })
    }

    // TODO: Cancel in Stripe
    // const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
    // await stripe.subscriptions.cancel(profile.stripe_subscription_id)

    // For now, just update in database
    const { error } = await supabase.rpc('cancel_subscription', {
      p_user_id: user.id
    })

    if (error) {
      console.error('Cancel subscription error:', error)
      return NextResponse.json({ error: 'Failed to cancel subscription' }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Cancel subscription error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
