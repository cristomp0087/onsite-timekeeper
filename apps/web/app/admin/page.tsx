import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Users, DollarSign, Award, Activity, TrendingUp, TrendingDown } from 'lucide-react'

export default async function AdminDashboardPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Verificar se é admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) {
    redirect('/account/dashboard')
  }

  // Buscar métricas
  const { data: metrics } = await supabase.rpc('get_admin_metrics')

  const metricsData = metrics?.[0] || {
    total_users: 0,
    trial_users: 0,
    active_paid_users: 0,
    canceled_users: 0,
    total_blades: 0,
    total_sessions: 0,
    mrr_cad: 0,
  }

  // Buscar feature usage
  const { data: featureUsage } = await supabase.rpc('get_feature_usage_summary')

  // Buscar usuários recentes
  const { data: recentUsers } = await supabase
    .from('profiles')
    .select('id, email, first_name, last_name, subscription_status, created_at, last_seen_at')
    .order('created_at', { ascending: false })
    .limit(10)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Visão geral do sistema OnSite Club
          </p>
        </div>
        <span className="px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
          🔒 Admin
        </span>
      </div>

      {/* Métricas Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          icon={Users}
          title="Total de Usuários"
          value={metricsData.total_users.toString()}
          subtitle={`${metricsData.trial_users} em trial`}
          color="blue"
        />
        <MetricCard
          icon={DollarSign}
          title="MRR (CAD)"
          value={`$${Number(metricsData.mrr_cad).toFixed(2)}`}
          subtitle={`${metricsData.active_paid_users} pagantes`}
          color="green"
        />
        <MetricCard
          icon={Award}
          title="Total Blades"
          value={metricsData.total_blades.toString()}
          subtitle="Pontos distribuídos"
          color="yellow"
        />
        <MetricCard
          icon={Activity}
          title="Sessões Totais"
          value={metricsData.total_sessions.toString()}
          subtitle="Registros de trabalho"
          color="purple"
        />
      </div>

      {/* Breakdown de Usuários */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatusCard
          title="Em Trial"
          count={metricsData.trial_users}
          total={metricsData.total_users}
          color="blue"
          icon={<TrendingUp className="w-5 h-5" />}
        />
        <StatusCard
          title="Pagantes"
          count={metricsData.active_paid_users}
          total={metricsData.total_users}
          color="green"
          icon={<DollarSign className="w-5 h-5" />}
        />
        <StatusCard
          title="Cancelados"
          count={metricsData.canceled_users}
          total={metricsData.total_users}
          color="red"
          icon={<TrendingDown className="w-5 h-5" />}
        />
      </div>

      {/* Feature Usage */}
      {featureUsage && featureUsage.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Uso de Features (últimos 30 dias)
          </h2>
          <div className="space-y-3">
            {featureUsage.map((feature) => (
              <div key={feature.feature} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <div>
                  <p className="font-medium text-gray-900">{feature.feature}</p>
                  <p className="text-sm text-gray-500">{feature.unique_users} usuários únicos</p>
                </div>
                <span className="text-lg font-semibold text-gray-900">
                  {feature.usage_count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Usuários Recentes */}
      {recentUsers && recentUsers.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Usuários Recentes
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Usuário
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cadastro
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Última Atividade
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {recentUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {user.first_name} {user.last_name}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <SubscriptionBadge status={user.subscription_status} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {new Date(user.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {user.last_seen_at
                        ? new Date(user.last_seen_at).toLocaleDateString('pt-BR')
                        : 'Nunca'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function MetricCard({
  icon: Icon,
  title,
  value,
  subtitle,
  color,
}: {
  icon: any
  title: string
  value: string
  subtitle: string
  color: 'blue' | 'green' | 'yellow' | 'purple'
}) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    purple: 'bg-purple-50 text-purple-600',
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
      <div>
        <p className="text-sm font-medium text-gray-600">{title}</p>
        <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
        <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
      </div>
    </div>
  )
}

function StatusCard({
  title,
  count,
  total,
  color,
  icon,
}: {
  title: string
  count: number
  total: number
  color: 'blue' | 'green' | 'red'
  icon: React.ReactNode
}) {
  const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : '0'
  
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-600',
    green: 'bg-green-50 border-green-200 text-green-600',
    red: 'bg-red-50 border-red-200 text-red-600',
  }

  return (
    <div className={`rounded-lg border p-6 ${colorClasses[color]}`}>
      <div className="flex items-center justify-between mb-4">
        <span className="text-2xl font-bold">{count}</span>
        {icon}
      </div>
      <p className="text-sm font-medium mb-1">{title}</p>
      <p className="text-xs opacity-80">{percentage}% do total</p>
    </div>
  )
}

function SubscriptionBadge({ status }: { status: string }) {
  const badges = {
    trialing: { label: 'Trial', color: 'bg-blue-100 text-blue-800' },
    active: { label: 'Ativo', color: 'bg-green-100 text-green-800' },
    canceled: { label: 'Cancelado', color: 'bg-red-100 text-red-800' },
    none: { label: 'Sem plano', color: 'bg-gray-100 text-gray-800' },
  }

  const badge = badges[status as keyof typeof badges] || badges.none

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
      {badge.label}
    </span>
  )
}
