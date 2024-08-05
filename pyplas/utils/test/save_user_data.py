import json 
from jsonschema import validate, ValidationError 

if __name__ == "__main__":

    with open("schema/save_user_data.json") as j:
        json_schema = json.load(j)

    items = {
        "q_content": {
            "fsd": [100]
        }
    }
    try:
        validate(items, json_schema)
    except ValidationError as e:
        print(e)
    else:
        print("Complete Test")