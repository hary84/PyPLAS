from typing import Literal
from .app_handler import ApplicationHandler
from pyplas.utils.log import get_logger
from pyplas.uimodules import *

mylogger = get_logger(__name__)

class ModuleHandler(ApplicationHandler):

    def post(self, module_name: str):
        if module_name == "explainNode":
            self.json = self.decode_request_body()
            self.write({"html": self._gen_node_string(node="Explain", **self.json)})
        elif module_name == "codeNode":
            self.json = self.decode_request_body()
            self.write({"html": self._gen_node_string(node="Code", **self.json)})
        elif module_name == "questionNode": 
            self.json = self.decode_request_body()
            self.write({"html": self._gen_node_string(node="Question", **self.json)})



    def _gen_node_string(self, node: Literal["Explain", "Code", "Question"]="Explain", **kwargs) -> str:
        """
        uimoduleの`Explain`, `Code`, `Question`を文字列化して渡す
        """
        if node == "Explain":
            _html = strfmodule(Explain(self), **kwargs)
        elif node == "Code":
            _html = strfmodule(Code(self), **kwargs)
        elif node == "Question":
            _html = strfmodule(Question(self), user=1, **kwargs)
        else:
            raise KeyError
        _nc = strfmodule(NodeControl(self))
            
        return _html + "\n" + _nc 




