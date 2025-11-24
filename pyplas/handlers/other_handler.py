from dataclasses import dataclass
import sqlite3
from tornado.web import MissingArgumentError
import json

from .app_handler import DevHandler, InvalidJSONError, ApplicationHandler
from .main_handler import NON_CATEGORIZED_CAT_ID
from pyplas.utils import globals as g


@dataclass
class ProblemOrderBody():
    """問題変更POSTのRequest Body"""
    order: list[str]

@dataclass 
class ProfileChangeBody():
    """問題プロファイル変更POSTのRequest Body"""
    profiles: dict[str, dict]

class ProblemOrderHandler(DevHandler):
    """
    問題順序変更用ハンドラー
    """
    def get(self, cat_id: str):
        """
        問題順序変更ページを表示する
        """
        if cat_id == NON_CATEGORIZED_CAT_ID:
            condition = r"category IS NULL"
        else:
            condition = r"category = :cat_id"
        SQL = r"""SELECT p_id, title, cat.cat_name AS cat_name, status, register_at
            FROM pages 
            LEFT OUTER JOIN categories AS cat ON category = cat.cat_id
            WHERE {condition}
            ORDER BY order_index ASC, register_at ASC""".format(condition=condition)

        records = g.db.execute(SQL, cat_id=cat_id)
        self.render("order_change.html", problems=records)


    def post(self, cat_id: str):
        """
        指定したカテゴリ`cat_id`の問題順序を変更する
        """
        try:
            self.json = ProblemOrderBody(**self.decode_request_body(validate="order_change.json"))
            SQL = r"""UPDATE pages SET order_index=:order
                WHERE p_id=:p_id"""
            orders = [{"p_id": p_id, "order": i } for i, p_id in enumerate(self.json.order)]
            g.db.execute_many(SQL, orders)
            self.write({"DESCR": "Problem Order is updated."})
            self.logger.info(f"Update problems order in the category(cat_id='{cat_id}')")
        except InvalidJSONError:
            self.set_status(400, "BAD REQUEST (INVALID REQUEST BODY)")
            self.finish()
        except sqlite3.Error as e:
            self.logger.error(e)
            self.set_status(400, reason="BAD REQUEST (UNACCEPTABLE ENTRY)")
            self.finish()
        except Exception as e:
            self.logger.error(e)
            self.set_status(500, "INTERNAL SERVER ERROR")
            self.finish()

class ProfileHandler(DevHandler):
    """
    問題プロファイル変更用ハンドラー
    """
    def post(self):
        """
        pagesテーブルのプロファイル(title, category, status)を変更する
        """
        try:
            self.json = ProfileChangeBody(**self.decode_request_body(
                validate="profile.json"))
            
            SQL = r"""UPDATE pages SET title=:title,
                category = 
                    CASE 
                        WHEN :category="0" THEN NULL
                        ELSE :category
                    END,
                status = :status
                WHERE p_id = :p_id"""
            params = [
                {"p_id": key} | value for key, value in self.json.profiles.items()
            ]
            g.db.execute_many(SQL, params)
            self.write({"DESCR": "Profile of Problems is updated."})
            self.logger.info("Problem's profiles are updated")
        except InvalidJSONError:
            self.set_status(400, "BAD REQUEST (INVALID REQUEST BODY)")
            self.finish()
        except sqlite3.Error as e:
            self.set_status(400, reason="BAD REQUEST (UNACCEPTABLE ENTRY)")
            self.finish()
        except Exception as e:
            self.logger.error(str(e))
            self.set_status(500, "INTERNAL SERVER ERROR")
            self.finish()

class PracticeHandler(ApplicationHandler):
    """練習ページ用ハンドラー"""

    def get(self):
        """
        練習ページを表示する
        """
        query = r"""SELECT cat_id, cat_name FROM categories"""
        categories = g.db.execute(query)
        

        try: 
            p_id = self.get_query_argument("p_id")
            q_id = self.get_query_argument("q_id")
        except MissingArgumentError as e:
            self.render("practice.html", initial=None, categories=categories)
            return
        
        query = r"""SELECT 
                        J.value AS node
                    FROM pages, JSON_EACH(JSON_EXTRACT(pages.page, '$.body')) AS J
                    WHERE p_id = :p_id 
                    AND  JSON_EXTRACT(node, '$.q_id') = :q_id 
                """ 
        res = g.db.execute(query, p_id=p_id, q_id=q_id)
        if len(res) != 1:
            self.render("practice.html", initial=None, categories=categories)
        else:
            res = res[0]["node"]
            res = json.loads(res)
            self.render("practice.html", initial=res, categories=categories)

        
