from tornado.web import UIModule 
import uuid 

class Node(UIModule):
    def render(self, code:str="", 
               editor_id:str=None, readonly: bool=False) -> str:
        if editor_id is None:
            editor_id = str(uuid.uuid4())
        readonly = "readonly" if readonly else ""
        return self.render_string("modules/node.html", 
                                  editor_id=str(editor_id),
                                  code=code,
                                  readonly=readonly) 
