import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Olá, {profile?.first_name || 'Usuário'}! 👋
        </h1>
        <p className="text-gray-600 mt-1">
          Bem-vindo ao OnSite Club
        </p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold mb-4">Dashboard em construção</h2>
        <p className="text-gray-600">
          Esta página mostrará suas estatísticas e métricas de trabalho.
        </p>
      </div>
    </div>
  )
}