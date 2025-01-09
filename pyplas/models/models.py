from logging import Logger
import os 
import signal
import sqlite3
from typing import Any, Literal, Optional, Sequence, Union

from pyplas.utils.log import get_logger
from .. import config as cfg

class InvalidDBSchema(Exception):
    """DBの構造が無効"""


def create_problem_db(path: str):
    """
    スキーマ定義ファイルに基づいて, 空の問題DBを作成する. 
    
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
        conn.executescript(pages)
        conn.commit()

def create_user_db(path: str):
    """
    スキーマ定義ファイルに基づいて, 空のユーザDBを作成する. 
    
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

def check_db_schema(
        db_path: str, 
        table_name: list[Literal["categories", "pages", "progress", "logs"]]
    ):
    """
    DBのschemaが正しいかをチェックする. 正しくない場合, `InvalidDBSchema`エラーを発生させる. 
    """
    for tname in table_name:
        with sqlite3.connect(db_path) as conn:
            cur = conn.execute(r"SELECT sql FROM sqlite_master WHERE name = :name",
                        {"name": tname})
            actual: Optional[tuple] = cur.fetchone()
            
        with open(os.path.join(cfg.SCHEMA_PATH, f"{tname}.sql"), "r", encoding="utf-8") as f:
            correct = f.read(-1)

        if (actual is None) or (actual[0] != correct):
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
        self.dev_mode = dev_mode

        self.page_path = cfg.PROBLEM_DB_PATH
        if self.dev_mode:
            self.user_path = cfg.DEV_USER_DB_PATH
        else:            
            self.user_path = cfg.USER_DB_PATH

        self.logger.info("Sets the Database paths")
        self._connect()

    def _connect(self):
        """
        問題DBに接続し, ユーザDBをATTACHする.   
        問題/ユーザDBが存在しない, またはschemaが異なる場合, 空の問題/ユーザDBを作成する. 

        このメソッドは直接呼び出さない.
        """
        try:
            _current_path = self.page_path
            if not os.path.exists(self.page_path):
                create_problem_db(self.page_path)
                self.logger.info(f"Create problem DB ({self.page_path})")
            else:
                check_db_schema(self.page_path, ["categories", "pages"])

            _current_path = self.user_path
            if not os.path.exists(self.user_path):
                create_user_db(self.user_path)
                self.logger.info(f"Create user DB ({self.user_path})")
            else:
                check_db_schema(self.user_path, ["logs", "progress"])
        except InvalidDBSchema as e:
            self.logger.critical("\n".join([
                e.__class__.__name__,
                f"This DB({_current_path}) cannot be used in this app.",
                f"Please remove it from {cfg.DB_DIR} and start again."
                ]))
            os.kill(os.getpid(), signal.SIGTERM)
            return
        except FileNotFoundError as e:
            self.logger.critical("\n".join([
                f"{e.filename} is not found.",
            ]))
            os.kill(os.getpid(), signal.SIGTERM)
            return
        except Exception as e:
            self.logger.critical(e.__class__.__name__)
            os.kill(os.getpid(), signal.SIGTERM)
            return

        self.conn = sqlite3.connect(self.page_path)
        self.conn.row_factory = self._dict_factory
        self.conn.execute(r"ATTACH DATABASE :user_path AS user", 
                          {"user_path": self.user_path})
        self.conn.execute(r"PRAGMA foreign_keys=ON")
        self.conn.commit()
        self.logger.info(f"connect with DB({self.page_path} and {self.user_path})")

    def _dict_factory(self, cursor, row):
        """
        DBから取得したデータをdictに変換する
        """
        fields = [column[0] for column in cursor.description]
        return {key: value for key, value in zip(fields, row)}

    def execute(self, sql:str, **parameters) -> list[Any]:
        """
        SQL文をを実行する

        Parameters
        ----------
        sql: str
            単一のsql文を実行する
        parameters:
            sqlに埋め込まれるパラメータ群
        """
        if self.conn is None:
            self.logger.warning("SQL cannot be executed before the connection is established.")
            raise sqlite3.Error
        try:
            cur = self.conn.execute(sql, (parameters))
            records = cur.fetchall()
        except sqlite3.Error as e:
            self.conn.rollback()
            raise e 
        else:
            self.conn.commit()
            return records
        
    def executes(self, sqls:list[str], **parameters) -> list[list[Any]]:
        """
        SQL文をを実行する

        Parameters
        ----------
        sql: list
            単一のsql文のリスト
        parameters:
            sqlに埋め込まれるパラメータ群
        """
        if self.conn is None:
            self.logger.warning("SQL cannot be executed before the connection is established.")
            raise sqlite3.Error
        responses = []
        try:
            for sql in sqls:
                cur = self.conn.execute(sql, (parameters))
                responses.append(cur.fetchall())
        except sqlite3.Error as e:
            self.conn.rollback()
            raise e 
        else:
            self.conn.commit()
            return responses
        
    def execute_many(self, sql: str, params: Sequence[dict]):
        """
        executemanyを使って繰り返しsql文を実行する

        Parameters
        ----------
        sql: str
            sql文
        params:
            sqlのパラメータを指定する. 
        """
        if self.conn is None:
            self.logger.warning("SQL cannot be executed before the connection is established.")
            raise sqlite3.Error
        try:
            self.conn.executemany(sql, params)
        except sqlite3.Error as e:
            self.conn.rollback()
            raise e
        else:
            self.conn.commit()
            self.logger.debug("The data has been successfully written.")

    def check_connect(self) -> bool:
        """
        DBと接続されているかをチェックする.
        """
        if self.conn is None:
            return False
        try:
            self.conn.cursor()
            return True
        except Exception:
            return False
        
    def _clean_up(self) -> None:
        """
        user DBを削除する. 
        
        このメソッドは直接呼び出さない.
        """
        if os.path.exists(self.user_path):
            if self.check_connect():
                self.logger.warning(f"Before delete db file, please disconnect from the database({self.page_path})")
            os.remove(self.user_path)
            self.logger.warning(f'Dev user DB({self.user_path}) is succesfully removed.')

    def close(self) -> None:
        """
        DBとの接続を切る. dev_modeがtrueの時, 開発用ユーザDBを削除する.
        """
        if self.conn is not None:
            self.conn.close()
            self.logger.warning('DB is successfully closed.')
            if self.dev_mode:
                self._clean_up()
