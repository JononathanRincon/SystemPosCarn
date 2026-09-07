---
name: talleros-backend-engineer
description: Guidelines, architectures, and patterns for building the TallerOS enterprise multi-tenant backend with NestJS 11, PostgreSQL (Supabase), Prisma 6, Vitest, and Vercel serverless deployment.
---

# TallerOS Backend Engineering Skill

This skill defines the technical standards, architectural rules, indexing strategies, testing conventions, and resiliency patterns for developing backend features in **TallerOS**.

---

## 1. Architectural Rules: Hexagonal (Ports & Adapters) + Vertical Slice

Every feature/domain module under `src/modules/<feature-name>/` MUST follow this exact 4-layer structure:

```text
src/modules/<feature-name>/
├── domain/                      # 1. Pure TypeScript (NO NestJS / Prisma imports)
│   ├── entities/<name>.entity.ts
│   ├── value-objects/
│   └── ports/<name>-repository.port.ts  # Interface + Symbol token for DI
├── application/                 # 2. Use Cases & Application Services
│   ├── use-cases/<action>-<name>.use-case.ts
│   └── dtos/<action>-<name>.dto.ts
├── infrastructure/              # 3. Adapters & Persistence
│   ├── adapters/prisma-<name>.repository.ts
│   └── mappers/<name>.mapper.ts
├── presentation/                # 4. HTTP Controllers & Decorators
│   ├── http/<name>.controller.ts
│   └── http/requests/<name>.request.ts
└── <feature-name>.module.ts     # Wiring DI: Port Symbol -> Adapter Class
```

### Critical Dependency Rule:
- `domain/` depends on **nothing**.
- `application/` depends **only on `domain/`**.
- `infrastructure/` implements `domain/ports` and depends on `@prisma/client`.
- `presentation/` calls `application/use-cases` and returns formatted API responses.

---

## 2. The Three Pillars of Quality (Reliability, Scalability, Maintainability)

### A. Reliability (Fiabilidad)
1. **Idempotency on Critical Writes:** Any state-changing financial, invoicing, or order creation endpoint MUST use the `@RequireIdempotency()` decorator with header `Idempotency-Key`.
2. **Transactional Outbox / Atomic Operations:** If an operation updates more than one aggregate or table (e.g. Invoicing a quote creates a Receivable and an AuditLog), wrap inside `this.prisma.$transaction(async (tx) => { ... })`.
3. **Fail-Closed Multi-Tenancy:** Always verify `tenantId` at the Application layer and enforce via database Row-Level Security (RLS) policies.

### B. Scalability (Escalabilidad) & Indexing Best Practices
1. **Index Type Selection Guide:**
   - **B-Tree:** Default for `tenant_id`, FKs, `created_at`, dates, numeric comparisons, and composite lookups `(tenant_id, created_at DESC)`.
   - **GIN (`pg_trgm`):** For searchable text (plates, owner names, company names, item SKUs, descriptions).
   - **Hash Index:** For exact equality lookups on high-entropy unique strings (e.g. `token`, `idempotency_key`, `qr_verification_code`).
   - **BRIN (Block Range Index):** For append-only time-series tables (`audit_logs`, `service_history`).
   - **Partial Indexes:** Always add `WHERE deleted_at IS NULL` or `WHERE status != 'completed'` to exclude inactive/archived rows from memory-resident index pages.
2. **Cursor-Based Pagination:** Use cursor pagination (`take: limit + 1`, `cursor: { id }`, `orderBy: { createdAt: 'desc' }`) for large datasets (Vehicles, Service History, Audit Logs).

### C. Maintainability (Mantenibilidad)
1. **Strict Type Parity with Frontend:** Field names, enums, and data models MUST align 1:1 with `Frontend/src/types/*.types.ts`.
2. **Standardized Response Envelope:**
   ```typescript
   {
     "success": true,
     "data": T,
     "meta": { "timestamp": "...", "correlationId": "...", "cursor": "..." }
   }
   ```
3. **Audit Logging on All Mutations:** Apply `@AuditAction(action, entityType)` on controller endpoints to automatically log actor, action, timestamp, IP, and diffs to `audit_logs`.

---

## 3. Testing Standards (Piramidal Approach with Vitest)

Every feature MUST have:
1. **Unit Test (`*.spec.ts`):** Tests use cases in complete isolation using `vitest-mock-extended` mocking the domain port.
2. **E2E Test (`*.e2e-spec.ts`):** Tests the HTTP controller, validation pipes, guards, and status codes using Supertest.

---

## 4. Vercel Serverless & Supabase Connection Constraints

1. **Connection Pooling Mandatory:** Use `DATABASE_URL` pointing to port `6543` (Supavisor) with `?pgbouncer=true`. Use `DIRECT_URL` (port `5432`) ONLY for Prisma migrations.
2. **Request Timeout Limit:** Vercel Hobby functions have a max execution timeout of **10 seconds**. Never perform blocking heavy operations in the HTTP request loop.
3. **Stateless Operations:** Store uploads in Supabase Storage buckets, never to local disk.
4. **No Direct Secret Leaks:** Never return `password_hash`, API keys, or raw internal errors in HTTP responses. Use `AllExceptionsFilter`.
