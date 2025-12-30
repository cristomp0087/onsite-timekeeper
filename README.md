# OnSite Timekeeper

Geofencing time tracking app for construction workers.

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- pnpm 9+
- Supabase account

### Setup
```bash
# Install dependencies
pnpm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your Supabase keys

# Run development
pnpm dev
```

## 📁 Project Structure
```
onsite-timekeeper/
├── apps/
│   ├── mobile/          # React Native + Expo
│   └── web/             # Next.js
├── packages/
│   └── shared/          # Shared code
├── supabase/
│   └── migrations/      # Database migrations
└── docs/                # Documentation
```

## 🛠️ Stack

- **Mobile:** React Native, Expo, SQLite
- **Web:** Next.js 15, Tailwind CSS
- **Backend:** Supabase (PostgreSQL)
- **Monorepo:** Turborepo, pnpm

## 📄 License

UNLICENSED - Private use only.

---

**OnSite Club** - Wear what you do!