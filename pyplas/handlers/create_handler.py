from dataclasses import dataclass
import json
import sqlite3
from typing import Any, Optional
import uuid

from .app_handler import DevHandler, InvalidJSONError
from pyplas.utils import globals as g


@dataclass
class RegisterBody():
    """POST /create/<p_id>時のRequest Body"""
    title: str
    page: dict[str, Any]
    answers: dict[str, Any]
    explanations: dict[str, Any]


class ProblemCreateHandler(DevHandler):
    """問題作成/編集ハンドラ"""
    
    # GET
    def get(self, p_id:Optional[str]=None):
        """
        - `/create`
            問題リスト
        - `/create/new`
            新規問題作成ページ
        - `/create/<p_id(uuid)>`
            問題編集ページ
        """
        try:
            # GET /create
            if p_id is None:
                self.render_problem_list()
                
            # GET /create/<p_id>
            elif p_id is not None:
                self.render_problem_editor(p_id=p_id)
        except AssertionError as e:
            self.logger.error(e)
            self.write_error(404, reason=f"PROBLEM({p_id}) NOT FOUND")
        except Exception as e:
            self.logger.error(e, exc_info=True)
            self.write_error(500, reason="INTERNAL SERVER ERROR")

    # POST
    def post(self, p_id:Optional[str]=None):
        """
        - `/create/new`
            新規問題登録
        - `/create/<p_id>`
            登録済みの問題の編集保存
        """
        try:
            # POST /create
            if p_id is None:
                self.set_status(404, reason=f"PROBLEM NOT FOUND")
                self.finish()

            # POST /create/<p_id>
            elif p_id is not None:
                self.json = RegisterBody(**self.decode_request_body(validate="register.json"))
                self.register(p_id)
        except InvalidJSONError:
            self.set_status(400, reason="BAD REQUEST (INVALID REQUEST BODY)")
            self.finish()
        except sqlite3.Error as e:
            self.logger.error(e)
            self.set_status(400, reason="BAD REQUEST (UNACCEPTABLE ENTRY)")
            self.finish()
        except Exception as e:
            self.logger.error(e, exc_info=True)
            self.set_status(500, reason="INTERNAL SERVER ERROR")
            self.finish()

    def delete(self, p_id:Optional[str]=None):
        """
        - `/create/<p_id>`   :`p_id`のIDを持つ問題を削除する
        """
        try:
            # DELETE /create
            if p_id is None:
                self.set_status(404, reason=f"PROBLEM NOT FOUND")
                self.finish()

            # DELETE /create/<p_id>
            elif p_id is not None:
                self.delete_problem(p_id)
        except AssertionError as e:
            self.set_status(404, f"PROBLEM({p_id}) NOT FOUND")
            self.finish()
        except Exception as e:
            self.logger.error(e, exc_info=True)
            self.set_status(500, reason="INTERNAL SERVER ERROR")
            self.finish()

    def render_problem_list(self):
        """
        問題一覧ページを表示する
        """
        SQL = r"""SELECT p_id, title, category, status 
            FROM pages
            ORDER BY category ASC, order_index ASC, register_at ASC"""
        problems = g.db.execute(SQL)
        sql = r"""SELECT * FROM categories"""
        cates = g.db.execute(sql)
        self.render("create_index.html", problem_list=problems, categories=cates)

    def render_problem_editor(self, p_id:str):
        """
        問題編集ページを表示する. `p_id`が`"new"`のときは新規問題作成ページを表示する

        DBに`p_id`が存在しないとき, `AssertionError`を投げる
        """
        # create new page
        if p_id == "new": 
            self.render("create.html", 
                        title="",
                        page={},
                        answers={},
                        is_new=True,
                        category=None)

        # edit exist page   
        else:
            sql = r"""SELECT title, page, answers, explanations, cat.cat_name AS cat_name
            FROM pages 
            LEFT OUTER JOIN categories AS cat ON category = cat.cat_id 
            WHERE p_id = :p_id"""
            pages = g.db.execute(sql, p_id=p_id)
            assert len(pages) != 0
            page = pages[0]
            
            self.render("create.html",
                        title=page["title"],
                        page=json.loads(page["page"]),
                        answers=json.loads(page["answers"]),
                        explanations=json.loads(page["explanations"]),
                        is_new=False,
                        category=page["cat_name"])

    def register(self, p_id:str):
        """
        問題をpagesテーブルに登録する
        """
        # register new problem
        if p_id == "new": 
            self.p_id = str(uuid.uuid4())
            sql = r"""INSERT INTO pages(p_id, title, page, answers, explanations) 
            VALUES(:p_id, :title, :page, :answers, :explanations)"""
            g.db.execute(sql, p_id=self.p_id, 
                             title=self.json.title, 
                             page=json.dumps(self.json.page),
                             answers=json.dumps(self.json.answers),
                             explanations=json.dumps(self.json.explanations))
            self.finish({"p_id": self.p_id,
                         "DESCR": "New Problem is successfully registered."})
            self.logger.info(f"New Problem(p_id={self.p_id}) is added.")
        # edit exist problem
        else: 
            sql = r"""UPDATE pages SET title=:title, page=:page, 
                answers=:answers, explanations=:explanations 
            WHERE p_id=:p_id"""
            g.db.execute(sql, p_id=p_id, 
                             title=self.json.title,
                             page=json.dumps(self.json.page),
                             answers=json.dumps(self.json.answers),
                             explanations=json.dumps(self.json.explanations))
            self.finish({"p_id": p_id,
                         "DESCR": f"Problem(id='{p_id}') is successfully saved."})
            self.logger.info(f"Problem(id='{p_id}') is updated.")

    def delete_problem(self, p_id: str):
        """
        問題を削除する

        問題が見つからない場合、`AssertionError`を投げる
        """
        sql = r"""DELETE FROM pages WHERE p_id=:p_id RETURNING *"""
        res = g.db.execute(sql, p_id=p_id)
        assert len(res) == 1
        res = res[0]

        descr = f"Problem(id='{p_id}') is successfully deleted."
        res["DESCR"] = descr
        self.logger.info(descr)
        self.finish(res)