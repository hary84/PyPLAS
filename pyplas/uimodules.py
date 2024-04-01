from tornado.web import UIModule 
import uuid 

class Node(UIModule):
    def render(self, code:str="", readonly:bool=False, testing:bool=False) -> str:
        added_class = []
        if testing:
            added_class.append("testing")  
        if testing or readonly:
            added_class.append("readonly")
        return self.render_string("modules/node.html", 
                                  editor_id=str(uuid.uuid4()),
                                  code=code,
                                  added_class=" ".join(added_class)) 

    # def embedded_javascript(self):
    #     return f"console.log('{self.id}')"