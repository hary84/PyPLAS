import re
from typing import Optional
import uuid

from tornado.web import UIModule 
from tornado.escape import to_unicode

from pyplas.utils import get_logger

mylogger = get_logger(__name__)

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
               allow_del:bool=False, node_id:Optional[str]=None, **kwargs) -> bytes:
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
               editable:bool=False, progress:int=0, node_id:Optional[str]=None, 
               explanation:list=[], **kwargs) -> bytes:
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
        explanation: list
            explanation for this question
        """
        if ptype == 0 and user == 0:
            try:
                question = self.ans_attr_deleted_html(question)
            except Exception as e:
                mylogger.error(e)

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
                                  node_id=node_id,
                                  explanation=explanation
                                  )
    
    def ans_attr_deleted_html(self, string: str) -> str:
        """input, selectタグ内のans属性が削除されたhtml文字列を返す"""
        return re.sub(r"(<(input|select)([^>]*?)?>)", self._del_ans_attr, string)

    def _del_ans_attr(self, match: re.Match) -> str:
        """渡されたselect, inputタグを含む文字列からans属性を削除する"""
        return re.sub(r"ans=((\"([^\"]*?)\"|\'([^\']*?)\'))", "", match[0])
    
class NodeControl(UIModule):
    def render(self, code:bool=True, explain:bool=True, question:bool=True, **kwargs):
        return self.render_string("modules/node-control.html",
                                  code=code,
                                  explain=explain,
                                  question=question,)

def strfmodule(module: UIModule, **kwargs):
    return to_unicode(module.render(**kwargs))