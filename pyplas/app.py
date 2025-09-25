import asyncio
import os
import signal

from jupyter_core.utils import run_sync
import tornado

from pyplas.utils import globals as g
from . import uimodules
from . import config as cfg
from pyplas import handlers

def make_app(develop: bool):
    # setup global variables
    g.db.setup(dev_mode=develop)

    return tornado.web.Application([
        # top
        (r"/", handlers.TopHandler),
        (r"/categories/(?P<cat_id>[\w]+)/?", handlers.ProblemListHandler),
        # problems
        (r"/problems/?", tornado.web.RedirectHandler, {"url": "/"}),
        (r"/problems/(?P<p_id>[\w-]+)/?", handlers.ProblemHandler),
        # scoring 
        (r"/scoring/?", handlers.ScoringHandler),
        # kernels
        (r"/kernels/?", handlers.KernelHandler),
        (r"/kernels/(?P<kernel_id>[\w-]+)/?", handlers.KernelHandler),
        (r"/kernels/(?P<kernel_id>[\w-]+)/(?P<action>[\w]+)/?", handlers.KernelHandler),
        # create
        (r"/create/?", handlers.ProblemCreateHandler),
        (r"/create/(?P<p_id>[\w-]+)/?", handlers.ProblemCreateHandler),
        # categories
        (r"/edit/categories/?", handlers.CategoryHandler),
        (r"/edit/categories/(?P<cat_id>[\w-]+)/?", handlers.CategoryHandler),
        # api 
        (r"/api/probleminfo/(?P<p_id>[\w-]+)/?", handlers.ProblemInfoHandler),
        (r"/api/categoryinfo/(?P<cat_id>[\w]+)/?", handlers.CategoryInfoHandler),
        (r"/api/saves/(?P<p_id>[\w-]+)/?", handlers.UserInputHandler),
        # other
        (r"/edit/order/(?P<cat_id>[\w-]+)/?", handlers.ProblemOrderHandler),
        (r"/edit/profiles/?", handlers.ProfileHandler),
        # files
        (r"/files/log/?", handlers.LogHandler),
        # ws
        (r"/ws/([\w-]+)/?", handlers.ExecutionHandler),
        # modules 
        (r"/modules/(?P<module_name>[\w]+)/?", handlers.ModuleHandler),
        # practice
        (r"/practice/?", handlers.PracticeHandler)
    ],
    default_handler_class=handlers.ErrorHandler,
    template_path=cfg.TEMPLATE_DIR,
    static_path=cfg.STATIC_DIR,
    debug=develop if os.name == "posix" else False,
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
    handlers.ScoringHandler.kill_all_subprocess()
    run_sync(g.km._async_shutdown_all)()
    g.db.close()