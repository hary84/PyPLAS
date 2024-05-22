import asyncio
from concurrent.futures import ProcessPoolExecutor
from concurrent.futures.process import BrokenProcessPool
from datetime import datetime
import signal
import sqlite3
from util import ApplicationHandler, custom_exec, datetime_encoda
import uuid
from typing import Tuple
import tornado 
import tornado.websocket 
import tornado.ioloop as ioloop
import os  
import json
from jupyter_client import AsyncMultiKernelManager, AsyncKernelManager, AsyncKernelClient
from jupyter_client.utils import run_sync
import uimodules
from uimodules import *

mult_km = AsyncMultiKernelManager()
mult_km.updated = tornado.locks.Event()

class MainHandler(ApplicationHandler):
    
    def prepare(self):
        self.cat = self.get_query_argument("category", None)

    def get(self):
        """
        問題一覧を表示
        (PATH)
            / -> カテゴリ一覧の表示
            /?category=<category> -> そのカテゴリのすべての問題を表示
        """
        if self.cat is None: # render categories index page
            sql = r"""SELECT cat_name FROM categories"""
            cat = self.get_from_db(sql)
            cat = [r["cat_name"] for r in cat]
            p_list = []
        else: # render problem list page with specific category
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
    def prepare(self, p_id=None):
        """
        JSONのロード
        [POST] /problems/<p_id>
            ptype:        問題のタイプ (0-> html, 1-> coding)
            q_id:         問題id
            answers:      解答のリスト
            kernel_id:    コードを実行するカーネルのid
        [PUT] /problems
            kernel_id:    コードを実行するカーネルのid
        [PUT] /problems/<p_id>
            q_content:    Question Nodeのconponent部分のdict
        """ 
        if self.request.method == "POST":
            keys = ["ptype", "q_id", "answers", "kernel_id"]
        elif self.request.method == "PUT":
            keys = ["q_content"]
        else:
            keys = []
        self.is_valid_json = self.load_json(validate=True, keys=keys)

    def get(self, p_id):
        """
        問題回答ページ
        (PATH)
            /problems/<p_id>
        """
        # 問題のタイトル, コンテンツ, 進捗, 過去の回答を取得
        sql = r"""SELECT pages.title, pages.page, 
            COALESCE(JSON_EXTRACT(progress.q_status, '$'), '{}') AS q_status, 
            COALESCE(JSON_EXTRACT(progress.q_content, '$'), '{}') AS q_content
            FROM pages 
            LEFT OUTER JOIN progress ON pages.p_id = progress.p_id
            WHERE pages.p_id=:p_id AND status=1"""
        try:
            page = self.get_from_db(sql, p_id=p_id)
            assert len(page) != 0
            page:dict = page[0]
        except (AssertionError, sqlite3.Error) as e:
            print(f"[ERROR] {e.__class__.__name__}: {e}")
            self.redirect("/")
            return
        else:
            page = {"title": page["title"], # str
                    "page": json.loads(page["page"]), 
                    "q_status": json.loads(page["q_status"]), # dict: {"q_id": [0|1|2], ...}
                    "q_content": {key: json.loads(value)  # dict: {"q_id": ['content', 'content'...], ...}
                                  for key, value in json.loads(page["q_content"]).items()}
                    }
            self.render(f"./problem.html", conponent=page, progress=[])

    async def post(self, p_id):
        """
        解答の採点
        (PATH)
            /problems/<p_id>
        """
        self.p_id = p_id
        
        if self.is_valid_json: # Request-bodyのJSONが有効な形式の場合
            sql = r"""SELECT answers FROM pages WHERE p_id=:p_id"""
            c_answers = self.get_from_db(sql, p_id=self.p_id)
            try:
                assert len(c_answers) != 0
                self.q_id = self.json["q_id"]
                c_answers: dict = json.loads(c_answers[0]["answers"])
                self.keys: list = c_answers.keys() # 問題(p_id)に存在するq_idのリスト
                self.c_answers:list = c_answers[self.q_id] # 質問(q_id)の答え
            except (AssertionError, KeyError) as e:
                content = f"Question(q-id={self.q_id}) does not exist"
                result = [False]

            try:
                if self.json["ptype"] == 0: # html problem
                    print(f"[LOG] HTML Scoring")
                    result, content = self.html_scoring()
                elif self.json["ptype"] == 1: # coding problem    
                    print(f"[LOG] CODE Testing Scoring")
                    result, content = await self.code_scoring()
            except Exception as e:
                content = f"[{e.__class__.__name__}] {e}"
                result = [False]

            q_status = 2 if False not in result else 1
            try:
                # 結果をdbに書き込む
                self._insert_and_update_progress(q_status=q_status)
            except sqlite3.Error as e:
                self.finish({"status": 500})
            else:
                self.write({"html": self._render_toast(content, q_status),
                            "progress": q_status,
                            "status": 200,
                            "saved": json.dumps({"p_id": p_id, "q_id": self.q_id, "result": q_status,
                                                "answer_at": datetime.now().strftime("%Y/%m/%d %H:%M:%S")})
                            })

    def _insert_and_update_progress(self, q_status: int) -> None:
        """
        採点結果logテーブル, progressテーブルに記録する
        """
        write_log = r"""INSERT INTO logs(p_id, q_id, content, result) 
            VALUES(:p_id, :q_id, :content, :status)
            """
        write_state = r"""INSERT INTO progress(p_id, q_status, q_content)
            VALUES (
            :p_id,
            JSON_OBJECT(JSON_QUOTE(:q_id), :status),
            JSON_OBJECT(JSON_QUOTE(:q_id), :content) ) 
            ON CONFLICT(p_id) DO UPDATE SET
            q_status=JSON_SET(q_status, '$.' || :q_id, :status),
            q_content=JSON_SET(q_content, '$.' || :q_id, :content)
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
                 for key in self.keys]
            ))
        self.write_to_db((write_log, write_state, update_state), 
                         p_id=self.p_id, q_id=self.q_id,
                         status=q_status,
                         content=json.dumps(self.json["answers"]))

    def _render_toast(self, content: str, stat: int) -> str:
        """
        templates/moduels/toast.htmlにパラメータを渡して文字列として返す
        """
        if stat == 1:
            stat = "status-error"
        elif stat == 2:
            stat = "status-success"
        return tornado.escape.to_unicode(
            self.render_string("./modules/toast.html",
                               **{"result_status": stat,
                                "result_content": content})
        )
    
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
        result = []

        # 文字列マッチング
        try:
            content = ''
            assert len(self.json["answers"]) == len(self.c_answers), "Does not match the number of questions in DB"
            for i, ans in enumerate(self.json["answers"]):
                result.append(ans == self.c_answers[i])
                content += f"<p class='mb-0'>[{'o' if result[i] else 'x'}] {ans}</p>"
        except (KeyError, AssertionError):
            raise

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
        self.kernel_id = self.json["kernel_id"]
        code = "\n".join(self.json["answers"] + self.c_answers)
        executor = ProcessPoolExecutor(max_workers=1)
        future = ioloop.IOLoop.current().run_in_executor(executor, custom_exec, code)
        ProblemHandler.execute_pool[self.kernel_id] = [executor, future]
        try:
            await future
        except BrokenProcessPool as e:
            result = [False]
            content = f"[Cancel]: The code execution process has been destroyed."
        except Exception as e:
            raise
        else:
            result = [True]
            content = "Complete"
        finally:
            ProblemHandler.execute_pool.pop(self.kernel_id, None)

        return (result, content)
    

    def put(self, p_id):
        """
        入力の保存
        (path) 
            /problems/<p_id     
        """
        if self.is_valid_json:
            write_content = r"""INSERT INTO progress(p_id, q_status, q_content)
                VALUES (:p_id, '{}', :q_content ) 
                ON CONFLICT(p_id) DO UPDATE SET
                q_content=:q_content
                """
            try:
                for key, value in self.json["q_content"]:
                    assert isinstance(key, str)
                    assert isinstance(value, list)
                self.write_to_db(write_content, p_id=p_id, 
                             q_content=json.dumps(self.json["q_content"]))
            except AssertionError as e:
                print(f"PUT /problems/{p_id}: {e}")
                self.finish({"status": 406,
                             "DESCR": "DATA KEY OR VALUE IS NOT ACCEPTABLE"})
            except sqlite3.Error as e:
                print(f"PUT /problems/{p_id}: {e}")
                self.finish({"status": 500,
                             "DESCR": "FILURE TO SAVE DATA"})
            else:
                self.finish({"status": 200,
                             "body": json.dumps(self.json["q_content"]),
                             "DESCR": "DATA SUCCESSFULLY SAVED"})
                
    def delete(self, p_id):
        """
        カーネル<p_id>で実行中のコードテスティングを中断する
        """
        print("[ProblemHandler PUT] cancel exec")
        executor, future = ProblemHandler.execute_pool.pop(p_id, [None, None])
        if executor is not None:
            for e in executor._processes.values():
                e.kill()
        self.finish({"status": 200,
                     "DESCR": "CODE TESTING IS SUCCESSFULLY CANCELED"})

class ExecutionHandler(tornado.websocket.WebSocketHandler):
    """コード実行管理"""

    async def open(self, id: str):
        global mult_km

        self.kernel_id = id
        self.exec = tornado.locks.Event()
        self.exec.set()
        await mult_km.updated.wait()
        self.km: AsyncKernelManager = mult_km.get_kernel(self.kernel_id)
        self.kc: AsyncKernelClient = self.km.client()
        if not self.kc.channels_running:
            self.kc.start_channels()
        print(f"[LOG] WS is connecting with {self.kernel_id}")

    async def on_message(self, received_msg: dict):
        """メッセージ受信時の処理

        received_msg: dict
            code: str
            node_id: str
        """
        received_msg = json.loads(received_msg)
        print(f"[LOG] WebSocket receive {received_msg}")
        await self.exec.wait()
        _code = received_msg.get("code", None)
        self.node_id = received_msg.get("node_id", None)
        self.has_error = False
        self.kc.execute(_code)
        self.exec.clear()
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
                if output["msg_type"] == "error":
                    self.has_error = True
                if output["content"].get('execution_state', None) == "idle":
                    self.write_message(json.dumps({
                        "msg_type": "exec-end-sig", 
                        "has_error": self.has_error,
                        "node_id": self.node_id}))
                    self.exec.set()
                    break
                else:
                    output.update({"node_id": self.node_id})
                    self.write_message(json.dumps(output, datetime_encoda))
            except Exception as e:
                print(e)
                break

    def on_close(self):
        print("[LOG] websocket is closing")
        

class KernelHandler(ApplicationHandler):
    """カーネル管理用 REST API"""

    def prepare(self):
        global mult_km
        mult_km.updated.clear()
        self.action = self.get_query_argument("action", default=None)

    async def get(self, k_id=None):
        """
        (PATH)
            /kernel/          -> 管理しているすべてのカーネルを出力
            /kernel/<k_id>/   -> k_idをもつカーネルが管理下にあるか
        """
        if k_id is None:
            print(f"[KernelHandler GET] Check all kernel")
            kernel_ids = await mult_km.list_kernel_ids()
            self.write({"status": 200,
                        "kernel_ids": kernel_ids})
        else:
            try:
                print(f"[KernelHandler GET] Check kernel({k_id})")
                is_alive = await mult_km.is_alive(k_id)
                self.finish({"status": 200,
                            "kernel_id": k_id,
                            "is_alive": is_alive})
            except KeyError as e:
                self.finish({"status": 500,
                             "DESCR": str(e)})


    async def post(self, k_id=None):
        """
        (PATH)
            /kernel/                          -> ランダムなidでカーネルを起動
            /kernel/<k_id>                    -> idを指定してカーネルを起動
            /kernel/<k_id>/?action=restart    -> カーネルの再起動
            /kernel/<k_id>/?action=interrupt  -> カーネルの中断
        """
        try:    
            if k_id is not None:
                self.kernel_id = k_id
                if self.action == "interrupt": # interrupt
                    print(f"[KernelHandler POST] kernel interrupt")
                    km = mult_km.get_kernel(self.kernel_id)
                    await km.interrupt_kernel()
                    self.DESCR = "Kernel successfully interrupted"

                elif self.action == "restart": # restart
                    print(f"[KernelHandler POST] kernel restart")
                    await mult_km.shutdown_kernel(kernel_id=self.kernel_id)
                    await mult_km.start_kernel(kernel_id=self.kernel_id)
                    self.DESCR = "Kernel successfully restarted"

                elif self.action is None: # start with specific kernel_id
                    print(f"[KernelHandler POST] kernel start")
                    await mult_km.start_kernel(kernel_id=self.kernel_id)
                    self.DESCR = "Kernel successfully booted"
                else:
                    raise ValueError
            else: # start with random kernel_id
                print(f"[KernelHandler POST] kernel start")
                self.kernel_id = await mult_km.start_kernel()
                self.DESCR = "kernel successfully booted"
        except Exception as e:
            self.status = 500
            self.DESCR = f"{e.__class__.__name__}: {e}"
        else:
            self.status = 200

        self.write({"status": self.status,
                    "DESCR": self.DESCR,
                    "kernel_id": self.kernel_id})
        
    async def delete(self, k_id=None):
        """
        カーネルを停止する.
        (PATH)
            /kernel/          -> すべてのカーネルを停止する
            /kernel/<k_id>/   -> k_idのkernel_idをもつカーネルを停止する
        """
        try:
            if k_id is not None: # shutdown specific kernel_id
                await mult_km.shutdown_kernel(k_id, now=True)
            else: # shutdown all kernel
                await mult_km.shutdown_all(now=True) 
        except Exception as e:
            status = 500
            descr = "FAIL TO SHUTDOWN KERNEL"
        else:
            status = 200
            descr = "KERNEL IS SUCCESSFULLY SHUTDOWN"

        self.write({"status": status,
                    "kernel_id": k_id,
                    "DESCR": descr})
            
    def on_finish(self):
        mult_km.updated.set()

class ProblemCreateHandler(ApplicationHandler):
    """
    問題作成モード
    """
    def prepare(self):
        """
        POST/PUT時のJSONをロード
        [POST]
            title:     タイトル
            page:      ページの構成要素のJSON
            answers:   {<q_id>: [ans...]}
        [PUT]
            title:     タイトル
            category:  問題カテゴリ
            status:    公開/非公開を決めるパラメータ
        """
        if self.request.method == "POST":
            keys = ["title", "page", "answers"]
            self.is_valid_json = self.load_json(validate=True, keys=keys)
        elif self.request.method == "PUT":
            keys = ["title", "category", "status"]
            self.is_valid_json = self.load_json(validate=True, keys=keys)
            
    def get(self, p_id=None):
        """
        (PATH)
            /create/ -> 問題リスト
            /create/new -> 新規問題作成ページ
            /create/<p_id(uuid)> -> 問題編集ページ
        """
        if p_id is None: # 問題index
            sql = r"""SELECT p_id, title, category, status FROM pages"""
            problems = self.get_from_db(sql)
            sql = r"""SELECT * FROM categories"""
            cates = self.get_from_db(sql)
            problems = [r for r in problems] 
            cates = [r for r in cates]
            self.render("create_index.html", problem_list=problems, categories=cates)

        else: # 編集ページ
            if p_id == "new": # 新規作成
                self.render("create.html", conponent={}, answers={}, is_new=True)
            else: # 編集
                sql = r"SELECT title, page, answers FROM pages where p_id = :p_id"
                page = self.get_from_db(sql, p_id=p_id)
                try:
                    assert len(page) != 0
                except AssertionError:
                    self.redirect("/create")
                else:
                    page = page[0]
                    page = {"title": page["title"],
                            "page": json.loads(page["page"]),
                            "answers": json.loads(page["answers"])}
                    self.render("create.html", conponent=page, is_new=False)

    def post(self, p_id):
        """
        (PATH)
            /create/new/ -> 新規保存
            /create/<p_id>/ -> 上書き保存
        """
        if p_id == "new": # 新規作成
            self.p_id = str(uuid.uuid4())
            sql = r"""INSERT INTO pages(p_id, title, page, answers) 
            VALUES(:p_id, :title, :page, :answers)"""
            try:
                self.write_to_db(sql, p_id=self.p_id, title=self.json["title"], 
                                page=json.dumps(self.json["page"]),
                                answers=json.dumps(self.json["answers"]))
            except sqlite3.Error:
                self.finish({"status": 500, "DESCR": "FAILURE TO REGISTER NEW PROBLEM"})
            else:
                self.finish({"status": 200, "p_id": self.p_id})

        else: # 上書き保存
            sql = r"""UPDATE pages SET title=:title, page=:page, answers=:answers WHERE p_id=:p_id"""
            try:
                self.write_to_db(sql, p_id=p_id, title=self.json["title"],
                                page=json.dumps(self.json["page"]),
                                answers=json.dumps(self.json["answers"]))
            except sqlite3.Error as e:
                print(f"POST /create/{p_id}: {e}")
                self.finish({"status": 500, "DESCR": f"FAILURE TO EDIT {p_id}"})
            else:
                self.finish({"status": 200, "p_id": p_id})

    def put(self, p_id):
        """
        ページの内容以外のパラメータ(title, category, status)の編集  
        (PATH)
            /create/<p_id>/
        """
        sql = r"""UPDATE pages SET title=:title, category=:category, status=:status WHERE p_id=:p_id"""
        try:
            self.write_to_db(sql, p_id=p_id, title=self.json["title"],
                            category=self.json["category"],
                            status=self.json["status"])
        except sqlite3.Error as e:
            print(f"PUT /create/{p_id}: {e}")
            self.finish({"status": 500, "profile": json.dumps(self.json), 
                         "DESCR": f"FAILURE TO UPDATE {p_id}'s PROFILE"})
        else:
            self.write({"status": 200, "profile": json.dumps(self.json)})

    def delete(self, p_id):
        """
        問題ページの削除
        (PATH)
            /create/<p_id>/
        """
        sql = r"""DELETE FROM pages WHERE p_id=:p_id"""
        try:
            self.write_to_db(sql, p_id=p_id)
        except sqlite3.Error as e:
            print(f"DELETE /create/{p_id}: {e}")
            self.finish({"status": 500, "p_id": p_id})
        else:
            self.finish({"status": 200})


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
        (r"/problems/(?P<p_id>[\w-]+)/?", ProblemHandler),
        (r'/ws/([\w-]+)/?', ExecutionHandler),
        (r"/kernel/?", KernelHandler),
        (r"/kernel/(?P<k_id>[\w-]+)/?", KernelHandler),
        (r"/create/?", ProblemCreateHandler),
        (r"/create/(?P<p_id>[\w-]+)/?", ProblemCreateHandler),
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