'use client';

import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import {
  User,
  CreditCard,
  Bell,
  MapPin,
  Shield,
  ExternalLink,
  LogOut,
  Trash2,
  Link,
  ShoppingBag,
  Globe,
  Smartphone,
  HelpCircle,
  Mail,
  ChevronRight,
  Settings,
  Clock,
} from 'lucide-react';

// URLs externas (configurar depois)
const URLS_EXTERNAS = {
  // Site/Portal do usuário
  portal: 'https://onsite.app/portal',

  // Shopify/E-commerce
  shopify: 'https://onsite.app/shopify/account',
  assinatura: 'https://onsite.app/billing',

  // Suporte
  suporte: 'https://onsite.app/support',
  docs: 'https://onsite.app/docs',

  // Legal
  termos: 'https://onsite.app/terms',
  privacidade: 'https://onsite.app/privacy',
};

interface ConfigSection {
  id: string;
  titulo: string;
  descricao: string;
  icon: React.ReactNode;
  items: ConfigItem[];
}

interface ConfigItem {
  id: string;
  titulo: string;
  descricao: string;
  tipo: 'link' | 'toggle' | 'action' | 'info';
  url?: string;
  valor?: boolean;
  onClick?: () => void;
  danger?: boolean;
}

export default function ConfiguracoesPage() {
  const { user, signOut } = useAuthStore();
  const [notificacoesEmail, setNotificacoesEmail] = useState(true);
  const [notificacoesPush, setNotificacoesPush] = useState(true);
  const [relatorioSemanal, setRelatorioSemanal] = useState(false);

  // Handlers
  const handleExcluirConta = () => {
    if (
      confirm(
        'Tem certeza que deseja excluir sua conta?\n\nEsta ação é irreversível e todos os seus dados serão perdidos.'
      )
    ) {
      if (
        confirm(
          'ATENÇÃO: Você perderá acesso a todos os seus registros de horas.\n\nDigite "EXCLUIR" para confirmar.'
        )
      ) {
        // TODO: Implementar exclusão de conta
        alert(
          'Para excluir sua conta, entre em contato com o suporte:\nsuporte@onsite.app'
        );
      }
    }
  };

  const handleSignOut = () => {
    if (confirm('Deseja sair da sua conta?')) {
      signOut();
    }
  };

  const abrirLink = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Configurações organizadas por seção
  const secoes: ConfigSection[] = [
    {
      id: 'conta',
      titulo: 'Conta',
      descricao: 'Gerencie suas informações pessoais',
      icon: <User className="w-5 h-5" />,
      items: [
        {
          id: 'perfil',
          titulo: 'Dados Pessoais',
          descricao: 'Nome, email, telefone, foto',
          tipo: 'link',
          url: URLS_EXTERNAS.portal + '/profile',
        },
        {
          id: 'senha',
          titulo: 'Alterar Senha',
          descricao: 'Atualize sua senha de acesso',
          tipo: 'link',
          url: URLS_EXTERNAS.portal + '/security',
        },
        {
          id: 'email',
          titulo: 'Email',
          descricao: user?.email || 'Não definido',
          tipo: 'info',
        },
      ],
    },
    {
      id: 'assinatura',
      titulo: 'Assinatura & Pagamento',
      descricao: 'Gerencie seu plano e forma de pagamento',
      icon: <CreditCard className="w-5 h-5" />,
      items: [
        {
          id: 'plano',
          titulo: 'Meu Plano',
          descricao: 'Visualize e altere seu plano atual',
          tipo: 'link',
          url: URLS_EXTERNAS.assinatura,
        },
        {
          id: 'pagamento',
          titulo: 'Forma de Pagamento',
          descricao: 'Cartão de crédito, boleto, PIX',
          tipo: 'link',
          url: URLS_EXTERNAS.assinatura + '/payment',
        },
        {
          id: 'faturas',
          titulo: 'Histórico de Faturas',
          descricao: 'Veja suas faturas anteriores',
          tipo: 'link',
          url: URLS_EXTERNAS.assinatura + '/invoices',
        },
      ],
    },
    {
      id: 'geofence',
      titulo: 'Configurações de Geofence',
      descricao: 'Personalize o comportamento do app móvel',
      icon: <MapPin className="w-5 h-5" />,
      items: [
        {
          id: 'geofence-config',
          titulo: 'Tempos de Popup',
          descricao: 'Configure os botões "Há X min" e countdown',
          tipo: 'link',
          url: '#', // TODO: Modal interno ou sincronizar com mobile
        },
        {
          id: 'raio-padrao',
          titulo: 'Raio Padrão',
          descricao: 'Defina o raio padrão para novos locais',
          tipo: 'link',
          url: '#',
        },
      ],
    },
    {
      id: 'notificacoes',
      titulo: 'Notificações',
      descricao: 'Configure como receber alertas',
      icon: <Bell className="w-5 h-5" />,
      items: [
        {
          id: 'email-notif',
          titulo: 'Notificações por Email',
          descricao: 'Receba alertas por email',
          tipo: 'toggle',
          valor: notificacoesEmail,
          onClick: () => setNotificacoesEmail(!notificacoesEmail),
        },
        {
          id: 'push-notif',
          titulo: 'Notificações Push',
          descricao: 'Alertas no celular',
          tipo: 'toggle',
          valor: notificacoesPush,
          onClick: () => setNotificacoesPush(!notificacoesPush),
        },
        {
          id: 'relatorio-semanal',
          titulo: 'Relatório Semanal',
          descricao: 'Receba um resumo toda segunda-feira',
          tipo: 'toggle',
          valor: relatorioSemanal,
          onClick: () => setRelatorioSemanal(!relatorioSemanal),
        },
      ],
    },
    {
      id: 'integracoes',
      titulo: 'Integrações',
      descricao: 'Conecte com outros serviços',
      icon: <Link className="w-5 h-5" />,
      items: [
        {
          id: 'shopify',
          titulo: 'Shopify',
          descricao: 'Conectar com sua loja Shopify',
          tipo: 'link',
          url: URLS_EXTERNAS.shopify,
        },
        {
          id: 'google',
          titulo: 'Google Calendar',
          descricao: 'Sincronizar eventos (em breve)',
          tipo: 'link',
          url: '#',
        },
        {
          id: 'api',
          titulo: 'API & Webhooks',
          descricao: 'Acesso programático aos seus dados',
          tipo: 'link',
          url: URLS_EXTERNAS.docs + '/api',
        },
      ],
    },
    {
      id: 'apps',
      titulo: 'Apps Conectados',
      descricao: 'Gerencie seus dispositivos',
      icon: <Smartphone className="w-5 h-5" />,
      items: [
        {
          id: 'mobile',
          titulo: 'App Mobile',
          descricao: 'OnSite Flow para iOS/Android',
          tipo: 'link',
          url: URLS_EXTERNAS.portal + '/devices',
        },
        {
          id: 'desktop',
          titulo: 'Desktop (atual)',
          descricao: 'Você está usando o app desktop',
          tipo: 'info',
        },
      ],
    },
    {
      id: 'suporte',
      titulo: 'Ajuda & Suporte',
      descricao: 'Obtenha ajuda quando precisar',
      icon: <HelpCircle className="w-5 h-5" />,
      items: [
        {
          id: 'central-ajuda',
          titulo: 'Central de Ajuda',
          descricao: 'Tutoriais e perguntas frequentes',
          tipo: 'link',
          url: URLS_EXTERNAS.docs,
        },
        {
          id: 'contato',
          titulo: 'Falar com Suporte',
          descricao: 'Entre em contato conosco',
          tipo: 'link',
          url: URLS_EXTERNAS.suporte,
        },
        {
          id: 'feedback',
          titulo: 'Enviar Feedback',
          descricao: 'Nos ajude a melhorar',
          tipo: 'link',
          url: URLS_EXTERNAS.suporte + '/feedback',
        },
      ],
    },
    {
      id: 'legal',
      titulo: 'Legal',
      descricao: 'Termos e políticas',
      icon: <Shield className="w-5 h-5" />,
      items: [
        {
          id: 'termos',
          titulo: 'Termos de Uso',
          descricao: 'Leia nossos termos de serviço',
          tipo: 'link',
          url: URLS_EXTERNAS.termos,
        },
        {
          id: 'privacidade',
          titulo: 'Política de Privacidade',
          descricao: 'Como tratamos seus dados',
          tipo: 'link',
          url: URLS_EXTERNAS.privacidade,
        },
      ],
    },
    {
      id: 'perigo',
      titulo: 'Zona de Perigo',
      descricao: 'Ações irreversíveis',
      icon: <Trash2 className="w-5 h-5 text-red-500" />,
      items: [
        {
          id: 'sair',
          titulo: 'Sair da Conta',
          descricao: 'Encerrar sessão neste dispositivo',
          tipo: 'action',
          onClick: handleSignOut,
        },
        {
          id: 'excluir',
          titulo: 'Excluir Conta',
          descricao: 'Remover permanentemente sua conta e dados',
          tipo: 'action',
          onClick: handleExcluirConta,
          danger: true,
        },
      ],
    },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
        <p className="text-gray-500 mt-1">Gerencie sua conta e preferências</p>
      </div>

      {/* Aviso sobre links externos */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <ExternalLink className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <p className="text-sm text-blue-800 font-medium">
              Algumas configurações abrem em uma nova aba
            </p>
            <p className="text-sm text-blue-600 mt-1">
              Para segurança, dados sensíveis como pagamento e senha são
              gerenciados em nosso portal seguro.
            </p>
          </div>
        </div>
      </div>

      {/* Seções de Configuração */}
      <div className="space-y-6">
        {secoes.map((secao) => (
          <div
            key={secao.id}
            className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
          >
            {/* Header da Seção */}
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center gap-3">
                <div
                  className={`${secao.id === 'perigo' ? 'text-red-500' : 'text-gray-600'}`}
                >
                  {secao.icon}
                </div>
                <div>
                  <h2
                    className={`font-semibold ${secao.id === 'perigo' ? 'text-red-700' : 'text-gray-900'}`}
                  >
                    {secao.titulo}
                  </h2>
                  <p className="text-sm text-gray-500">{secao.descricao}</p>
                </div>
              </div>
            </div>

            {/* Items */}
            <div className="divide-y divide-gray-100">
              {secao.items.map((item) => (
                <div
                  key={item.id}
                  className={`px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition ${
                    item.tipo === 'link' || item.tipo === 'action'
                      ? 'cursor-pointer'
                      : ''
                  }`}
                  onClick={() => {
                    if (item.tipo === 'link' && item.url && item.url !== '#') {
                      abrirLink(item.url);
                    } else if (item.tipo === 'action' && item.onClick) {
                      item.onClick();
                    }
                  }}
                >
                  <div className="flex-1">
                    <h3
                      className={`font-medium ${item.danger ? 'text-red-600' : 'text-gray-900'}`}
                    >
                      {item.titulo}
                    </h3>
                    <p className="text-sm text-gray-500">{item.descricao}</p>
                  </div>

                  {/* Controle baseado no tipo */}
                  {item.tipo === 'link' && (
                    <div className="flex items-center gap-2 text-gray-400">
                      {item.url !== '#' && <ExternalLink className="w-4 h-4" />}
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  )}

                  {item.tipo === 'toggle' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        item.onClick?.();
                      }}
                      className={`relative w-12 h-6 rounded-full transition ${
                        item.valor ? 'bg-primary-600' : 'bg-gray-300'
                      }`}
                    >
                      <div
                        className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                          item.valor ? 'translate-x-7' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  )}

                  {item.tipo === 'action' && (
                    <ChevronRight
                      className={`w-4 h-4 ${item.danger ? 'text-red-400' : 'text-gray-400'}`}
                    />
                  )}

                  {item.tipo === 'info' && (
                    <span className="text-sm text-gray-500">
                      {item.descricao}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Versão do App */}
      <div className="text-center py-8 text-gray-400 text-sm">
        <p>OnSite Flow Desktop v1.0.0</p>
        <p className="mt-1">© 2024 Shabba • Todos os direitos reservados</p>
      </div>
    </div>
  );
}
