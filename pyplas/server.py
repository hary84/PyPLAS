import asyncio
from concurrent.futures import ProcessPoolExecutor
from concurrent.futures.process import BrokenProcessPool
import signal
import sqlite3
from util import ApplicationHandler, InvalidJSONError, custom_exec, datetime_encoda
import uuid
from typing import Optional, Tuple
import tornado 
import tornado.websocket 
import tornado.ioloop as ioloop
import os  
import json
from jupyter_client import AsyncMultiKernelManager, AsyncKernelManager, AsyncKernelClient
from jupyter_client.multikernelmanager import DuplicateKernelError
from jupyter_client.utils import run_sync
import uimodules
from uimodules import *

mult_km = AsyncMultiKernelManager()
mult_km.updated = tornado.locks.Event()

class MainHandler(ApplicationHandler):
    
    def prepare(self):
        print(f"[{self.request.method}] {self.request.uri}")
        self.cat = self.get_query_argument("category", None)

    def get(self):
        """
        PATH
            * / -> カテゴリ一覧の表示
            * /?category=<category> -> そのカテゴリのすべての問題を表示
        """
        if self.cat is None: # カテゴリ一覧を表示
            sql = r"""SELECT cat_name FROM categories"""
            cat = self.get_from_db(sql)
            cat = [r["cat_name"] for r in cat]
            p_list = []
        else: # あるカテゴリに属する問題一覧を表示
            sql = r"""SELECT pages.p_id, pages.title, COALESCE(progress.p_status, 0) AS p_status 
            FROM pages INNER JOIN categories ON pages.category = categories.cat_id
            LEFT OUTER JOIN progress ON pages.p_id = progress.p_id
            WHERE categories.cat_name = :cat_name AND pages.status = 1"""
            p_list = self.get_from_db(sql, cat_name=self.cat)
            p_list = [r for r in p_list]
            cat = []

        self.render("index.html", categories=cat, problem_list=p_list)

