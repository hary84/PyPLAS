import json 
import os 

from jsonschema import validate

from pyplas.utils import globals as g

def get_schema_path(schema_name) -> str:
    """
    schema_nameファイルのパスを返す
    """
    return os.path.join(g.SCHEMA_PATH, schema_name)


def validate_json(js, schema_name):
    """
    与えられたjsonをjson schemaによって検証する

    Parameters
    ----------
    js: dict
        検証の対象となるjson
    schema_name: str
        検証に使いたいjsonファイルの名前. 
        ファイル名のみを記述する. 
        e.g.) schema.json
    """
    path = get_schema_path(schema_name)
    with open(path) as j:
        json_schema = json.load(j)

    validate(js, json_schema)