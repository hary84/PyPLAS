import asyncio
from contextlib import closing
from datetime import date, datetime
import signal
import sqlite3
import uuid
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

class MainHandler(tornado.web.RequestHandler):
    
    def prepare(self):
        self.cat = self.get_query_argument("category", None)

    def get(self):
        """
        問題一覧を表示
        / -> カテゴリ一覧の表示
        /?category=<category> -> そのカテゴリのすべての問題を表示
        """
        if self.cat is None:
            with closing(sqlite3.connect("pyplas.db")) as conn:
                conn.row_factory = sqlite3.Row
                cur = conn.cursor()
                sql = r"""SELECT cat_name FROM categories"""
                cur.execute(sql)
                res = cur.fetchall()
            cat = [r["cat_name"] for r in res] if res is not None else []
            self.render("index.html", categories=cat, problem_list=[])
        else:
            with closing(sqlite3.connect("pyplas.db")) as conn:
                conn.row_factory = sqlite3.Row 
                cur = conn.cursor()
                sql = r"""SELECT p_id, title, progress FROM pages
                INNER JOIN categories ON pages.category = categories.cat_id
                WHERE cat_name = :cat_name AND status = 1"""
                cur.execute(sql, ({"cat_name": self.cat})) 
                res = cur.fetchall()
            problem_list = [dict(r) for r in res]
            self.render("index.html", categories=[], problem_list=problem_list)


class ProblemHandler(tornado.web.RequestHandler):

    def prepare(self):
        self.kc = None 
        if self.request.headers.get("Content-Type", None) == "application/json":
            self.j = json.loads(self.request.body)

    def get(self, p_id):
        """
        問題回答ページ
        /problems/<p_id>
        """
        with closing(sqlite3.connect("pyplas.db")) as conn:
            conn.row_factory = sqlite3.Row 
            cur = conn.cursor()
            sql = f"SELECT * FROM pages where p_id=:p_id AND status=1"
            cur.execute(sql, ({"p_id": p_id}))
            page = cur.fetchone()

        page = {key: page[key] if key!="page" else json.loads(page[key]) for key in page.keys()}
        self.render(f"./problem.html", conponent=page, progress=[])

    async def post(self, p_id):
        """
        解答
        /problems/<p_id>
        """
        global  mult_km
        self.p_id = p_id
        try:
            self.kernel_id = await mult_km.start_kernel(kernel_id=self.j["kernel_id"])
            self.km: AsyncKernelManager = mult_km.get_kernel(self.kernel_id)
        except (DuplicateKernelError, KeyError) as e:
            self._return_error_msg(e)
            return 
        self.kc: AsyncKernelClient = self.km.client()
        if (not self.kc.channels_running):
            self.kc.start_channels()
        await self.scoring()
        
    def _return_error_msg(self, e):
        prop = {"result_status": "status-error",
                "result_content": str(e)}
        html = tornado.escape.to_unicode(
            self.render_string("./modules/toast.html", **prop))
        self.write({"html": html})

    async def scoring(self):
        code = ""
        for value in self.j["code"]:
            code = code + "\n" + value
        
        with closing(sqlite3.connect("pyplas.db")) as conn:
            cur = conn.cursor()

            sql = "SELECT answers FROM answer WHERE pid=?"
            cur.execute(sql, (self.p_id,))
            answers = json.loads(cur.fetchone()[0])
            test_code = answers[self.j["qid"]].get("code", None)
            code = code + "\n" + test_code
            self.kc.execute(code)

            status = 1
            while 1:
                try:
                    output = await self.kc.get_iopub_msg()
                except:
                    break
                print(f"[LOG] scoring output msg_type: {output['msg_type']}")
                if output["msg_type"] == "error":
                    error = "\n".join(output["content"]["traceback"])
                    status = 0
                if output["msg_type"] == "status" and output["content"]["execution_state"] == "idle":
                    break

            sql = "INSERT INTO log(pid, qid, content, status) SELECT :pid, :qid, :content, :status " +\
                  "WHERE NOT EXISTS(SELECT * FROM log WHERE qid=:qid AND status=1)"
            cur.execute(sql, ({"pid": self.p_id,
                               "qid": self.j["qid"],
                               "content": str(self.j["code"]),
                               "status": status}))
            conn.commit()

        print(f"[LOG] POST RESULT SEND")

        prop = {"result_status": "status-success" if status else "status-error",
                "result_content": "Complete" if status else error}
        
        html = tornado.escape.to_unicode(
            self.render_string("./modules/toast.html", **prop)
        )
        self.write({"html": html})
        
        self.kc.stop_channels()
        await mult_km.shutdown_kernel(self.kernel_id)
        

