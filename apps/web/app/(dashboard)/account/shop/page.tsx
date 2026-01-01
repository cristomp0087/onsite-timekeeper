import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ShoppingBag, Award, ExternalLink } from 'lucide-react'

export default async function ShopPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('blades_balance, blades_lifetime_earned, level')
    .eq('id', user.id)
    .single()

  // Buscar últimas transações de Blades
  const { data: transactions } = await supabase
    .from('blades_transactions')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10)

  const shopifyUrl = `https://${process.env.SHOPIFY_DOMAIN}`

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Loja OnSite</h1>
        <p className="text-gray-600 mt-1">
          Uniformes, EPIs e equipamentos para construção
        </p>
      </div>

      {/* Blades Balance Card */}
      <div className="bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-lg p-6 mb-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Award className="w-6 h-6" />
              <h2 className="text-2xl font-bold">Blades Rewards</h2>
            </div>
            <p className="text-yellow-100 text-sm">
              Seu saldo de pontos de fidelidade
            </p>
          </div>
          <div className="text-right">
            <p className="text-5xl font-bold">{profile?.blades_balance || 0}</p>
            <p className="text-yellow-100 text-sm mt-1">Blades</p>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-yellow-500 grid grid-cols-2 gap-4">
          <div>
            <p className="text-yellow-100 text-sm">Ganhos Total</p>
            <p className="text-2xl font-bold">{profile?.blades_lifetime_earned || 0}</p>
          </div>
          <div>
            <p className="text-yellow-100 text-sm">Nível</p>
            <p className="text-2xl font-bold capitalize">{profile?.level || 'Rookie'}</p>
          </div>
        </div>
      </div>

      {/* Como Ganhar Blades */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Como Ganhar Blades
        </h3>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🛍️</span>
            <div>
              <p className="font-medium text-gray-900">1ª Compra + Cartão Cadastrado</p>
              <p className="text-sm text-gray-600">Ganhe 2 Blades ao fazer sua primeira compra</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-2xl">👥</span>
            <div>
              <p className="font-medium text-gray-900">Indique um Amigo</p>
              <p className="text-sm text-gray-600">Ganhe 2 Blades por cada indicação</p>
            </div>
          </div>
          <div className="flex items-start gap-3 opacity-50">
            <span className="text-2xl">🎁</span>
            <div>
              <p className="font-medium text-gray-900">Mais formas em breve</p>
              <p className="text-sm text-gray-600">Estamos desenvolvendo mais formas de ganhar Blades</p>
            </div>
          </div>
        </div>
      </div>

      {/* Shop CTA */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Visite Nossa Loja
            </h3>
            <p className="text-sm text-gray-600">
              Uniformes, EPIs e equipamentos de qualidade
            </p>
          </div>
          <ShoppingBag className="w-8 h-8 text-gray-400" />
        </div>
        <a
          href={shopifyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
        >
          Ir para Loja
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>

      {/* Histórico de Blades */}
      {transactions && transactions.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Histórico de Blades
          </h3>
          <div className="space-y-3">
            {transactions.map((transaction) => (
              <div
                key={transaction.id}
                className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0"
              >
                <div>
                  <p className="font-medium text-gray-900">{transaction.reason}</p>
                  <p className="text-sm text-gray-500">
                    {new Date(transaction.created_at).toLocaleDateString('pt-BR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </p>
                </div>
                <span className={`font-bold ${
                  transaction.amount > 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {transaction.amount > 0 ? '+' : ''}{transaction.amount}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
