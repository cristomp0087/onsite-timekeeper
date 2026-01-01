import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MapPin, Clock, Calendar } from 'lucide-react'

export default async function TimekeeperPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Buscar locais do usuário
  const { data: locais } = await supabase
    .from('locais')
    .select('*')
    .eq('user_id', user.id)
    .eq('ativo', true)
    .order('nome')

  // Buscar registros recentes (últimos 30 dias)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data: registros } = await supabase
    .from('registros')
    .select('*')
    .eq('user_id', user.id)
    .gte('entrada', thirtyDaysAgo.toISOString())
    .order('entrada', { ascending: false })
    .limit(50)

  // Calcular estatísticas
  let totalMinutos = 0
  let totalSessoes = registros?.length || 0

  if (registros) {
    registros.forEach((reg) => {
      if (reg.saida) {
        const entrada = new Date(reg.entrada).getTime()
        const saida = new Date(reg.saida).getTime()
        totalMinutos += Math.round((saida - entrada) / 60000)
      }
    })
  }

  const totalHoras = Math.floor(totalMinutos / 60)
  const minutosRestantes = totalMinutos % 60

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Timekeeper</h1>
        <p className="text-gray-600 mt-1">
          Gerencie seus locais e registros de trabalho
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          icon={Clock}
          title="Total de Horas (30 dias)"
          value={`${totalHoras}h ${minutosRestantes}min`}
          color="blue"
        />
        <StatCard
          icon={Calendar}
          title="Sessões (30 dias)"
          value={totalSessoes.toString()}
          color="green"
        />
        <StatCard
          icon={MapPin}
          title="Locais Ativos"
          value={locais?.length.toString() || '0'}
          color="purple"
        />
      </div>

      {/* Locais */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Meus Locais</h2>
          <button className="text-sm text-blue-600 hover:text-blue-500 font-medium">
            + Adicionar Local
          </button>
        </div>
        
        {locais && locais.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {locais.map((local) => (
              <div
                key={local.id}
                className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <MapPin className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    local.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {local.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{local.nome}</h3>
                <p className="text-sm text-gray-500">{local.endereco}</p>
                <div className="mt-2 text-xs text-gray-400">
                  Raio: {local.raio}m
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600">Nenhum local cadastrado</p>
            <p className="text-sm text-gray-500 mt-1">
              Adicione locais no app mobile para começar
            </p>
          </div>
        )}
      </div>

      {/* Registros Recentes */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Registros Recentes (30 dias)
        </h2>
        
        {registros && registros.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Local
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Data
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Entrada
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Saída
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Duração
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {registros.slice(0, 20).map((registro) => {
                  const entrada = new Date(registro.entrada)
                  const saida = registro.saida ? new Date(registro.saida) : null
                  const duracao = saida 
                    ? Math.round((saida.getTime() - entrada.getTime()) / 60000)
                    : null

                  return (
                    <tr key={registro.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {registro.local_nome}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {entrada.toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {entrada.toLocaleTimeString('pt-BR', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {saida 
                          ? saida.toLocaleTimeString('pt-BR', { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })
                          : <span className="text-green-600 font-medium">Em andamento</span>
                        }
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        {duracao 
                          ? `${Math.floor(duracao / 60)}h ${duracao % 60}min`
                          : '-'
                        }
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8">
            <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600">Nenhum registro nos últimos 30 dias</p>
            <p className="text-sm text-gray-500 mt-1">
              Use o app mobile para registrar suas horas
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({
  icon: Icon,
  title,
  value,
  color,
}: {
  icon: any
  title: string
  value: string
  color: 'blue' | 'green' | 'purple'
}) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">{value}</p>
        </div>
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  )
}
