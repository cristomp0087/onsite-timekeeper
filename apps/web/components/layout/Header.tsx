'use client'

import { useEffect, useState } from 'react'
import { Bell, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export function Header() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const supabase = createClient()

  useEffect(() => {
    // Get user
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      
      // Get profile
      if (user) {
        supabase
          .from('profiles')
          .select('first_name, last_name, avatar_url, blades_balance')
          .eq('id', user.id)
          .single()
          .then(({ data }) => setProfile(data))
      }
    })
  }, [])

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Left side - could add breadcrumbs here */}
        <div className="flex-1">
          {/* Breadcrumbs ou Search podem ir aqui */}
        </div>

        {/* Right side - user info */}
        <div className="flex items-center gap-4">
          {/* Blades Balance */}
          {profile?.blades_balance !== undefined && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-yellow-50 border border-yellow-200">
              <span className="text-lg">🔪</span>
              <span className="text-sm font-semibold text-yellow-900">
                {profile.blades_balance} Blades
              </span>
            </div>
          )}

          {/* Notifications */}
          <button className="p-2 rounded-lg hover:bg-gray-100 transition-colors relative">
            <Bell className="w-5 h-5 text-gray-600" />
            {/* Notification badge */}
            {/* <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" /> */}
          </button>

          {/* User Menu */}
          <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium text-gray-900">
                {profile?.first_name} {profile?.last_name}
              </p>
              <p className="text-xs text-gray-500">{user?.email}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt="Avatar"
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <User className="w-5 h-5 text-blue-600" />
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
