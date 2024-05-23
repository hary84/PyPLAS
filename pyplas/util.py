from datetime import datetime, date
import json
import sqlite3
import traceback
from typing import Union
import tornado
from tornado.httputil import HTTPServerRequest
from tornado.web import Application


class AppException(Exception):
    def __init__(self, arg):
        self.arg = arg

class InvalidJSONException(AppException):
    def __str__(self):
        return (
            f"無効なJSONフォーマットです"
        )
    

class ApplicationHandler(tornado.web.RequestHandler):

    def __init__(self, application: Application, request: HTTPServerRequest, **kwargs) -> None:
        super().__init__(application, request, **kwargs)
        self.json: dict = None
        self.db_path = self.settings["db_path"]
    
    def validate_JSON(self, keys:Union[list, dict]) -> bool:
        """
        POSTやPUTから送られてきたJSONに対応するkeyがあるかどうか検証する

        Parameters
        ----------
        key: list or dict 
            検証の対象となるキーのリストまたは{key: type}のdict
        """
        if self.json is None:
            return False
        if isinstance(keys, list):
            try:
                for key in keys:
                    self.json[key]
            except:
                return False
        elif isinstance(keys, dict):
            try:
                for key, value in keys.items():
                    assert isinstance(self.json[key], value)
            except:
                return False
            
        return True
            
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
                return self.validate_JSON(keys)
        else:
            self.json = {}
            return None
            
    def get_from_db(self, sql:str, **kwargs) -> list :
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
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = _dict_factory
            cur = conn.execute(sql, (kwargs))
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
            conn = sqlite3.connect(self.db_path)
            sqls = [sql] if isinstance(sql, str) else sql
            for q in sqls:
                conn.execute(q, (kwargs))
        except sqlite3.Error as e:
            print(e)
            conn.rollback()
            raise
        else:
            conn.commit()

    def print_traceback(self):
        """
        error時のtracebackをきれいに標準出力にprintする
        except内でのみ有効
        """
        err = traceback.format_exc()
        print("="*40)
        print(err[:-1])
        print("="*40)


def _dict_factory(cursor, row) -> dict:
    """
    DBから取得したデータをdictに変換する
    """
    fields = [column[0] for column in cursor.description]
    return {key: value for key, value in zip(fields, row)}

def custom_exec(code: str) -> None:
    """
    exec()関数を使って任意のコードを実行する

    Parameters
    ----------
    code: str
        実行したいコード
    """
    import asyncio
    ls = {}
    exec(
        "async def __ex(): " +
        "".join(f"\n    {row}" for row in code.split('\n')),
        {},
        ls
    )
    asyncio.run(ls["__ex"]())

def datetime_encoda(obj: object) -> str:
    """
    objがdatetimeオブジェクトであれば、isoformatの文字列に変換する
    """
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()