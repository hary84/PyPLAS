from jupyter_client.multikernelmanager import AsyncMultiKernelManager
import tornado

from pyplas.models import DBHandler

db = DBHandler()

km = AsyncMultiKernelManager()
km.updated = tornado.locks.Event()
