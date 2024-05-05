from tornado.web import UIModule 
from tornado.escape import to_unicode

class Code(UIModule):
    def render(self, content:str="", readonly:bool=False, user:int=0, 
               allow_del:bool=False, **kwargs) -> bytes:
        """
        *content: code content
        *readonly
            False: CAN edit code
            True : CAN NOT edit code 
        user
            0: learner
            1: problem creator (add readonly checkbox)
        allow_del
            False: CAN NOT add/remove node 
            True : CAN add/remove node (add trash btn)
        """
        if type(content) == list:
            content = "\n".join(content)

        return self.render_string("modules/code.html", 
                                content=content,
                                readonly=readonly,
                                user=user,
                                allow_del=allow_del,
                                **kwargs) 


class Explain(UIModule):
    def render(self, editor:bool=False, content:str="", 
               allow_del:bool=False, **kwargs) -> str:
        """
        *content: markdown content 
        editor:    False: is PLAIN text
                   True : is EDITOR 
        allow_del: if True, add del-btn
        """
        if type(content) == list:
            content = "\n".join(content)

        return self.render_string("modules/explain.html",
                                  editor=editor,
                                  content=content,
                                  allow_del=allow_del
                                  )

    

class Question(UIModule):
    def render(self, q_id:str, ptype:int=0, user:int=0, conponent:list=[], question:str="",
               answer:list=[], editable:bool=False, **kwargs) -> str:
        """
        *q_id: question id (unique)
        *ptype: 0: HTML Problem
               1: Code Writing Problem
        user:  0: learner
               1: problem creator 
        conponent: contents (only if ptype == 1)
        *question: question text
        *answers: answer list
        *editable: False: CAN NOT add/remove Markdown, Code
                  True : CAN add/remove Markdown, Code
        """
        if ptype == 1:
            answer = answer[0]
        return self.render_string("modules/question.html",
                                  q_id=q_id, ptype=ptype, user=user,
                                  question=question,
                                  answer=answer,
                                  conponent=conponent,
                                  editable=editable)
    
class NodeControl(UIModule):
    def render(self, code:bool=True, explain:bool=True, question:bool=True):
        return self.render_string("modules/node-control.html",
                                  code=code,
                                  explain=explain,
                                  question=question,)

def strfmodule(module: UIModule, **kwargs):
    return to_unicode(module.render(**kwargs))