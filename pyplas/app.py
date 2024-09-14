import asyncio
import signal

from jupyter_client.utils import run_sync
import tornado

from pyplas.utils import globals as g
from . import uimodules
from . import config as cfg
from pyplas.handlers import *

def make_app(develop: bool):
    # setup global variables
    g.db.setup(dev_mode=develop)

    return tornado.web.Application([
        (r"/", MainHandler),

        (r"/problems/?", ProblemHandler),
        (r"/problems/(?P<p_id>[\w-]+)/?", ProblemHandler),
        (r"/problems/(?P<p_id>[\w-]+)/(?P<action>[\w]+)/?", ProblemHandler),

        (r'/ws/([\w-]+)/?', ExecutionHandler),

        (r"/kernel/?", KernelHandler),
        (r"/kernel/(?P<k_id>[\w-]+)/?", KernelHandler),
        (r"/kernel/(?P<k_id>[\w-]+)/(?P<action>[\w]+)/?", KernelHandler),

        (r"/create/category/?", CategoryHandler),
        (r"/create/category/(?P<cat_id>[\w-]+)/?", CategoryHandler),
        (r"/create/?", ProblemCreateHandler),
        (r"/create/(?P<p_id>[\w-]*)/?", ProblemCreateHandler),
        (r"/create/(?P<p_id>[\w-]+)/(?P<action>[\w]+)/?", ProblemCreateHandler),

        (r"/api/render/?", RenderHTMLModuleHandler),
    ],
    default_handler_class=ErrorHandler,
    template_path=cfg.TEMPLATE_DIR,
    static_path=cfg.STATIC_DIR,
    debug=develop,
    ui_modules=uimodules,
    develop=develop,
    )

async def starter(port: int, develop: bool):
    """
    サーバーの起動
    """
    app = make_app(develop)
    app.listen(port)
    shutdown_event = asyncio.Event()

    def shutdown_server(signum, frame):
        clean_up()
        shutdown_event.set()

    signal.signal(signal.SIGTERM, shutdown_server)
    signal.signal(signal.SIGINT, shutdown_server)
    await shutdown_event.wait()

def clean_up():
    """
    サーバー停止時の処理
    """
    ProblemHandler.kill_all_subprocess()
    run_sync(g.km._async_shutdown_all)()
    g.db.close()