from io import StringIO
import json
import os
import sqlite3
import subprocess
import tempfile
from typing import Optional, Union, Tuple

import pandas as pd 
from tornado.ioloop import IOLoop
import tornado

from .app_handler import ApplicationHandler, InvalidJSONError
from pyplas.utils import get_logger, globals as g
import pyplas.config as cfg

mylogger = get_logger(__name__)

class ProblemHandler(ApplicationHandler):

    execute_pool = {}
    def prepare(self):
        mylogger.info(f"{self.request.method} {self.request.uri}")

    def get(self, p_id:Optional[str]=None, action:Optional[str]=None) -> None:
        """
        PATH
            * /problems                 : / へリダイレクト
            * /problems/<p_id>          : 問題を表示
            * /problems/<p_id>/ifno     : 問題の基礎情報を取得
            * /problems/log/download    : logをcsvファイルとしてダウンロードする
        """
        # GET /problems
        if p_id is None and action is None: 
            self.redirect("/", permanent=True)
            return 
        
        # GET /problems/<p_id>
        elif p_id is not None and action is None: 
            self.render_problem(p_id=p_id)

        # GET /problems/<p_id>/<action>    
        elif p_id is not None and action is not None: 
            if p_id == "log" and action == "download":
                try:
                    self.load_url_queries(["cat", "name", "num"])
                except tornado.web.MissingArgumentError:
                    self.set_status(400, reason="Invalid url query. Please set 'cat', 'name', 'num'.")
                    self.finish()
                else:
                    self.log_downdload(**self.query)
            elif action == "info":
                self.get_problem_info(p_id=p_id)
            else:    
                self.write_error(404)


    def render_problem(self, p_id:str):
        """
        DBから問題を取得し, レンダリングする
        """
        sql = r"""SELECT pages.title, pages.page, categories.cat_name,
            COALESCE(user.progress.q_status, '{}') AS q_status, 
            COALESCE(user.progress.q_content, '{}') AS q_content
            FROM pages 
            LEFT OUTER JOIN categories ON category = categories.cat_id
            LEFT OUTER JOIN user.progress ON pages.p_id = user.progress.p_id
            WHERE pages.p_id=:p_id AND status=1"""
        try:
            page = g.db.get_from_db(sql, p_id=p_id)
            assert len(page) != 0, f"p_id='{p_id}' does not exist in DB."
        except (AssertionError) as e:
            self.write_error(404, reason=f"problem({p_id}) does not found.")
        else:
            page:dict = page[0]
            try:
                self.render(f"./problem.html", 
                            title=page["title"],
                            page=json.loads(page["page"]),
                            q_status=json.loads(page["q_status"]),
                            q_content=json.loads(page["q_content"]),
                            progress=[],
                            category=page["cat_name"])
            except Exception as e:
                mylogger.error(e, exc_info=True)
                self.write_error(500)


    def log_downdload(self,  cat:str, name:str, num:Union[int, str], **kwargs) -> list[dict]:
        """
        user.dbのlogsテーブルからあるカテゴリcat_nameに属するログをdictのlistとして返す.
        """
        sql = r"""SELECT p_id, q_id, content, result, answer_at FROM user.logs
                INNER JOIN categories ON user.logs.category = categories.cat_id
                WHERE categories.cat_name = :cat_name"""
        logs = g.db.get_from_db(sql, cat_name=cat)
        logs_string = StringIO(json.dumps(logs))
        df = pd.read_json(logs_string)
        csv_bin = df.to_csv(header=True, index=False).encode("utf-8")

        self.set_header("Content-Type", "text/csv")
        self.set_header("Content-Disposition", 
                        f'attachment; filename="{num}_{name}_{cat}.csv"')
        self.set_header("Content-Length", len(csv_bin))
        self.write(csv_bin)

    def get_problem_info(self, p_id: str) -> dict[str, str]:
        """
        pyplas.dbから問題の基礎情報(p_id, title, category, page)を取得し, dictとして返す. 
        """
        sql = r"""SELECT p_id, title, category, page FROM pages
            WHERE p_id = :p_id"""
        try: 
            info = g.db.get_from_db(sql, p_id=p_id)
            assert len(info) == 1, "p_id is not exist in db"
            self.write(info[0] | 
                       {"DESCR": "get problem info"})
        except AssertionError:
            self.set_status(404, reason=f"problem({p_id}) is not found.")
            self.finish()


    async def post(self, p_id:Optional[str]=None, action:Optional[str]=None) -> None:
        """
        PATH
            * /problems/<p_id>/save     : セーブ
            * /problems/<p_id>/scoring  : 採点
            * /problems/<p_id>/cancel   : 採点キャンセル
        """
        try:
            # POST /problems
            if p_id is None and action is None:
                self.set_status(404, reason=f"{self.request.uri} is not found.")
                self.finish()
            
            # POST /problems/<p_id>
            elif p_id is not None and action is None:
                self.set_status(404, reason=f"{self.request.uri} is not found.")
                self.finish()

            # POST /problems/<p_id>/<action>
            elif p_id is not None and action is not None:
                if action == "save":
                    self.load_json(validate=True, schema="save_user_data.json")
                    self.saving(p_id)
                elif action == "scoring":
                    self.load_json(validate=True, schema="scoring.json")
                    if self.json["kernel_id"] in ProblemHandler.execute_pool.keys():
                        self.set_status(202, reason=f"This question is currently being scored.")
                        self.finish()
                        return
                    await self.scoring(p_id)
                elif action == "cancel":
                    self.load_url_queries(["kernel_id"])
                    self.canceling(p_id)
                else:
                    self.set_status(404, f"{self.request.uri} is not found.")
                    self.finish()
        except (InvalidJSONError, tornado.web.MissingArgumentError):
            self.set_status(400, reason="invalid request body or Invalid url query")
            self.finish()
        except sqlite3.Error as e:
            self.set_status(400, reason=str(e))
            self.finish()
        except Exception as e:
            mylogger.error(e, exc_info=True)
            self.set_status(500, reason="internal server error")
            self.finish()

    def saving(self, p_id:str) -> None:
        """
        問題<p_id>内のすべてのQuestion Nodeのユーザー入力を
        progressテーブルのq_contentに保存する
        """
        write_content = r"""INSERT INTO user.progress(p_id, q_status, q_content)
            VALUES (:p_id, '{}', :q_content) 
            ON CONFLICT(p_id) DO UPDATE SET
            q_content=:q_content
            """
        write_p_status = r"""UPDATE user.progress SET 
            p_status = 1
            WHERE p_id = :p_id AND p_status == 0"""

        g.db.write_to_db((write_content, write_p_status), p_id=p_id, 
                        q_content=json.dumps(self.json["q_content"]))
        self.finish({"body": json.dumps(self.json["q_content"]),
                    "DESCR": "data is successfully saved."})

    async def scoring(self, p_id:str) -> None:
        """
        問題<p_id>内の質問<q_id>について採点を行う

        Parameters
        ----------
        p_id: str
            問題のid
        """
        sql = r"""SELECT answers FROM pages WHERE p_id=:p_id"""
        c_answers = g.db.get_from_db(sql, p_id=p_id)
        try:
            assert len(c_answers) != 0, f"Problem({p_id}) does not exist."
            c_answers: dict = json.loads(c_answers[0]["answers"])

            # get all question's <q_id>
            keys: list = c_answers.keys() 
            assert len(keys) != 0, f"Problem({p_id}) has no questions."

            # get answers for specified <q_id>
            self.target_answers:list = c_answers.get(self.json["q_id"], []) 
            assert len(self.target_answers) != 0, f"Question({self.json['q_id']}) does not exist."
        except AssertionError:
            raise InvalidJSONError
        else:
            # html problem
            if self.json["ptype"] == 0: 
                result, content = self.html_scoring()
            # code test problem
            elif self.json["ptype"] == 1:  
                result, content = await self.code_scoring()
            else:
                raise InvalidJSONError
            
            q_status = 2 if False not in result else 1
            # write result to logs, progress table
            self._insert_and_update_progress(p_id=p_id, q_id=self.json["q_id"], 
                                            q_status=q_status,
                                            content=json.dumps(self.json["answers"]),
                                            keys=keys) 
            self.finish({"content": content,
                        "progress": q_status,
                        "DESCR": "Scoring complete."})

    def canceling(self, p_id:Optional[str]=None) -> None:
        """
        カーネル<kernel_id>で実行中のコードテスティングを中断する

        Parameters
        ----------
        p_id: str
            問題のid
        """
        kernel_id = self.query["kernel_id"]
        process = ProblemHandler.execute_pool.pop(kernel_id, None)
        if process is not None:
            process.kill()
            mylogger.debug(f"cancel code scoring({kernel_id})")
        self.finish({"DESCR": "Code testing is successfully canceled."})

    def html_scoring(self) -> Tuple[list, str]:
        """
        html problemの自動採点

        Returns
        -------
        result: list
            各質問の採点結果をTrue/Falseで表したlist
        content: str
            toastに表示される文字列
        """
        # 文字列マッチング
        result = []
        content = ''
        try:
            assert len(self.json["answers"]) == len(self.target_answers), "Does not match the number of questions in DB"
        except AssertionError as e:
            raise InvalidJSONError
        else:
            for i, ans in enumerate(self.json["answers"]):
                result.append(ans == self.target_answers[i])
                content += f"<p class='mb-0'>[{'o' if result[i] else 'x'}] {ans}</p>"

        return (result, content)
    
    async def code_scoring(self) -> Tuple[list, str]:
        """
        coding problem 自動採点
        
        Returns
        -------
        result: list
            各質問の採点結果をTrue/Falseで表したlist
        content: str
            toastに表示される文字列
        """
        code = "\n".join(self.json["answers"] + self.target_answers)
        with tempfile.NamedTemporaryFile(delete=True, dir=cfg.PYTHON_TEMP_DIR, suffix=".py") as tmp:
            mylogger.debug(f"create temporary file: {tmp.name}")
            file_path = os.path.join(cfg.PYTHON_TEMP_DIR, tmp.name)
            with open(file_path, "w") as f:
                f.write(code)

            process = subprocess.Popen(["python", file_path],
                                       stdout=subprocess.PIPE, 
                                       stderr=subprocess.PIPE)
            ProblemHandler.execute_pool[self.json["kernel_id"]] = process
            future = IOLoop.current().run_in_executor(None, process.communicate)
            stdout, stderr = await future 
            returncode = process.returncode

        decoded_stdout = stdout.decode()
        decoded_stderr = stderr.decode()
        mylogger.debug(f"subprocess returncode is {returncode}")

        if returncode == -9:
            result = [False]
            content = "Code Scoring has been cancelled."
        elif returncode == 0:
            result = [True]
            content = "Complete"
        else:
            result = [False]
            content = decoded_stderr

        ProblemHandler.execute_pool.pop(self.json["kernel_id"], None)
        return (result, content)

    def _insert_and_update_progress(self, p_id: str, q_id:str, q_status:int, content:str,
                                    keys: list) -> None:
        """
        採点結果logテーブル, progressテーブルに記録する
        """
        write_log = r"""INSERT INTO user.logs(p_id, category, q_id, content, result) 
            VALUES(
                :p_id, 
                (SELECT category FROM pages WHERE p_id=:p_id),
                :q_id, 
                :content,
                :status
            )
        """
        write_state = r"""INSERT INTO user.progress(p_id, q_status, q_content)
            VALUES (
            :p_id,
            JSON_OBJECT(:q_id, :status),
            JSON_OBJECT(:q_id, JSON(:content)) ) 
            ON CONFLICT(p_id) DO UPDATE SET
            q_status=JSON_SET(q_status, '$.' || :q_id, :status),
            q_content=JSON_SET(q_content, '$.' || :q_id, JSON(:content))
            """
        update_state = r"""UPDATE user.progress 
            SET p_status= 
            CASE
                WHEN {condition} AND SUM(stat.value != 2) = 0 THEN 2 
                ELSE 1
            END
            FROM JSON_EACH(q_status) AS stat
            WHERE p_id = :p_id
            """.format(condition=r" AND ".join(
                [r"JSON_TYPE(q_status, '$.{key}') IS NOT NULL".format(key=key) 
                 for key in keys]
            ))
        g.db.write_to_db((write_log, write_state, update_state), 
                         p_id=p_id, q_id=q_id,
                         status=q_status,
                         content=content)
