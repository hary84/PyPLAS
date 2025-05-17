import json
from typing import Any, Dict, Optional, Union

import jsonschema.exceptions
import tornado
from tornado.httputil import HTTPServerRequest
from tornado.web import Application

from pyplas.utils.helper import validate_json
from pyplas.utils.log import get_logger

class InvalidJSONError(Exception):
    """POST, PUT, DELETE等でRequest-Bodyから取得したJSONが無効な形式"""

class ApplicationHandler(tornado.web.RequestHandler):

    def __init__(self, application: Application, request: HTTPServerRequest, **kwargs) -> None:
        super().__init__(application, request, **kwargs)
        self.json = {}
        self.query = {}
        self.is_dev_mode: bool = self.settings["develop"]

    def prepare(self):
        self.logger = get_logger(self.__class__.__module__)
        self.logger.debug(f"{self.request.method} {self.request.uri}")

    def get_template_namespace(self) -> Dict[str, Any]:
        namespace = super().get_template_namespace()
        namespace["current_url"] = self.request.uri
        namespace["is_dev_mode"] = self.is_dev_mode
        return namespace

    def write_error(self, status_code: int, **kwargs: Any) -> None:
        """エラー時に表示するデフォルトの画面を設定する"""
        self.set_status(status_code, kwargs.get("reason", None))
        self.render("error.html", status_code=status_code)
        
    def decode_request_body(self, validate: Optional[str]=None) -> dict[str, Any]:
        """
        リクエストボディをPythonの`dict`に変換し, `self.json`に格納する
        
        Parameters
        ----------
        validate: str or None, default None
            キーやタイプについて検証するか否か  
            - `str`型の場合, `config.SCHEMA_PATH`内のjsonschemaファイルを参照してjsonの検証を行う 
        """
        if self.request.headers.get("Content-Type", None) == "application/json":
            decoded_body = json.loads(self.request.body)
            if validate is not None:
                try:
                    validate_json(decoded_body, schema_name=validate)
                except jsonschema.exceptions.ValidationError:
                    raise InvalidJSONError
            return decoded_body
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

class DevHandler(ApplicationHandler):
    """開発者権限が必要なハンドラー"""
    def prepare(self):
        super().prepare()
        if not self.is_dev_mode:
            self.write_error(403, reason="server is NOT developer mode.")