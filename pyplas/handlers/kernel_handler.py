import asyncio
from typing import Optional

from jupyter_client.multikernelmanager import DuplicateKernelError

from .app_handler import ApplicationHandler
from pyplas.utils import get_logger, globals as g

mylogger = get_logger(__name__)


class KernelHandler(ApplicationHandler):
    """カーネル管理用 REST API"""

    def prepare(self) -> None:
        g.km.updated.clear()
        mylogger.info(f"{self.request.method} {self.request.uri}")

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
                "DESCR": "Get a list of kernels managed by the server."
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
                "DESCR": "Get the kernel state(alive or not)"
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
            self.set_status(500, reason=f"kernel({k_id}) is already exist.")
            self.finish()
        except KeyError as e:
            self.set_status(500, reason=f"kernel_id({k_id}) is not found in KM.")
            self.finish()
        except Exception as e:
            mylogger.error(e, exc_info=True)
            self.set_status(500, reason="internal server error")
            self.finish()

    async def kernel_start(self, kernel_id:Optional[str]=None) -> None:
        """
        カーネルを起動する
        """
        try:
            if kernel_id is None:
                self.kernel_id = await g.km.start_kernel()
            else:
                self.kernel_id = await g.km.start_kernel(kernel_id=kernel_id)
        except DuplicateKernelError as e:
            raise
        else:
            mylogger.debug(f"kernel(kernel_id={kernel_id}) is started.")
            self.finish({"kernel_id": self.kernel_id,
                         "DESCR": "Kernel is successfully started."})

    async def kernel_restart(self, kernel_id:str) -> None:
        """
        カーネルを再起動する
        """
        try:
            await g.km.shutdown_kernel(kernel_id=kernel_id)
            await g.km.start_kernel(kernel_id=kernel_id)
        except KeyError as e:
            raise
        else:
            mylogger.debug(f"kernel(kernel_id={kernel_id}) is restarted.")
            self.finish({"kernel_id": kernel_id,
                         "DESCR": "Kernel is successfully restarted."})

    async def kernel_interrupt(self, kernel_id:str) -> None:
        """
        カーネルの実行を中断する
        """
        try:
            km = g.km.get_kernel(kernel_id)
            await km.interrupt_kernel()
        except KeyError as e:
            raise
        else:
            mylogger.debug(f"kernel(kernel_id={kernel_id}) is interrupted.")
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
                self.set_status(404, reason=f"{self.request.uri} is not found.")
                self.finish()
        except KeyError:
            self.set_status(500, reason=f"kernel_id({k_id}) is not found in KM.")
            self.finish()
           
    async def kernel_shutdown(self, kernel_id:Optional[str]=None) -> None:
        """
        カーネルを停止する
        """
        # shutdown all
        if kernel_id is None:
            await g.km.shutdown_all(now=True)
            self.finish({"DESCR": "All kernel is successfully shutted down."})
        # shutdown specified kernel
        else:
            try:
                await g.km.shutdown_kernel(kernel_id, now=True)
            except KeyError:
                raise
            else:
                self.finish({"kernel_id": kernel_id,
                             "DESCR": f"Kernel({kernel_id}) is successfully shutted down."})

    def on_finish(self):
        g.km.updated.set()