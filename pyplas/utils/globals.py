from jupyter_client import AsyncMultiKernelManager
import tornado

from pyplas.models import DBHandler
from .. import config as cfg

db = DBHandler()

km = AsyncMultiKernelManager()
km.updated = tornado.locks.Event()
