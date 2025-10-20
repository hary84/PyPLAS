from typing import Optional

from jupyter_client.multikernelmanager import DuplicateKernelError

from .app_handler import ApplicationHandler
from pyplas.utils import globals as g

class KernelHandler(ApplicationHandler):
    """カーネル管理用 REST API"""

    def prepare(self) -> None:
        super().prepare()
        g.km.updated.clear()

    # GET
    async def get(self, kernel_id:Optional[str]=None, action:Optional[str]=None):
        """
        - `/kernels`              :管理しているすべてのカーネルを出力
        - `/kernels/<kernel_id>/` :kernel_idをもつカーネルが管理下にあるか
        """
        # GET /kernel
        if kernel_id is None and action is None:
            self.get_alive_kernels()

        # GET /kernel/<kernel_id>
        elif kernel_id is not None and action is None:
            await self.get_kernel_state(kernel_id)

        # GET /kernel/<kernel_id>/<action>
        elif kernel_id is not None and action is not None:
            self.set_status(404, f"NOT FOUND")
            self.finish()

    # POST
    async def post(self, kernel_id:Optional[str]=None, action:Optional[str]=None):
        """ 
        - `/kernels`                        :ランダムなidでカーネルを起動
        - `/kernels/<kernel_id>`            :idを指定してカーネルを起動
        - `/kernels/<kernel_id>/restart`    :カーネルの再起動
        - `/kernels/<kernel_id>/interrupt`  :カーネルの中断
        """
        try:
            # POST /kernel
            if kernel_id is None and action is None:
                await self.kernel_start()

            # POST /kernel/<kernel_id>
            elif kernel_id is not None and action is None:
                await self.kernel_start(kernel_id=kernel_id)

            # POST /kernel/<kernel_id>/<action>
            elif kernel_id is not None and action is not None:
                if action == "restart":
                    await self.kernel_restart(kernel_id=kernel_id)
                elif action == "interrupt":
                    await self.kernel_interrupt(kernel_id=kernel_id)
                else:
                    self.set_status(404, reason=f"NOT FOUND")
                    self.finish()
        except DuplicateKernelError as e:
            self.set_status(400, reason=f"BAD REQUEST (KERNEL ALREADY EXISTS)")
            self.finish()
        except KeyError as e:
            self.set_status(404, reason=f"KERNEL NOT FOUND")
            self.finish()
        except Exception as e:
            self.logger.error(e, exc_info=True)
            self.set_status(500, reason="INTERNAL SERVER ERROR")
            self.finish()

    # DELETE
    async def delete(self, kernel_id:Optional[str]=None, action:Optional[str]=None):
        """
        - `/kernels/<kernel_id>` :`kernel_id`のIDをもつカーネルを停止する
        """
        try:
            # DELETE /kernels
            if kernel_id is None and action is None:
                self.set_status(404, reason=f"NOT FOUND")
                self.finish()

            # DELETE /kernels/<kernel_id>
            elif kernel_id is not None and action is None:
                await self.kernel_shutdown(kernel_id=kernel_id)
            
            # DELETE /kernels/<kernel_id>/<action>
            elif kernel_id is not None and action is not None:
                self.set_status(404, reason=f"NOT FOUND")
                self.finish()
        except KeyError:
            self.set_status(404, reason=f"KERNEL NOT FOUND")
            self.finish()    

    def get_alive_kernels(self):
        """
        稼働中のすべてのカーネルの`kernel_id`を返す
        """
        kernel_ids = g.km.list_kernel_ids()
        self.finish({
            "kernel_ids": kernel_ids,
            "DESCR": "Got a list of currently running kernels"
        })

    async def get_kernel_state(self, kernel_id: str):
        """
        指定したカーネルが起動しているかを`bool`値で返す
        """
        try:
            is_alive = await g.km.is_alive(kernel_id)
        except KeyError:
            is_alive = False 
        self.finish({
            "kernel_id": kernel_id,
            "is_alive": is_alive,
            "DESCR": "Got the state of the kernel(alive or not)"
        })

    async def kernel_start(self, kernel_id:Optional[str]=None):
        """
        カーネルを起動する  
        `kernel_id`が`None`の場合, ランダムなIDでカーネルを起動する

        重複した`kernel_id`が渡された場合, `DupulicateKernelError`を投げる
        """

        if kernel_id is None:
            self.kernel_id = await g.km.start_kernel()
        else:
            self.kernel_id = await g.km.start_kernel(kernel_id=kernel_id)
            
        self.finish({"kernel_id": self.kernel_id,
                     "DESCR": "Kernel is successfully started."})
        self.logger.info(f"Starting a kernel(id='{kernel_id}')")

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
            self.logger.info(f"Restarting a kernel(id='{kernel_id}')")

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
            self.logger.info(f"Kernel(id='{kernel_id}') is interrupted.")
           
    async def kernel_shutdown(self, kernel_id:str):
        """
        カーネルを停止する  
        `kernel_id=None`の場合, 指定されたカーネルのみを停止する

        存在しない`kernel_id`が渡された場合, `KeyError`を投げる  
        """
        try:
            await g.km.shutdown_kernel(kernel_id, now=True)
        except KeyError:
            raise
        else:
            self.finish({"kernel_id": kernel_id,
                            "DESCR": f"Kernel({kernel_id}) is successfully shutted down."})
            self.logger.info(f"Shutdown a kernel(id='{kernel_id}')")

    def on_finish(self):
        g.km.updated.set()