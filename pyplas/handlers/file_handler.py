
from io import StringIO
import json
import pandas as pd 
from tornado.web import MissingArgumentError

from .app_handler import ApplicationHandler
from pyplas.utils import globals as g


class LogHandler(ApplicationHandler):

    def get(self):
        """
        対象カテゴリのログファイルを取得する
        """
        try:
            cat_id = self.get_query_argument("cat")
        except MissingArgumentError:
            self.set_status(400, reason="Invalid URL query")
            self.finish()
            return
        
        if cat_id == "0":
            condition = r"category is NULL"
        else:
            condition = r"category = :cat_id"
        SQL = fr"""SELECT * FROM user.logs WHERE {condition}"""
        logs = g.db.execute(SQL, cat_id=cat_id)
        
        logs_string = StringIO(json.dumps(logs))
        df = pd.read_json(logs_string)
        csv_bin = df.to_csv(header=True, index=False).encode("utf-8")
        self.set_header("Content-Type", "text/csv")
        self.set_header("Content-Length", len(csv_bin))
        self.write(csv_bin)