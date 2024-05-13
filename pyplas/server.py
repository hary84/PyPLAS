import asyncio
from datetime import date, datetime
import signal
from util import InvalidJSONException, ApplicationHandler
import uuid
from typing import Union, Tuple
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
        self.cat = self.get_query_argument("category", None)

    def get(self):
        """
        問題一覧を表示
        (PATH)
            / -> カテゴリ一覧の表示
            /?category=<category> -> そのカテゴリのすべての問題を表示
        """
        if self.cat is None:
            sql = r"""SELECT cat_name FROM categories"""
            cat = self.get_from_db(sql)
            cat = [r["cat_name"] for r in cat]
            self.render("index.html", categories=cat, problem_list=[])
        else:
            sql = r"""SELECT pages.p_id, pages.title, progress.status FROM pages
            INNER JOIN categories ON pages.category = categories.cat_id
            LEFT OUTER JOIN progress ON pages.p_id = progress.p_id
            WHERE categories.cat_name = :cat_name AND pages.status = 1"""
            p_list = self.get_from_db(sql, cat_name=self.cat)
            p_list = [r for r in p_list]
            self.render("index.html", categories=[], problem_list=p_list)

class ProblemHandler(ApplicationHandler):
    """
    問題ページの表示/解答の採点を行う
    """
    def prepare(self):
        """
        JSONのロード
        [POST]
            ptype:        問題のタイプ (0-> html, 1-> coding)
            q_id:         問題id
            answers:      解答のリスト
            kernel_id:    コードを実行するカーネルのid
        """ 
        keys = ["ptype", "q_id", "answers", "kernel_id"]
        self.is_valid_json = self.load_json(validate=True, keys=keys)

    def get(self, p_id):
        """
        問題回答ページ
        (PATH)
            /problems/<p_id>
        """
        sql = r"SELECT title, page FROM pages where p_id=:p_id AND status=1"
        page = self.get_from_db(sql, p_id=p_id)

        try:
            assert len(page) != 0
            page = page[0]
        except AssertionError as e:
            print(f"[ERROR] {e}")
            self.redirect("/")
            return
        else:
            page = {"title": page["title"],
                    "page": json.loads(page["page"])}
            self.render(f"./problem.html", conponent=page, progress=[])

    async def post(self, p_id):
        """
        解答
        (PATH)
            /problems/<p_id>
        """
        self.p_id = p_id
        
        if self.is_valid_json:
            sql = r"""SELECT answers FROM pages WHERE p_id=:p_id"""
            answers = self.get_from_db(sql, p_id=self.p_id)
            try:
                assert len(answers) != 0
                self.answers = answers[0][self.json["answers"]]
            except AssertionError as e:
                pass
            if self.json["ptype"] == 0: # html problem
                result, content = self.html_scoring()
            elif self.json["ptype"] == 1: # coding problem
                result, content = self.code_scoring()
            else:
                raise KeyError
            is_perfect = False not in result 
            sql = r"""INSERT INTO logs(p_id, q_id, content, result) 
            VALUES(:p_id, :q_id, :content, :result)"""
            self.write_to_db(sql, p_id=self.p_id,
                             q_id=self.json["q_id"],
                             content=json.dumps(self.json["answers"]),
                             result=int(is_perfect))

        self.write({"html": self._render_toast(content, is_perfect)})

    def _render_toast(self,  content, stat):
        if stat == 0:
            stat = "status-error"
        elif stat == 1:
            stat = "status-success"
        return tornado.escape.to_unicode(
            self.render_string("./modules/toast.html",
                               {"result_status": stat,
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
        try:
            content = ''
            assert len(self.j["answers"]) == len(self.answers), "Does not match the number of questions in DB"
            for i, ans in self.answers:
                result.append(ans == self.j["answers"][i])
                content += "[o] " if result[i] else "[x] " + ans + "\n"
        except (KeyError, AssertionError) as e:
            content = str(e)

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
        global mult_km 
        try:
            code = self.json["code"] + self.answers
            code = "\n".join(code)
            self.kernel_id = await mult_km.start_kernel(kernel_id=self.json["kernel_id"])
            self.km: AsyncKernelManager = mult_km.get_kernel(self.kernel_id)
            self.kc: AsyncKernelClient = self.km.client()
            if (not self.kc.channels_running):
                self.kc.start_channels()
        except (KeyError, DuplicateKernelError) as e:
            pass
            
        self.kc.execute(code)
        result = [True]
        while 1:
            try:
                output = await self.kc.get_iopub_msg()
            except: 
                break 
            if output["msg_type"] == "error":
                content = "\n".join(output["content"]["traceback"])
                result[0] = False
            if output["msg_type"] == "status" and output["content"]["execution_state"] == "idle":
                break

        if result[0] == True:
            content = "Complete"

        self.kc.stop_channels()
        await mult_km.shutdown_kernel(self.kernel_id)
        return result, content

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
                if output["msg_type"] == "status" and output["content"]['execution_state'] == "idle":
                    self.write_message(json.dumps({"msg_type": "exec-end-sig", 
                                                    "has_error": self.has_error,
                                                    "node_id": self.node_id}
                                                    ))
                    self.exec.set()
                    break
                else:
                    output.update({"node_id": self.node_id})
                    self.write_message(json.dumps(output, default=self._datetime_encoda))
            except Exception as e:
                print(e)
                break

    def _datetime_encoda(self, obj):
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
    
    def on_close(self):
        print("[LOG] websocket is closing")
        

class KernelHandler(tornado.web.RequestHandler):
    """カーネル管理用 REST API"""

    def prepare(self):
        global mult_km
        mult_km.updated.clear()
        self.action = self.get_query_argument("action", default=None)


    async def get(self, k_id=None):
        """
        管理しているカーネルのidを知らせる
        (PATH)
            /kernel/          -> 管理しているすべてのカーネルを出力
            /kernel/<k_id>/   -> k_idをもつカーネルが管理下にあるか
        """
        if k_id:
            is_alive = await mult_km.is_alive(k_id)
            print(f"[KernelHandler-get] Check kernel({k_id})")
            self.write({"status": "success",
                        "is_alive": is_alive})
        else:
            print(f"[KernelHandler-get] Check all kernel")
            kernel_ids = await mult_km.list_kernel_ids()
            self.write({"status": "success",
                        "is_alive": kernel_ids})

    async def post(self, k_id=None):
        """
        カーネルの起動/再起動/中断
        (PATH)
            /kernel/                          -> ランダムなidでカーネルを起動
            /kernel/<k_id>                    -> idを指定してカーネルを起動
            /kernel/<k_id>/?action=restart    -> カーネルの再起動
            /kernel/<k_id>/?action=interrupt  -> カーネルの中断
        """
        try:    
            if k_id is not None:
                self.kernel_id = k_id
                if self.action == "interrupt":
                    km = mult_km.get_kernel(self.kernel_id)
                    await km.interrupt_kernel()
                    self.DESCR = "Kernel successfully interrupted"

                elif self.action == "restart":
                    await mult_km.shutdown_kernel(kernel_id=self.kernel_id)
                    await mult_km.start_kernel(kernel_id=self.kernel_id)
                    self.DESCR = "Kernel successfully restarted"

                elif self.action is None:
                    await mult_km.start_kernel(kernel_id=self.kernel_id)
                    self.DESCR = "Kernel successfully booted"
                else:
                    raise ValueError
            else:
                self.kernel_id = await mult_km.start_kernel()
                self.DESCR = "kernel successfully booted"
        except Exception as e:
            self.status = "error"
            self.DESCR = str(e)
        else:
            self.status = "success"

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
            if k_id is not None:
                await mult_km.shutdown_kernel(k_id, now=True)
            else:
                await mult_km.shutdown_all(now=True) 
        except Exception as e:
            self.status = "error"
        else:
            self.status = "success"

        self.write({"status": self.status})
            
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
        問題編集ページ
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
                assert len(page) != 0
                page = page[0]
                page = {"title": page["title"],
                        "page": json.loads(page["page"]),
                        "answers": json.loads(page["answers"])}
                self.render("create.html", conponent=page, is_new=False)

    def post(self, p_id):
        """
        pageの新規作成/更新
        (PATH)
            /create/new/ -> 新規保存
            /create/<p_id>/ -> 上書き保存
        """
        if p_id == "new": # 新規作成
            sql = r"""INSERT INTO pages(p_id, title, page, answers) 
            VALUES(:p_id, :title, :page, :answers)"""
            self.write_to_db(sql, p_id=p_id, title=self.json["title"], 
                             page=json.dumps(self.json["page"]),
                             answers=json.dumps(self.json["answers"]))

            self.write({"status": 1, "p_id": p_id})

        else: # 上書き保存
            sql = r"""UPDATE pages SET title=:title, page=:page, answers WHERE p_id=:p_id"""
            self.write_to_db(sql, p_id=p_id, title=self.json["title"],
                             page=json.dumps(self.json["page"]),
                             answers=json.dumps(self.json["answers"]))
            self.write({"status": 1})

    def put(self, p_id):
        """
        ページの内容以外のパラメータ(title, category, status)の編集  
        (PATH)
            /create/<p_id>/
        """
        sql = r"""UPDATE pages SET title=:title, category=:category, status=:status WHERE p_id=:p_id"""
        self.write_to_db(sql, p_id=p_id, title=self.json["title"],
                         category=self.json["category"],
                         status=self.json["status"])
        self.write({"status": 1})

    def delete(self, p_id):
        """
        問題ページの削除
        (PATH)
            /create/<p_id>/
        """
        pass


class RenderHTMLModuleHandler(tornado.web.RequestHandler):
    def prepare(self):
        self.action = self.get_query_argument("action", None)
        if self.request.headers.get("Content-Type", None) == "application/json":
            self.j = json.loads(self.request.body)

    def post(self):
        if self.action == "addMD":
            self.write({"html": self._gen_node_string(node="Explain")})
        elif self.action == "addCode":
            self.write({"html": self._gen_node_string(node="Code")})
        elif self.action == "addQ":
            self.write({"html": self._gen_node_string(node="Question")})
        else:
            self.write_error()

    def _gen_node_string(self, node:str="Explain", has_nc:bool=True):
        _nc = ""
        if node == "Explain":
            _html = strfmodule(Explain(self), editor=True, allow_del=True, inQ=self.j.get("inQ", False))
        elif node == "Code":
            _html = strfmodule(Code(self), allow_del=True, user=self.j.get("user", 0))
        elif node == "Question":
            _html = strfmodule(Question(self),q_id=uuid.uuid4(), user=1, editable=True, 
                               ptype=self.j.get("ptype", 0))
        else:
            raise KeyError
        if has_nc:
            _nc = strfmodule(NodeControl(self), question= not self.j.get("inQ", False))
            
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
        run_sync(mult_km._async_shutdown_all)()
        shutdown_event.set()
        print("[LOG] Server has been safely shut down.")

    signal.signal(signal.SIGTERM, shutdown_server)
    signal.signal(signal.SIGINT, shutdown_server)
    await shutdown_event.wait()

    
if __name__ == "__main__":
    asyncio.run(main())