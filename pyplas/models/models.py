from logging import Logger
import os 
import signal
import sqlite3
from typing import Any, Optional, Sequence

from pyplas.utils.log import get_logger
from .. import config as cfg

class InvalidDBSchema(Exception):
    """DBの構造が無効"""


class DBHandler:
    """
    DBに関わる処理を行うクラス
    """
    # DBのテーブル名
    PAGE_TNAME = ["categories", "pages"]
    USER_TNAME = ["logs", "progress"]

    def __init__(self):
        self.conn:Optional[sqlite3.Connection] = None
        self.logger: Logger = get_logger(self.__class__.__name__)
        self.page_path = cfg.PROBLEM_DB_PATH

    def setup(self, dev_mode:bool=False):
        """
        ユーザDBへのパスを設定し, 問題DBに接続する.
        """
        self.dev_mode = dev_mode

        if self.dev_mode:
            self.user_path = cfg.DEV_USER_DB_PATH
        else:            
            self.user_path = cfg.USER_DB_PATH

        self.logger.info("Set the Database paths")
        self._validation_db()
        self._connect()

    def create_problem_db(self):
        """
        スキーマ定義ファイルに基づいて, 空の問題DBを作成する
        """
        with open(os.path.join(cfg.SCHEMA_PATH, "categories.sql"), "r", encoding="utf-8") as f:
            categories = f.read(-1)

        with open(os.path.join(cfg.SCHEMA_PATH, "pages.sql"), "r", encoding="utf-8") as f:
            pages = f.read(-1)

        with sqlite3.connect(self.page_path) as conn:
            conn.executescript(categories)
            conn.executescript(pages)
            conn.commit()


    def create_user_db(self):
        """
        スキーマ定義ファイルに基づいて, 空のユーザDBを作成する
        """
        with open(os.path.join(cfg.SCHEMA_PATH, "logs.sql"), "r", encoding="utf-8") as f:
            logs = f.read(-1)

        with open(os.path.join(cfg.SCHEMA_PATH, "progress.sql"), "r", encoding="utf-8") as f:
            progress = f.read(-1)

        with sqlite3.connect(self.user_path) as conn:
            conn.executescript(logs)
            conn.executescript(progress)
            conn.commit()

    def _validation_db(self):
        """
        DBファイルが存在するかを確認し、DBのスキーマが正しいかを検証する
        
        検証に失敗した場合、エラーログを表示してアプリを強制終了する
        """
        try:
            # DBが存在する場合
            if os.path.exists(self.page_path) and os.path.exists(self.user_path):
                self._check_db_schema()
                self.logger.info(f"Verify that the DBs exist and have the correct schema.")

            # 存在しない場合
            else:
                _current_path = self.page_path
                if not os.path.exists(self.page_path):
                    self.create_problem_db()
                    self.logger.info(f"Create problem DB ({self.page_path})")

                _current_path = self.user_path
                if not os.path.exists(self.user_path):
                    self.create_user_db()
                    self.logger.info(f"Create user DB ({self.user_path})")

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

    def _connect(self):
        """
        問題DBに接続し, ユーザDBをATTACHする
        """
        self.conn = sqlite3.connect(self.page_path)
        self.conn.row_factory = self._dict_factory
        self.conn.execute(r"ATTACH DATABASE :user_path AS user", 
                          {"user_path": self.user_path})
        self.conn.execute(r"PRAGMA foreign_keys=ON")
        self.conn.commit()
        self.logger.info(f"Connect with DB({self.page_path} and {self.user_path})")

    def _check_db_schema(self):
        """
        DBのschemaが正しいかをチェックする. 正しくない場合, `InvalidDBSchema`エラーを発生させる. 
        """
        query = r"SELECT sql FROM sqlite_master WHERE name = :name"

        for (path, tnames) in zip([self.page_path, self.user_path], [self.PAGE_TNAME, self.USER_TNAME]):
            with sqlite3.connect(path) as conn:
                for tname in tnames:
                    cur = conn.execute(query, {"name": tname})
                    actual = cur.fetchone()

                    with open(os.path.join(cfg.SCHEMA_PATH, f"{tname}.sql"), "r", encoding="utf-8") as f:
                        correct = f.read(-1)

                    if (actual is None) or (actual[0] != correct):
                        raise InvalidDBSchema


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
