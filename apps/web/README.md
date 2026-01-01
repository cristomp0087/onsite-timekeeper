# OnSite Flow - Desktop (Web App)

Gerenciador de horas de trabalho - versão web/desktop.

## 🚀 Setup

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env.local
# Edite .env.local com suas credenciais do Supabase

# 3. Rodar em desenvolvimento
npm run dev

# 4. Acessar
# http://localhost:3000
```

## 📁 Estrutura

```
src/
├── app/
│   ├── page.tsx              # Login
│   ├── layout.tsx            # Layout raiz
│   └── dashboard/
│       ├── layout.tsx        # Layout com sidebar
│       ├── page.tsx          # Dashboard principal
│       └── registros/
│           └── page.tsx      # Tabela de registros
├── components/
│   ├── Sidebar.tsx           # Menu lateral
│   ├── StatCard.tsx          # Card de estatística
│   └── HoursChart.tsx        # Gráfico de barras
├── stores/
│   ├── authStore.ts          # Estado de autenticação
│   └── sessoesStore.ts       # Estado de sessões
├── lib/
│   ├── supabase.ts           # Cliente Supabase
│   ├── utils.ts              # Formatações
│   └── export.ts             # Export Excel/CSV
└── types/
    └── database.ts           # Tipos do banco
```

## ✅ Features

### Dashboard

- [x] Cards de estatísticas (total horas, sessões, média)
- [x] Gráfico de horas por dia (últimos 14 dias)
- [x] Atividade recente

### Registros

- [x] Tabela paginada
- [x] Filtros (período, local, busca)
- [x] Export Excel (.xlsx)
- [x] Export CSV

### Em Desenvolvimento

- [ ] Página de Locais (visualizar/editar)
- [ ] Página de Relatórios (PDF)
- [ ] Configurações de usuário

## 🔗 Conexão com Mobile

Este app usa o **mesmo Supabase** do mobile:

- Mesmo banco de dados
- Mesma autenticação
- Dados sincronizados em tempo real

## 📦 Destino no Monorepo

```
apps/
├── mobile/          # React Native (Expo)
└── web/             # Next.js (este projeto)
    ├── src/
    ├── package.json
    └── ...
```

## 🛠️ Tech Stack

- **Next.js 14** - Framework React
- **TypeScript** - Tipagem
- **Tailwind CSS** - Estilos
- **Zustand** - Estado global
- **Chart.js** - Gráficos
- **XLSX** - Export Excel
- **Supabase** - Backend

## 📝 Notas

- Login usa mesmas credenciais do mobile
- Não precisa de GPS (apenas visualização)
- Ideal para gestão mensal/relatórios
