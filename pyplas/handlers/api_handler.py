import json
from .app_handler import ApplicationHandler
from pyplas.utils import globals as g


class ProblemInfoHandler(ApplicationHandler):
    """
    `p_id`に対応する問題の情報を提供する
    """
    def get(self, p_id: str):
        # データを取得
        SQL = r"""SELECT p_id, title, categories.cat_name AS category, page
        FROM pages
        LEFT OUTER JOIN categories ON pages.category = categories.cat_id
        WHERE p_id = :p_id AND status == 1"""
        problem_records = g.db.execute(SQL, p_id=p_id)
        
        if len(problem_records) == 0:
            self.set_status(404, f"Problem(p_id='{p_id}') is not found.")
            self.finish()

        else:
            record: dict = problem_records[0]
            record["DESCR"] = f"Get information on Problem(p_id='{p_id}')."
            self.write(record)

class UserInputHandler(ApplicationHandler):
    """
    `p_id`に対応する問題のユーザー入力を提供する
    """
    def get(self, p_id: str):
        SQL = r"""SELECT pages.p_id, user.progress.q_content FROM pages
        LEFT OUTER JOIN user.progress ON pages.p_id = user.progress.p_id
        WHERE pages.p_id = :p_id"""
        records = g.db.execute(SQL, p_id=p_id)

        if len(records) == 0:
            self.set_status(404, f"Problem(p_id='{p_id}') is not found.")
            self.finish()
        else:
            record: dict = records[0]
            saves = {} if record["q_content"] is None else json.loads(record["q_content"])
            self.write({
                "p_id": p_id,
                "saves": saves,
                "DESCR": f"Get your saved answers"
            })

class CategoryInfoHandler(ApplicationHandler):
    """
    `cat_id`に対応するカテゴリの情報を提供する
    """
    def get(self, cat_id: str):
        SQL = r"""SELECT * FROM categories WHERE cat_id=:cat_id"""
        records = g.db.execute(SQL, cat_id=cat_id)

        if len(records) == 0:
            self.set_status(404, f"Category(cat_id='{cat_id}') is not found.")
            self.finish()
        else:
            record: dict = records[0]
            record["DESCR"] = f"Get the category informations"
            self.write(record)