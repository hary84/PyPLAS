from typing import Optional
import uuid

from bs4 import BeautifulSoup
from tornado.web import UIModule 
from tornado.escape import to_unicode

class Code(UIModule):
    def render(self, content:str="", readonly:bool=False, user:int=0, 
               allow_del:bool=False, node_id:Optional[str]=None, **kwargs) -> bytes:
        """
        Parameters
        ----------
        content*: str
            code content
        readonly*: bool
            False: CAN edit code
            True : CAN NOT edit code 
        user: int
            0: learner
            1: problem creator (add readonly checkbox)
        allow_del: bool
            if True, can remove node
        node_id: str
            random uuid4
        """
        if node_id is None:
            node_id = str(uuid.uuid4())

        return self.render_string("modules/code.html", 
                                content=content,
                                readonly=readonly,
                                user=user,
                                allow_del=allow_del,
                                node_id=node_id,
                                **kwargs) 


class Explain(UIModule):
    def render(self, editor:bool=False, content:str="", 
               allow_del:bool=False, node_id:Optional[str]=None, **kwargs) -> str:
        """
        Parameters 
        ----------
        content*: str
            markdown content 
        editor: bool
            False: is PLAIN text
            True : is EDITOR 
        allow_del: bool
            if True, add del-btn
        node_id: str 
            ramdom uuid4
        """
        if node_id is None:
            node_id = str(uuid.uuid4())
            
        return self.render_string("modules/explain.html",
                                  editor=editor,
                                  content=content,
                                  allow_del=allow_del,
                                  node_id=node_id
                                  )

    

class Question(UIModule):
    def render(self, q_id:str, ptype:int=0, user:int=0, conponent:list=[], question:str="",
               answers:list=[], saved_answers:list=[], 
               editable:bool=False, progress:int=0, node_id:Optional[str]=None, **kwargs) -> str:
        """
        Parameters
        ----------
        q_id*: str
            question id (unique)
        ptype*: int
            0: HTML Problem  
            1: Code Writing Problem
        user: int
            0: learner  
            1: problem creator 
        conponent*: list
            contents 
            :Only used in ptype=1 and editable=False  
            :e.g. [Node, Node, ...]
        question*: str
            question text
        answers: list
            correct answer list (used if user = 1)  
            e.g. [answer, answer, ...]
        saved_answers: list
            answers saved in DB (used if user =0)  
            e.g. [answer, answer, ...]
        editable*: bool
            False: CAN NOT add/remove Markdown, Code  
            True : CAN add/remove Markdown, Code
        progress: int
            0: untried  
            1: tried  
            2: complete  
        node_id: str 
            ramdom uuid4
        """
        if ptype == 0 and user == 0:
            soup = BeautifulSoup(question, "html.parser")
            elems = soup.find_all(["select", "input"], attrs={"ans", True})
            for i, e in enumerate(elems):
                del e.attrs["ans"]
                try:
                    if e.name == "input":
                        e["value"] = saved_answers[i]
                    elif e.name == "select":
                        e.find("option", {"value": saved_answers[i]})["selected"] = ""
                except (IndexError, AttributeError, TypeError):
                    continue

            question = soup.prettify()
        elif ptype == 1:
            answers = answers[0] if len(answers) > 0 else ""

        if node_id is None: 
            node_id = str(uuid.uuid4())

        return self.render_string("modules/question.html",
                                  q_id=q_id, ptype=ptype, user=user,
                                  question=question,
                                  answers=answers,
                                  saved_answers=saved_answers,
                                  conponent=conponent,
                                  editable=editable,
                                  progress=progress,
                                  node_id=node_id
                                  )
    
class NodeControl(UIModule):
    def render(self, code:bool=True, explain:bool=True, question:bool=True, **kwargs):
        return self.render_string("modules/node-control.html",
                                  code=code,
                                  explain=explain,
                                  question=question,)

def strfmodule(module: UIModule, **kwargs):
    return to_unicode(module.render(**kwargs))