class ProblemHandler(ApplicationHandler):

    execute_pool = {}
    def prepare(self):
        print(f"[{self.request.method}] {self.request.uri}")

    def get(self, p_id:Optional[str]=None, action:Optional[str]=None) -> None:
        """
        PATH
            * /problems           : / へリダイレクト
            * /problems/<p_id>    : 問題を表示
        """
        # GET /problems
        if p_id is None and action is None: 
            self.redirect("/", permanent=True)
            return 
        
        # GET /problems/<p_id>
        elif p_id is not None and action is None: 
            sql = r"""SELECT pages.title, pages.page, 
                COALESCE(progress.q_status, '{}') AS q_status, 
                COALESCE(progress.q_content, '{}') AS q_content
                FROM pages 
                LEFT OUTER JOIN progress ON pages.p_id = progress.p_id
                WHERE pages.p_id=:p_id AND status=1"""
            try:
                page = self.get_from_db(sql, p_id=p_id)
                assert len(page) != 0
            except (AssertionError, sqlite3.Error) as e:
                print(f"[ERROR] {e.__class__.__name__}: {e}")
                self.write_error()
                return
            else:
                page:dict = page[0]
                self.render(f"./problem.html", 
                            title=page["title"],
                            page=json.loads(page["page"]),
                            q_status=json.loads(page["q_status"]),
                            q_content=json.loads(page["q_content"]),
                            progress=[])

        # GET /problems/<p_id>/<action>    
        elif p_id is not None and action is not None: 
            self.write_error()

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
                self.set_status(404)
                self.finish({"DESCR": f"{self.request.full_url()} is not found."})
            
            # POST /problems/<p_id>
            elif p_id is not None and action is None:
                self.set_status(404)
                self.finish({"DESCR": f"{self.request.full_url()} is not found."})

            # POST /problems/<p_id>/<action>
            elif p_id is not None and action is not None:
                if action == "save":
                    self.load_json(validate=True, keys=["q_content"])
                    self.saving(p_id)
                elif action == "scoring":
                    self.load_json(validate=True, keys=["q_id", "ptype", "answers", "kernel_id"])
                    await self.scoring(p_id)
                elif action == "cancel":
                    self.load_url_queries(["kernel_id"])
                    self.canceling(p_id)
                else:
                    self.set_status(404)
                    self.finish({"DESCR": f"{self.request.full_url()} is not found."})
        except (InvalidJSONError, tornado.web.MissingArgumentError, sqlite3.Error):
            self.print_traceback()
            self.set_status(400)
            self.finish({"DESCR": "Invalid request message or Invalid url query"})

    def saving(self, p_id:str) -> None:
        """
        問題<p_id>内のすべてのQuestion Nodeのユーザー入力を
        progressテーブルのq_contentに保存する
        """
        write_content = r"""INSERT INTO progress(p_id, q_status, q_content)
            VALUES (:p_id, '{}', :q_content) 
            ON CONFLICT(p_id) DO UPDATE SET
            q_content=:q_content
            """
        try:
            for key, value in self.json["q_content"].items():
                assert isinstance(key, str), "data key is invalid type. expected 'str'"
                assert isinstance(value, list), "data value is invalid type. expected 'list'"
            self.write_to_db(write_content, p_id=p_id, 
                            q_content=json.dumps(self.json["q_content"]))
        except AssertionError:
            raise InvalidJSONError
        except sqlite3.Error:
            self.print_traceback()
            raise
        else:
            self.finish({"body": json.dumps(self.json["q_content"]),
                        "DESCR": "data is successfully saved."})

    async def scoring(self, p_id:str) -> None:
        """
        問題<p_id>内の質問<q_id>について採点を行う
        """
        sql = r"""SELECT answers FROM pages WHERE p_id=:p_id"""
        c_answers = self.get_from_db(sql, p_id=p_id)
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
            elif self.json["ptype"] == 1: #  
                result, content = await self.code_scoring()
            q_status = 2 if False not in result else 1
            try:
                # write result to logs, progress table
                self._insert_and_update_progress(p_id=p_id, q_id=self.json["q_id"], 
                                                 q_status=q_status,
                                                 content=json.dumps(self.json["answers"]),
                                                 keys=keys) 
            except sqlite3.Error:
                self.print_traceback()
                raise 
            else:
                self.finish({"content": content,
                             "progress": q_status,
                             "DESCR": "Scoring complete."})

    def canceling(self, p_id:Optional[str]=None) -> None:
        """
        カーネル<kernel_id>で実行中のコードテスティングを中断する
        """
        executor = ProblemHandler.execute_pool.pop(self.query["kernel_id"], None)
        if executor is not None:
            for e in executor._processes.values():
                e.kill()
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
        # set up test kernel
        kernel_id = self.json["kernel_id"]
        code = "\n".join(self.json["answers"] + self.target_answers)
        executor = ProcessPoolExecutor(max_workers=1)
        future = ioloop.IOLoop.current().run_in_executor(executor, custom_exec, code)
        ProblemHandler.execute_pool[kernel_id] = executor
        try:
            await future
        except BrokenProcessPool as e:
            result = [False]
            content = f"[Cancel]: The code execution process has been destroyed."
        except Exception as e:
            result = [False]
            content = f"[{e.__class__.__name__}] {e}"
        else:
            result = [True]
            content = "Complete"
        finally:
            ProblemHandler.execute_pool.pop(kernel_id, None)

        return (result, content)    

    def _insert_and_update_progress(self, p_id: str, q_id:str, q_status:int, content:str,
                                    keys: list) -> None:
        """
        採点結果logテーブル, progressテーブルに記録する
        """
        write_log = r"""INSERT INTO logs(p_id, q_id, content, result) 
            VALUES(:p_id, :q_id, :content, :status)
            """
        write_state = r"""INSERT INTO progress(p_id, q_status, q_content)
            VALUES (
            :p_id,
            JSON_OBJECT(:q_id, :status),
            JSON_OBJECT(:q_id, JSON(:content)) ) 
            ON CONFLICT(p_id) DO UPDATE SET
            q_status=JSON_SET(q_status, '$.' || :q_id, :status),
            q_content=JSON_SET(q_content, '$.' || :q_id, JSON(:content))
            """
        update_state = r"""UPDATE progress 
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
        self.write_to_db((write_log, write_state, update_state), 
                         p_id=p_id, q_id=q_id,
                         status=q_status,
                         content=content)

class ExecutionHandler(tornado.websocket.WebSocketHandler):
    """コード実行管理"""

    async def open(self, id: str):
        global mult_km

        self.kernel_id = id
        # self.exec = tornado.locks.Event()
        # self.exec.set()
        await mult_km.updated.wait()
        self.km: AsyncKernelManager = mult_km.get_kernel(self.kernel_id)
        self.kc: AsyncKernelClient = self.km.client()
        if not self.kc.channels_running:
            self.kc.start_channels()
        print(f"[WS] WS is connecting with {self.kernel_id}")

    async def on_message(self, received_msg: dict):
        """メッセージ受信時の処理

        received_msg: dict
            code: str
            node_id: str
        """
        await self.kc.wait_for_ready()
        received_msg = json.loads(received_msg)
        print(f"[WS] WebSocket receive {received_msg}")
        # await self.exec.wait()
        _code = received_msg.get("code", None)
        self.node_id = received_msg.get("node_id", None)
        self.kc.execute(_code)
        # self.exec.clear()
        ioloop.IOLoop.current().spawn_callback(self.messaging)

    async def messaging(self):
        """
        コード実行にまつわるipykernelからの一連のメッセージを受信
        """
        print("===== spawn callback =====")
        while 1:
            try:
                output = await self.kc.get_iopub_msg()
                print(f"received {output['msg_type']}")
                if output["content"].get('execution_state', None) == "idle":
                    self.write_message(json.dumps({
                        "msg_type": "exec-end-sig", 
                        "node_id": self.node_id}))
                    # self.exec.set()
                    break
                else:
                    output.update({"node_id": self.node_id})
                    self.write_message(json.dumps(output, default=datetime_encoda))
            except Exception as e:
                print(e)
                break
        print("=========================")

    def on_close(self):
        print("[WS] websocket is closing")
        

class KernelHandler(ApplicationHandler):
    """カーネル管理用 REST API"""

    def prepare(self) -> None:
        mult_km.updated.clear()
        print(f"[{self.request.method}] {self.request.uri}")

    async def get(self, k_id:Optional[str]=None, action:Optional[str]=None) -> None:
        """
        PATH
            * /kernel             :管理しているすべてのカーネルを出力
            * /kernel/<k_id>/     :k_idをもつカーネルが管理下にあるか
        """
        # GET /kernel
        if k_id is None and action is None:
            kernel_ids = mult_km.list_kernel_ids()
            self.finish({
                "kernel_ids": kernel_ids,
                "DESCR": "Get a list of kernels managed by the server."
            })

        # GET /kernel/<k_id>
        elif k_id is not None and action is None:
            try:
                is_alive = await mult_km.is_alive(k_id)
            except KeyError:
                is_alive = False
            self.finish({
                "kernel_id": k_id,
                "is_alive": is_alive,
                "DESCR": "Get the kernel state(alive or not)"
            })

        # GET /kernel/<k_id>/<action>
        elif k_id is not None and action is not None:
            self.write_error()


    async def post(self, k_id:Optional[str]=None, action:Optional[str]=None) -> None:
        """
        PATH
            * /kernel/                          : ランダムなidでカーネルを起動
            * /kernel/<k_id>                    : idを指定してカーネルを起動
            * /kernel/<k_id>/restart            : カーネルの再起動
            * /kernel/<k_id>/interrupt          : カーネルの中断
        """
        try:
            # POST /kernel
            if k_id is None and action is None:
                await self.kernel_start()

            # POST /kernel/<k_id>
            elif k_id is not None and action is None:
                await self.kernel_start(kernel_id=k_id)

            # POST /kernel/<k_id>/<action>
            elif k_id is not None and action is not None:
                if action == "restart":
                    await self.kernel_restart(kernel_id=k_id)
                elif action == "interrupt":
                    await self.kernel_interrupt(kernel_id=k_id)
                else:
                    self.set_status(404)
                    self.finish({"DESCR": f"{self.request.full_url()} is not found."})
        except DuplicateKernelError as e:
            self.set_status(400)
            self.finish({"DESCR": "kernel_id is already started."})
        except KeyError as e:
            self.set_status(404)
            self.finish({"DESCR": "kernel_id is not found in KM."})

    async def kernel_start(self, kernel_id:Optional[str]=None) -> None:
        """
        カーネルを起動する
        """
        try:
            if kernel_id is None:
                self.kernel_id = await mult_km.start_kernel()
            else:
                self.kernel_id = await mult_km.start_kernel(kernel_id=kernel_id)
        except DuplicateKernelError as e:
            raise
        else:
            self.finish({"kernel_id": self.kernel_id,
                         "DESCR": "Kernel is successfully started."})

    async def kernel_restart(self, kernel_id:str) -> None:
        """
        カーネルを再起動する
        """
        try:
            await mult_km.shutdown_kernel(kernel_id=kernel_id)
            await mult_km.start_kernel(kernel_id=kernel_id)
        except KeyError as e:
            raise
        else:
            self.finish({"kernel_id": kernel_id,
                         "DESCR": "Kernel is successfully restarted."})

    async def kernel_interrupt(self, kernel_id:str) -> None:
        """
        カーネルの実行を中断する
        """
        try:
            km = mult_km.get_kernel(kernel_id)
            await km.interrupt_kernel()
        except KeyError as e:
            raise
        else:
            self.finish({"kernel_id": kernel_id,
                         "DESCR": "Kernel is successfully interrupted."})

    async def delete(self, k_id:Optional[str]=None, action:Optional[str]=None):
        """
        PATH
            * /kernel          : すべてのカーネルを停止する
            * /kernel/<k_id>   : k_idのkernel_idをもつカーネルを停止する
        """
        try:
            # DELETE /kernel
            if k_id is None and action is None:
                await self.kernel_shutdown()

            # DELETE /kernel/<k_id>
            elif k_id is not None and action is None:
                await self.kernel_shutdown(kernel_id=k_id)
            
            # DELETE /kernel/<k_id>/<action>
            elif k_id is not None and action is not None:
                self.set_status(404)
                self.finish({"DESCR": f"{self.request.full_url()} is not found."})
        except KeyError:
            self.set_status(404)
            self.finish({"DESCR": "Kernel_id is not found in KM."})
           
    async def kernel_shutdown(self, kernel_id:Optional[str]=None) -> None:
        """
        カーネルを停止する
        """
        # shutdown all
        if kernel_id is None:
            await mult_km.shutdown_all(now=True)
            self.finish({"DESCR": "All kernel is successfully shutted down."})
        # shutdown specified kernel
        else:
            try:
                await mult_km.shutdown_kernel(kernel_id, now=True)
            except KeyError:
                raise
            else:
                self.finish({"kernel_id": kernel_id,
                             "DESCR": f"Kernel({kernel_id}) is successfully shutted down."})

    def on_finish(self):
        mult_km.updated.set()

class ProblemCreateHandler(ApplicationHandler):
    """
    問題作成モード
    """
    def prepare(self):
        print(f"[{self.request.method}] {self.request.uri}")
            
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
            problems = self.get_from_db(sql)
            sql = r"""SELECT * FROM categories"""
            cates = self.get_from_db(sql)
            problems = [r for r in problems] 
            cates = [r for r in cates]
            self.render("create_index.html", problem_list=problems, categories=cates)
            
        # GET /create/<p_id>
        elif p_id is not None and action is None:
            self.render_edit(p_id=p_id)

        # GET /create/<p_id>/<action>
        elif p_id is not None and action is not None:
            self.write_error()

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
                        is_new=True)

        # edit exist page   
        else:
            sql = r"SELECT title, page, answers FROM pages where p_id = :p_id"
            page = self.get_from_db(sql, p_id=p_id)
            try:
                assert len(page) != 0
            except AssertionError:
                self.redirect("/create")
            else:
                page = page[0]
                self.render("create.html",
                            title=page["title"],
                            page=json.loads(page["page"]),
                            answers=json.loads(page["answers"]),
                            is_new=False)

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
                self.set_status(404)
                self.finish({"DESCR": f"{self.request.full_url()} is not found."})

            # POST /create/<p_id>
            elif p_id is not None and action is None:
                if p_id == "profile":
                    self.load_json(validate=True, keys=["profiles"])
                    self.update_profile()
                else:
                    self.set_status(404)
                    self.finish({"DESCR": f"{self.request.full_url()} is not found"})

            # POST /create/<p_id>/<action>
            elif p_id is not None and action is not None:
                if action == "register":
                    self.load_json(validate=True, keys=["title", "page", "answers"])
                    self.register(p_id=p_id)
                else:
                    self.set_status(404)
                    self.finish({"DESCR": f"{self.request.full_url()} is not found."})
        except (InvalidJSONError, sqlite3.Error):
            self.set_status(400)
            self.finish({"DESCR": "Invalid request message or Invalid url query"})

    def register(self, p_id:str) -> None:
        """
        問題をpagesテーブルに登録する
        """
        # register new problem
        if p_id == "new": 
            self.p_id = str(uuid.uuid4())
            sql = r"""INSERT INTO pages(p_id, title, page, answers) 
            VALUES(:p_id, :title, :page, :answers)"""
            try:
                self.write_to_db(sql, p_id=self.p_id, title=self.json["title"], 
                                page=json.dumps(self.json["page"]),
                                answers=json.dumps(self.json["answers"]))
            except sqlite3.Error:
                self.print_traceback()
                raise 
            else:
                self.finish({"p_id": self.p_id,
                             "DESCR": "New Problem is successfully registered."})
        # edit exist problem
        else: 
            sql = r"""UPDATE pages SET title=:title, page=:page, answers=:answers 
            WHERE p_id=:p_id"""
            try:
                self.write_to_db(sql, p_id=p_id, title=self.json["title"],
                                page=json.dumps(self.json["page"]),
                                answers=json.dumps(self.json["answers"]))
            except sqlite3.Error:
                self.print_traceback()
                raise 
            else:
                self.finish({"p_id": p_id,
                             "DESCR": f"Problem({p_id}) is successfully saved."})

    def update_profile(self) -> None:
        """
        pagesテーブルのprofile(title, category, status)を変更する
        """
        sql = r"""UPDATE pages SET title=:title, category=:category, status=:status 
        WHERE p_id=:p_id"""
        try:
            params = [{"p_id": key} | v for key, v in self.json["profiles"].items()]
            self.write_to_db_many(sql, params)
        except sqlite3.Error:
            self.print_traceback()
            raise 
        else:
            self.write({"profile": json.dumps(self.json),
                        "DESCR": "problem profile is successfully updated."})

    def delete(self, p_id:Optional[str]=None, action:Optional[str]=None) -> None:
        """
        PATH
            * /create/<p_id>    :問題<p_id>を削除する
        """
        # DELETE /create
        if p_id is None and action is None:
            self.set_status(404)
            self.finish({"DESCR": f"{self.request.full_url()} is not found."})

        # DELETE /create/<p_id>
        elif p_id is not None and action is None:
            sql = r"""DELETE FROM pages WHERE p_id=:p_id"""
            try:
                self.write_to_db(sql, p_id=p_id)
            except sqlite3.Error as e:
                self.print_traceback()
                raise
            else:
                self.finish({"kernel_id": p_id,
                             "DESCR": f"Problem({p_id}) is successfully deleted."})
                
        # DELETE /create/<p_id>/<action>
        elif p_id is not None and action is not None:
            self.set_status(404)
            self.finish({"DESCR": f"{self.request.full_url()} is not found."})


class RenderHTMLModuleHandler(tornado.web.RequestHandler):
    def prepare(self):
        self.action = self.get_query_argument("action", None)
        if self.request.headers.get("Content-Type", None) == "application/json":
            self.j: dict = json.loads(self.request.body)

    def post(self):
        if self.action == "addMD":
            self.write({"html": self._gen_node_string(node="Explain")})
        elif self.action == "addCode":
            self.write({"html": self._gen_node_string(node="Code", 
                                                      explain=bool(self.j.get("user", 0)),
                                                      question=not(self.j.get("inQ", True)))
                        })
        elif self.action == "addQ":
            self.write({"html": self._gen_node_string(node="Question")})
        else:
            self.write_error()

    def _gen_node_string(self, node:str="Explain", **kwargs):
        if node == "Explain":
            _html = strfmodule(Explain(self), editor=True, allow_del=True)
        elif node == "Code":
            _html = strfmodule(Code(self), allow_del=True, user=self.j.get("user", 0))
        elif node == "Question":
            _html = strfmodule(Question(self),q_id=uuid.uuid4(), user=1, editable=True, 
                               ptype=self.j.get("ptype", 0))
        else:
            raise KeyError
        _nc = strfmodule(NodeControl(self), **kwargs)
            
        return _html + "\n" + _nc 


def make_app():
    return tornado.web.Application([
        (r"/", MainHandler),
        (r"/problems/?", ProblemHandler),
        (r"/problems/(?P<p_id>[\w-]+)/?", ProblemHandler),
        (r"/problems/(?P<p_id>[\w-]+)/(?P<action>[\w]+)/?", ProblemHandler),
        (r'/ws/([\w-]+)/?', ExecutionHandler),
        (r"/kernel/?", KernelHandler),
        (r"/kernel/(?P<k_id>[\w-]+)/?", KernelHandler),
        (r"/kernel/(?P<k_id>[\w-]+)/(?P<action>[\w]+)/?", KernelHandler),
        (r"/create/?", ProblemCreateHandler),
        (r"/create/(?P<p_id>[\w-]*)/?", ProblemCreateHandler),
        (r"/create/(?P<p_id>[\w-]+)/(?P<action>[\w]+)/?", ProblemCreateHandler),
        (r"/api/render/?", RenderHTMLModuleHandler)
    ],
    template_path=os.path.join(os.getcwd(), "templates"),
    static_path=os.path.join(os.getcwd(), "static"),
    db_path=os.path.join(os.getcwd(), "pyplas.db"),
    debug=True,
    ui_modules=uimodules
    )

async def main():
    app = make_app()
    app.listen(8888)
    shutdown_event = asyncio.Event()

    def shutdown_server(signum, frame):
        for ex, f in ProblemHandler.execute_pool.values():
            for e in ex._processes.values():
                print(f"[LOG] Process: {e} is killed")
                e.kill()
        run_sync(mult_km._async_shutdown_all)()
        print("[LOG] Server has been safely shut down.")
        shutdown_event.set()

    signal.signal(signal.SIGTERM, shutdown_server)
    signal.signal(signal.SIGINT, shutdown_server)
    await shutdown_event.wait()

if __name__ == "__main__":
    asyncio.run(main())