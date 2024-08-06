import argparse
import asyncio
import signal

from jupyter_client.utils import run_sync
import tornado

from pyplas.utils import get_logger, globals as g
from . import uimodules
from . import config as cfg
from pyplas.handlers import *


# parse command-line argment
parser = argparse.ArgumentParser(description="PyPLAS server options")
parser.add_argument("-p", "--port", default=8888, type=str, help="Port number to run the server on")
parser.add_argument("-d", "--develop", action="store_true", help="Run the server in developer mode")
args = parser.parse_args()

# setup global variables
g.db.setup(dev_mode=args.develop)

logger = get_logger(__name__)

def make_app():
    return tornado.web.Application([
        (r"/", MainHandler),
        (r"/problems/?", ProblemHandler),
        (r"/problems/(?P<p_id>[\w-]+)/?", ProblemHandler),
        (r"/problems/(?P<p_id>[\w-]+)/(?P<action>[\w]+)/?", ProblemHandler),
        (r'/ws/([\w-]+)/?', ExecutionHandler),
        (r"/kernel/?", KernelHandler),
        (r"/kernel/(?P<k_id>[\w-]+)/?", KernelHandler),
        (r"/kernel/(?P<k_id>[\w-]+)/(?P<action>[\w]+)/?", KernelHandler),
        (r"/create/?", ProblemCreateHandler),
        (r"/create/(?P<p_id>[\w-]*)/?", ProblemCreateHandler),
        (r"/create/(?P<p_id>[\w-]+)/(?P<action>[\w]+)/?", ProblemCreateHandler),
        (r"/category/?", CategoryHandler),
        (r"/category/(?P<cat_id>[\w-]+)/?", CategoryHandler),
        (r"/api/render/?", RenderHTMLModuleHandler),
    ],
    default_handler_class=ErrorHandler,
    template_path=cfg.TEMPLATE_DIR,
    static_path=cfg.STATIC_DIR,
    debug=True,
    ui_modules=uimodules,
    develop=args.develop,
    )

async def main():
    app = make_app()
    app.listen(args.port)
    shutdown_event = asyncio.Event()

    def shutdown_server(signum, frame):
        print()
        for p in  ProblemHandler.execute_pool.values():
            p.kill()
        logger.info(f"[Server Stop] All Subprocess are killed")

        run_sync(g.km._async_shutdown_all)()
        logger.info("[Server Stop] All Ipykernel are successfully shutteddown.")
        g.db.close()
        logger.info("[Server Stop] DB is successfully closed.")
        shutdown_event.set()

    signal.signal(signal.SIGTERM, shutdown_server)
    signal.signal(signal.SIGINT, shutdown_server)
    await shutdown_event.wait()