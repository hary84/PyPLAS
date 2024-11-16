import json
from typing import Any, Dict, Optional, Union

import jsonschema.exceptions
import tornado
from tornado.httputil import HTTPServerRequest
from tornado.web import Application

from pyplas.utils.helper import validate_json

class InvalidJSONError(Exception):
    """POST, PUT, DELETE等でRequest-Bodyから取得したJSONが無効な形式"""

class ApplicationHandler(tornado.web.RequestHandler):

    def __init__(self, application: Application, request: HTTPServerRequest, **kwargs) -> None:
        super().__init__(application, request, **kwargs)
        self.json = {}
        self.query = {}
        self.is_dev_mode: bool = self.settings["develop"]

    def get_template_namespace(self) -> Dict[str, Any]:
        namespace = super().get_template_namespace()
        namespace["current_url"] = self.request.uri
        namespace["is_dev_mode"] = self.is_dev_mode
        return namespace

    def write_error(self, status_code: int, **kwargs: Any) -> None:
        """エラー時に表示するデフォルトの画面を設定する"""
        self.set_status(status_code, kwargs.get("reason", None))
        self.render("error.html", status_code=status_code)
            
            
    def load_json(self, validate: Optional[str]=None):
        """
        リクエストボディをPythonの`dict`に変換し, `self.json`に格納する
        
        Parameters
        ----------
        validate: str or None, default None
            キーやタイプについて検証するか否か  
            - `None`の場合, 検証を行わない.  
            - `str`型の場合, `config.SCHEMA_PATH`内のjsonschemaファイルを参照してjsonの検証を行う
        """
        if self.request.headers.get("Content-Type", None) == "application/json":
            self.json = json.loads(self.request.body)
            if validate is not None:
                try:
                    validate_json(self.json, schema_name=validate)
                except jsonschema.exceptions.ValidationError:
                    raise InvalidJSONError
        else:
            raise InvalidJSONError
            
    def load_url_queries(self, names: Union[list[str], dict[str, Any]]):
        """
        URL queryを`self.query`に格納する

        Parameters
        ----------
        names: list or dict
            queryの名前を指定する.
            - dictの場合、keyがquery名, valueがデフォルトの値
        """
        if isinstance(names, list):
            for name in names:
                self.query[name] = self.get_query_argument(name)
        elif isinstance(names, dict):
            for name, default in names.items():
                query = self.get_query_argument(name, default)
                if isinstance(query, str):
                    query = self.get_query_argument(name, default)
                self.query[name] = query