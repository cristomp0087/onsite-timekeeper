import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CreditCard, Smartphone, Shield, User, AlertCircle } from 'lucide-react'

export default async function SettingsPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Configurações</h1>
        <p className="text-gray-600 mt-1">
          Gerencie sua conta e preferências
        </p>
      </div>

      {/* Subscription Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <CreditCard className="w-5 h-5 text-gray-600" />
          <h2 className="text-xl font-semibold text-gray-900">Assinatura</h2>
        </div>

        <div className="space-y-4">
          {/* Status */}
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <div>
              <p className="font-medium text-gray-900">Status</p>
              <p className="text-sm text-gray-500">Estado atual da sua assinatura</p>
            </div>
            <div>
              {profile?.subscription_status === 'trialing' && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                  🎉 Trial Ativo
                </span>
              )}
              {profile?.subscription_status === 'active' && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                  ✅ Ativo
                </span>
              )}
              {profile?.subscription_status === 'canceled' && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                  ❌ Cancelado
                </span>
              )}
              {profile?.subscription_status === 'none' && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                  ⏸️ Sem Assinatura
                </span>
              )}
            </div>
          </div>

          {/* Trial Info */}
          {profile?.subscription_status === 'trialing' && profile?.trial_ends_at && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start">
                <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-900">
                    Trial de 6 meses ativo
                  </h3>
                  <p className="mt-1 text-sm text-blue-700">
                    Seu trial termina em {new Date(profile.trial_ends_at).toLocaleDateString('pt-BR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}. Após isso, será cobrado CAD $9.99/mês automaticamente.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Payment Method */}
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <div>
              <p className="font-medium text-gray-900">Método de Pagamento</p>
              <p className="text-sm text-gray-500">
                {profile?.has_payment_method ? 'Cartão cadastrado' : 'Nenhum cartão cadastrado'}
              </p>
            </div>
            <button className="text-sm text-blue-600 hover:text-blue-500 font-medium">
              {profile?.has_payment_method ? 'Alterar' : 'Adicionar'}
            </button>
          </div>

          {/* Features */}
          <div className="py-3">
            <p className="font-medium text-gray-900 mb-3">Features Liberadas</p>
            <div className="space-y-2">
              <FeatureStatus
                name="Voice Calculator"
                enabled={profile?.voice_calculator_enabled || false}
              />
              <FeatureStatus
                name="Sync Automático"
                enabled={profile?.sync_enabled || false}
              />
              <FeatureStatus
                name="Blades Rewards"
                enabled={profile?.has_payment_method || false}
              />
            </div>
          </div>

          {/* Cancel */}
          {profile?.subscription_status !== 'canceled' && profile?.subscription_status !== 'none' && (
            <div className="pt-4 border-t border-gray-100">
              <button className="text-sm text-red-600 hover:text-red-500 font-medium">
                Cancelar Assinatura
              </button>
              <p className="text-xs text-gray-500 mt-1">
                Reembolso total no primeiro ano
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Device Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Smartphone className="w-5 h-5 text-gray-600" />
          <h2 className="text-xl font-semibold text-gray-900">Dispositivo Vinculado</h2>
        </div>

        {profile?.device_id ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <div>
                <p className="font-medium text-gray-900">{profile.device_model || 'Dispositivo'}</p>
                <p className="text-sm text-gray-500">
                  {profile.device_platform === 'ios' && '📱 iPhone'}
                  {profile.device_platform === 'android' && '📱 Android'}
                  {profile.device_platform === 'web' && '💻 Web'}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Vinculado em {new Date(profile.device_registered_at).toLocaleDateString('pt-BR')}
                </p>
              </div>
              <button className="text-sm text-red-600 hover:text-red-500 font-medium">
                Desvincular
              </button>
            </div>
            <p className="text-sm text-gray-600">
              ℹ️ Você pode vincular apenas 1 dispositivo por conta. Desvincule para trocar de celular.
            </p>
          </div>
        ) : (
          <div className="text-center py-8">
            <Smartphone className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-600">
              Nenhum dispositivo vinculado
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Faça login no app mobile para vincular
            </p>
          </div>
        )}
      </div>

      {/* Account Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <User className="w-5 h-5 text-gray-600" />
          <h2 className="text-xl font-semibold text-gray-900">Conta</h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <div>
              <p className="font-medium text-gray-900">Email</p>
              <p className="text-sm text-gray-500">{user.email}</p>
            </div>
          </div>

          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <div>
              <p className="font-medium text-gray-900">Senha</p>
              <p className="text-sm text-gray-500">••••••••</p>
            </div>
            <button className="text-sm text-blue-600 hover:text-blue-500 font-medium">
              Alterar
            </button>
          </div>

          <div className="pt-4 border-t border-gray-100">
            <button className="text-sm text-red-600 hover:text-red-500 font-medium">
              Deletar Conta
            </button>
            <p className="text-xs text-gray-500 mt-1">
              Esta ação é permanente e não pode ser desfeita
            </p>
          </div>
        </div>
      </div>

      {/* Security Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-5 h-5 text-gray-600" />
          <h2 className="text-xl font-semibold text-gray-900">Segurança & Privacidade</h2>
        </div>

        <div className="space-y-3">
          <a href="#" className="block text-sm text-blue-600 hover:text-blue-500">
            📄 Termos de Uso
          </a>
          <a href="#" className="block text-sm text-blue-600 hover:text-blue-500">
            🔒 Política de Privacidade
          </a>
          <a href="#" className="block text-sm text-blue-600 hover:text-blue-500">
            💳 Política de Cancelamento
          </a>
          <a href="#" className="block text-sm text-blue-600 hover:text-blue-500">
            🛡️ Segurança de Dados
          </a>
        </div>
      </div>
    </div>
  )
}

function FeatureStatus({ name, enabled }: { name: string; enabled: boolean }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-gray-700">{name}</span>
      {enabled ? (
        <span className="text-sm text-green-600 font-medium">✓ Ativado</span>
      ) : (
        <span className="text-sm text-gray-400">✗ Bloqueado</span>
      )}
    </div>
  )
}
