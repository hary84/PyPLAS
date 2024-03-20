import asyncio
import signal
import tornado 
import tornado.websocket 
import tornado.ioloop as ioloop
import os  
import re
import json
import glob
from jupyter_client import MultiKernelManager, KernelManager, KernelClient
from jupyter_client.multikernelmanager import DuplicateKernelError
import uimodules

mult_km = MultiKernelManager()
mult_km.updated = tornado.locks.Event()
problems = []

class MainHandler(tornado.web.RequestHandler):
        
    def get(self):
        problem_files = glob.glob("./templates/problems/*.html")
        problem_files = [ f"/problems/{os.path.splitext(os.path.basename(file))[0]}" 
                        for file in problem_files]
        self.render("index.html", problem_files=problem_files,
                    is_problem_page=False)

class ProblemHandler(tornado.web.RequestHandler):

    def get(self, p_id):
        self.render(f"./problems/{p_id}.html", 
                    is_problem_page=True)
    
class ExecutionHandler(tornado.websocket.WebSocketHandler):

    async def open(self, id: str):
        global mult_km


        self.kernel_id = id
        self.exec = tornado.locks.Event()
        self.exec.set()
        self.que = tornado.queues.Queue()
        await mult_km.updated.wait()
        self.km: KernelManager = mult_km.get_kernel(self.kernel_id)
        self.kc: KernelClient = self.km.client()
        self.kc.start_channels()        
        print(f"[LOG] ws is connecting with {self.kernel_id}")

        self.pcallback = ioloop.PeriodicCallback(self.messaging,
                                                 callback_time=5) # ms


    async def on_message(self, reseaved_msg: dict):
        reseaved_msg = json.loads(reseaved_msg)
        print(f"[LOG] ws reseaved : {reseaved_msg}")
        code = reseaved_msg.get("code", None)
        self.que.put(code)
        while True:
            await self.exec.wait()
            try:
                code = await self.que.get(timeout=1)
            except:
                break
            self.kc.execute(code)
            self.exec.clear()
            self.pcallback.start()


    def messaging(self):
        print("periodic callback")
        while(1):
            try:
                outputs  = self.kc.iopub_channel.get_msg(timeout=0.5)
            except:
                break
            print(f"[LOG] kernel outputs msg-type: {outputs['msg_type']}")
            content = outputs["content"]
            if outputs["msg_type"] == "execute_result":
                self.send_msg("text", content["data"]["text/plain"])
            elif outputs["msg_type"] == "stream":
                self.send_msg("text", content["text"])
            elif outputs["msg_type"] == "display_data":
                self.send_msg("text", content["data"]["text/plain"])
                self.send_msg("image/png", content["data"]["image/png"], escape=False)
            elif outputs["msg_type"] == "error":
                msg = self.decode_anci("\n".join(content["traceback"]))
                self.send_msg("error", msg)
            elif outputs["msg_type"] == "status" and outputs["content"]['execution_state'] == "idle":
                self.send_msg("status", "end")
                self.pcallback.stop()
                self.exec.set()
                print("execute complete")
                break

    def send_msg(self, msg_type: str, msg: str, escape:bool = True):
        if escape:
            msg = tornado.escape.xhtml_escape(msg)
        self.write_message({
            "msg_type": msg_type,
            "msg": msg
        })

    def decode_anci(self, msg: str):
        ANSI_TAG = r"\u001b\[[;\d]+m"
        return re.sub(ANSI_TAG, "", msg)
    
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
                mult_km.restart_kernel(self.kernel_id)
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

    signal.signal(signal.SIGINT, shutdown_server)
    await shutdown_event.wait()
    print("[LOG] Server has been safely shut down.")

    
if __name__ == "__main__":
    asyncio.run(main())