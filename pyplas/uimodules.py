from tornado.web import UIModule 
from tornado.escape import to_unicode

class Node(UIModule):
    def render(self, code:str="", readonly:bool=False, allow_add:bool=False, **kwargs) -> bytes:
        added_class = []
        if readonly:
            added_class.append("readonly")

        return self.render_string("modules/node.html", 
                                code=code,
                                added_class=" ".join(added_class),
                                allow_add=allow_add,
                                **kwargs) 

    def javascript_files(self) :
        return ["js/modules/node.js"]


class Explain(UIModule):
    def render(self, content:str="", **kwargs) -> str:
        return self.render_string("modules/explain.html",
                                  content=content,
                                  **kwargs)
    

class Question(UIModule):
    def render(self, qid:str, body:list=[], mode: int=0, editable:bool=False, allow_add:bool=False, **kwargs) -> str:
        """
        mode: 0 -> student
              1 -> create(str match)
              2 -> create(code test)
        """
        return self.render_string("modules/question.html",
                                  qid=qid,
                                  conponent=body,
                                  editable=editable,
                                  allow_add=allow_add,
                                  mode=mode,
                                  **kwargs)

class NodeControl(UIModule):
    def render(self, code:bool=True, explain:bool=True, question:bool=True, dele:bool=True):
        return self.render_string("modules/node-control.html",
                                  code=code,
                                  explain=explain,
                                  question=question,
                                  dele=dele)
    
class AceMDE(UIModule):
    def render(self,):
        return self.render_string("modules/MDE.html")

def strfmodule(module: UIModule, **kwargs):
    return to_unicode(module.render(**kwargs))