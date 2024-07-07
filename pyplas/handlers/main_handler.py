from .app_handler import ApplicationHandler
from pyplas.utils import get_logger , globals as g

logger = get_logger(__name__)

class MainHandler(ApplicationHandler):
    
    def prepare(self):
        logger.info(f"{self.request.method} {self.request.uri}")
        self.load_url_queries({"category": None})

    def get(self):
        """
        PATH
            * / → カテゴリ一覧の表示
            * /?category=<category> → そのカテゴリのすべての問題を表示
        """
        if self.query["category"] is None: # カテゴリ一覧を表示
            sql = r"""SELECT cat_name FROM categories"""
            cat = g.db.get_from_db(sql)
            cat = [r["cat_name"] for r in cat]
            p_list = []
        else: # あるカテゴリに属する問題一覧を表示
            sql = r"""SELECT pages.p_id, pages.title, COALESCE(user.progress.p_status, 0) AS p_status 
            FROM pages INNER JOIN categories ON pages.category = categories.cat_id
            LEFT OUTER JOIN user.progress ON pages.p_id = user.progress.p_id
            WHERE categories.cat_name = :cat_name AND pages.status = 1"""
            p_list = g.db.get_from_db(sql, cat_name=self.query["category"])
            p_list = [r for r in p_list]
            cat = []

        self.render("index.html", categories=cat, problem_list=p_list)