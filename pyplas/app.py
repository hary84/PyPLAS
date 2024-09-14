import asyncio
import signal

from jupyter_client.utils import run_sync
import tornado

from pyplas.utils import globals as g
from . import uimodules
from . import config as cfg
from pyplas import handlers as hd

def make_app(develop: bool):
    # setup global variables
    g.db.setup(dev_mode=develop)

    return tornado.web.Application([
        (r"/", hd.MainHandler),

        (r"/problems/?", hd.ProblemHandler),
        (r"/problems/(?P<p_id>[\w-]+)/?", hd.ProblemHandler),
        (r"/problems/(?P<p_id>[\w-]+)/(?P<action>[\w]+)/?", hd.ProblemHandler),

        (r'/ws/([\w-]+)/?', hd.ExecutionHandler),

        (r"/kernel/?", hd.KernelHandler),
        (r"/kernel/(?P<k_id>[\w-]+)/?", hd.KernelHandler),
        (r"/kernel/(?P<k_id>[\w-]+)/(?P<action>[\w]+)/?", hd.KernelHandler),

        (r"/create/category/?", hd.CategoryHandler),
        (r"/create/category/(?P<cat_id>[\w-]+)/?", hd.CategoryHandler),
        (r"/create/?", hd.ProblemCreateHandler),
        (r"/create/(?P<p_id>[\w-]*)/?", hd.ProblemCreateHandler),
        (r"/create/(?P<p_id>[\w-]+)/(?P<action>[\w]+)/?", hd.ProblemCreateHandler),

        (r"/api/render/?", hd.RenderHTMLModuleHandler),
    ],
    default_handler_class=hd.ErrorHandler,
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
    hd.ProblemHandler.kill_all_subprocess()
    run_sync(g.km._async_shutdown_all)()
    g.db.close()