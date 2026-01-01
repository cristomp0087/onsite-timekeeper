import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { User, Mail, Phone, Building, Briefcase } from 'lucide-react'

export default async function ProfilePage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Meu Perfil</h1>
        <p className="text-gray-600 mt-1">
          Gerencie suas informações pessoais
        </p>
      </div>

      {/* Profile Card */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div className="flex items-start gap-6">
          {/* Avatar */}
          <div className="flex-shrink-0">
            <div className="w-24 h-24 rounded-full bg-blue-100 flex items-center justify-center">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt="Avatar"
                  className="w-24 h-24 rounded-full object-cover"
                />
              ) : (
                <User className="w-12 h-12 text-blue-600" />
              )}
            </div>
            <button className="mt-3 text-sm text-blue-600 hover:text-blue-500 font-medium">
              Alterar foto
            </button>
          </div>

          {/* Info */}
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900">
              {profile?.first_name} {profile?.last_name}
            </h2>
            <p className="text-gray-600">{user.email}</p>
            <div className="mt-4 flex items-center gap-4">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                Nível: {profile?.level || 'Rookie'}
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                {profile?.subscription_status === 'trialing' && '🎉 Trial Ativo'}
                {profile?.subscription_status === 'active' && '✅ Ativo'}
                {profile?.subscription_status === 'none' && '⏸️ Sem Plano'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Personal Information */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">
            Informações Pessoais
          </h3>
          <button className="text-sm text-blue-600 hover:text-blue-500 font-medium">
            Editar
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3 py-3 border-b border-gray-100">
            <User className="w-5 h-5 text-gray-400" />
            <div className="flex-1">
              <p className="text-sm text-gray-500">Nome Completo</p>
              <p className="font-medium text-gray-900">
                {profile?.first_name} {profile?.last_name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 py-3 border-b border-gray-100">
            <Mail className="w-5 h-5 text-gray-400" />
            <div className="flex-1">
              <p className="text-sm text-gray-500">Email</p>
              <p className="font-medium text-gray-900">{user.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 py-3 border-b border-gray-100">
            <Phone className="w-5 h-5 text-gray-400" />
            <div className="flex-1">
              <p className="text-sm text-gray-500">Telefone</p>
              <p className="font-medium text-gray-900">
                {profile?.phone || 'Não informado'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 py-3 border-b border-gray-100">
            <Building className="w-5 h-5 text-gray-400" />
            <div className="flex-1">
              <p className="text-sm text-gray-500">Empresa</p>
              <p className="font-medium text-gray-900">
                {profile?.company || 'Não informado'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 py-3">
            <Briefcase className="w-5 h-5 text-gray-400" />
            <div className="flex-1">
              <p className="text-sm text-gray-500">Função</p>
              <p className="font-medium text-gray-900">
                {profile?.role || 'Não informado'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bio */}
      {profile?.bio && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Sobre
          </h3>
          <p className="text-gray-700 whitespace-pre-wrap">{profile.bio}</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm text-gray-500 mb-1">Membro desde</p>
          <p className="text-xl font-bold text-gray-900">
            {new Date(profile?.created_at).toLocaleDateString('pt-BR', {
              month: 'long',
              year: 'numeric'
            })}
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm text-gray-500 mb-1">Blades Total</p>
          <p className="text-xl font-bold text-gray-900">
            {profile?.blades_lifetime_earned || 0}
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm text-gray-500 mb-1">Última Atividade</p>
          <p className="text-xl font-bold text-gray-900">
            {profile?.last_seen_at
              ? new Date(profile.last_seen_at).toLocaleDateString('pt-BR')
              : 'Hoje'}
          </p>
        </div>
      </div>
    </div>
  )
}
