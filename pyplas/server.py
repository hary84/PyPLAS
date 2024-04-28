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

mult_km = AsyncMultiKernelManager()
mult_km.updated = tornado.locks.Event()

class MainHandler(tornado.web.RequestHandler):

    def get(self):
        with closing(sqlite3.connect("pyplas.db")) as conn:
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()
            sql = "SELECT id, title, status FROM pages"
            cur.execute(sql)
            res = cur.fetchall()

        p_list = [dict(r) for r in res]
        self.render("index.html", problem_list=p_list)
    

class ProblemHandler(tornado.web.RequestHandler):

    def prepare(self):
        self.kc = None 
        if self.request.headers.get("Content-Type", None) == "application/json":
            self.j = json.loads(self.request.body)

    def get(self, p_id):
        with closing(sqlite3.connect("pyplas.db")) as conn:
            conn.row_factory = sqlite3.Row 
            cur = conn.cursor()
            sql = f"SELECT * FROM pages where id = ?"
            cur.execute(sql, (p_id,))
            page = cur.fetchone()

            sql = f"SELECT id, title, status FROM pages"
            cur.execute(sql)
            progress = cur.fetchall()

        page = {key: page[key] if key!="page" else json.loads(page[key]) for key in page.keys()}
        progress = [dict(p) for p in progress]
        self.render(f"./problem.html", conponent=page, progress=progress)

    async def post(self, p_id):
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
        self.action = self.get_query_argument("action", None)

    def get(self, p_id=None):
        if p_id is None:
            self.write("in preparation")
        else:
            self.render("create.html")

    def post(self, p_id=None):
        if p_id is None:
            if self.action == "addMD":
                self.write({"html": self._strfhtml("./modules/explain_form.html")})
            elif self.action == "addCode":
                self.write({"html": uimodules.strfmodule(uimodules.Node(self),
                                                         allow_add=True)})
            elif self.action == "addQ":
                _type = self.get_query_argument("type", "html")
                if _type == "html":
                    mode = 1
                elif _type == "code":
                    mode = 2
                else:
                    mode = 1
                self.write({"html": uimodules.strfmodule(uimodules.Question(self),
                                                        qid=uuid.uuid4(),
                                                        allow_add=True,
                                                        mode=mode)})
            else:
                self.write_error()
        else:
            self.write("in preparation")

    def _strfhtml(self, path, **kwargs):
        return tornado.escape.to_unicode(
            self.render_string(path, **kwargs)
        )


def make_app():
    return tornado.web.Application([
        (r"/", MainHandler),
        (r"/problems/(?P<p_id>[\w-]+)/?", ProblemHandler),
        (r'/ws/([\w-]+)/?', ExecutionHandler),
        (r"/kernel/?", KernelHandler),
        (r"/kernel/(?P<k_id>[\w-]+)/?", KernelHandler),
        (r"/create/?", ProblemCreateHandler),
        (r"/create/(?P<p_id>[\w-]+)/?", ProblemCreateHandler)
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