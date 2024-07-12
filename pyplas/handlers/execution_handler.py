import asyncio
from datetime import datetime, date
import json 

from jupyter_client import AsyncKernelManager, AsyncKernelClient
from tornado.websocket import WebSocketHandler
from tornado.ioloop import IOLoop

from pyplas.utils import get_logger, globals as g

mylogger = get_logger(__name__)

class ExecutionHandler(WebSocketHandler):
    """コード実行管理"""

    async def open(self, id: str):

        self.kernel_id = id
        await g.km.updated.wait()
        self.km: AsyncKernelManager = g.km.get_kernel(self.kernel_id)
        self.kc: AsyncKernelClient = self.km.client()
        if not self.kc.channels_running:
            self.kc.start_channels()
        mylogger.info(f"WS OPEN {self.request.uri}")

    async def on_message(self, received_msg: dict):
        """
        メッセージ受信時の処理

        Parameters
        ----------
        received_msg: dict
            * <key> code    | <value> 実行したいコード
            * <key> node_id | <value> 実行ノードのid
        """
        await self.kc.wait_for_ready()
        received_msg = json.loads(received_msg)
        mylogger.info(f"WS RECEIVE {self.request.uri}")
        _code = received_msg.get("code", "")
        self.node_id = received_msg.get("node_id", "unknown")
        self.kc.execute(_code)
        IOLoop.current().spawn_callback(self.messaging)

    async def messaging(self):
        """
        コード実行にまつわるipykernelからの一連のメッセージを受信
        """
        while 1:
            try:
                output = await self.kc.get_iopub_msg()
                if output["content"].get('execution_state', None) == "idle":
                    self.write_message(json.dumps({
                        "msg_type": "exec-end-sig", 
                        "node_id": self.node_id}))
                    break
                else:
                    output.update({"node_id": self.node_id})
                    self.write_message(json.dumps(output, default=datetime_encoda))
            except Exception:
                break

    def on_close(self):
        mylogger.info(f"WS CLOSE({self.close_code}) {self.request.uri} ")
        if self.close_code == 1000: # when restarting kernel
            pass 
        elif self.close_code == 1001: # when closing page
            IOLoop.current().spawn_callback(wait_and_shutdown_kernel, kernel_id=self.kernel_id)
            mylogger.debug(f"kernel(kernel_id={self.kernel_id}) is stopped.")


def datetime_encoda(obj: object) -> str:
    """
    objがdatetimeオブジェクトであれば、isoformatの文字列に変換する
    """
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    
async def wait_and_shutdown_kernel(kernel_id: str, wait_time: int=5):
    """
    wait_time秒後にkmが管理しているカーネルを停止する. 
    """
    await asyncio.sleep(wait_time)
    await g.km.shutdown_kernel(kernel_id=kernel_id)