class ExecutionHandler(tornado.websocket.WebSocketHandler):

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
        received_msg = json.loads(received_msg)
        print(f"[LOG] WS received : {received_msg}")
        await self.exec.wait()
        _code = received_msg.get("code", None)
        self.msg_meta = {"qid": received_msg.get("qid"), # identify question node
                         "id": received_msg.get("id")} # id to identify node 
        self.has_error = False
        self.kc.execute(_code)
        self.exec.clear()
        ioloop.IOLoop.current().spawn_callback(self.messaging)

    async def messaging(self):
        print("=====spawn callback=====")
        while 1:
            try:
                output = await self.kc.get_iopub_msg()
            except:
                # ioloop.IOLoop.current().spawn_callback(self.messaging2)
                break

            print("get msg = " , output["msg_type"])
            if output["msg_type"] == "error":
                self.has_error = True
            if output["msg_type"] == "status" and output["content"]['execution_state'] == "idle":
                self.write_message(json.dumps({"msg_type": "exec-end-sig", 
                                                "has_error": self.has_error} 
                                                | self.msg_meta))
                self.exec.set()
                break
            self.write_message(json.dumps(output | self.msg_meta , default=self._datetime_encoda))

    def _datetime_encoda(self, obj):
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
    
    def on_close(self):
        print("[LOG] websocket is closing")

class KernelHandler(tornado.web.RequestHandler):

    def prepare(self):
        global mult_km
        mult_km.updated.clear()


    def get(self, k_id=None):
        """
        MultiKernelManagerの管理しているすべてのidを知らせる.
        kernel_id が存在する場合, そのカーネルが動いているかを知らせる.
        """
        if k_id:
            is_alive = mult_km.is_alive(k_id)
            print(f"[KernelHandler-get] Check kernel({k_id})")
            self.write({"status": "success",
                        "is_alive": is_alive})
        else:
            print(f"[KernelHandler-get] Check all kernel")
            kernel_ids = mult_km.list_kernel_ids()
            self.write({"status": "success",
                        "is_alive": kernel_ids})

    async def post(self, k_id=None):
        """
        カーネルを起動する.
        k_idが存在する場合, 
        [query]None: 指定されたk_idでカーネルの起動
        [query]action==restart: カーネルの再起動
        [query]action==interrupt: カーネルの中断
        """
        if k_id is not None:
            self.kernel_id = k_id
            action = self.get_query_argument(name="action", default=None)
            if action == "interrupt":
                print(f"[KernelHandler-post] Interrupt kernel")
                km = mult_km.get_kernel(self.kernel_id)
                await km.interrupt_kernel()
                self.write({"status": "success"})

            elif action == "restart":
                print(f"[KernelHandler-post] Restart kernel")
                await mult_km.shutdown_kernel(kernel_id=self.kernel_id)
                await mult_km.start_kernel(kernel_id=self.kernel_id)
                self.write({"status": "success"})

            elif action is None:
                print(f"[KernelHandler-post] Start kernel with {self.kernel_id}")
                try:
                    await mult_km.start_kernel(kernel_id=self.kernel_id)
                except DuplicateKernelError as e:
                    print(e)
                    self.write({"status": "error",
                                "DESCR": f"{self.kernel_id} is already exist"})
                else:
                    self.write({"status": "success",
                                "kernel_id": self.kernel_id})
        else:
            self.kernel_id = await mult_km.start_kernel()
            print(f"[KernelHandler-post] Create new kernel({self.kernel_id})")
            self.write({"status": "success",
                        "kernel_id": self.kernel_id})
     
    async def delete(self, k_id=None):
        """
        すべてのカーネルを停止する.
        k_idが存在する場合, そのカーネルのみを停止する.
        """
        if k_id:
            print(f"[KernelHandler-delete] Stop kernel({k_id})")
            await mult_km.shutdown_kernel(k_id, now=True)
            self.write({"status": "success"})
        else:
            await mult_km.shutdown_all(now=True)
            self.write({"status": "success"})   
            
    def on_finish(self):
        mult_km.updated.set()

