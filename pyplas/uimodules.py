from tornado.web import UIModule 

class Node(UIModule):
    def render(self, code:str="", readonly:bool=False, testing:bool=False, **kwargs) -> str:
        added_class = []
        if testing:
            added_class.append("d-none")  
        if testing or readonly:
            added_class.append("readonly")
        return self.render_string("modules/node.html", 
                                  code=code,
                                  added_class=" ".join(added_class)) 

    def javascript_files(self) :
        return ["js/modules/node.js"]
    
    def css_files(self):
        return ["css/modules/node.css"]

class Explain(UIModule):
    def render(self, content:str="", **kwargs) -> str:
        return self.render_string("modules/explain.html",
                                  content=content)
    

class Question(UIModule):
    def render(self, body: list, **kwargs) -> str:
        return self.render_string("modules/question.html",
                                  conponent=body)