from logging import Logger
import os 
import sqlite3
from typing import Optional, Union

from pyplas.utils.log import get_logger
from .. import config as cfg

class InvalidDBSchema(Exception):
    """DBの構造が無効"""


def create_problem_db(path: str):
    """空の問題DBを作成する. 
    
    Parameters
    ----------
    path: str
        DBの保存先パス
    """
    with open(os.path.join(cfg.SCHEMA_PATH, "categories.sql"), "r", encoding="utf-8") as f:
        categories = f.read(-1)

    with open(os.path.join(cfg.SCHEMA_PATH, "pages.sql"), "r", encoding="utf-8") as f:
        pages = f.read(-1)

    with sqlite3.connect(path) as conn:
        conn.executescript(categories)
        conn.execute(pages)
        conn.commit()

def create_user_db(path: str):
    """空のユーザDBを作成する
    
    Parameters
    ----------
    path: str
        DBの保存先パス
    """
    with open(os.path.join(cfg.SCHEMA_PATH, "logs.sql"), "r", encoding="utf-8") as f:
        logs = f.read(-1)

    with open(os.path.join(cfg.SCHEMA_PATH, "progress.sql"), "r", encoding="utf-8") as f:
        progress = f.read(-1)

    with sqlite3.connect(path) as conn:
        conn.executescript(logs)
        conn.executescript(progress)
        conn.commit()

def check_db_schema(db_path: str, table_name: list[str]):
    """DBのschemaが正しいかをチェックする. 正しくない場合, 
    InvalidDBSchemaエラーを発生させる. """

    for tname in table_name:
        with sqlite3.connect(db_path) as conn:
            cur = conn.execute(r"SELECT sql FROM sqlite_master WHERE name = :name",
                        {"name": tname})
            actual = cur.fetchone()[0]
            
        with open(os.path.join(cfg.SCHEMA_PATH, f"{tname}.sql"), "r", encoding="utf-8") as f:
            correct = f.read(-1)

        if actual != correct:
            raise InvalidDBSchema

class DBHandler:
    """
    DBに関わる処理を行うクラス
    """
    def __init__(self):
        self.conn:Optional[sqlite3.Connection] = None
        self.logger: Logger = get_logger(self.__class__.__name__)

    def setup(self, dev_mode:bool=False):
        """ユーザDBへのパスを設定し, 問題DBに接続する."""
        self.page_path = cfg.PROBLEM_DB_PATH
        self.dev_mode = dev_mode
        if self.dev_mode:
            self.user_path = cfg.DEV_USER_DB_PATH
        else:            
            self.user_path = cfg.USER_DB_PATH
        self._connect()

    def _connect(self) -> sqlite3.Connection:
        """
        問題DBに接続し, ユーザDBをATTACHする. 問題/ユーザDBが存在しない, またはschemaが異なる場合, 
        空の問題/ユーザDBを作成する. 

        このメソッドは直接呼び出さない.
        """
        if not os.path.exists(self.page_path):
            create_problem_db(self.page_path)
            self.logger.info(f"create problem DB ({self.page_path})")
        else:
            check_db_schema(self.page_path, ["categories", "pages"])

        if not os.path.exists(self.user_path):
            create_user_db(self.user_path)
            self.logger.info(f"create user DB ({self.user_path})")

        else:
            check_db_schema(self.user_path, ["logs", "progress"])

        self.conn = sqlite3.connect(self.page_path)
        self.conn.row_factory = self._dict_factory
        self.conn.execute(r"ATTACH DATABASE :user_path AS user", 
                          {"user_path": self.user_path})
        self.conn.execute(r"PRAGMA foreign_keys=ON")
        self.conn.commit()
        self.logger.debug(f"connect with DB({self.page_path})")

    def _dict_factory(self, cursor, row):
        """
        DBから取得したデータをdictに変換する
        """
        fields = [column[0] for column in cursor.description]
        return {key: value for key, value in zip(fields, row)}
    
    def get_from_db(self, sql:str, **kwargs) -> list:
        """
        DBからデータを受け取る
        
        Parameters
        ----------
        sql: str
            sql文
        kwargs: 
            sqlのパラメータを指定する
        """
        try:
            cur = self.conn.execute(sql, (kwargs))
            return cur.fetchall()
        except sqlite3.Error:
            raise
    
    def write_to_db(self, sql:Union[str, tuple, list], **kwargs) -> None:
        """
        DBにデータを書き込む
        
        Parameters
        ----------
        sql: str, tuple, list
            sql文. tuple, listの場合は各sql文を実行する
        kwargs:
            sqlのパラメータを指定する
        """
        try:
            sqls = [sql] if isinstance(sql, str) else sql
            for q in sqls:
                self.conn.execute(q, (kwargs))
        except sqlite3.Error as e:
            self.logger.error(e, exc_info=True)
            self.conn.rollback()
            raise
        else:
            self.conn.commit()
            self.logger.debug("The data has been successfully written.")

    def write_to_db_many(self, sql:str, params:Union[tuple[dict], list[dict]]) -> None:
        """
        DBにデータを書き込む(executemanyを利用する)

        Parameters
        ----------
        sql: str
            sql文
        params:
            sqlのパラメータを指定する. 
        """
        try:
            self.conn.executemany(sql, params)
        except sqlite3.Error as e:
            self.logger.error(e)
            self.conn.rollback()
            raise 
        else:
            self.conn.commit()
            self.logger.debug("The data has been successfully written.")

    def check_connect(self) -> bool:
        """
        self.connがDBと接続されているかをチェックする.
        """
        try:
            self.conn.cursor()
            return True
        except Exception:
            return False

    def _clean_up(self) -> None:
        """
        self.user_pathのuser DBを削除する. 
        
        このメソッドは直接呼び出さない.
        """
        if os.path.exists(self.user_path):
            if self.check_connect():
                self.logger.warn(f"Before delete db file, please disconnect from the database({self.page_path})")
            os.remove(self.user_path)

    def close(self) -> None:
        """
        DBとの接続を切る. dev_modeがtrueの時, 開発用ユーザDBを削除する.
        """
        self.conn.close()
        if self.dev_mode:
            self._clean_up()
        self.logger.warning('DB is successfully closed.')
