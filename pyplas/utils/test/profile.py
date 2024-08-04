import json 
from jsonschema import validate, ValidationError 

if __name__ == "__main__":

    with open("schema/profile.json") as j:
        json_schema = json.load(j)

    items = {
        "profiles": {
            "p_id1": {
                "title": "demo title",
                "status": 0,
                "category": 4
            },
            2: {
                "title": "demo title2",
                "status": 3,
                "category": 2
            }
        }
    }
    try:
        validate(items, json_schema)
    except ValidationError as e:
        print(e)
    else:
        print("Complete Test")