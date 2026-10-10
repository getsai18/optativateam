# -*- coding: utf-8 -*-
"""
Genera los SVG de la carpeta Diagramas a partir de layouts fijos (sin dependencias).
Uso:  python generar_diagramas.py
Salidas: DER-relacional.svg, modelo-dynamodb.svg, arquitectura-general.svg
Las fuentes Mermaid editables están en los .md de esta misma carpeta.
"""
import os

OUT = os.path.dirname(os.path.abspath(__file__))

# Paleta por zona funcional
COLORS = {
    "seguridad": "#364FC7",
    "catalogo": "#2B8A3E",
    "impuestos": "#E8590C",
    "facturacion": "#862E9C",
    "pagos": "#0B7285",
    "aws": "#FF9900",
    "aws2": "#C925D1",
    "neutral": "#495057",
}
MARKER = {
    "PK": "#C92A2A", "SK": "#6741D9", "UK": "#5C940D", "FK": "#1864AB",
    "GSI": "#B45309", "TTL": "#0B7285", "PK,FK": "#862E9C",
}
LINE_H, HEAD_H, PAD = 16, 26, 8


def esc(t):
    return t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def entity(x, y, name, attrs, color, w=220):
    """attrs: lista de (marcador, nombre). Devuelve (svg, box)."""
    h = HEAD_H + PAD + len(attrs) * LINE_H + PAD
    p = [
        f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="#FFFFFF" stroke="#343A40" stroke-width="1.3"/>',
        f'<rect x="{x}" y="{y}" width="{w}" height="{HEAD_H}" fill="{color}"/>',
        f'<text x="{x + w / 2}" y="{y + 17}" text-anchor="middle" font-size="13" '
        f'font-weight="bold" fill="#FFFFFF" font-family="Segoe UI, Arial">{esc(name)}</text>',
    ]
    ty = y + HEAD_H + PAD + 12
    for marker, nm in attrs:
        p.append(f'<line x1="{x + 6}" y1="{ty - 12}" x2="{x + w - 6}" y2="{ty - 12}" stroke="#F1F3F5"/>')
        if marker:
            p.append(f'<text x="{x + w - 8}" y="{ty}" text-anchor="end" font-size="9.5" '
                     f'font-weight="bold" fill="{MARKER[marker]}" font-family="Consolas, monospace">{esc(marker)}</text>')
        p.append(f'<text x="{x + 10}" y="{ty}" font-size="11.5" '
                 f'fill="{"#212529" if marker else "#495057"}" font-family="Consolas, monospace">{esc(nm)}</text>')
        ty += LINE_H
    return "\n".join(p), (x, y, w, h)


def center(b):
    x, y, w, h = b
    return x + w / 2, y + h / 2


def border_pt(b, toward):
    x, y, w, h = b
    cx, cy = x + w / 2, y + h / 2
    dx, dy = toward[0] - cx, toward[1] - cy
    if dx == 0 and dy == 0:
        return cx, cy
    sx = (w / 2) / abs(dx) if dx else 1e9
    sy = (h / 2) / abs(dy) if dy else 1e9
    s = min(sx, sy)
    return cx + dx * s, cy + dy * s


def label(svg_lines, x, y, text, size=11, fill="#212529", anchor="middle", bold=False, family="Segoe UI, Arial"):
    w = len(text) * (size * 0.58)
    if anchor == "middle":
        rx = x - w / 2
    elif anchor == "end":
        rx = x - w
    else:
        rx = x
    svg_lines.append(f'<rect x="{rx - 2}" y="{y - size}" width="{w + 4}" height="{size + 5}" fill="#FFFFFF" fill-opacity="0.9"/>')
    svg_lines.append(
        f'<text x="{x}" y="{y}" text-anchor="{anchor}" font-size="{size}" fill="{fill}" '
        f'{"font-weight=\"bold\" " if bold else ""}font-family="{family}">{esc(text)}</text>')


