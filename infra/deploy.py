"""Despliegue automático en AWS Academy Learner Lab (cuenta de aplicación).

    python infra/deploy.py                       # todo: build + stack + frontend
    python infra/deploy.py --profile learnerlab  # usa un perfil de ~/.aws/credentials
    python infra/deploy.py --skip-frontend       # solo backend / infraestructura
    python infra/deploy.py --frontend-only       # solo vuelve a publicar el frontend
    python infra/deploy.py --stage prod

Qué hace:
  1. Verifica que la cuenta sea de Learner Lab (existe el rol LabRole).
  2. Empaqueta las 4 Lambdas con dependencias para Linux x86_64 / Python 3.12 (sin Docker).
  3. Sube el paquete a un bucket de artefactos y despliega infra/template.yaml con CloudFormation
     (SAM transform): API Gateway, Lambdas con LabRole, EventBridge, DynamoDB y bucket S3.
  4. Compila el frontend con VITE_API_URL = URL de la API y lo publica en el bucket.

Credenciales de AWS: las temporales del Learner Lab (AWS Details -> AWS CLI), en
~/.aws/credentials o en variables AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_SESSION_TOKEN.
Credenciales de base de datos y JWT_SECRET: backend/.env (no se versiona).
Requisitos: AWS CLI v2, Python 3.10+, pip, Node 18+ y npm.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BUILD = ROOT / ".build"
TEMPLATE = ROOT / "infra" / "template.yaml"
PACKAGED = BUILD / "packaged.yaml"
ENV_FILE = ROOT / "backend" / ".env"

FUNCTIONS = {
    # nombre: (código fuente, archivos/carpetas a copiar, requirements)
    "api": (ROOT / "backend", ["app", "wsgi.py"], ROOT / "backend" / "requirements.txt"),
    "authorizer": (ROOT / "backend/functions/authorizer", ["handler.py"],
                   ROOT / "backend/functions/authorizer/requirements.txt"),
    "cart": (ROOT / "backend/functions/cart", ["handler.py"], None),  # boto3 ya viene en el runtime
    "tax_rate_sync": (ROOT / "backend/functions/tax_rate_sync", ["handler.py"],
                      ROOT / "backend/functions/tax_rate_sync/requirements.txt"),
}
# Ya incluidos en el runtime de Lambda: no se empaquetan para reducir el tamaño.
RUNTIME_PROVIDED = {"boto3", "botocore", "s3transfer", "jmespath", "python-dateutil", "six", "urllib3"}
REQUIRED_ENV = ["BILLING_DB_HOST", "BILLING_DB_NAME", "BILLING_DB_USER", "BILLING_DB_PASSWORD",
                "CATALOG_DB_HOST", "CATALOG_DB_NAME", "CATALOG_DB_USER", "CATALOG_DB_PASSWORD", "JWT_SECRET"]


def log(message: str) -> None:
    print(f"\n==> {message}", flush=True)


def run(cmd: list[str], *, cwd: Path | None = None, env: dict | None = None, capture: bool = False) -> str:
    shown = " ".join(cmd if len(cmd) < 12 else cmd[:12] + ["..."])
    print(f"    $ {shown}", flush=True)
    result = subprocess.run(
        cmd, cwd=cwd, env=env, text=True, shell=(os.name == "nt" and cmd[0] in ("npm", "npx")),
        stdout=subprocess.PIPE if capture else None,
    )
    if result.returncode != 0:
        sys.exit(f"Falló: {shown}")
    return result.stdout or ""


class Aws:
    def __init__(self, profile: str | None, region: str):
        self.base = ["aws", "--region", region]
        if profile:
            self.base += ["--profile", profile]
        self.region = region

    def json(self, *args: str) -> dict:
        out = run(self.base + list(args) + ["--output", "json"], capture=True)
        return json.loads(out) if out.strip() else {}

    def call(self, *args: str, quiet_fail: bool = False) -> bool:
        result = subprocess.run(self.base + list(args), capture_output=True, text=True)
        if result.returncode != 0 and not quiet_fail:
            sys.exit(f"Falló: aws {' '.join(args)}\n{result.stderr}")
        return result.returncode == 0

    def run(self, *args: str) -> None:
        run(self.base + list(args))


def load_env() -> dict[str, str]:
    from_file: dict[str, str] = {}
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                from_file[key.strip()] = value.strip().strip('"').strip("'")
    env = {**from_file, **{k: v for k, v in os.environ.items() if k in REQUIRED_ENV}}
    missing = [k for k in REQUIRED_ENV if not env.get(k)]
    if missing:
        sys.exit(f"Faltan variables en backend/.env: {', '.join(missing)}")
    if len(env["JWT_SECRET"]) < 32:
        sys.exit("JWT_SECRET debe tener al menos 32 caracteres.")
    return env


def check_learner_lab(aws: Aws, force: bool) -> str:
    log("Verificando cuenta AWS")
    identity = aws.json("sts", "get-caller-identity")
    account = identity["Account"]
    print(f"    cuenta {account} | {identity['Arn']}")
    if not aws.call("iam", "get-role", "--role-name", "LabRole", quiet_fail=True):
        if not force:
            sys.exit(
                "Esta cuenta no tiene el rol LabRole: no parece AWS Academy Learner Lab.\n"
                "Usa --profile con las credenciales del Learner Lab (o --force si sabes lo que haces)."
            )
        print("    AVISO: sin LabRole, se continúa por --force")
    return account


def build_functions() -> None:
    log("Empaquetando Lambdas (Linux x86_64, Python 3.12)")
    for name, (src, items, requirements) in FUNCTIONS.items():
        target = BUILD / name
        shutil.rmtree(target, ignore_errors=True)
        target.mkdir(parents=True)
        if requirements:
            reqs = [
                line.strip() for line in requirements.read_text(encoding="utf-8").splitlines()
                if line.strip() and not line.startswith("#")
                and line.split(">")[0].split("=")[0].split("[")[0].strip().lower() not in RUNTIME_PROVIDED
            ]
            if reqs:
                run([sys.executable, "-m", "pip", "install", "--quiet", "--target", str(target),
                     "--platform", "manylinux2014_x86_64", "--implementation", "cp", "--python-version", "3.12",
                     "--only-binary=:all:", "--upgrade", *reqs])
        for item in items:
            source = src / item
            if source.is_dir():
                shutil.copytree(source, target / item, ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
            else:
                shutil.copy2(source, target / item)
        for junk in target.rglob("__pycache__"):
            shutil.rmtree(junk, ignore_errors=True)
        size = sum(f.stat().st_size for f in target.rglob("*") if f.is_file()) / 1_048_576
        print(f"    {name}: {size:.1f} MB")


def ensure_artifacts_bucket(aws: Aws, account: str) -> str:
    bucket = f"billing-artifacts-{account}-{aws.region}"
    if not aws.call("s3api", "head-bucket", "--bucket", bucket, quiet_fail=True):
        log(f"Creando bucket de artefactos {bucket}")
        args = ["s3api", "create-bucket", "--bucket", bucket]
        if aws.region != "us-east-1":
            args += ["--create-bucket-configuration", f"LocationConstraint={aws.region}"]
        aws.call(*args)
        aws.call("s3api", "put-public-access-block", "--bucket", bucket, "--public-access-block-configuration",
                 "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true")
    return bucket


def deploy_stack(aws: Aws, stack: str, stage: str, artifacts: str, env: dict[str, str]) -> None:
    log("Empaquetando plantilla")
    aws.run("cloudformation", "package", "--template-file", str(TEMPLATE), "--s3-bucket", artifacts,
            "--s3-prefix", stack, "--output-template-file", str(PACKAGED))
    log(f"Desplegando stack {stack} (tarda unos minutos la primera vez)")
    params = {
        "Stage": stage,
        "BillingDbHost": env["BILLING_DB_HOST"],
        "BillingDbPort": env.get("BILLING_DB_PORT", "3306"),
        "BillingDbName": env["BILLING_DB_NAME"],
        "BillingDbUser": env["BILLING_DB_USER"],
        "BillingDbPassword": env["BILLING_DB_PASSWORD"],
        "CatalogDbHost": env["CATALOG_DB_HOST"],
        "CatalogDbPort": env.get("CATALOG_DB_PORT", "5432"),
        "CatalogDbName": env["CATALOG_DB_NAME"],
        "CatalogDbUser": env["CATALOG_DB_USER"],
        "CatalogDbPassword": env["CATALOG_DB_PASSWORD"],
        "JwtSecret": env["JWT_SECRET"],
        "SessionTtlMs": env.get("SESSION_TTL_MS", "1800000"),
        "AllowDemoLogin": "true" if env.get("ALLOW_DEMO_LOGIN", "false").lower() in ("1", "true", "yes") else "false",
        "DemoPassword": env.get("DEMO_PASSWORD", "demo1234"),
    }
    # Los parámetros van en un archivo temporal para no exponer contraseñas en la línea de comandos.
    params_file = BUILD / "parameters.json"
    params_file.write_text(json.dumps([f"{k}={v}" for k, v in params.items()]), encoding="utf-8")
    try:
        result = subprocess.run(
            aws.base + ["cloudformation", "deploy", "--template-file", str(PACKAGED), "--stack-name", stack,
                        "--capabilities", "CAPABILITY_AUTO_EXPAND", "--no-fail-on-empty-changeset",
                        "--tags", "project=billing-system", f"stage={stage}",
                        "--parameter-overrides", f"file://{params_file}"],
            text=True,
        )
    finally:
        params_file.unlink(missing_ok=True)
    if result.returncode != 0:
        print("\nEventos con error del stack:")
        subprocess.run(aws.base + ["cloudformation", "describe-stack-events", "--stack-name", stack,
                                   "--max-items", "20", "--output", "table", "--query",
                                   "StackEvents[?contains(ResourceStatus, 'FAILED')].[LogicalResourceId,ResourceStatusReason]"])
        sys.exit("El despliegue de CloudFormation falló.")


def stack_outputs(aws: Aws, stack: str) -> dict[str, str]:
    data = aws.json("cloudformation", "describe-stacks", "--stack-name", stack)
    return {o["OutputKey"]: o["OutputValue"] for o in data["Stacks"][0].get("Outputs", [])}


def publish_frontend(aws: Aws, outputs: dict[str, str]) -> None:
    frontend = ROOT / "frontend"
    log("Compilando frontend")
    env = {**os.environ, "VITE_API_URL": outputs["ApiUrl"], "VITE_LAMBDA_URL": outputs["ApiUrl"]}
    if not (frontend / "node_modules").exists():
        run(["npm", "ci", "--no-audit", "--no-fund"], cwd=frontend, env=env)
    run(["npm", "run", "build"], cwd=frontend, env=env)
    bucket = outputs["FrontendBucketName"]
    log(f"Publicando en s3://{bucket}")
    dist = frontend / "dist"
    aws.run("s3", "sync", str(dist), f"s3://{bucket}", "--delete", "--exclude", "index.html",
            "--cache-control", "public,max-age=31536000,immutable")
    aws.run("s3", "cp", str(dist / "index.html"), f"s3://{bucket}/index.html",
            "--cache-control", "no-cache", "--content-type", "text/html; charset=utf-8")


def smoke_test(outputs: dict[str, str]) -> None:
    import urllib.request

    log("Prueba rápida")
    try:
        with urllib.request.urlopen(outputs["ApiUrl"] + "/health", timeout=20) as response:
            print(f"    GET /health -> {response.status} {response.read().decode()[:60]}")
    except Exception as exc:  # noqa: BLE001
        print(f"    GET /health falló: {exc}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--profile", help="perfil de ~/.aws/credentials (p. ej. learnerlab)")
    parser.add_argument("--region", default=os.environ.get("AWS_REGION", "us-east-1"))
    parser.add_argument("--stage", default="dev")
    parser.add_argument("--skip-frontend", action="store_true")
    parser.add_argument("--frontend-only", action="store_true")
    parser.add_argument("--force", action="store_true", help="desplegar aunque no exista LabRole")
    args = parser.parse_args()

    aws = Aws(args.profile, args.region)
    stack = f"billing-{args.stage}"
    account = check_learner_lab(aws, args.force)
    BUILD.mkdir(exist_ok=True)

    if not args.frontend_only:
        env = load_env()
        build_functions()
        artifacts = ensure_artifacts_bucket(aws, account)
        deploy_stack(aws, stack, args.stage, artifacts, env)

    outputs = stack_outputs(aws, stack)
    if not args.skip_frontend:
        publish_frontend(aws, outputs)
    smoke_test(outputs)

    log("Listo")
    print(f"    Frontend : {outputs['FrontendUrl']}")
    print(f"    API      : {outputs['ApiUrl']}")
    print("    Recuerda: el security group de los RDS (cuenta de datos) debe aceptar 3306/5432 desde Lambda.")


if __name__ == "__main__":
    main()
