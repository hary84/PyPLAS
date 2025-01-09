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
        SQLs = [
            rf"""SELECT cat_name FROM categories
            WHERE cat_id=:cat_id"""
            ,
            f"""SELECT pages.p_id, pages.title, 
            COALESCE(user.progress.p_status, 0) AS p_status
            FROM pages
            LEFT OUTER JOIN categories AS cat ON pages.category = cat.cat_id
            LEFT OUTER JOIN user.progress ON pages.p_id = user.progress.p_id
            WHERE {condition} AND pages.status = 1
            ORDER BY order_index ASC, register_at ASC
            """
        ]
        # データを取得
        categories, problems = g.db.executes(SQLs, cat_id=cat_id)

        if len(categories) > 0:
            category_name = categories[0]["cat_name"]
        elif len(categories) == 0 and (cat_id != NON_CATEGORIZED_CAT_ID):
            self.write_error(404, reason=f"Category(cat_id={cat_id}) is not found.")
            return 
        else:
            category_name = None
        
        self.render("problems_index.html",
                    problems = problems,
                    category_name = category_name
                    )