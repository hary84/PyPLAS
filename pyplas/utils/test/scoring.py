import json 
from jsonschema import validate, ValidationError 

if __name__ == "__main__":

    with open("schema/scoring.json") as j:
        json_schema = json.load(j)

    items = {
        "q_id": "1",
        "ptype": "2",
        "answers": ["fasdf", "fasdfas", "日本語"],
        "kernel_id": "fdsaf-dfasdf-fsadf"
    }
    try:
        validate(items, json_schema)
    except ValidationError as e:
        print(e)
    else:
        print("Complete Test")