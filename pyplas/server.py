import asyncio
import signal
import tornado 
import tornado.websocket 
import tornado.ioloop as ioloop
import os  
import json
from jupyter_client import MultiKernelManager, KernelManager, KernelClient

mult_km = MultiKernelManager()
mult_km.updated = tornado.locks.Event()


class MainHandler(tornado.web.RequestHandler):

    async def get(self):
        self.render("index.html")


class ExecutionHandler(tornado.websocket.WebSocketHandler):

    async def open(self, id):
        global mult_km
        self.kernel_id = id
        print(f"[LOG] ws is connecting with {self.kernel_id}")
        await mult_km.updated.wait()
        self.km: KernelManager = mult_km.get_kernel(self.kernel_id)
        self.kc: KernelClient = self.km.client()
        self.kc.start_channels()        

        self.pcallback = ioloop.PeriodicCallback(self.messaging,
                                                 callback_time=5) # ms


    async def on_message(self, reseaved_msg):
        if self.pcallback.is_running:
            self.pcallback.stop()
        reseaved_msg = json.loads(reseaved_msg)
        print(f"[LOG] ws reseaved : {reseaved_msg}")
        code = reseaved_msg.get("code", None)
        self.kc.execute(code)
        self.pcallback.start()


    def messaging(self):
        print("periodic callback")
        while(1):
            try:
                outputs  = self.kc.iopub_channel.get_msg(timeout=1)
            except:
                break
            print(f"[LOG] kernel outputs msg-type: {outputs['msg_type']}")
            if outputs["msg_type"] == "execute_result":
                self.write_message({
                    "msg_type": "execute_result",
                    "output": outputs['content']['data']['text/plain']})
            if outputs["msg_type"] == "stream":
                self.write_message({
                    "msg_type": "execute_result",
                    "output": outputs["content"]["text"]}) 
            if outputs["msg_type"] == "status" and outputs["content"]['execution_state'] == "idle":
                self.pcallback.stop()
                break

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
        [query]action == restartの時, カーネルの再起動
        [query]action == interruptの時, カーネルの中断
        """
        if k_id:
            self.kernel_id = k_id
            action = self.get_query_argument(name="action", default=None)
            print(f"[KernelHandler-post] kernel_id: {self.kernel_id}")
            if action == "interrupt":
                print(f"[KernelHandler-post] Interrupt kernel")
                mult_km.interrupt_kernel(self.kernel_id)
                self.write({"status": "success"})
            elif action == "restart":
                print(f"[KernelHandler-post] Restart kernel")
                mult_km.restart_kernel(self.kernel_id)
                self.write({"status": "success"})
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
        (r'/ws/([\w-]+)/?', ExecutionHandler),
        (r"/kernel/?", KernelHandler),
        (r"/kernel/(?P<k_id>[\w-]+)/?", KernelHandler),
    ],
    template_path=os.path.join(os.getcwd(), "templates"),
    static_path=os.path.join(os.getcwd(), "static"),
    debug=True,
    websocket_ping_interval=1
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