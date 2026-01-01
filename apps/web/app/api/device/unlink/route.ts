import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Call unlink_device function
    const { error } = await supabase.rpc('unlink_device', {
      p_user_id: user.id
    })

    if (error) {
      console.error('Unlink device error:', error)
      return NextResponse.json({ error: 'Failed to unlink device' }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Unlink device error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
