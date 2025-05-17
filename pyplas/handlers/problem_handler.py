import json

from .app_handler import ApplicationHandler, InvalidJSONError
from pyplas.utils import globals as g

class ProblemHandler(ApplicationHandler):

    def get(self, p_id: str):
        """
        問題ページを表示する
        """
        # pagesテーブルからtitle, page,
        # categoriesテーブルからcat_name,
        # progressテーブルからq_status, q_content を取得する
        SQL = r"""SELECT pages.title, pages.page, pages.category, categories.cat_name,
            COALESCE(user.progress.q_status, '{}') AS q_status, 
            COALESCE(user.progress.q_content, '{}') AS q_content
            FROM pages 
            LEFT OUTER JOIN categories ON category = categories.cat_id
            LEFT OUTER JOIN user.progress ON pages.p_id = user.progress.p_id
            WHERE pages.p_id=:p_id AND (status=1 OR :is_dev)
            """
        
        try:
            pages:list = g.db.execute(SQL, p_id=p_id, is_dev=self.is_dev_mode)
            assert len(pages) == 1, f"Problem(p_id={p_id}) is not found."
                
            page:dict = pages[0]
            self.render(f"./problem.html", 
                        title=page["title"],
                        page=json.loads(page["page"]),
                        q_status=json.loads(page["q_status"]),
                        q_content=json.loads(page["q_content"]),
                        cat_id=page["category"],
                        cat_name=page["cat_name"])
        except AssertionError as e:
            self.logger.error(e)
            self.write_error(404, reason=str(e))
        except Exception as e:
            self.logger.error(e)
            self.write_error(500, reason=str(e))


    def post(self, p_id:str):
        """
        問題(p_id)のユーザ入力をDBに保存する
        """
        # user.dbのprogressテーブルに`新たな列を追加する
        # すでにp_idの列が存在する場合は，q_contentを更新する
        SQL = r"""INSERT INTO user.progress(p_id, q_status, q_content, p_status)
            VALUES (:p_id, '{}', :q_content, 1) 
            ON CONFLICT(p_id) DO UPDATE SET
            q_content=:q_content
            RETURNING q_content;
            """
        try:
            rcv_json = self.decode_request_body(validate="save_user_data.json")
            records = g.db.execute(SQL,
                            p_id=p_id,
                            q_content=json.dumps(rcv_json["content"]))
        except InvalidJSONError as e:
            self.set_status(400, reason="Invalid request body")
            self.finish()
        except Exception as e:
            self.logger.error(e, exc_info=True)
            self.set_status(500, reason="Internal Server Error")
            self.finish()
        else:
            self.finish({
                "body": rcv_json["content"],
                "DESCR": "Your input data is successfully saved."
            })
            self.logger.info(f"User's input in \"{p_id}\" is saved.")

    