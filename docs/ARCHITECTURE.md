# 🏗️ Arquitetura - OnSite Timekeeper

## 📦 Estrutura do Monorepo
```
onsite-timekeeper/
├── apps/
│   ├── mobile/          # React Native + Expo
│   └── web/             # Next.js 15
├── packages/
│   └── shared/          # Código compartilhado
├── supabase/
│   └── migrations/      # Database migrations
└── docs/                # Documentação
```

---

## 🔧 Stack Tecnológica

### Mobile
- **Framework:** React Native + Expo
- **Linguagem:** TypeScript
- **Database Local:** expo-sqlite
- **Geofencing:** expo-location + expo-task-manager
- **State:** Zustand

### Web
- **Framework:** Next.js 15 (App Router)
- **Linguagem:** TypeScript
- **State:** Zustand
- **Estilo:** Tailwind CSS

### Backend
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth
- **Realtime:** Supabase Realtime

### Tooling
- **Monorepo:** Turborepo
- **Package Manager:** pnpm
- **Linting:** ESLint + Prettier
- **Type Checking:** TypeScript strict mode

---

## 📊 Fluxo de Dados

### Mobile → Supabase → Web
```
┌─────────────────┐
│  Mobile App     │
│  (SQLite)       │ Offline-first
└────────┬────────┘
         │ sync quando online
         ▼
┌─────────────────┐
│   Supabase      │
│  (PostgreSQL)   │ Source of truth
└────────┬────────┘
         │ realtime
         ▼
┌─────────────────┐
│   Web App       │
│  (Dashboard)    │ Read-only
└─────────────────┘
```

---

## 🗄️ Schema do Banco

### Tabela: `locais`
```sql
id          uuid PRIMARY KEY
user_id     uuid REFERENCES auth.users
nome        text
latitude    float8
longitude   float8
raio        int4 DEFAULT 100
cor         text
ativo       bool DEFAULT true
created_at  timestamptz
updated_at  timestamptz
```

### Tabela: `registros`
```sql
id                    uuid PRIMARY KEY
user_id               uuid REFERENCES auth.users
local_id              uuid REFERENCES locais
local_nome            text
entrada               timestamptz
saida                 timestamptz
tipo                  text DEFAULT 'automatico'
editado_manualmente   bool DEFAULT false
motivo_edicao         text
hash_integridade      text
cor                   text
device_id             text
created_at            timestamptz
synced_at             timestamptz
```

---

## 🔐 Segurança

### Row Level Security (RLS)
- Usuários só veem **seus próprios dados**
- Policies por operação (SELECT, INSERT, UPDATE, DELETE)
- Service Role Key **nunca** vai pro cliente

---

**OnSite Club** - Wear what you do!