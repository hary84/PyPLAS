import asyncio
from contextlib import closing
from datetime import date, datetime
import signal
import sqlite3
import tornado 
import tornado.websocket 
import tornado.ioloop as ioloop
import os  
import json
from jupyter_client import MultiKernelManager, KernelManager, KernelClient
from jupyter_client.multikernelmanager import DuplicateKernelError
import uimodules

mult_km = MultiKernelManager()
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

    def get(self, p_id):
        with closing(sqlite3.connect("pyplas.db")) as conn:
            conn.row_factory = sqlite3.Row 
            cur = conn.cursor()
            sql = f"SELECT * FROM pages where id = {p_id}"
            cur.execute(sql)
            page = cur.fetchone()

            sql = f"SELECT id, title, status FROM pages"
            cur.execute(sql)
            progress = cur.fetchall()

        page = {key: page[key] if key!="page" else json.loads(page[key]) for key in page.keys()}
        progress = [dict(p) for p in progress]
        self.render(f"./problem.html", conponent=page, progress=progress)
    

class ExecutionHandler(tornado.websocket.WebSocketHandler):

    async def open(self, id: str):
        global mult_km

        self.kernel_id = id
        self.exec = tornado.locks.Event()
        self.exec.set()
        await mult_km.updated.wait()
        self.km: KernelManager = mult_km.get_kernel(self.kernel_id)
        self.kc: KernelClient = self.km.client()
        if not self.kc.channels_running:
            self.kc.start_channels()
        print(f"[LOG] WS is connecting with {self.kernel_id}")

        self.pcallback = ioloop.PeriodicCallback(self.messaging,
                                                 callback_time=5) # ms


    async def on_message(self, received_msg: dict):
        received_msg = json.loads(received_msg)
        print(f"[LOG] WS received : {received_msg}")
        await self.exec.wait()
        _code = received_msg.get("code", None)
        self.msg_meta = {"ops": received_msg.get("ops"), # ops: exec, test
                         "id": received_msg.get("id")} # id to identify node 
        self.has_error = False
        self.kc.execute(_code)
        self.exec.clear()
        self.pcallback.start()


    def messaging(self):
        print("periodic callback")
        _try_limit = 10
        for _ in range(_try_limit):
            try:
                outputs  = self.kc.iopub_channel.get_msg(timeout=0.5)
            except:
                break
            print(f"[LOG] kernel outputs msg-type: {outputs['msg_type']}")
            if outputs["msg_type"] == "error":
                self.has_error = True
            if outputs["msg_type"] == "status" and outputs["content"]['execution_state'] == "idle":
                self.pcallback.stop()
                self.write_message(json.dumps({"msg_type": "exec-end-sig", 
                                               "has_error": self.has_error} 
                                               | self.msg_meta))
                self.exec.set()
                break
            self.write_message(json.dumps(outputs | self.msg_meta , default=self._datetime_encoda))

    def _datetime_encoda(self, obj):
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
    
    def on_close(self):
        print("[LOG] websocket is closing")
        if self.pcallback.is_running():
            self.pcallback.stop()


class KernelHandler(tornado.web.RequestHandler):

    def initialize(self):
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

    def post(self, k_id=None):
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
                mult_km.interrupt_kernel(self.kernel_id)
                self.write({"status": "success"})
            elif action == "restart":
                print(f"[KernelHandler-post] Restart kernel")
                mult_km.shutdown_kernel(kernel_id=self.kernel_id)
                mult_km.start_kernel(kernel_id=self.kernel_id)
                self.write({"status": "success"})
            elif action is None:
                print(f"[KernelHandler-post] Start kernel with {self.kernel_id}")
                try:
                    mult_km.start_kernel(kernel_id=self.kernel_id)
                except DuplicateKernelError as e:
                    print(e)
                    self.write({"status": "error",
                                "DESCR": f"{self.kernel_id} is already exist"})
                else:
                    self.write({"status": "success",
                                "kernel_id": self.kernel_id})
        else:
            self.kernel_id = mult_km.start_kernel()
            print(f"[KernelHandler-post] Create new kernel({self.kernel_id})")
            self.write({"status": "success",
                        "kernel_id": self.kernel_id})
     
    def delete(self, k_id=None):
        """
        すべてのカーネルを停止する.
        k_idが存在する場合, そのカーネルのみを停止する.
        """
        if k_id:
            print(f"[KernelHandler-delete] Stop kernel({k_id})")
            mult_km.shutdown_kernel(k_id, now=True)
            self.write({"status": "success"})
        else:
            mult_km.shutdown_all(now=True)
            self.write({"status": "success"})   
            
    def on_finish(self):
        mult_km.updated.set()


def make_app():
    return tornado.web.Application([
        (r"/", MainHandler),
        (r"/problems/(?P<p_id>[\w-]+)/?", ProblemHandler),
        (r'/ws/([\w-]+)/?', ExecutionHandler),
        (r"/kernel/?", KernelHandler),
        (r"/kernel/(?P<k_id>[\w-]+)/?", KernelHandler),
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
        mult_km.shutdown_all()
        shutdown_event.set()

    signal.signal(signal.SIGTERM, shutdown_server)
    signal.signal(signal.SIGINT, shutdown_server)
    await shutdown_event.wait()
    print("[LOG] Server has been safely shut down.")

    
if __name__ == "__main__":
    asyncio.run(main())