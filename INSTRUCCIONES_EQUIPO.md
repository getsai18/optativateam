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

## 2. Commits (rubro 5)

Los cambios ya están subidos en la rama **`mejoras-auditoria`**. Jacqueline es la autora de
los 6 commits, con su identidad configurada en el repositorio:

```
jacqueline pilgram <20243ds007@utez.edu.mx>
```

| Commit | Mensaje |
|---|---|
| `43a7753` | docs: corrige cifras reales y documentacion obsoleta |
| `23f170c` | feat(db): normaliza roles con app_role y migracion idempotente |
| `001bec5` | fix(api): emision consistente y rate limit distribuido en DynamoDB |
| `603907b` | test(ci): workflow con MySQL/PostgreSQL y pruebas reales de SP |
| `54864a0` | feat(infra): apagado automatico de RDS y riesgo aceptado de SG |
| `90fef85` | docs: agrega memoria corregida e instrucciones para el equipo |

El último paso es abrir el Pull Request hacia `main`:

```
https://github.com/getsai18/optativateam/pull/new/mejoras-auditoria
```

> Si más adelante se decide que los otros integrantes también aparezcan como autores, cada
> persona debe hacer sus propios commits con su cuenta (`git config user.name` y
> `git config user.email`). No se reescribe el historial ajeno ni se comparte identidad.

---

## Resumen de responsables

| Tarea | Quién | Estado |
|---|---|---|
| Revocar token en GitHub | Dueño de la cuenta (`getsai18`) | PENDIENTE |
| `git remote set-url` en cada copia | Cada integrante | PENDIENTE |
| Commits en `mejoras-auditoria` | Jacqueline (6 commits) | HECHO |
| Abrir PR y hacer merge a `main` | Dueño del repo | PENDIENTE |
| Código, docs, PDF y CI | Auditoría (bajo tu autoría) | HECHO |
