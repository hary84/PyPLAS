from tornado.web import UIModule 
from tornado.escape import to_unicode

class Code(UIModule):
    def render(self, content:str="", readonly:bool=False, user:int=0, 
               allow_del:bool=False, **kwargs) -> bytes:
        """
        user
            0: learner
            1: problem creator (add readonly checkbox)
        allow_del
            False: CAN NOT add/remove node 
            True: CAN add/remove node (add trash btn)
        """
        if type(content) == list:
            content = "\n".join(content)

        return self.render_string("modules/code.html", 
                                content=content,
                                readonly=readonly,
                                user=user,
                                allow_del=allow_del,
                                **kwargs) 

    def javascript_files(self) :
        return ["js/modules/node.js"]


class Explain(UIModule):
    def render(self, editor:bool=False, content:str="", allow_del:bool=False, inQ:bool=False) -> str:
        """
        editor
            False: is PLAIN text
            True: is EDITOR 

        allow_del
            False: 
            True: add del-btn

        inQ 
            False: is NOT in Question node 
            True: is in Question node (add question-builder-btn)
        """
        if type(content) == list:
            content = "\n".join(content)

        return self.render_string("modules/explain.html",
                                  editor=editor,
                                  content=content,
                                  allow_del=allow_del,
                                  inQ=inQ)

    

class Question(UIModule):
    def render(self, qid:str, ptype:int=0, user:int=0, conponent:list=[], 
               answer:str="", editable:bool=False) -> str:
        """
        user: 0: learner
              1: problem creator 

        ptype: 0: HTML Problem
               1: Code Writing Problem
        
        editable
            False: CAN NOT add/remove Markdown, Code
            True: CAN add/remove Markdown, Code

        """
        if (ptype == 1) and len(conponent) > 0:
            question = conponent[0]
        else:
            question = ""

        return self.render_string("modules/question.html",
                                  qid=qid, ptype=ptype, user=user,
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