from .app_handler import ApplicationHandler
from pyplas.utils import get_logger , globals as g

logger = get_logger(__name__)

class MainHandler(ApplicationHandler):
    
    def prepare(self):
        logger.debug(f"{self.request.method} {self.request.uri}")
        self.load_url_queries({"category": None})
        self.category = self.query["category"]

    def get(self):
        """
        PATH
            * / → カテゴリ一覧の表示
            * /?category=<category> → そのカテゴリのすべての問題を表示
        """
        if self.category is None: # カテゴリ一覧を表示
            self.get_category_list()
        else: # あるカテゴリに属する問題一覧を表示
            self.get_problem_list(self.category)

    def get_category_list(self): 
        """
        カテゴリ一覧を表示する
        """
        SQL = r"""SELECT cat_name, logo_url FROM categories"""
        cat = g.db.get_from_db(SQL)

        self.render("index.html",
                    category_list=cat,
                    problem_list=[],
                    category=None
                    )
        
    def get_problem_list(self, category: str):
        """
        問題一覧を表示する
        
        Parameters
        ----------
        category: str
            カテゴリ名
        """
        # SQL queryを作成
        if self.category == "None":
            condition = r"pages.category IS NULL"
        else:
            condition = r"cat.cat_name = :cat_name"
        SQL = fr"""SELECT pages.p_id, pages.title, 
        COALESCE(user.progress.p_status, 0) AS p_status
        FROM pages 
        LEFT OUTER JOIN categories AS cat ON pages.category = cat.cat_id
        LEFT OUTER JOIN user.progress ON pages.p_id = user.progress.p_id
        WHERE {condition} AND pages.status = 1
        ORDER BY order_index ASC, register_at ASC"""

        problem_list = g.db.get_from_db(SQL, cat_name=self.category)
        if len(problem_list) == 0:
            self.set_status(404, f"Category({self.category}) is not found")
        
        self.render("index.html",
                    category_list=[],
                    problem_list=problem_list,
                    category=self.category
                    )