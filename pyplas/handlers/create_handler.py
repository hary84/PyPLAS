import json
import sqlite3
from typing import Optional
import uuid

from .app_handler import ApplicationHandler, InvalidJSONError
from pyplas.utils import get_logger, globals as g

mylogger = get_logger(__name__)

class ProblemCreateHandler(ApplicationHandler):
    """問題作成ハンドラ"""
    def prepare(self):
        mylogger.info(f"{self.request.method} {self.request.uri}")
        if not self.is_dev_mode:
            self.write_error(403, reason="server is not developer mode.")
            
    def get(self, p_id:Optional[str]=None, action:Optional[str]=None) -> None:
        """
        PATH
            * /create/              :問題リスト
            * /create/new           :新規問題作成ページ
            * /create/<p_id(uuid)>  :問題編集ページ
        """
        # GET /create
        if p_id is None and action is None:
            sql = r"""SELECT p_id, title, category, status FROM pages"""
            problems = g.db.get_from_db(sql)
            sql = r"""SELECT * FROM categories"""
            cates = g.db.get_from_db(sql)
            problems = [r for r in problems] 
            cates = [r for r in cates]
            try:
                self.render("create_index.html", problem_list=problems, categories=cates)
            except Exception as e: 
                mylogger.error(e, exc_info=True)
                self.write_error(500, reason="Error occurred during rendering page")
            
        # GET /create/<p_id>
        elif p_id is not None and action is None:
            self.render_edit(p_id=p_id)

        # GET /create/<p_id>/<action>
        elif p_id is not None and action is not None:
            self.write_error(404)

    def render_edit(self, p_id:str) -> None:
        """
        問題編集ページを表示
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
            sql = r"""SELECT title, page, answers, cat.cat_name AS cat_name
            FROM pages 
            LEFT OUTER JOIN categories AS cat ON category = cat.cat_id 
            WHERE p_id = :p_id"""
            page = g.db.get_from_db(sql, p_id=p_id)
            try:
                assert len(page) != 0
            except AssertionError:
                self.redirect("/create")
            else:
                page = page[0]
                try:
                    self.render("create.html",
                                title=page["title"],
                                page=json.loads(page["page"]),
                                answers=json.loads(page["answers"]),
                                is_new=False,
                                category=page["cat_name"])
                except Exception as e:
                    mylogger.error(e, exc_info=True)
                    self.write_error(500, reason="Error occurred during rendering page")

    def post(self, p_id:Optional[str]=None, action:Optional[str]=None) -> None:
        """
        PATH
            * /create/new/register      :新規問題登録
            * /create/<p_id>/register   :登録済みの問題の編集保存
            * /create/profile           :プロファイル(title, category, status)の変更
        """
        try:
            # POST /create
            if p_id is None and action is None:
                self.set_status(404, reason=f"{self.request.uri} is not Found.")
                self.finish()

            # POST /create/<p_id>
            elif p_id is not None and action is None:
                if p_id == "profile":
                    self.load_json(validate=True, schema="profile.json")
                    self.update_profile()
                else:
                    self.set_status(404, reason=f"{self.request.uri} is not Found.")
                    self.finish()

            # POST /create/<p_id>/<action>
            elif p_id is not None and action is not None:
                if action == "register":
                    self.load_json(validate=True, schema="register.json")
                    self.register(p_id=p_id)
                else:
                    self.set_status(404, reason=f"{self.request.uri} is not Found.")
                    self.finish()
        except InvalidJSONError:
            self.set_status(400, reason="Invalid request message or Invalid url query")
            self.finish()
        except sqlite3.Error as e:
            self.set_status(400, reason=str(e))
            self.finish()
        except Exception as e:
            mylogger.error(e, exc_info=True)
            self.set_status(500, reason="internal server error")
            self.finish()

    def register(self, p_id:str) -> None:
        """
        問題をpagesテーブルに登録する
        """
        # register new problem
        if p_id == "new": 
            self.p_id = str(uuid.uuid4())
            sql = r"""INSERT INTO pages(p_id, title, page, answers) 
            VALUES(:p_id, :title, :page, :answers)"""
            g.db.write_to_db(sql, p_id=self.p_id, title=self.json["title"], 
                                   page=json.dumps(self.json["page"]),
                                   answers=json.dumps(self.json["answers"]))
            self.finish({"p_id": self.p_id,
                         "DESCR": "New Problem is successfully registered."})
        # edit exist problem
        else: 
            sql = r"""UPDATE pages SET title=:title, page=:page, answers=:answers 
            WHERE p_id=:p_id"""
            g.db.write_to_db(sql, p_id=p_id, title=self.json["title"],
                            page=json.dumps(self.json["page"]),
                            answers=json.dumps(self.json["answers"]))
            self.finish({"p_id": p_id,
                         "DESCR": f"Problem({p_id}) is successfully saved."})

    def update_profile(self) -> None:
        """
        pagesテーブルのprofile(title, category, status)を変更する
        """
        sql = r"""UPDATE pages SET title=:title, 
        category=CASE
            WHEN :category = "" THEN NULL
            ELSE :category
            END,
            status=:status 
        WHERE p_id=:p_id"""
        params = [{"p_id": key} | v for key, v in self.json["profiles"].items()]
        g.db.write_to_db_many(sql, params)
        self.write({"profile": json.dumps(self.json),
                    "DESCR": "problem profile is successfully updated."})

    def delete(self, p_id:Optional[str]=None, action:Optional[str]=None) -> None:
        """
        PATH
            * /create/<p_id>    :問題<p_id>を削除する
        """
        # DELETE /create
        if p_id is None and action is None:
            self.set_status(404, reason=f"{self.request.uri} is not Found.")
            self.finish()

        # DELETE /create/<p_id>
        elif p_id is not None and action is None:
            sql = r"""DELETE FROM pages WHERE p_id=:p_id"""
            g.db.write_to_db(sql, p_id=p_id)
            self.finish({"p_id": p_id,
                         "DESCR": f"Problem({p_id}) is successfully deleted."})
                
        # DELETE /create/<p_id>/<action>
        elif p_id is not None and action is not None:
            self.set_status(404, reason=f"{self.request.uri} is not Found.")
            self.finish()