class ProblemCreateHandler(tornado.web.RequestHandler):

    def prepare(self):
        if self.request.headers.get("Content-Type", None) == "application/json":
            self.j = json.loads(self.request.body)

    def get(self, p_id=None):
        """
        問題編集ページ
        /create/ -> 問題リスト
        /create/new -> 新規問題作成ページ
        /create/<p_id(uuid)> -> 問題編集ページ
        """
        if p_id is None:
            with closing(sqlite3.connect("pyplas.db")) as conn:
                conn.row_factory = sqlite3.Row 
                cur = conn.cursor()
                sql = r"""SELECT p_id, title, category, status FROM pages"""
                cur.execute(sql)
                res = cur.fetchall()
                sql = r"""SELECT * FROM categories"""
                cur.execute(sql)
                cates = cur.fetchall()
            res = [dict(r) for r in res] if res is not None else []
            cates = [dict(r) for r in cates]
            self.render("create_index.html", problem_list=res, categories=cates)
        else:
            if p_id == "new":
                self.render("create.html", conponent={}, answers={}, is_new=True)
            else:
                with closing(sqlite3.connect("pyplas.db")) as conn:
                    conn.row_factory = sqlite3.Row
                    cur = conn.cursor()
                    sql = r"SELECT title, page FROM pages where p_id = :p_id"
                    cur.execute(sql, ({"p_id": p_id}))
                    res = cur.fetchone()
                    if res is None:
                        self.redirect("/create/new")
                    sql = r"SELECT answers FROM answers WHERE p_id = :p_id"
                    cur.execute(sql, ({"p_id": p_id}))
                    ans = cur.fetchone()
                    ans = json.loads(ans["answers"]) if ans is not None else {}

                res = {"title": res["title"],
                    "page": json.loads(res["page"])}
                self.render("create.html", conponent=res, answers=ans, is_new=False)

    def post(self, p_id):
        """
        pageの新規作成/更新
        /create/new/ -> 新規保存
        /create/<p_id>/ -> 上書き保存
        """
        if p_id == "new":
            with closing(sqlite3.connect("pyplas.db")) as conn:
                try:
                    p_id = str(uuid.uuid4())
                    cur = conn.cursor()
                    sql = r"""INSERT INTO pages(p_id, title, page) VALUES(:p_id, :title, :page)"""
                    cur.execute(sql, ({"p_id": p_id,
                                       "title": self.j["title"],
                                       "page": json.dumps(self.j["page"])}))
                    if len(self.j["answers"]):
                        sql = r"INSERT INTO answers(p_id, answers) VALUES(:p_id, :answers)"
                        cur.execute(sql, ({"p_id": p_id,
                                           "answers": json.dumps(self.j["answers"])}))
                except Exception as e:
                    print(e)
                    self.write({"status": 0})
                    conn.rollback()
                else:
                    # self.write({"status": 1})
                    conn.commit()
                    self.redirect(f"/create/{p_id}")

        else:
            with closing(sqlite3.connect("pyplas.db")) as conn:
                try:
                    cur = conn.cursor()
                    sql = r"""UPDATE pages SET title=:title, page=:page WHERE p_id=:p_id"""
                    cur.execute(sql, ({"p_id": p_id,
                                       "title": self.j["title"],
                                       "page": json.dumps(self.j["page"])}))
                    if (len(self.j["answers"])):
                        sql = r"""UPDATE answers SET answers=:answers WHERE p_id=:p_id"""
                        cur.execute(sql, ({"p_id": p_id,
                                           "answers": json.dumps(self.j["answers"])}))
                except Exception as e:
                    print(e)
                    self.write({"status": 0})
                    conn.rollback()
                else:
                    self.write({"status": 1})
                    conn.commit()

    def put(self, p_id=None):
        """
        ページの内容以外のパラメータ(title, category, status)の編集  
        /create/<p_id>/
        """
        with closing(sqlite3.connect("pyplas.db")) as conn:
            try:
                cur = conn.cursor()
                sql = r"""UPDATE pages SET title=:title, category=:category, status=:status WHERE p_id=:p_id"""
                cur.execute(sql, ({"p_id": p_id,
                                   "title": self.j["title"],
                                   "category": self.j["category"],
                                   "status": self.j["status"]
                                   }))
            except Exception as e:
                print(e)
                self.write({"status": 0})
                conn.rollback()
            else:
                self.write({"status": 1})
                conn.commit()

    def delete(self, p_id=None):
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