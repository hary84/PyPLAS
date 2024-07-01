import asyncio
from datetime import datetime, date
from io import StringIO
import json
import os
import sqlite3
import sys
import traceback
from typing import Any, Optional, Union
import urllib.parse

import tornado
from tornado.httputil import HTTPServerRequest
from tornado.web import Application
from jupyter_client import MultiKernelManager

def print_traceback():
    """
    error時のtracebackをきれいに標準出力にprintする
    except内でのみ有効
    """
    err = traceback.format_exc()
    print("="*40)
    print(err[:-1])
    print("="*40)

def custom_exec(code: str) -> None:
    """
    exec()関数を使って任意のコードを実行する

    Parameters
    ----------
    code: str
        実行したいコード
    """
    original_stdout = sys.stdout 
    sys.stdout = StringIO()
    ls = {}
    try:
        exec(
            "async def __ex(): " +
            "".join(f"\n    {row}" for row in code.split('\n')),
            {},
            ls
        )
        asyncio.run(ls["__ex"]())
    finally:
        sys.stdout = original_stdout


def datetime_encoda(obj: object) -> str:
    """
    objがdatetimeオブジェクトであれば、isoformatの文字列に変換する
    """
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    
async def wait_and_shutdown_kernel(km: MultiKernelManager, kernel_id: str, wait_time: int=5):
    """
    wait_time秒後にkmが管理しているカーネルを停止する. 
    """
    await asyncio.sleep(wait_time)
    await km.shutdown_kernel(kernel_id=kernel_id)

class InvalidJSONError(Exception):
    """POST, PUT, DELETE等でRequest-Bodyから取得したJSONが無効な形式"""


class ApplicationHandler(tornado.web.RequestHandler):

    def __init__(self, application: Application, request: HTTPServerRequest, **kwargs) -> None:
        super().__init__(application, request, **kwargs)
        self.json: dict = None
        self.is_dev_mode: bool = self.settings["develop"]

    def write_error(self, status_code: int, **kwargs: Any) -> None:
        self.set_status(status_code, kwargs.get("reason", None))
        self.render("error.html", status_code=status_code)
    
    def validate_JSON(self, keys:Union[list, dict]) -> bool:
        """
        POSTやPUTから送られてきたJSONに対応するkeyがあるかどうか検証する

        Parameters
        ----------
        key: list or dict 
            検証の対象となるキーのリストまたは{key: type}のdict
        """
        if self.json is None:
            raise InvalidJSONError
        if isinstance(keys, list):
            try:
                for key in keys:
                    self.json[key]
            except:
                raise InvalidJSONError
        elif isinstance(keys, dict):
            try:
                for key, value in keys.items():
                    assert isinstance(self.json[key], value)
            except:
                raise InvalidJSONError
            
            
    def load_json(self, validate:bool=False, keys:Union[list, dict]=[]) -> Union[None, bool]:
        """
        POSTやPUTから送られてきたJSONをpythonのdictに変換する
        
        Parameters
        ----------
        validate: bool, default False
            キーやタイプについて検証するか否か
        keys: list or dict, default []
            検証の対象になるキーのリストまたは辞書
        """
        if self.request.headers.get("Content-Type", None) == "application/json":
            self.json = json.loads(self.request.body)
            if validate:
                self.validate_JSON(keys)
        else:
            raise InvalidJSONError
            
    def load_url_queries(self, names: Union[list[str], dict[str, Any]]):
        """
        URL queryをself.queryに格納する

        Parameters
        ----------
        names: list or dict
            queryの名前を指定する. dictの場合、keyがquery名, valueがデフォルトの値
        """
        self.query = {}
        if isinstance(names, list):
            for name in names:
                self.query[name] = urllib.parse.quote(self.get_query_argument(name))
        elif isinstance(names, dict):
            for name, default in names.items():
                query = self.get_query_argument(name, default)
                if isinstance(query, str):
                    query = urllib.parse.quote(query)
                self.query[name] = query
        else:
            raise TypeError
        
class ErrorHandler(ApplicationHandler): 
    """
    For 404 errors, use in the default_handler_class, Application setting.
    """
    def prepare(self):
        self.write_error(status_code=404)


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

        # set dev_user_path in self.user_path if dev_mode is true
        if self.dev_mode:
            self.user_path = dev_user_path

        # create user.db/dev-user.db if not exist
        if not os.path.exists(self.user_path):
            self._setup_user_db(user_path)

        # connect pyplas.db 
        self.conn = self._connect(self.page_path)

        # attach user.db in pyplas.db
        self.conn.execute(
            r"ATTACH DATABASE :user_path AS user", 
            {"user_path": self.user_path})

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
            print(e)
            self.conn.rollback()
            raise
        else:
            self.conn.commit()

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
            print(e)
            self.conn.rollback()
            raise 
        else:
            self.conn.commit()

    def _clean_up(self, conn:Optional[sqlite3.Connection]=None) -> None:
        """
        self.user_pathのuser DBをクリーンアップする. 
        
        このメソッドは直接呼び出さない.

        Parameters
        ----------
        conn: Sqlite3.Connection
            クリーンアップしたいDBとの接続. Noneの場合, self.user_pathを使って, 
            Connectionインスタンスを作成する. 
        """
        if conn is None:
            conn = self._connect(self.user_path)
        conn.execute(r"DELETE FROM logs")
        conn.execute(r"DELETE FROM progress")
        conn.commit()

    def close(self) -> None:
        """
        DBとの接続を切る. dev_modeがtrueの時, user DBをクリーンアップする.
        """
        self.conn.close()
        if self.dev_mode:
            self._clean_up()