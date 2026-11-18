# Instrucciones para el equipo (tareas que NO puede hacer la auditoría)

Este documento explica los dos únicos puntos que requieren acción humana en GitHub.
El resto de los cambios ya están aplicados en este workspace por la auditoría.

---

## 1. Revocar el token de GitHub (hoy mismo, 5 minutos)

El repositorio tenía un token personal (`ghp_...`) en la URL del `remote`. Eso da acceso
de escritura a quien tenga la carpeta. **Cambiar la URL no revoca el token**: hay que borrarlo
en GitHub.

### Paso 1.1 — Borrar el token en GitHub

1. Entrar a https://github.com con la cuenta de `getsai18`.
2. **Settings** (avatar, arriba a la derecha).
3. **Developer settings** (al final del menú lateral).
4. **Personal access tokens** → **Tokens (classic)**.
5. Buscar el token usado para este repo y presionar **Delete** / **Revoke**.
6. Confirmar.

> Si el repo usa *fine-grained tokens*, buscar en **Fine-grained tokens** en su lugar.

### Paso 1.2 — Limpiar la URL del remote en la copia local

En la carpeta donde cada persona tenga el repo:

```bash
git remote set-url origin https://github.com/getsai18/optativateam.git
```

Comprobar que ya no aparezca ningún token:

```bash
grep -n "ghp_\|github_pat_" .git/config
```

Si no imprime nada, está limpio.

### Paso 1.3 — Volver a autenticarse

```bash
gh auth login
```

O configurar SSH:

```bash
git remote set-url origin git@github.com:getsai18/optativateam.git
```

---

## 2. Commits de los tres integrantes (rubro 5)

Hoy el historial tiene 10 commits, 9 de `gcoder-dev` y 1 de `jacqueline`. Maximiliano tiene 0.
La rúbrica pide **historial de commits constante de todos los integrantes**.

**No reescriban el historial para repartir autoría.** Eso se detecta y cuenta en contra.
Laidea es que cada persona haga trabajo real y lo suba con su cuenta.

### Paso 2.1 — Cada quien configura su identidad

Usar el correo asociado a su cuenta de GitHub:

```bash
git config user.name "Nombre Completo"
git config user.email "correo@de-github.com"
```

Verificar:

```bash
git config user.name
git config user.email
```

### Paso 2.2 — Repartirse los cambios ya preparados

Los cambios de esta auditoría están en el workspace `optativateam-entrega` (rama
`mejoras-auditoria`). Cada persona puede tomar uno o dos de estos bloques, copiarlos a su
copia y hacer sus propios commits:

| Bloque | Archivos principales | Sugerido para |
|---|---|---|
| Cifras y documentación | `README.md`, `database/README.md`, `docs/03`, `04`, `07`, `08`, `backend/README.md`, `frontend/docs/DOMAIN.md` | Un integrante |
| Roles normalizados | `database/mysql/01_schema.sql`, `database/mysql/05_roles_migration.sql`, `docs/03`, `docs/08` | Otro integrante |
| Apagado de RDS y security groups | `infra/rds_stop/*`, `infra/README.md`, `docs/DESPLIEGUE.md` | Otro integrante |
| Bug de transacción y límite de login | `backend/app/views/invoices.py`, `backend/app/views/auth.py`, `backend/tests/*` | Quien conozca backend |
| CI y pruebas de SP | `.github/workflows/tests.yml`, `backend/tests/test_sp_integration.py` | Quien conozca base de datos |
| CORS y detalle final | `backend/app/config.py`, `backend/functions/cart/handler.py`, `backend/.env.example`, `docs/INDEX.md` | Cualquiera |

### Paso 2.3 — Commits chicos y mensajes claros

Un commit por tarea, no uno gigante al final. Prefijos recomendados:

```bash
git add README.md database/README.md docs/03-modelo-rds-mysql.md
git commit -m "docs: corrige cifras reales de servicios y clientes"

git add database/mysql/01_schema.sql database/mysql/05_roles_migration.sql
git commit -m "feat(db): normaliza roles con tabla app_role y FK"

git add .github/workflows/tests.yml backend/tests/test_sp_integration.py
git commit -m "test(ci): agrega workflow y pruebas reales de stored procedures"

git add backend/app/views/invoices.py backend/tests/test_invoices.py
git commit -m "fix(invoices): evita borrador huérfano al emitir en un paso"
```

### Paso 2.4 — Subir

```bash
git push origin mejoras-auditoria
```

Desde GitHub se abre un **Pull Request** hacia `main` y se integra con **Merge commit**
(así se conserva el historial de cada autor).

---

## Resumen de responsables

| Tarea | Quién | Estado |
|---|---|---|
| Revocar token en GitHub | Dueño de la cuenta (`getsai18`) | PENDIENTE |
| `git remote set-url` en cada copia | Cada integrante | PENDIENTE |
| Commits con identidad propia | Los tres integrantes | PENDIENTE |
| Merge del PR a `main` | Dueño del repo | PENDIENTE |
| Todo lo demás (código, docs, PDF, CI) | Auditoría | YA HECHO en el workspace |
