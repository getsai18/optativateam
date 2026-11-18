"""Genera los scripts DML de datos sintéticos (deterministas, semilla fija).

    python database/seed/generate_seed.py

Escribe:
    database/postgres/04_seed_catalog.sql   100 servicios, 50 características, asignaciones e impuestos
    database/mysql/04_seed_customers.sql    40 clientes y reglas de descuento por cliente

Los scripts son idempotentes (ON CONFLICT / ON DUPLICATE KEY) y se aplican con
    python database/apply.py --seed
"""

from __future__ import annotations

import random
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
rng = random.Random(20261117)


def q(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


# ---------------------------------------------------------------------------
# Características (50). Las 5 primeras ya existen en la base.
# ---------------------------------------------------------------------------
FEATURES = [
    ("Storage", "Almacenamiento incluido en el plan", "GB"),
    ("Support hours", "Horas de soporte técnico incluidas", "horas"),
    ("Uptime SLA", "Disponibilidad mensual garantizada", "%"),
    ("Users", "Usuarios o licencias incluidas", "usuarios"),
    ("Delivery time", "Tiempo estimado de entrega", "dias"),
    ("vCPU", "Núcleos de procesamiento virtual", "vCPU"),
    ("RAM", "Memoria RAM asignada", "GB"),
    ("Bandwidth", "Transferencia de datos mensual incluida", "TB"),
    ("Backups", "Frecuencia de respaldos automáticos", "por dia"),
    ("Backup retention", "Días que se conservan los respaldos", "dias"),
    ("Regions", "Regiones de despliegue disponibles", "regiones"),
    ("IP addresses", "Direcciones IP públicas incluidas", "IPs"),
    ("Load balancer", "Balanceador de carga incluido", "unidades"),
    ("CDN", "Red de distribución de contenido", "incluido"),
    ("Response time", "Tiempo máximo de primera respuesta", "horas"),
    ("Support channel", "Canales de atención disponibles", "canal"),
    ("Coverage", "Horario de cobertura del servicio", "horario"),
    ("On-site visits", "Visitas presenciales al mes", "visitas"),
    ("Dedicated engineer", "Ingeniero asignado a la cuenta", "personas"),
    ("License term", "Vigencia de la licencia", "meses"),
    ("Devices per user", "Dispositivos permitidos por usuario", "dispositivos"),
    ("Updates", "Actualizaciones incluidas durante la vigencia", "incluido"),
    ("API calls", "Llamadas a la API incluidas al mes", "miles"),
    ("Integrations", "Integraciones con sistemas de terceros", "integraciones"),
    ("Consulting hours", "Horas de consultoría incluidas", "horas"),
    ("Deliverables", "Entregables documentados", "documentos"),
    ("Workshops", "Talleres con el equipo del cliente", "talleres"),
    ("Training hours", "Horas de capacitación", "horas"),
    ("Participants", "Participantes por grupo", "personas"),
    ("Certification", "Certificado de participación o examen", "incluido"),
    ("Course format", "Modalidad del curso", "modalidad"),
    ("Materials", "Material didáctico incluido", "incluido"),
    ("Scan frequency", "Frecuencia de escaneos de vulnerabilidades", "por mes"),
    ("Encryption", "Cifrado de datos en reposo y en tránsito", "algoritmo"),
    ("Compliance", "Marcos de cumplimiento cubiertos", "marco"),
    ("Monitored endpoints", "Equipos monitoreados", "equipos"),
    ("Incident response", "Tiempo de respuesta ante incidentes", "horas"),
    ("Pentest scope", "Activos incluidos en la prueba de penetración", "activos"),
    ("Data sources", "Fuentes de datos integradas", "fuentes"),
    ("Dashboards", "Tableros de indicadores incluidos", "tableros"),
    ("Data volume", "Volumen de datos procesado al mes", "GB"),
    ("Refresh rate", "Frecuencia de actualización de datos", "minutos"),
    ("ML models", "Modelos predictivos incluidos", "modelos"),
    ("Sprints", "Iteraciones de desarrollo incluidas", "sprints"),
    ("Developers", "Desarrolladores asignados", "personas"),
    ("Code warranty", "Garantía sobre defectos del código", "meses"),
    ("Environments", "Ambientes de despliegue (dev, qa, prod)", "ambientes"),
    ("Test coverage", "Cobertura mínima de pruebas automatizadas", "%"),
    ("Source code", "Entrega del código fuente", "incluido"),
    ("Documentation", "Documentación técnica y manual de usuario", "incluido"),
]
assert len(FEATURES) == 50

# ---------------------------------------------------------------------------
# Servicios por categoría: (prefijo, [(nombre, descripción, precio base)], características)
# ---------------------------------------------------------------------------
TIERS = [("Basic", 1.0), ("Standard", 1.8), ("Pro", 3.2), ("Enterprise", 6.0)]

CATEGORIES = {
    "Cloud Infrastructure": ("CLD", [
        ("Cloud Hosting", "Servidor virtual administrado con respaldo diario.", 1200),
        ("Managed Database", "Base de datos administrada con alta disponibilidad.", 1800),
        ("Object Storage", "Almacenamiento de objetos con replicación.", 450),
        ("Kubernetes Cluster", "Clúster de contenedores administrado.", 3500),
    ], ["vCPU", "RAM", "Storage", "Bandwidth", "Backups", "Backup retention", "Regions", "IP addresses",
        "Load balancer", "CDN", "Uptime SLA"]),
    "Software Licenses": ("LIC", [
        ("Productivity Suite", "Licencia por usuario de la suite de productividad.", 2450),
        ("ERP License", "Licencia del sistema de planeación de recursos.", 5200),
        ("CRM License", "Licencia de gestión de relaciones con clientes.", 1900),
    ], ["Users", "License term", "Devices per user", "Updates", "Storage", "Integrations", "API calls"]),
    "Support & Maintenance": ("SUP", [
        ("Support Plan", "Soporte técnico con niveles de servicio.", 3800),
        ("Preventive Maintenance", "Mantenimiento preventivo de infraestructura.", 2600),
        ("Helpdesk Service", "Mesa de ayuda para usuarios finales.", 2100),
    ], ["Support hours", "Response time", "Support channel", "Coverage", "On-site visits", "Dedicated engineer",
        "Uptime SLA"]),
    "Consulting": ("CON", [
        ("IT Consulting", "Consultoría técnica especializada.", 950),
        ("Cloud Migration Assessment", "Evaluación de migración a la nube.", 12500),
        ("Digital Strategy", "Consultoría de estrategia de transformación digital.", 18000),
    ], ["Consulting hours", "Deliverables", "Workshops", "Delivery time", "Dedicated engineer", "Documentation"]),
    "Training": ("TRN", [
        ("Cloud Fundamentals Course", "Curso de fundamentos de cómputo en la nube.", 4200),
        ("Cybersecurity Awareness", "Capacitación en concientización de seguridad.", 2800),
        ("Data Analysis Bootcamp", "Programa intensivo de análisis de datos.", 9500),
    ], ["Training hours", "Participants", "Certification", "Course format", "Materials", "Delivery time"]),
    "Security": ("SEC", [
        ("Security Audit", "Auditoría de seguridad con reporte de hallazgos.", 8500),
        ("Vulnerability Scanning", "Escaneo periódico de vulnerabilidades.", 3200),
        ("Managed Firewall", "Firewall administrado con monitoreo.", 4100),
        ("Penetration Test", "Prueba de penetración de aplicaciones e infraestructura.", 15000),
    ], ["Scan frequency", "Encryption", "Compliance", "Monitored endpoints", "Incident response", "Pentest scope",
        "Coverage"]),
    "Data & Analytics": ("DAT", [
        ("BI Dashboard", "Tableros de inteligencia de negocio.", 5400),
        ("Data Warehouse", "Almacén de datos administrado.", 7800),
        ("Predictive Analytics", "Modelos predictivos sobre datos del cliente.", 13500),
    ], ["Data sources", "Dashboards", "Data volume", "Refresh rate", "ML models", "Storage", "Users"]),
    "Development": ("DEV", [
        ("Web Application", "Desarrollo de aplicación web a la medida.", 25000),
        ("Mobile App", "Desarrollo de aplicación móvil.", 32000),
        ("API Integration", "Desarrollo de integración entre sistemas.", 11000),
    ], ["Sprints", "Developers", "Code warranty", "Environments", "Test coverage", "Source code", "Documentation",
        "Delivery time"]),
}

VALUE_RANGES = {
    "%": ["99.5", "99.9", "99.95", "99.99"],
    "incluido": ["Sí"],
    "horario": ["8x5", "12x5", "24x7"],
    "canal": ["Correo", "Correo y chat", "Correo, chat y teléfono"],
    "algoritmo": ["AES-128", "AES-256"],
    "marco": ["ISO 27001", "PCI-DSS", "SOC 2", "ISO 27001 y SOC 2"],
    "modalidad": ["En línea", "Presencial", "Híbrido"],
}


def feature_value(unit: str, tier_factor: float) -> str:
    if unit in VALUE_RANGES:
        options = VALUE_RANGES[unit]
        index = min(len(options) - 1, int(tier_factor // 1.8))
        return options[index]
    base = rng.choice([1, 2, 4, 5, 10, 20, 50, 100])
    return str(max(1, int(round(base * tier_factor))))


def build_services():
    services = []
    for category, (prefix, products, _features) in CATEGORIES.items():
        number = 101
        for product, description, price in products:
            for tier, factor in TIERS:
                services.append({
                    "code": f"{prefix}-{number:04d}",
                    "name": f"{product} {tier}",
                    "description": f"{description} Plan {tier}.",
                    "price": round(price * factor, 2),
                    "category": category,
                    "tier_factor": factor,
                })
                number += 1
    return services


SERVICES = build_services()
assert len(SERVICES) >= 100, len(SERVICES)


def write_catalog() -> None:
    out = [
        "-- =============================================================================",
        "-- Datos sintéticos del catálogo (RDS PostgreSQL). GENERADO por database/seed/generate_seed.py",
        f"-- {len(SERVICES)} servicios, {len(FEATURES)} características, asignaciones e impuestos.",
        "-- Idempotente: se puede ejecutar varias veces.",
        "-- =============================================================================",
        "",
        "-- Limpia el servicio de prueba (id 1) que quedó con datos basura",
        "UPDATE service SET code = 'CON-0001', name = 'Technical Advisory Hour',",
        "       description = 'Hora de asesoría técnica remota.', category = 'Consulting'",
        " WHERE id = 1 AND code = 'EWE';",
        "",
        "-- Características",
        "INSERT INTO feature (name, description, unit) VALUES",
    ]
    out.append(",\n".join(f"    ({q(n)}, {q(d)}, {q(u)})" for n, d, u in FEATURES))
    out.append("ON CONFLICT (name) DO NOTHING;\n")

    out.append("-- Servicios (el trigger trg_service_price_audit registra el precio inicial)")
    out.append("INSERT INTO service (code, name, description, base_price, category, active) VALUES")
    out.append(",\n".join(
        f"    ({q(s['code'])}, {q(s['name'])}, {q(s['description'])}, {s['price']:.2f}, {q(s['category'])}, 1)"
        for s in SERVICES))
    out.append("ON CONFLICT (code) DO NOTHING;\n")

    units = {n: u for n, _d, u in FEATURES}
    rows = []
    for s in SERVICES:
        pool = CATEGORIES[s["category"]][2]
        for feature in rng.sample(pool, k=min(len(pool), rng.randint(3, 5))):
            rows.append((s["code"], feature, feature_value(units[feature], s["tier_factor"])))
    out.append("-- Características por servicio")
    out.append("INSERT INTO service_feature (service_id, feature_id, value)")
    out.append("SELECT s.id, f.id, v.value FROM (VALUES")
    out.append(",\n".join(f"    ({q(c)}, {q(f)}, {q(v)})" for c, f, v in rows))
    out.append(") AS v(code, feature, value)")
    out.append("JOIN service s ON s.code = v.code")
    out.append("JOIN feature f ON f.name = v.feature")
    out.append("ON CONFLICT (service_id, feature_id) DO NOTHING;\n")

    out.append("-- Asignación masiva con el SP (requisito 9 de la rúbrica)")
    out.append("DO $$")
    out.append("DECLARE v_services INTEGER[]; v_features INTEGER[]; v_count INTEGER;")
    out.append("BEGIN")
    out.append("    SELECT array_agg(id) INTO v_services FROM service WHERE category = 'Security';")
    out.append("    SELECT array_agg(id) INTO v_features FROM feature WHERE name = 'Encryption';")
    out.append("    CALL sp_bulk_assign_features(v_services, v_features, 'AES-256', v_count);")
    out.append("    SELECT array_agg(id) INTO v_services FROM service WHERE category IN ('Development', 'Consulting');")
    out.append("    SELECT array_agg(id) INTO v_features FROM feature WHERE name = 'Documentation';")
    out.append("    CALL sp_bulk_assign_features(v_services, v_features, 'Sí', v_count);")
    out.append("END $$;\n")

    out.append("-- Impuestos: IVA 16 % a todo; Training exento (IVA 0 %);")
    out.append("-- Consulting con retenciones de ISR e IVA (servicios profesionales).")
    out.append("INSERT INTO service_tax (service_id, tax_id)")
    out.append("SELECT s.id, t.id FROM service s JOIN tax t ON t.code = CASE WHEN s.category = 'Training'")
    out.append("                                                         THEN 'VAT0' ELSE 'VAT16' END")
    out.append("WHERE NOT EXISTS (SELECT 1 FROM service_tax x WHERE x.service_id = s.id)")
    out.append("ON CONFLICT DO NOTHING;")
    out.append("INSERT INTO service_tax (service_id, tax_id)")
    out.append("SELECT s.id, t.id FROM service s CROSS JOIN tax t")
    out.append("WHERE s.category = 'Consulting' AND t.code IN ('RET_ISR', 'RET_IVA')")
    out.append("ON CONFLICT DO NOTHING;")

    (ROOT / "postgres" / "04_seed_catalog.sql").write_text("\n".join(out) + "\n", encoding="utf-8")


# ---------------------------------------------------------------------------
# Clientes (MySQL)
# ---------------------------------------------------------------------------
COMPANIES = [
    ("Aurora Textiles", "S.A. de C.V."), ("Bosque Verde Alimentos", "S.A. de C.V."),
    ("Cumbre Ingeniería", "S.C."), ("Dinamo Energía", "S.A.P.I. de C.V."), ("Eje Norte Transportes", "S.A. de C.V."),
    ("Faro Seguros", "S.A."), ("Granito Construcciones", "S.A. de C.V."), ("Horizonte Farmacéutica", "S.A. de C.V."),
    ("Ícaro Aeroservicios", "S.A. de C.V."), ("Jade Hoteles", "S.A. de C.V."), ("Kappa Laboratorios", "S.C."),
    ("Lumen Iluminación", "S.A. de C.V."), ("Marea Pesquera", "S. de R.L."), ("Nube Azul Telecom", "S.A.P.I. de C.V."),
    ("Olivo Restaurantes", "S.A. de C.V."), ("Pinar Muebles", "S.A. de C.V."), ("Quetzal Turismo", "S.A. de C.V."),
    ("Roble Despacho Contable", "S.C."), ("Sierra Minera", "S.A.B. de C.V."), ("Trébol Agroindustrial", "S.P.R. de R.L."),
    ("Umbral Arquitectos", "S.C."), ("Vértice Automotriz", "S.A. de C.V."), ("Wari Cosméticos", "S.A. de C.V."),
    ("Xólotl Editorial", "S.A. de C.V."), ("Yunque Metalúrgica", "S.A. de C.V."), ("Zafiro Joyería", "S.A. de C.V."),
    ("Altamira Hospital", "S.A. de C.V."), ("Brisa Inmobiliaria", "S.A. de C.V."), ("Cauce Hidráulica", "S.A. de C.V."),
    ("Delfín Logística Marítima", "S.A. de C.V."), ("Encino Universidad", "A.C."), ("Fénix Reciclaje", "S.A. de C.V."),
    ("Girasol Guarderías", "S.C."), ("Halcón Seguridad Privada", "S.A. de C.V."), ("Iris Óptica", "S.A. de C.V."),
    ("Jaguar Deportes", "S.A. de C.V."), ("Kiosko Digital", "S.A.P.I. de C.V."), ("Laguna Bebidas", "S.A. de C.V."),
    ("Monarca Fundación", "A.C."), ("Nogal Abogados", "S.C."),
]
STREETS = ["Av. Insurgentes Sur", "Av. Revolución", "Calz. de Tlalpan", "Av. Constitución", "Blvd. Kukulcán",
           "Av. Juárez", "Av. Vallarta", "Paseo Montejo", "Av. Universidad", "Blvd. Díaz Ordaz"]
CITIES = ["Ciudad de México, CDMX", "Monterrey, N.L.", "Guadalajara, Jal.", "Mérida, Yuc.", "Puebla, Pue.",
          "Querétaro, Qro.", "Cuernavaca, Mor.", "Toluca, Edo. Méx.", "León, Gto.", "Tijuana, B.C."]


def rfc(name: str, index: int) -> str:
    letters = "".join(w[0] for w in name.upper().replace("Í", "I").replace("Ó", "O").replace("É", "E").split()[:3])
    letters = (letters + "XXX")[:3]
    year, month, day = rng.randint(95, 99) if index % 3 else rng.randint(0, 22), rng.randint(1, 12), rng.randint(1, 28)
    return f"{letters}{year:02d}{month:02d}{day:02d}{chr(65 + index % 26)}{index % 10}{chr(65 + (index * 7) % 26)}"


def write_customers() -> None:
    rows = []
    for index, (name, kind) in enumerate(COMPANIES):
        slug = name.lower().split()[0].translate(str.maketrans("áéíóúñ", "aeioun"))
        rows.append((
            f"{name} {kind}", rfc(name, index), f"facturacion@{slug}{index}.example",
            f"+52 {rng.randint(33, 999):03d} {rng.randint(100, 999)} {rng.randint(1000, 9999)}",
            f"{rng.choice(STREETS)} {rng.randint(10, 3999)}, {rng.choice(CITIES)}",
        ))
    out = [
        "-- =============================================================================",
        "-- Datos sintéticos de facturación (RDS MySQL). GENERADO por database/seed/generate_seed.py",
        f"-- {len(rows)} clientes y reglas de descuento por cliente. Idempotente.",
        "-- =============================================================================",
        "",
        "INSERT INTO customer (name, tax_id, email, phone, address, active) VALUES",
        ",\n".join(f"    ({q(n)}, {q(t)}, {q(e)}, {q(p)}, {q(a)}, 1)" for n, t, e, p, a in rows),
        "ON DUPLICATE KEY UPDATE id = id;",
        "",
        "-- Descuentos por cliente (además de las reglas de volumen de 03_rubrica_ext.sql)",
        "INSERT INTO discount_rule (name, customer_id, min_subtotal, pct)",
        "SELECT v.name, c.id, v.min_subtotal, v.pct",
        "  FROM (",
        f"        SELECT 'Convenio educativo' AS name, {q(rows[30][1])} AS tax_id, NULL AS min_subtotal, 0.0800 AS pct",
        f"        UNION ALL SELECT 'Cliente estratégico', {q(rows[3][1])}, 20000.00, 0.0600",
        f"        UNION ALL SELECT 'Fundación sin fines de lucro', {q(rows[38][1])}, NULL, 0.1000",
        "  ) v",
        "  JOIN customer c ON c.tax_id = v.tax_id",
        " WHERE NOT EXISTS (SELECT 1 FROM discount_rule d WHERE d.name = v.name);",
    ]
    (ROOT / "mysql" / "04_seed_customers.sql").write_text("\n".join(out) + "\n", encoding="utf-8")


if __name__ == "__main__":
    write_catalog()
    write_customers()
    print(f"OK: {len(SERVICES)} servicios, {len(FEATURES)} características, {len(COMPANIES)} clientes")
