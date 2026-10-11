"""Loads the demo projects/users into DynamoDB. Run after the stack is deployed:

    python infra/seed.py            (uses AWS_REGION / table env vars, defaults match the template)
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import database  # noqa: E402

if database.dynamodb is None:
    sys.exit("boto3/DynamoDB unavailable - run `pip install boto3` and `aws login` first.")

import json  # noqa: E402

with open(os.path.join(os.path.dirname(__file__), "seed_projects.json"), encoding="utf-8") as fh:
    seed_projects = json.load(fh)

for p in seed_projects:
    database.dynamodb.Table(database.PROJECTS_TABLE).put_item(Item=database._convert_floats_to_decimals(p))
    print("seeded project", p["project_id"])

for u in database.MOCK_USERS.values():
    database.dynamodb.Table(database.USERS_TABLE).put_item(Item=database._convert_floats_to_decimals(u))
    print("seeded user", u["wallet_address"])

for t in database.MOCK_TRANSACTIONS:
    database.dynamodb.Table(database.TRANSACTIONS_TABLE).put_item(Item=database._convert_floats_to_decimals(t))
    print("seeded tx", t["tx_id"])
