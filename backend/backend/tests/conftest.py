import datetime

import pytest

from app import audit, auth, cart, create_app
from app import repos
from app.domain import utcnow


@pytest.fixture()
def app():
    audit.reset_memory()
    cart.reset_memory()
    application = create_app(
        {
            "TESTING": True,
            "JWT_SECRET": "test-secret-0123456789-0123456789-ab",
            "AUDIT_BACKEND": "memory",
            "DEMO_PASSWORD": "demo1234",
            "ALLOW_DEMO_LOGIN": True,
        }
    )
    yield application


@pytest.fixture()
def client(app):
    return app.test_client()


def make_token(app, role="ADMIN", sub="usr_1", customer_id=None):
    claims = auth.build_claims(
        {
            "sub": sub,
            "email": f"{role.lower()}@test.local",
            "name": f"{role.title()} User",
            "role": role,
            "customer_id": customer_id,
            "ttl_ms": app.config["SESSION_TTL_MS"],
        }
    )
    return auth.encode_token(claims, app.config["JWT_SECRET"])


def auth_headers(app, role="ADMIN", sub="usr_1", customer_id=None):
    return {"Authorization": f"Bearer {make_token(app, role, sub, customer_id)}"}


class FakeStore:
    def __init__(self):
        self.users: dict[int, dict] = {}
        self.customers: dict[int, dict] = {}
        self.features: dict[int, dict] = {}
        self.services: dict[int, dict] = {}
        self.service_tax: dict[int, list[int]] = {}
        self.service_features: dict[int, list[dict]] = {}
        self.taxes: dict[int, dict] = {}
        self.tax_history: list[dict] = []
        self.issuer = {
            "id": 1,
            "legal_name": "Northwind Digital Services S.A. de C.V.",
            "tax_id": "NDS200115KX7",
            "address": "Reforma 250, Juárez, CDMX",
            "active": 1,
        }
        self.invoices: dict[int, dict] = {}
        self.details: dict[int, dict] = {}
        self.detail_taxes: dict[int, dict] = {}
        self.payments: dict[int, dict] = {}
        self.folios: dict[int, int] = {}
        self.seq = {
            "usr": 1,
            "cus": 1,
            "feat": 1,
            "svc": 1,
            "tax": 1,
            "txh": 1,
            "inv": 1,
            "det": 1,
            "dtax": 1,
            "pay": 1,
        }

    def _next(self, key: str) -> int:
        value = self.seq[key]
        self.seq[key] += 1
        return value

    def seed_minimal(self):
        self.taxes[1] = {"id": 1, "code": "VAT16", "name": "VAT", "current_rate": 0.16, "active": 1}
        self.tax_history.append(
            {"id": 1, "tax_id": 1, "rate": 0.16, "valid_from": datetime.date(2020, 1, 1), "valid_to": None}
        )
        self.customers[1] = {
            "id": 1,
            "name": "Grupo Alameda Logística S.A. de C.V.",
            "tax_id": "GAL860415HX3",
            "email": "billing@alameda.example",
            "phone": "+52 55 1234 5678",
            "address": "Calzada de las Bombas 120, Coyoacán, CDMX",
            "active": 1,
        }
        self.customers[2] = {
            "id": 2,
            "name": "Cliente Inactivo S.A.",
            "tax_id": "INA000000XX1",
            "email": "inactive@example.test",
            "phone": None,
            "address": "Dirección inactiva",
            "active": 0,
        }
        self.services[1] = {
            "id": 1,
            "code": "CLD-0001",
            "name": "Managed Kubernetes Cluster",
            "description": "Clúster K8s administrado.",
            "base_price": 4500.0,
            "category": "Cloud Infrastructure",
            "active": 1,
        }
        self.services[2] = {
            "id": 2,
            "code": "LIC-0002",
            "name": "Endpoint Antivirus License",
            "description": "Licencia mensual.",
            "base_price": 180.0,
            "category": "Software Licenses",
            "active": 0,
        }
        self.service_tax[1] = [1]
        self.service_tax[2] = [1]
        self.seq["tax"] = 2
        self.seq["txh"] = 2
        self.seq["cus"] = 3
        self.seq["svc"] = 3

    def add_invoice(self, status="DRAFT", customer_id=1, total=100.0, subtotal=100.0, tax_total=0.0,
                    created_at=None, issued_at=None, paid_at=None):
        invoice_id = self._next("inv")
        now = utcnow()
        self.invoices[invoice_id] = {
            "id": invoice_id,
            "uuid": None,
            "folio": None,
            "issuer_id": 1,
            "customer_id": customer_id,
            "created_by": 1,
            "status": status,
            "receiver_name": "Receptor",
            "receiver_tax_id": "RFC12345678",
            "receiver_address": "Dirección",
            "subtotal": subtotal,
            "tax_total": tax_total,
            "total": total,
            "created_at": created_at or now,
            "issued_at": issued_at,
            "paid_at": paid_at,
            "cancelled_at": None,
            "cancellation_reason": None,
        }
        return invoice_id

    def install(self, monkeypatch):
        store = self

        def find_user_by_login(email):
            email = email.lower()
            for row in store.users.values():
                if row["email"].lower() == email:
                    return dict(row)
            return None

        def find_user(user_id):
            row = store.users.get(user_id)
            return dict(row) if row else None

        def list_users():
            return [dict(row) for row in store.users.values()]

        def user_email_taken(email, exclude_id=0):
            return any(
                row["email"].lower() == email.lower() and row["id"] != exclude_id for row in store.users.values()
            )

        def insert_user(email, password_hash, full_name, role, customer_id, active):
            user_id = store._next("usr")
            store.users[user_id] = {
                "id": user_id,
                "email": email,
                "password_hash": password_hash,
                "full_name": full_name,
                "role": role,
                "customer_id": customer_id,
                "active": int(active),
            }
            return user_id

        def update_user(user_id, email, full_name, role, customer_id, active):
            store.users[user_id].update(
                {
                    "email": email,
                    "full_name": full_name,
                    "role": role,
                    "customer_id": customer_id,
                    "active": int(active),
                }
            )
            return 1

        def list_customers():
            return [dict(row) for row in store.customers.values()]

        def find_customer(customer_id):
            row = store.customers.get(customer_id)
            return dict(row) if row else None

        def customer_tax_taken(tax_id, exclude_id=0):
            return any(row["tax_id"] == tax_id and row["id"] != exclude_id for row in store.customers.values())

        def customer_email_taken(email, exclude_id=0):
            return any(
                row["email"].lower() == email.lower() and row["id"] != exclude_id for row in store.customers.values()
            )

        def insert_customer(name, tax_id, email, phone, address, active):
            customer_id = store._next("cus")
            store.customers[customer_id] = {
                "id": customer_id,
                "name": name,
                "tax_id": tax_id,
                "email": email,
                "phone": phone,
                "address": address,
                "active": int(active),
            }
            return customer_id

        def update_customer(customer_id, name, tax_id, email, phone, address, active):
            store.customers[customer_id].update(
                {
                    "name": name,
                    "tax_id": tax_id,
                    "email": email,
                    "phone": phone,
                    "address": address,
                    "active": int(active),
                }
            )
            return 1

        def get_issuer():
            return dict(store.issuer) if store.issuer else None

        def ensure_issuer(legal_name, tax_id, address):
            store.issuer = {
                "id": 1,
                "legal_name": legal_name,
                "tax_id": tax_id,
                "address": address,
                "active": 1,
            }
            return dict(store.issuer)

        def list_taxes():
            return [dict(row) for row in store.taxes.values()]

        def find_tax(tax_id):
            row = store.taxes.get(tax_id)
            return dict(row) if row else None

        def list_tax_history():
            return sorted(
                (dict(row) for row in store.tax_history),
                key=lambda r: (r["tax_id"], str(r["valid_from"]), r["id"]),
            )

        def tax_history_for(tax_id):
            rows = [dict(row) for row in store.tax_history if row["tax_id"] == tax_id]
            return sorted(rows, key=lambda r: (str(r["valid_from"]), r["id"]))

        def open_tax_period(tax_id):
            rows = [row for row in store.tax_history if row["tax_id"] == tax_id and row["valid_to"] is None]
            if not rows:
                return None
            return dict(sorted(rows, key=lambda r: str(r["valid_from"]))[0])

        def close_tax_period(tax_id, valid_to):
            count = 0
            for row in store.tax_history:
                if row["tax_id"] == tax_id and row["valid_to"] is None:
                    row["valid_to"] = valid_to
                    count += 1
            return count

        def insert_tax_history(tax_id, rate, valid_from, changed_by):
            entry_id = store._next("txh")
            store.tax_history.append(
                {
                    "id": entry_id,
                    "tax_id": tax_id,
                    "rate": rate,
                    "valid_from": valid_from,
                    "valid_to": None,
                    "changed_by": changed_by,
                }
            )
            return entry_id

        def update_tax_current_rate(tax_id, rate):
            store.taxes[tax_id]["current_rate"] = rate
            return 1

        def list_services():
            return [dict(row) for row in store.services.values()]

        def find_service(service_id):
            row = store.services.get(service_id)
            return dict(row) if row else None

        def service_code_taken(code, exclude_id=0):
            return any(
                row["code"].lower() == code.lower() and row["id"] != exclude_id for row in store.services.values()
            )

        def insert_service(code, name, description, base_price, category, active):
            service_id = store._next("svc")
            store.services[service_id] = {
                "id": service_id,
                "code": code,
                "name": name,
                "description": description,
                "base_price": base_price,
                "category": category,
                "active": int(active),
            }
            return service_id

        def update_service(service_id, code, name, description, base_price, category, active):
            store.services[service_id].update(
                {
                    "code": code,
                    "name": name,
                    "description": description,
                    "base_price": base_price,
                    "category": category,
                    "active": int(active),
                }
            )
            return 1

        def replace_service_taxes(service_id, tax_ids):
            store.service_tax[service_id] = list(tax_ids)

        def list_service_tax_ids(service_id):
            return list(store.service_tax.get(service_id, []))

        def service_tax_map(service_ids):
            return {sid: list(store.service_tax.get(sid, [])) for sid in service_ids}

        def replace_service_features(service_id, features):
            store.service_features[service_id] = [
                {"feature_id": feature_id, "value": value} for feature_id, value in features
            ]

        def service_feature_map(service_ids):
            return {sid: list(store.service_features.get(sid, [])) for sid in service_ids}

        def list_features():
            return [dict(row) for row in store.features.values()]

        def find_feature(feature_id):
            row = store.features.get(feature_id)
            return dict(row) if row else None

        def feature_name_taken(name, exclude_id=0):
            return any(
                row["name"].lower() == name.lower() and row["id"] != exclude_id for row in store.features.values()
            )

        def insert_feature(name, description, unit):
            feature_id = store._next("feat")
            store.features[feature_id] = {
                "id": feature_id,
                "name": name,
                "description": description,
                "unit": unit,
            }
            return feature_id

        def update_feature(feature_id, name, description, unit):
            store.features[feature_id].update({"name": name, "description": description, "unit": unit})
            return 1

        def feature_usage_count(feature_id):
            return sum(
                1
                for values in store.service_features.values()
                for item in values
                if item["feature_id"] == feature_id
            )

        def delete_feature(feature_id):
            store.features.pop(feature_id, None)
            return 1

        def list_invoices():
            return sorted(
                (dict(row) for row in store.invoices.values()),
                key=lambda r: (r["created_at"], r["id"]),
                reverse=True,
            )

        def list_invoices_for_customer(customer_id):
            return [
                row
                for row in list_invoices()
                if row["customer_id"] == customer_id and row["status"] != "DRAFT"
            ]

        def find_invoice(invoice_id):
            row = store.invoices.get(invoice_id)
            return dict(row) if row else None

        def insert_invoice(issuer_id, customer_id, created_by, receiver_name, receiver_tax_id,
                           receiver_address, subtotal, tax_total, total, created_at):
            invoice_id = store._next("inv")
            store.invoices[invoice_id] = {
                "id": invoice_id,
                "uuid": None,
                "folio": None,
                "issuer_id": issuer_id,
                "customer_id": customer_id,
                "created_by": created_by,
                "status": "DRAFT",
                "receiver_name": receiver_name,
                "receiver_tax_id": receiver_tax_id,
                "receiver_address": receiver_address,
                "subtotal": subtotal,
                "tax_total": tax_total,
                "total": total,
                "created_at": created_at,
                "issued_at": None,
                "paid_at": None,
                "cancelled_at": None,
                "cancellation_reason": None,
            }
            return invoice_id

        def update_invoice_draft(invoice_id, customer_id, receiver_name, receiver_tax_id,
                                 receiver_address, subtotal, tax_total, total):
            store.invoices[invoice_id].update(
                {
                    "customer_id": customer_id,
                    "receiver_name": receiver_name,
                    "receiver_tax_id": receiver_tax_id,
                    "receiver_address": receiver_address,
                    "subtotal": subtotal,
                    "tax_total": tax_total,
                    "total": total,
                }
            )
            return 1

        def set_invoice_totals(invoice_id, subtotal, tax_total, total):
            store.invoices[invoice_id].update(
                {"subtotal": subtotal, "tax_total": tax_total, "total": total}
            )
            return 1

        def set_invoice_issued(invoice_id, folio, uuid, issued_at):
            store.invoices[invoice_id].update(
                {"status": "ISSUED", "folio": folio, "uuid": uuid, "issued_at": issued_at}
            )
            return 1

        def set_invoice_cancelled(invoice_id, cancelled_at, reason):
            store.invoices[invoice_id].update(
                {
                    "status": "CANCELLED",
                    "cancelled_at": cancelled_at,
                    "cancellation_reason": reason,
                }
            )
            return 1

        def set_invoice_paid(invoice_id, paid_at):
            store.invoices[invoice_id].update({"status": "PAID", "paid_at": paid_at})
            return 1

        def delete_invoice(invoice_id):
            detail_ids = [d["id"] for d in store.details.values() if d["invoice_id"] == invoice_id]
            for detail_id in detail_ids:
                store.details.pop(detail_id, None)
                for dtax_id, row in list(store.detail_taxes.items()):
                    if row["invoice_detail_id"] == detail_id:
                        store.detail_taxes.pop(dtax_id, None)
            store.invoices.pop(invoice_id, None)
            return 1

        def details_for(invoice_ids):
            wanted = set(invoice_ids)
            rows = [dict(row) for row in store.details.values() if row["invoice_id"] in wanted]
            return sorted(rows, key=lambda r: (r["invoice_id"], r["id"]))

        def detail_taxes_for(detail_ids):
            wanted = set(detail_ids)
            rows = []
            for row in store.detail_taxes.values():
                if row["invoice_detail_id"] in wanted:
                    item = dict(row)
                    item["code"] = row["tax_code"]  # snapshot, igual que el SQL real
                    rows.append(item)
            return sorted(rows, key=lambda r: r["id"])

        def delete_details(invoice_id):
            for detail_id, detail in list(store.details.items()):
                if detail["invoice_id"] == invoice_id:
                    store.details.pop(detail_id, None)
                    for dtax_id, row in list(store.detail_taxes.items()):
                        if row["invoice_detail_id"] == detail_id:
                            store.detail_taxes.pop(dtax_id, None)

        def insert_detail(invoice_id, service_id, service_name, quantity, unit_price,
                          line_subtotal, tax_amount, line_total):
            detail_id = store._next("det")
            store.details[detail_id] = {
                "id": detail_id,
                "invoice_id": invoice_id,
                "service_id": service_id,
                "service_name": service_name,
                "quantity": quantity,
                "unit_price": unit_price,
                "line_subtotal": line_subtotal,
                "tax_amount": tax_amount,
                "line_total": line_total,
            }
            return detail_id

        def insert_detail_tax(detail_id, tax_id, rate, amount, tax_code, tax_name):
            entry_id = store._next("dtax")
            store.detail_taxes[entry_id] = {
                "id": entry_id,
                "invoice_detail_id": detail_id,
                "tax_id": tax_id,
                "tax_code": tax_code,
                "tax_name": tax_name,
                "rate": rate,
                "amount": amount,
            }
            return entry_id

        def update_detail_amounts(detail_id, line_subtotal, tax_amount, line_total):
            store.details[detail_id].update(
                {"line_subtotal": line_subtotal, "tax_amount": tax_amount, "line_total": line_total}
            )
            return 1

        def delete_detail_taxes(detail_id):
            for entry_id, row in list(store.detail_taxes.items()):
                if row["invoice_detail_id"] == detail_id:
                    store.detail_taxes.pop(entry_id, None)

        def next_folio(year):
            current = store.folios.get(year, 0) + 1
            store.folios[year] = current
            return current

        def list_payments(invoice_id):
            rows = [dict(row) for row in store.payments.values() if row["invoice_id"] == invoice_id]
            return sorted(rows, key=lambda r: r["id"])

        def count_payments(invoice_id):
            return len(list_payments(invoice_id))

        def insert_payment(invoice_id, method, amount, reference, paid_at, registered_by):
            payment_id = store._next("pay")
            store.payments[payment_id] = {
                "id": payment_id,
                "invoice_id": invoice_id,
                "method": method,
                "amount": amount,
                "reference": reference,
                "paid_at": paid_at,
                "registered_by": registered_by,
            }
            return payment_id

        def fetch_labels(kind, db_ids):
            wanted = set(db_ids)
            if kind == "user":
                return {row["id"]: row["full_name"] for row in store.users.values() if row["id"] in wanted}
            if kind == "customer":
                return {row["id"]: row["name"] for row in store.customers.values() if row["id"] in wanted}
            if kind == "service":
                return {row["id"]: row["name"] for row in store.services.values() if row["id"] in wanted}
            if kind == "feature":
                return {row["id"]: row["name"] for row in store.features.values() if row["id"] in wanted}
            if kind == "tax":
                return {row["id"]: row["code"] for row in store.taxes.values() if row["id"] in wanted}
            if kind == "invoice":
                return {
                    row["id"]: (row["folio"] or "Draft invoice")
                    for row in store.invoices.values()
                    if row["id"] in wanted
                }
            return {}

        mapping = {
            "find_user_by_login": find_user_by_login,
            "find_user": find_user,
            "list_users": list_users,
            "user_email_taken": user_email_taken,
            "insert_user": insert_user,
            "update_user": update_user,
            "list_customers": list_customers,
            "find_customer": find_customer,
            "customer_tax_taken": customer_tax_taken,
            "customer_email_taken": customer_email_taken,
            "insert_customer": insert_customer,
            "update_customer": update_customer,
            "get_issuer": get_issuer,
            "ensure_issuer": ensure_issuer,
            "list_taxes": list_taxes,
            "find_tax": find_tax,
            "list_tax_history": list_tax_history,
            "tax_history_for": tax_history_for,
            "open_tax_period": open_tax_period,
            "close_tax_period": close_tax_period,
            "insert_tax_history": insert_tax_history,
            "update_tax_current_rate": update_tax_current_rate,
            "list_services": list_services,
            "find_service": find_service,
            "service_code_taken": service_code_taken,
            "insert_service": insert_service,
            "update_service": update_service,
            "replace_service_taxes": replace_service_taxes,
            "list_service_tax_ids": list_service_tax_ids,
            "service_tax_map": service_tax_map,
            "replace_service_features": replace_service_features,
            "service_feature_map": service_feature_map,
            "list_features": list_features,
            "find_feature": find_feature,
            "feature_name_taken": feature_name_taken,
            "insert_feature": insert_feature,
            "update_feature": update_feature,
            "feature_usage_count": feature_usage_count,
            "delete_feature": delete_feature,
            "list_invoices": list_invoices,
            "list_invoices_for_customer": list_invoices_for_customer,
            "find_invoice": find_invoice,
            "find_invoice_for_update": find_invoice,
            "insert_invoice": insert_invoice,
            "update_invoice_draft": update_invoice_draft,
            "set_invoice_totals": set_invoice_totals,
            "set_invoice_issued": set_invoice_issued,
            "set_invoice_cancelled": set_invoice_cancelled,
            "set_invoice_paid": set_invoice_paid,
            "delete_invoice": delete_invoice,
            "details_for": details_for,
            "detail_taxes_for": detail_taxes_for,
            "delete_details": delete_details,
            "insert_detail": insert_detail,
            "insert_detail_tax": insert_detail_tax,
            "update_detail_amounts": update_detail_amounts,
            "delete_detail_taxes": delete_detail_taxes,
            "next_folio": next_folio,
            "list_payments": list_payments,
            "count_payments": count_payments,
            "insert_payment": insert_payment,
            "fetch_labels": fetch_labels,
        }
        for name, function in mapping.items():
            monkeypatch.setattr(repos, name, function)


@pytest.fixture()
def store(monkeypatch):
    fake = FakeStore()
    fake.seed_minimal()
    fake.install(monkeypatch)
    return fake
