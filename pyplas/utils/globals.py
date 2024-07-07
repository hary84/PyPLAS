from jupyter_client import AsyncMultiKernelManager
import tornado

from pyplas.models import DBHandler

PROBLEM_DB_PATH = "pyplas/database/pyplas.db"
USER_DB_PATH = "pyplas/database/user.db"
DEV_USER_DB_PATH = "pyplas/database/dev-user.db"

TEMPLATE_DIR = "pyplas/templates"
STATIC_DIR = "pyplas/static"


db: DBHandler = None

km = AsyncMultiKernelManager()
km.updated = tornado.locks.Event()
