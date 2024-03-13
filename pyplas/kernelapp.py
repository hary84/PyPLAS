from jupyter_client import KernelManager 


class MyKernelApp():

    def __init__(self):
        self.km = KernelManager()
        # self.km.client_class = "jupyter_client.asynchronous.AsyncKernelClient"
        self.kc = None
    
    def startup_kernelapp(self) -> None:
        """KernelManagerとkernelClientの立ち上げ, 起動
        カーネルがすでに起動している場合は再起動する"""
        
        if self.km.is_alive():
            self.km.restart_kernel()
        else:
            self.km = KernelManager()
            self.km.start_kernel()
        self.kc = self.km.client()
        self.kc.start_channels()

        print("[LOG] Ready to use the kernel")


    def stop_kernelapp(self):
        """KernelManagerとKernelClientを停止する"""

        self.kc.stop_channels()
        self.km.shutdown_kernel()
        print("[LOG] Stop the kernel")

    def interrupt_execute(self):
        """実行中のコードを中断する"""

        msg = self.kc.session.msg("interrupt_request", {})
        self.kc.control_channel.send(msg)
        print("[LOG] Interrupt the kernel")
    

