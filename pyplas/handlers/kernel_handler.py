from typing import Optional

from jupyter_client.multikernelmanager import DuplicateKernelError

from .app_handler import ApplicationHandler
from pyplas.utils import get_logger, globals as g

mylogger = get_logger(__name__)


class KernelHandler(ApplicationHandler):
    """カーネル管理用 REST API"""

    def prepare(self) -> None:
        g.km.updated.clear()
        mylogger.debug(f"{self.request.method} {self.request.uri}")

    async def get(self, k_id:Optional[str]=None, action:Optional[str]=None) -> None:
        """
        PATH
            * /kernel             :管理しているすべてのカーネルを出力
            * /kernel/<k_id>/     :k_idをもつカーネルが管理下にあるか
        """
        # GET /kernel
        if k_id is None and action is None:
            kernel_ids = g.km.list_kernel_ids()
            self.finish({
                "kernel_ids": kernel_ids,
                "DESCR": "Got a list of currently running kernels"
            })

        # GET /kernel/<k_id>
        elif k_id is not None and action is None:
            try:
                is_alive = await g.km.is_alive(k_id)
            except KeyError:
                is_alive = False
            self.finish({
                "kernel_id": k_id,
                "is_alive": is_alive,
                "DESCR": "Got the state of the kernel(alive or not)"
            })

        # GET /kernel/<k_id>/<action>
        elif k_id is not None and action is not None:
            self.set_status(404, f"{self.request.uri} is not Found.")
            self.finish()

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
                    self.set_status(404, reason=f"{self.request.uri} is not Found.")
                    self.finish()
        except DuplicateKernelError as e:
            self.set_status(409, reason=f"kernel(id='{k_id}') is already exist.")
            self.finish()
        except KeyError as e:
            self.set_status(404, reason=f"kernel(id='{k_id}') is not found.")
            self.finish()
        except Exception as e:
            mylogger.error(e, exc_info=True)
            self.set_status(500, reason="Internal Server Error")
            self.finish()

    async def kernel_start(self, kernel_id:Optional[str]=None) -> None:
        """
        カーネルを起動する

        重複した`kernel_id`が渡された場合, `DupulicateKernelError`を投げる
        """
        try:
            if kernel_id is None:
                self.kernel_id = await g.km.start_kernel()
            else:
                self.kernel_id = await g.km.start_kernel(kernel_id=kernel_id)
        except DuplicateKernelError as e:
            raise
        else:
            self.finish({"kernel_id": self.kernel_id,
                         "DESCR": "Kernel is successfully started."})
            mylogger.info(f"Starting a kernel(id='{kernel_id}')")

    async def kernel_restart(self, kernel_id:str) -> None:
        """
        カーネルを再起動する

        存在しない`kernel_id`が渡された場合, `KeyError`を投げる
        """
        try:
            await g.km.shutdown_kernel(kernel_id=kernel_id)
            await g.km.start_kernel(kernel_id=kernel_id)
        except KeyError as e:
            raise
        else:
            self.finish({"kernel_id": kernel_id,
                         "DESCR": "Kernel is successfully restarted."})
            mylogger.info(f"Restarting a kernel(id='{kernel_id}')")

    async def kernel_interrupt(self, kernel_id:str) -> None:
        """
        カーネルの実行を中断する

        存在しない`kernel_id`が渡された場合, `KeyError`を投げる
        """
        try:
            km = g.km.get_kernel(kernel_id)
            await km.interrupt_kernel()
        except KeyError as e:
            raise
        else:
            self.finish({"kernel_id": kernel_id,
                         "DESCR": "Kernel is successfully interrupted."})
            mylogger.info(f"Kernel(id='{kernel_id}') is interrupted.")

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
                self.set_status(404, reason=f"{self.request.uri} is not found.")
                self.finish()
        except KeyError:
            self.set_status(404, reason=f"kernel_id({k_id}) is not found.")
            self.finish()
           
    async def kernel_shutdown(self, kernel_id:Optional[str]=None) -> None:
        """
        カーネルを停止する

        存在しない`kernel_id`が渡された場合, `KeyError`を投げる  
        `kernel_id=None`の場合, 指定されたカーネルのみを停止する
        """
        # shutdown all
        if kernel_id is None:
            await g.km.shutdown_all(now=True)
            self.finish({"DESCR": "All kernel is successfully shutted down."})
            mylogger.info("Shutdown all kernels.")
        # shutdown specified kernel
        else:
            try:
                await g.km.shutdown_kernel(kernel_id, now=True)
            except KeyError:
                raise
            else:
                self.finish({"kernel_id": kernel_id,
                             "DESCR": f"Kernel({kernel_id}) is successfully shutted down."})
                mylogger.info(f"Shutdown a kernel(id='{kernel_id}')")

    def on_finish(self):
        g.km.updated.set()