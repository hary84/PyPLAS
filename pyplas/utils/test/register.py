import json 
from jsonschema import validate, ValidationError 

if __name__ == "__main__":

    with open("schema/register.json") as j:
        json_schema = json.load(j)

    items = {
        "title": "demo title",
        "page": {
            'header': {
                'summary': '**aaaaa**', 
                'source': '*bbbbb*', 
                'env': '***ccccc***'
            }, 
            'body': [
                {'type': 'explain', 'content': 'ddddd'}, 
                {'type': 'code', 'content': 'print("hello")', 'readonly': True}, 
                {'type': 'question', 'q_id': '1', 'ptype': 0, 'conponent': [], 'question': '<p class="mb-0 q-text">\n   <label class="form-label">100と入力せよ</label>\n   <input type="text" class="form-control q-form" placeholder="answer" ans="100">\n</p>\n<p class="mb-0 q-text">\n   <label class="form-label">選択肢1を選べ</label>\n   <select class="form-select" ans="1">\n       <option selected="">Open this select menu</option>\n       <option value="1">選択肢1</option>\n       <option value="2">選択肢2</option>\n   </select>\n</p>', 'editable': False}, 
                {'type': 'question', 'q_id': '2', 'ptype': 1, 'conponent': [], 'question': '変数`a`に100を代入しなさい', 'editable': True}, 
                {'type': 'question', 'q_id': '3', 'ptype': 1, 'conponent': [{'type': 'explain', 'content': 'まず、`a`に100を代入する。'}, {'type': 'code', 'content': 'a = '}, {'type': 'explain', 'content': 'その後、`b`に`100**2`を代入する'}, {'type': 'code', 'content': 'b = '}], 'question': '`a`に100を代入し、その後、`b`に`a`の2乗を代入せよ。', 'editable': False}
            ]
        },
        "answers": {
            "1": ["dafa", "fdaf"],
            "2": ["dfafdfdf", "fdsfsdfsdf"]
        }
    }
    try:
        validate(items, json_schema)
    except ValidationError as e:
        print(e)
    else:
        print("Complete Test")