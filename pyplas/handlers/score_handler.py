from dataclasses import asdict, dataclass
import json
import os
import subprocess
import sys
import sqlite3
import tempfile
from typing import Tuple

import tornado
from tornado.ioloop import IOLoop

from .app_handler import ApplicationHandler, InvalidJSONError
from pyplas.utils import globals as g
from pyplas.utils.helper import add_PYTHONPATH
import pyplas.config as cfg

@dataclass
class ScoringBody:
    """ScoringHandlerのPOST時のRequest Body"""
    p_id: str
    q_id: str 
    ptype: int 
    answers: list[str] 
    job_id: str 


class ScoringHandler(ApplicationHandler):

    job_pool = {}

    @classmethod 
    def kill_all_subprocess(cls):
        """実行中のすべてのサブプロセスをkillする"""
        for p in cls.job_pool.values():
            p.kill()
        if len(cls.job_pool.values()) != 0:
            print("All Subprocesses are killed")    

    # POST
    async def post(self):
        """
        問題ページ内の質問の採点を行う
        """
        try:
            self.json = ScoringBody(**self.decode_request_body(validate="scoring.json"))
            if self.json.job_id in self.job_pool.keys():
                self.set_status(202, reason=f"ACCEPTED (IN SCORING)")
                self.finish()
            else:
                await self.scoring()
        except AssertionError as e:
            self.set_status(404, reason="QUESTION NOT FOUND")
            self.finish()
        except InvalidJSONError:
            self.set_status(400, reason="BAD REQUEST (INVALID REQUEST BODY)")
            self.finish()
        except Exception as e:
            self.logger.error(e, exc_info=True)
            self.set_status(500, reason="INTERNAL SERVER ERROR")
            self.finish()

    # DELETE
    async def delete(self):
        """
        採点を中断する
        """
        try:
            self.job_id = self.get_argument("job_id")
            process = self.job_pool.pop(self.job_id, None)
            if process is not None:
                process.kill()
                self.logger.info(f"Canceling Code-Test scoring (job_id='{self.job_id}')")
            self.finish({"DESCR": "Code Testing is canceled."})
        except tornado.web.MissingArgumentError:
            self.set_status(400, reason="Invalid Request; use 'job_id' query")
            self.finish()


    async def scoring(self) -> None:
        """
        問題内の質問について採点を行う

        p_id, q_idが存在しない場合, `AssertionError`を投げる
        """
        exp = []
        SQL = r"""SELECT JSON_EXTRACT(answers, '$.' || :q_id) AS answer,
                JSON_EXTRACT(explanations, '$.' || :q_id) AS exp
            FROM pages WHERE p_id=:p_id"""
        records:list = g.db.execute(SQL, 
                                    p_id=self.json.p_id,
                                    q_id=self.json.q_id)
        assert len(records) == 1, f"Problem(p_id={self.json.p_id}) does not exist."
        answer = records[0]["answer"]
        assert  answer is not None, f"Question(q_id={self.json.q_id}) in Problem({self.json.p_id}) does not exists."
        current_answer:list= json.loads(answer)

        if self.json.ptype == 0:
            result, content = self.scoring_word_test(current_answer)
        elif self.json.ptype == 1:
            result, content = await self.scoring_code_test(current_answer)

        self.insert_log_and_progress(result, self.json.answers)
        if result:
            self.update_progress()
            exp = records[0]["exp"]

        self.logger.info(f"Scoring question({self.json.p_id}/{self.json.q_id})")
        self.finish({
            "p_id": self.json.p_id,
            "q_id": self.json.q_id,
            "html": content,
            "result": result,
            "explanation": exp,
            "DESCR": f"Scoring question"
        })

    def scoring_word_test(self, corrects: list[str]) -> Tuple[bool, str]:
        """
        Word Testの採点を行う

        Returns
        -------
        result: bool
            採点結果
        content: str
            toastに表示される文字列
        """
        # 文字列マッチング
        results = []
        content = ''
        assert len(self.json.answers) == len(corrects), "Does not match the number of questions"

        for i, ans in enumerate(self.json.answers):
            results.append(ans == corrects[i])
            content += f"<p class='mb-0'>[{i+1}] {'o' if results[i] else 'x'}</p>"

        result = not (False in results)

        return (result, content)
    
    async def scoring_code_test(self, corrects: list[str]) -> Tuple[bool, str]:
        """
        Code Testの採点を行う
        
        Returns
        -------
        result: bool
            採点結果
        content: str
            toastに表示される文字列
        """
        code = "\n".join(self.json.answers + corrects)
        env = add_PYTHONPATH(os.getcwd())

        try: 
            tmp_file = tempfile.NamedTemporaryFile(delete=False, 
                                                   dir=cfg.PYTHON_TEMP_DIR, 
                                                   mode="w+t",
                                                   suffix=".py",
                                                   encoding="utf-8")
            file_path = os.path.join(cfg.PYTHON_TEMP_DIR, tmp_file.name)
            tmp_file.write(code)
            tmp_file.close()
            process = subprocess.Popen([sys.executable, file_path],
                                       stdout=subprocess.PIPE,
                                       stderr=subprocess.PIPE,
                                       env=env)
            ScoringHandler.job_pool[self.json.job_id] = process 
            future = IOLoop.current().run_in_executor(None, process.communicate)
            stdout, stderr = await future 
            returncode = process.returncode
        finally: 
            os.remove(file_path)
            ScoringHandler.job_pool.pop(self.json.job_id, None)

        decoded_stdout = stdout.decode(cfg.PREFERRED_ENCODING)
        decoded_stderr = stderr.decode(cfg.PREFERRED_ENCODING)
        self.logger.debug(f"subprocess returncode is {returncode}")

        if returncode == -9:
            result = False
            content = "Code Scoring has been cancelled."
        elif returncode == 0:
            result = True
            content = f"Complete\n\n[output]\n{decoded_stdout}"
        else:
            result = False
            content = decoded_stderr

        return (result, content)

    def insert_log_and_progress(self, result:bool, content:list) -> None:
        """
        採点結果logテーブル, progressテーブルに記録する
        """
        result_int = 2 if result else 1
        SQL = [
            r"""
            INSERT INTO user.logs(p_id, title, category, q_id, ptype, content, result)
                VALUES (
                :p_id,
                (SELECT title FROM pages WHERE p_id=:p_id),
                (SELECT category FROM pages WHERE p_id=:p_id),
                :q_id,
                :ptype,
                :content,
                :result
            )
            """,
            r"""
            INSERT INTO user.progress(p_id, q_status, q_content, p_status)
                VALUES(
                :p_id,
                JSON_OBJECT(:q_id, :result),
                JSON_OBJECT(:q_id, JSON(:content)),
                1
                )
            ON CONFLICT(p_id) DO UPDATE SET
                q_status=JSON_SET(q_status, '$.' || :q_id, :result),
                q_content=JSON_SET(q_content, '$.' || :q_id, JSON(:content)),
                p_status=1
            """
        ]
        g.db.executes(SQL,
                      content=json.dumps(content, ensure_ascii=False),
                      result=result_int,
                      **asdict(self.json))
        
    def update_progress(self):
        """
        progressテーブルを更新する
        """
        SQL = r"""
        UPDATE user.progress set p_status = 2
        WHERE p_id=:p_id AND NOT EXISTS (
            SELECT 1 
            FROM JSON_EACH(
                (SELECT answers FROM pages WHERE p_id=:p_id)) AS p
            WHERE (
                JSON_EXTRACT(q_status, '$.' || p.key) IS NULL OR 
                JSON_EXTRACT(q_status, '$.' || p.key) != 2
            )
        )"""
        g.db.execute(SQL, p_id=self.json.p_id)