def rel_direct(svg, b1, b2, text, c1="1", c2="N", dashed=False):
    p1 = border_pt(b1, center(b2))
    p2 = border_pt(b2, center(b1))
    dash = ' stroke-dasharray="6 4"' if dashed else ""
    svg.append(f'<line x1="{p1[0]:.0f}" y1="{p1[1]:.0f}" x2="{p2[0]:.0f}" y2="{p2[1]:.0f}" '
               f'stroke="#495057" stroke-width="1.4" marker-end="url(#arr)"{dash}/>')
    # cardinalidades cerca de cada extremo
    dx, dy = p2[0] - p1[0], p2[1] - p1[1]
    n = max((dx * dx + dy * dy) ** 0.5, 1)
    ux, uy = dx / n, dy / n
    label(svg, p1[0] + ux * 16, p1[1] + uy * 16 + 4, c1, size=10, fill="#C92A2A", bold=True)
    label(svg, p2[0] - ux * 16, p2[1] - uy * 16 + 4, c2, size=10, fill="#C92A2A", bold=True)
    mx, my = (p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2
    label(svg, mx, my - 4, text, size=10, fill="#343A40")


def rel_polyline(svg, pts, text, dashed=False, end_label="N"):
    dash = ' stroke-dasharray="6 4"' if dashed else ""
    d = " ".join(f"{'M' if i == 0 else 'L'}{p[0]:.0f},{p[1]:.0f}" for i, p in enumerate(pts))
    svg.append(f'<path d="{d}" fill="none" stroke="#495057" stroke-width="1.4" marker-end="url(#arr)"{dash}/>')
    (x1, y1), (x2, y2) = pts[0], pts[-2]
    dx, dy = x2 - x1, y2 - y1
    n = max((dx * dx + dy * dy) ** 0.5, 1)
    ux, uy = dx / n, dy / n
    label(svg, pts[0][0] + ux * 14, pts[0][1] + uy * 14 + 4, "1", size=10, fill="#C92A2A", bold=True)
    label(svg, pts[-1][0] - ux * 14, pts[-1][1] - uy * 14 + 4, end_label, size=10, fill="#C92A2A", bold=True)
    mid = pts[len(pts) // 2]
    label(svg, mid[0], mid[1] - 6 if abs(dy) < abs(dx) else mid[1], text, size=10, fill="#343A40")


def svg_doc(w, h, body, title, subtitle):
    return (
        f'<?xml version="1.0" encoding="UTF-8"?>\n'
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">\n'
        f'<defs>\n'
        f'<marker id="arr" markerWidth="9" markerHeight="8" refX="8" refY="4" orient="auto">'
        f'<path d="M0,0 L9,4 L0,8 z" fill="#495057"/></marker>\n'
        f'</defs>\n'
        f'<rect width="{w}" height="{h}" fill="#FFFFFF"/>\n'
        f'<text x="{w / 2}" y="30" text-anchor="middle" font-size="19" font-weight="bold" '
        f'fill="#212529" font-family="Segoe UI, Arial">{esc(title)}</text>\n'
        f'<text x="{w / 2}" y="50" text-anchor="middle" font-size="12" fill="#868E96" '
        f'font-family="Segoe UI, Arial">{esc(subtitle)}</text>\n'
        f'{body}\n</svg>\n'
    )


# =============================================================================
# 1) DER relacional (14 tablas) — mismo modelo en RDS MySQL y RDS Oracle
# =============================================================================
def gen_der():
    DY = 60  # desplazamiento por el título
    svg = []
    boxes = {}

    def put(key, x, y, name, attrs, color):
        s, b = entity(x, y + DY, name, attrs, color)
        svg.append(s)
        boxes[key] = b

    put("customer", 40, 40, "customer", [
        ("PK", "id"), ("", "name"), ("UK", "tax_id"), ("UK", "email"), ("", "phone"),
        ("", "address"), ("", "active"), ("", "created_at"), ("", "updated_at"),
    ], COLORS["seguridad"])
    put("app_user", 40, 260, "app_user", [
        ("PK", "id"), ("UK", "email"), ("", "password_hash"), ("", "full_name"), ("", "role"),
        ("FK", "customer_id"), ("", "active"), ("", "created_at"), ("", "updated_at"),
    ], COLORS["seguridad"])
    put("issuer", 40, 480, "issuer", [
        ("PK", "id"), ("", "legal_name"), ("UK", "tax_id"), ("", "address"), ("", "active"),
    ], COLORS["seguridad"])
    put("tax", 330, 40, "tax", [
        ("PK", "id"), ("UK", "code"), ("", "name"), ("", "current_rate"), ("", "active"),
    ], COLORS["impuestos"])
    put("tax_history", 330, 200, "tax_history", [
        ("PK", "id"), ("FK", "tax_id"), ("", "rate"), ("", "valid_from"), ("", "valid_to"),
        ("FK", "changed_by"), ("", "created_at"),
    ], COLORS["impuestos"])
    put("feature", 330, 400, "feature", [
        ("PK", "id"), ("UK", "name"), ("", "description"), ("", "unit"),
    ], COLORS["catalogo"])
    put("service_feature", 330, 540, "service_feature", [
        ("PK", "id"), ("FK", "service_id"), ("FK", "feature_id"), ("", "value"),
    ], COLORS["catalogo"])
    put("service", 630, 40, "service", [
        ("PK", "id"), ("UK", "code"), ("", "name"), ("", "description"), ("", "base_price"),
        ("", "category"), ("", "active"), ("", "created_at"), ("", "updated_at"),
    ], COLORS["catalogo"])
    put("service_tax", 630, 280, "service_tax", [
        ("PK,FK", "service_id"), ("PK,FK", "tax_id"),
    ], COLORS["catalogo"])
    put("invoice", 930, 40, "invoice", [
        ("PK", "id"), ("UK", "uuid"), ("UK", "folio"), ("FK", "issuer_id"), ("FK", "customer_id"),
        ("FK", "created_by"), ("", "status"), ("", "receiver_name"), ("", "receiver_tax_id"),
        ("", "receiver_address"), ("", "subtotal"), ("", "tax_total"), ("", "total"),
        ("", "created_at"), ("", "issued_at"), ("", "paid_at"), ("", "cancelled_at"),
        ("", "cancellation_reason"),
    ], COLORS["facturacion"])
    put("invoice_detail", 930, 410, "invoice_detail", [
        ("PK", "id"), ("FK", "invoice_id"), ("FK", "service_id"), ("", "service_name"),
        ("", "quantity"), ("", "unit_price"), ("", "line_subtotal"), ("", "tax_amount"), ("", "line_total"),
    ], COLORS["facturacion"])
    put("invoice_detail_tax", 930, 630, "invoice_detail_tax", [
        ("PK", "id"), ("FK", "invoice_detail_id"), ("FK", "tax_id"), ("", "rate"), ("", "amount"),
    ], COLORS["facturacion"])
    put("folio_counter", 1230, 40, "folio_counter", [
        ("PK", "year"), ("", "last_number"),
    ], COLORS["pagos"])
    put("payment", 1230, 160, "payment", [
        ("PK", "id"), ("FK", "invoice_id"), ("", "method"), ("", "amount"),
        ("", "reference"), ("", "paid_at"), ("FK", "registered_by"),
    ], COLORS["pagos"])

    # Relaciones directas (borde a borde)
    rel_direct(svg, boxes["customer"], boxes["app_user"], "cuenta CUSTOMER")
    rel_direct(svg, boxes["tax"], boxes["tax_history"], "historial")
    rel_direct(svg, boxes["app_user"], boxes["tax_history"], "modifica")
    rel_direct(svg, boxes["feature"], boxes["service_feature"], "describe")
    rel_direct(svg, boxes["service"], boxes["service_tax"], "aplica")
    rel_direct(svg, boxes["tax"], boxes["service_tax"], "grava")
    rel_direct(svg, boxes["service"], boxes["invoice_detail"], "snapshot")
    rel_direct(svg, boxes["invoice"], boxes["invoice_detail"], "contiene")
    rel_direct(svg, boxes["invoice_detail"], boxes["invoice_detail_tax"], "desglose")
    rel_direct(svg, boxes["invoice"], boxes["payment"], "pago unico", c2="0..1")
    rel_direct(svg, boxes["folio_counter"], boxes["invoice"], "se incrementa al emitir", c1="", dashed=True)

    # Relaciones con ruta manual (evitan cruzar cajas)
    dy = DY
    rel_polyline(svg, [(630, 141 + dy), (600, 141 + dy), (600, 593 + dy), (550, 593 + dy)], "asigna valor")
    rel_polyline(svg, [(150, 40 + dy), (150, 32), (1000, 32), (1000, 40 + dy)], "recibe")
    rel_polyline(svg, [(260, 353 + dy), (300, 353 + dy), (300, 26), (970, 26), (970, 40 + dy)], "crea factura")
    rel_polyline(svg, [(40, 533 + dy), (20, 533 + dy), (20, 20), (1040, 20), (1040, 40 + dy)], "emite")
    rel_polyline(svg, [(440, 40 + dy), (440, 16), (1170, 16), (1170, 683 + dy), (1150, 683 + dy)], "tasa congelada")
    rel_polyline(svg, [(260, 400 + dy), (300, 400 + dy), (300, 790), (1340, 790), (1340, 314 + dy)],
                 "registra pago")

    # Leyenda
    leg_y = 860
    svg.append(f'<line x1="40" y1="{leg_y - 24}" x2="1480" y2="{leg_y - 24}" stroke="#DEE2E6"/>')
    for i, (grp, color) in enumerate([("Seguridad", COLORS["seguridad"]), ("Catalogo", COLORS["catalogo"]),
                                      ("Impuestos", COLORS["impuestos"]), ("Facturacion", COLORS["facturacion"]),
                                      ("Pagos y folios", COLORS["pagos"])]):
        x = 60 + i * 200
        svg.append(f'<rect x="{x}" y="{leg_y - 12}" width="14" height="14" fill="{color}"/>')
        svg.append(f'<text x="{x + 20}" y="{leg_y}" font-size="12" fill="#495057" font-family="Segoe UI, Arial">{grp}</text>')
    x = 1080
    svg.append(f'<text x="{x}" y="{leg_y}" font-size="12" fill="#495057" font-family="Segoe UI, Arial">'
               f'PK=clave primaria · UK=unica · FK=extranjera · linea punteada=sin FK</text>')

    doc = svg_doc(1520, 900, "\n".join(svg),
                  "DER — Sistema de Facturacion (14 tablas relacionales)",
                  "Amazon RDS: MySQL 8 (principal) u Oracle 19c (alternativa) — mismo modelo logico · fuente: frontend/src/domain.ts")
    with open(os.path.join(OUT, "DER-relacional.svg"), "w", encoding="utf-8") as f:
        f.write(doc)
    print("OK DER-relacional.svg")


# =============================================================================
# 2) Modelo DynamoDB (4 tablas, claves e indices)
# =============================================================================
def gen_dynamodb():
    svg = []
    boxes = {}

    def put(key, x, y, name, attrs, color, w=300):
        s, b = entity(x, y, name, attrs, color, w=w)
        svg.append(s)
        boxes[key] = b

    put("audit", 340, 60, "billing_audit_log", [
        ("PK", "entity_key  (HASH)"), ("SK", "event_ts  (RANGE)"), ("GSI", "feed_pk  (GSI feed)"),
        ("GSI", "user_id  (GSI user)"), ("", "action"), ("", "entity_type"), ("", "entity_id"), ("", "details {M}"),
    ], COLORS["aws"])
    put("events", 720, 60, "billing_invoice_event", [
        ("PK", "invoice_id  (HASH)"), ("SK", "event_ts  (RANGE)"), ("", "event_type"),
        ("", "from_status"), ("", "to_status"), ("", "user_id"), ("", "details {M}"),
    ], COLORS["aws"])
    put("sessions", 340, 370, "billing_user_session", [
        ("PK", "session_id  (HASH)"), ("GSI", "user_id  (GSI user_id-index)"), ("", "role"),
        ("", "customer_id"), ("", "created_at"), ("", "expires_at"), ("TTL", "ttl  (epoch seg)"),
    ], COLORS["aws2"])
    put("carts", 720, 370, "billing_invoice_cart", [
        ("PK", "user_id  (HASH)"), ("", "invoice_id"), ("", "customer_id"), ("", "items [L]"),
        ("", "step"), ("", "updated_at"), ("TTL", "ttl  (epoch seg)"),
    ], COLORS["aws2"])

    # Operaciones del frontend (columna izquierda) -> tabla/indice
    ops = [
        ("writeAudit() — cada mutacion · PutItem", 80, "audit", False),
        ("AuditPage feed global · Query GSI feed_pk", 124, "audit", True),
        ("Auditoria por usuario · Query GSI user_id", 168, "audit", True),
        ("Historial de UNA entidad · Query PK", 212, "audit", False),
        ("emitir / pagar / cancelar · PutItem", 282, "events", False),
        ("Timeline de la factura · Query PK", 326, "events", False),
        ("login / validar sesion · Put+GetItem", 402, "sessions", False),
        ("Revocar todas las sesiones · Query GSI", 446, "sessions", True),
        ("builderStore guardar · PutItem", 518, "carts", False),
        ("Reanudar / borrar carrito · Get+Delete", 562, "carts", False),
    ]
    for text, y, target, dashed in ops:
        # caja de operacion
        w, h = 280, 30
        svg.append(f'<rect x="20" y="{y}" width="{w}" height="{h}" rx="5" fill="#FFF4E6" stroke="#E8590C" stroke-width="1"/>')
        svg.append(f'<text x="30" y="{y + 19}" font-size="11" fill="#7C2D12" font-family="Segoe UI, Arial">{esc(text)}</text>')
        tb = boxes[target]
        p1 = (20 + w, y + h / 2)
        p2 = border_pt(tb, (p1[0] + 10, p1[1]))
        dash = ' stroke-dasharray="6 4"' if dashed else ""
        svg.append(f'<line x1="{p1[0]}" y1="{p1[1]}" x2="{p2[0]:.0f}" y2="{p2[1]:.0f}" '
                   f'stroke="#E8590C" stroke-width="1.3" marker-end="url(#arr)"{dash}/>')

    svg.append(f'<text x="20" y="42" font-size="12" font-weight="bold" fill="#212529" font-family="Segoe UI, Arial">'
               f'Operaciones del frontend</text>')
    svg.append(f'<text x="340" y="42" font-size="12" font-weight="bold" fill="#212529" font-family="Segoe UI, Arial">'
               f'Tablas DynamoDB (PK/SK/GSI/TTL)</text>')
    svg.append(f'<line x1="40" y1="630" x2="1080" y2="630" stroke="#DEE2E6"/>')
    svg.append(f'<text x="40" y="652" font-size="11.5" fill="#495057" font-family="Segoe UI, Arial">'
               f'Solido = acceso por clave principal · Punteado = acceso via GSI · Ninguna tabla replica datos del relacional (RDS)</text>')

    doc = svg_doc(1120, 680, "\n".join(svg),
                  "Amazon DynamoDB — 4 tablas NoSQL del Sistema de Facturacion",
                  "Diseno por patrones de acceso del frontend · auditoria, eventos de factura, sesiones TTL y carrito del wizard")
    with open(os.path.join(OUT, "modelo-dynamodb.svg"), "w", encoding="utf-8") as f:
        f.write(doc)
    print("OK modelo-dynamodb.svg")


# =============================================================================
# 3) Arquitectura general (frontend -> AWS)
# =============================================================================
def gen_arquitectura():
    svg = []

    def box(x, y, w, h, title, lines, fill, stroke, tcolor="#FFFFFF", tsize=14):
        svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" fill="{fill}" stroke="{stroke}" stroke-width="1.5"/>')
        svg.append(f'<text x="{x + w / 2}" y="{y + 22}" text-anchor="middle" font-size="{tsize}" font-weight="bold" '
                   f'fill="{tcolor}" font-family="Segoe UI, Arial">{esc(title)}</text>')
        ty = y + 42
        for ln in lines:
            svg.append(f'<text x="{x + w / 2}" y="{ty}" text-anchor="middle" font-size="11.5" '
                       f'fill="{tcolor}" font-family="Segoe UI, Arial">{esc(ln)}</text>')
            ty += 16

    def arrow(x1, y1, x2, y2, dashed=False):
        dash = ' stroke-dasharray="7 5"' if dashed else ""
        svg.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="#495057" '
                   f'stroke-width="1.8" marker-end="url(#arr)"{dash}/>')

    box(390, 70, 400, 64, "Frontend React (optativateam)",
        ["SPA: zustand + react-hook-form + zod · servicios con firmas API"], "#364FC7", "#364FC7")
    arrow(590, 134, 590, 166)
    box(390, 170, 400, 56, "Amazon API Gateway",
        ["endpoints REST + autorizacion por rol"], "#495057", "#495057")
    arrow(590, 226, 590, 262)
    box(390, 266, 400, 64, "AWS Lambda (Flask)",
        ["logica transaccional: folios, estados, impuestos, JWT"], "#212529", "#212529")

    # Grupo RDS
    svg.append(f'<rect x="60" y="400" width="500" height="240" rx="10" fill="#F8F9FA" '
               f'stroke="#364FC7" stroke-width="1.5" stroke-dasharray="8 5"/>')
    svg.append(f'<text x="310" y="424" text-anchor="middle" font-size="13" font-weight="bold" '
               f'fill="#364FC7" font-family="Segoe UI, Arial">Amazon RDS — modelo relacional (14 tablas)</text>')
    box(90, 440, 200, 78, "MySQL 8.0", ["motor PRINCIPAL", "RDS(MySQL)/"], "#FFFFFF", "#1864AB", tcolor="#1864AB", tsize=13)
    box(330, 440, 200, 78, "Oracle 19c", ["alternativa", "RDS(Oracle)/"], "#FFFFFF", "#862E9C", tcolor="#862E9C", tsize=13)
    svg.append(f'<text x="310" y="556" text-anchor="middle" font-size="11.5" fill="#495057" font-family="Segoe UI, Arial">'
               f'Se despliega UNO u otro (mismo modelo logico):</text>')
    svg.append(f'<text x="310" y="574" text-anchor="middle" font-size="11.5" fill="#495057" font-family="Segoe UI, Arial">'
               f'instancias separadas, sin JOINs entre motores</text>')
    svg.append(f'<text x="310" y="606" text-anchor="middle" font-size="11.5" font-weight="bold" fill="#212529" font-family="Segoe UI, Arial">'
               f'customers · users · catalogo · taxes · invoices · payments</text>')
    arrow(500, 330, 310, 400)
    label(svg, 430, 356, "transaccional (FKs, folios, totales)", size=11)

    # Grupo DynamoDB
    svg.append(f'<rect x="620" y="400" width="500" height="240" rx="10" fill="#FFF8F0" '
               f'stroke="#FF9900" stroke-width="1.5" stroke-dasharray="8 5"/>')
    svg.append(f'<text x="870" y="424" text-anchor="middle" font-size="13" font-weight="bold" '
               f'fill="#B45309" font-family="Segoe UI, Arial">Amazon DynamoDB — NoSQL (4 tablas)</text>')
    for (x, y, t, l1) in [(650, 440, "billing_audit_log", "auditoria · PK entity_key + SK event_ts · 2 GSI"),
                          (650, 505, "billing_invoice_event", "ciclo de vida por factura"),
                          (880, 440, "billing_user_session", "sesiones JWT · TTL 30 min"),
                          (880, 505, "billing_invoice_cart", "carrito del wizard · TTL")]:
        svg.append(f'<rect x="{x}" y="{y}" width="210" height="54" rx="6" fill="#FFFFFF" stroke="#FF9900" stroke-width="1.2"/>')
        svg.append(f'<text x="{x + 105}" y="{y + 20}" text-anchor="middle" font-size="11.5" font-weight="bold" '
                   f'fill="#B45309" font-family="Consolas, monospace">{esc(t)}</text>')
        svg.append(f'<text x="{x + 105}" y="{y + 40}" text-anchor="middle" font-size="10" '
                   f'fill="#495057" font-family="Segoe UI, Arial">{esc(l1)}</text>')
    svg.append(f'<text x="870" y="590" text-anchor="middle" font-size="11.5" fill="#495057" font-family="Segoe UI, Arial">'
               f'Sin FKs hacia RDS; sin duplicar datos del relacional</text>')
    arrow(680, 330, 870, 400)
    label(svg, 800, 356, "append-only / TTL", size=11)

    # Pie
    svg.append(f'<line x1="60" y1="680" x2="1120" y2="680" stroke="#DEE2E6"/>')
    svg.append(f'<text x="600" y="704" text-anchor="middle" font-size="11.5" fill="#868E96" font-family="Segoe UI, Arial">'
               f'Seguridad: VPC privada sin acceso publico · TLS · secretos en AWS Secrets Manager · permisos IAM minimos (ver README de cada carpeta)</text>')

    doc = svg_doc(1180, 730, "\n".join(svg),
                  "Arquitectura general — Frontend a AWS (RDS + DynamoDB)",
                  "RDS MySQL u Oracle (relacional, uno u otro) + DynamoDB (NoSQL) — fuentes: Diagramas/*.md y READMEs de cada carpeta")
    with open(os.path.join(OUT, "arquitectura-general.svg"), "w", encoding="utf-8") as f:
        f.write(doc)
    print("OK arquitectura-general.svg")


if __name__ == "__main__":
    gen_der()
    gen_dynamodb()
    gen_arquitectura()
    print("Diagramas generados en:", OUT)
