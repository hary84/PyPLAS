from .app_handler import ApplicationHandler
from pyplas.utils import get_logger , globals as g

logger = get_logger(__name__)

class MainHandler(ApplicationHandler):
    
    def prepare(self):
        logger.debug(f"{self.request.method} {self.request.uri}")
        self.load_url_queries({"category": None})

    def get(self):
        """
        PATH
            * / → カテゴリ一覧の表示
            * /?category=<category> → そのカテゴリのすべての問題を表示
        """
        if self.query["category"] is None: # カテゴリ一覧を表示
            sql = r"""SELECT cat_name, logo_url FROM categories"""
            cat = g.db.get_from_db(sql)
            p_list = []
        else: # あるカテゴリに属する問題一覧を表示
            if self.query["category"] == "None":
                cat_name = None
            else:
                cat_name = self.query["category"]
            sql = r"""SELECT pages.p_id, pages.title, 
            COALESCE(user.progress.p_status, 0) AS p_status
            FROM pages 
            LEFT OUTER JOIN categories AS cat ON pages.category = cat.cat_id
            LEFT OUTER JOIN user.progress ON pages.p_id = user.progress.p_id
            WHERE (cat.cat_name = :cat_name OR cat.cat_name is :cat_name) AND pages.status = 1
            ORDER BY order_index ASC, register_at ASC"""
            p_list = g.db.get_from_db(sql, cat_name=cat_name)
            p_list = [r for r in p_list]
            cat = []

        self.render("index.html", 
                    category_list=cat, 
                    problem_list=p_list, 
                    category=self.query["category"],
                    dev_mode=self.is_dev_mode)