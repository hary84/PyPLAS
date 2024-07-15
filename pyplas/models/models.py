from logging import Logger
import os 
import sqlite3
from typing import Optional, Union

from pyplas.utils.log import get_logger


class DBHandler:
    """
    DBに関わる処理を行うクラス
    """
    def __init__(self, page_path:str, user_path:str, dev_user_path:str,
                 dev_mode:bool=False):
        self.page_path:str = page_path 
        self.user_path:str = user_path 
        self.dev_mode:bool = dev_mode
        self.conn:Optional[sqlite3.Connection] = None
        self.logger: Logger = get_logger(self.__class__.__name__)

        # set dev_user_path in self.user_path if dev_mode is true
        if self.dev_mode:
            self.user_path = dev_user_path
            self._clean_up()

        # create user.db/dev-user.db if not exist
        if not os.path.exists(self.user_path):
            self._setup_user_db(self.user_path)

        # connect pyplas.db 
        self.conn = self._connect(self.page_path)

        # attach user.db in pyplas.db
        self.conn.execute(
            r"ATTACH DATABASE :user_path AS user", 
            {"user_path": self.user_path})
        
        self.conn.execute(r"PRAGMA foreign_keys=ON")
        self.conn.commit()

    def _connect(self, path:str) -> sqlite3.Connection:
        """
        DBに接続する. pathに.dbファイルが存在しない場合, FileNotFoundErrorを投げる.

        このメソッドは直接呼び出さない.

        Parameters
        ----------
        path: str
            dbファイルのパス

        Returns
        -------
        conn: sqlite3.Connection 
            dbとのコネクションオブジェクト
        """
        if not os.path.exists(path):
            raise FileNotFoundError
        conn = sqlite3.connect(path)
        conn.row_factory = self._dict_factory
        self.logger.debug(f"connect with DB({path})")
        return conn
    
    def _setup_user_db(self, db_path:str) -> None:
        """
        userデータ用DBを用意する. テーブルが存在しないならば, logsテーブルとprogressテーブルを作成する.

        このメソッドは直接呼び出さない.

        Parameters
        ----------
        db_path: str
            userデータ用DBファイルのパス
        """
        conn = sqlite3.connect(db_path)
        
        create_logs = r"""CREATE TABLE IF NOT EXISTS logs (
            p_id TEXT,
            category INT NOT NULL,
            q_id TEXT NOT NULL,
            content TEXT NOT NULL,
            result INT NOT NULL,
            answer_at DEFAULT CURRENT_TIMESTAMP,
            CHECK(result = 1 OR result = 2)
        )"""
        create_progress = r"""CREATE TABLE IF NOT EXISTS progress (
            p_id TEXT PRIMARY_KEY UNIQUE,
            q_status JSON NOT NULL,
            q_content JSON NOT NULL,
            p_status INT DEFAULT 0,
            CHECK(p_status = 0 OR p_status = 1 OR p_status = 2)
        )"""
        conn.execute(create_logs)
        conn.execute(create_progress)
        conn.commit()
        conn.close()
        self.logger.debug(f"initialize user DB({db_path})")


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
            self.logger.error(e)
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
            self.logger.debug("The DB has been cleaned up.")

    def close(self) -> None:
        """
        DBとの接続を切る. dev_modeがtrueの時, user DBをクリーンアップする.
        """
        self.conn.close()
        if self.dev_mode:
            self._clean_up()
