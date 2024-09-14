import os 

from pyplas import config as cfg 
from pyplas.app import clean_up
from pyplas.models import create_problem_db

TEST_DB_PATH = "pyplas/database/test_pyplas.db"
TEST_USR_PATH = "pyplas/database/test_user.db"

def setup_database():
    """空の問題DBを作成し, cfgのパスを変更する"""
    cfg.PROBLEM_DB_PATH = TEST_DB_PATH
    create_problem_db(cfg.PROBLEM_DB_PATH)
    cfg.USER_DB_PATH = TEST_USR_PATH

def clean_up_database():
    """サーバー停止時の処理を行い, DBを削除する"""
    clean_up()
    os.remove(TEST_DB_PATH)