# ✅ Checkpoints - OnSite Timekeeper

**Filosofia:** Cada checkpoint deve rodar 100% sem erros antes de avançar.

---

## ✅ CP0: Fundação
**Status:** ✅ COMPLETO  
**Objetivo:** Setup monorepo + tooling  

### O que foi feito:
- ✅ Monorepo com pnpm + Turborepo
- ✅ TypeScript configurado
- ✅ ESLint + Prettier funcionando
- ✅ packages/shared estruturado
- ✅ .env.example com chaves reais
- ✅ .gitignore completo
- ✅ Documentação inicial
- ✅ Repositório GitHub criado

---

## ⏳ CP1: Supabase Core
**Status:** 🔄 PRÓXIMO  
**Objetivo:** Database + Auth + RLS  
**Tempo:** 45min

### O que vai fazer:
- [ ] Verificar projeto Supabase existente
- [ ] Migration: criar tabelas `locais` e `registros`
- [ ] Configurar RLS policies
- [ ] Adicionar índices de performance
- [ ] Adicionar triggers (updated_at)
- [ ] Testar auth + queries

---

## ⏳ CP2: Mobile - Integração
**Status:** 🔜 AGUARDANDO  
**Objetivo:** Integrar código mobile existente  
**Tempo:** 2h

### O que vai fazer:
- [ ] Integrar código mobile testado
- [ ] Revisar estrutura de pastas
- [ ] Configurar expo-sqlite
- [ ] Validar geofencing existente
- [ ] Testar GPS em campo
- [ ] Ajustar UX conforme necessário

---

## ⏳ CP3: Web - Integração
**Status:** 🔜 AGUARDANDO  
**Objetivo:** Integrar código web existente  
**Tempo:** 1.5h

### O que vai fazer:
- [ ] Integrar código web
- [ ] Configurar Next.js 15 + Supabase SSR
- [ ] Validar dashboard
- [ ] Testar relatórios
- [ ] Ajustar responsividade

---

## ⏳ CP4: Sync & Polish
**Status:** 🔜 AGUARDANDO  
**Objetivo:** Sincronização + refinamentos  
**Tempo:** 2h

### O que vai fazer:
- [ ] Validar sync mobile ↔ Supabase
- [ ] Testar cenários offline
- [ ] Resolver conflitos
- [ ] Polish UX mobile
- [ ] Polish dashboard web

---

## ⏳ CP5: Deploy
**Status:** 🔜 AGUARDANDO  
**Objetivo:** Produção  
**Tempo:** 1h

### O que vai fazer:
- [ ] Deploy web na Vercel
- [ ] Build mobile com EAS
- [ ] Testar em produção
- [ ] Documentar setup

---

**OnSite Club** - Wear what you do!