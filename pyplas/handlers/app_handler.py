import json
from typing import Any, Union
import urllib

import tornado
from tornado.httputil import HTTPServerRequest
from tornado.web import Application

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