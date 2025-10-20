from .app_handler import ApplicationHandler
from pyplas.utils import globals as g

NON_CATEGORIZED_CAT_ID = "0"       

class TopHandler(ApplicationHandler):

    def get(self):
        """
        カテゴリ一覧を表示する
        """
        # データを取得
        SQL = r"""SELECT cat_id, cat_name, logo_url FROM categories"""
        categories = g.db.execute(SQL)

        self.render("index.html", categories=categories)


class ProblemListHandler(ApplicationHandler):

    def get(self, cat_id: str):
        """
        カテゴリ`category_name`に属する問題の一覧を表示する
        """
        if cat_id == NON_CATEGORIZED_CAT_ID:
            condition = r"pages.category IS NULL"
        else:
            condition = r"pages.category = :cat_id"

        q1 = r"SELECT cat_name FROM categories WHERE cat_id=:cat_id"
        categories = g.db.execute(q1, cat_id=cat_id)

        q2 = f"""SELECT pages.p_id, pages.title, 
                COALESCE(user.progress.p_status, 0) AS p_status
                FROM pages
                LEFT OUTER JOIN user.progress ON pages.p_id = user.progress.p_id
                WHERE {condition} AND pages.status = 1
                ORDER BY order_index ASC, register_at ASC
            """
        problems = g.db.execute(q2, cat_id=cat_id)

        if cat_id == NON_CATEGORIZED_CAT_ID:
            category_name = "None"
        elif len(categories) == 1:
            category_name:str = categories[0]["cat_name"]
        else:
            self.write_error(404, reason=f"CATEGORY({cat_id}) NOT FOUND")
            return 
        
        self.render("problems_index.html",
                    problems = problems,
                    category_name = category_name
                    )