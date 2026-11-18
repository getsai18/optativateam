"""Elimina todo lo desplegado por infra/deploy.py (no toca los RDS de la cuenta de datos).

    python infra/destroy.py --profile learnerlab
    python infra/destroy.py --stage dev --keep-artifacts

Vacía el bucket del frontend (CloudFormation no borra buckets con objetos), elimina el stack
(Lambdas, API Gateway, EventBridge, DynamoDB, logs) y, salvo --keep-artifacts, el bucket de artefactos.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys


def aws(base: list[str], *args: str, check: bool = True) -> subprocess.CompletedProcess:
    result = subprocess.run(base + list(args), capture_output=True, text=True)
    if check and result.returncode != 0:
        sys.exit(f"Falló: aws {' '.join(args)}\n{result.stderr}")
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--profile")
    parser.add_argument("--region", default=os.environ.get("AWS_REGION", "us-east-1"))
    parser.add_argument("--stage", default="dev")
    parser.add_argument("--keep-artifacts", action="store_true")
    parser.add_argument("--yes", action="store_true", help="no pedir confirmación")
    args = parser.parse_args()

    base = ["aws", "--region", args.region] + (["--profile", args.profile] if args.profile else [])
    account = json.loads(aws(base, "sts", "get-caller-identity", "--output", "json").stdout)["Account"]
    stack = f"billing-{args.stage}"
    frontend = f"billing-frontend-{account}-{args.stage}"
    artifacts = f"billing-artifacts-{account}-{args.region}"

    if not args.yes:
        answer = input(f"Se eliminará el stack {stack} de la cuenta {account} (DynamoDB incluido). Escribe 'si': ")
        if answer.strip().lower() != "si":
            sys.exit("Cancelado.")

    print(f"==> Vaciando s3://{frontend}")
    aws(base, "s3", "rm", f"s3://{frontend}", "--recursive", check=False)
    print(f"==> Eliminando stack {stack}")
    aws(base, "cloudformation", "delete-stack", "--stack-name", stack)
    aws(base, "cloudformation", "wait", "stack-delete-complete", "--stack-name", stack)
    if not args.keep_artifacts:
        print(f"==> Eliminando bucket de artefactos {artifacts}")
        aws(base, "s3", "rb", f"s3://{artifacts}", "--force", check=False)
    print("Listo.")


if __name__ == "__main__":
    main()
