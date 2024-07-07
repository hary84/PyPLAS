from .app_handler import ApplicationHandler
from pyplas.utils.log import get_logger
from pyplas.uimodules import *

mylogger = get_logger(__name__)

class RenderHTMLModuleHandler(ApplicationHandler):
    def prepare(self):
        mylogger.info(f"{self.request.method} {self.request.uri}")
        self.load_url_queries({"action": None})

    def post(self):
        if self.query["action"] == "addMD":
            self.load_json(validate=False)
            self.write({"html": self._gen_node_string(node="Explain", **self.json)})
        elif self.query["action"] == "addCode":
            self.load_json(validate=False)
            self.write({"html": self._gen_node_string(node="Code", **self.json)
                        })
        elif self.query["action"] == "addQ":
            self.load_json(validate=False)
            self.write({"html": self._gen_node_string(node="Question", **self.json)})
        else:
            self.write_error()

    def _gen_node_string(self, node:str="Explain", **kwargs):
        if node == "Explain":
            _html = strfmodule(Explain(self), **kwargs)
        elif node == "Code":
            _html = strfmodule(Code(self), **kwargs)
        elif node == "Question":
            _html = strfmodule(Question(self), q_id="temp", user=1, editable=True, 
                               **kwargs)
        else:
            raise KeyError
        _nc = strfmodule(NodeControl(self), **kwargs)
            
        return _html + "\n" + _nc 
