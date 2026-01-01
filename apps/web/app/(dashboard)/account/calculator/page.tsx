import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Calculator, ExternalLink, Lock } from 'lucide-react'

export default async function CalculatorPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('voice_calculator_enabled, has_payment_method')
    .eq('id', user.id)
    .single()

  const calculatorUrl = process.env.NEXT_PUBLIC_CALCULATOR_URL || 'https://onsite-calculator-apps.vercel.app'

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">OnSite Calculator</h1>
        <p className="text-gray-600 mt-1">
          Calculadora de construção com suporte a frações e voice input
        </p>
      </div>

      {/* Feature Status */}
      {!profile?.has_payment_method && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <Lock className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-900">
                Voice Calculator Bloqueado
              </h3>
              <p className="mt-1 text-sm text-yellow-700">
                Adicione um método de pagamento em Configurações para desbloquear a feature de voz.
              </p>
              <a
                href="/account/settings"
                className="mt-2 inline-block text-sm font-medium text-yellow-800 hover:text-yellow-700"
              >
                Ir para Configurações →
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Calculator Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-lg bg-blue-50">
              <Calculator className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">
              Calculadora Básica
            </h3>
          </div>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              Frações de polegadas (5 1/2 + 3 1/4)
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              Feet e inches
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              Funciona 100% offline
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              Sempre gratuito
            </li>
          </ul>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-lg bg-purple-50">
              <span className="text-2xl">🎙️</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">
              Voice Calculator
            </h3>
          </div>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-center gap-2">
              {profile?.voice_calculator_enabled ? (
                <span className="text-green-500">✓</span>
              ) : (
                <span className="text-gray-400">✗</span>
              )}
              Fale os cálculos
            </li>
            <li className="flex items-center gap-2">
              {profile?.voice_calculator_enabled ? (
                <span className="text-green-500">✓</span>
              ) : (
                <span className="text-gray-400">✗</span>
              )}
              Whisper AI transcrição
            </li>
            <li className="flex items-center gap-2">
              {profile?.voice_calculator_enabled ? (
                <span className="text-green-500">✓</span>
              ) : (
                <span className="text-gray-400">✗</span>
              )}
              GPT-4o interpretação
            </li>
            <li className="flex items-center gap-2">
              {profile?.voice_calculator_enabled ? (
                <span className="text-green-500">✓</span>
              ) : (
                <span className="text-red-500">✗</span>
              )}
              {profile?.voice_calculator_enabled ? 'Desbloqueado' : 'Requer cartão'}
            </li>
          </ul>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Acesso Rápido
        </h3>
        <div className="space-y-3">
          <a
            href={calculatorUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all group"
          >
            <div>
              <p className="font-medium text-gray-900 group-hover:text-blue-600">
                Abrir Calculator Web
              </p>
              <p className="text-sm text-gray-500">
                Use no navegador
              </p>
            </div>
            <ExternalLink className="w-5 h-5 text-gray-400 group-hover:text-blue-600" />
          </a>

          <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">
                  📱 App Mobile
                </p>
                <p className="text-sm text-gray-500">
                  Em breve na Play Store e App Store
                </p>
              </div>
              <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 font-medium">
                Em breve
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
