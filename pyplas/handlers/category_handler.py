import sqlite3
from typing import Optional
from .app_handler import ApplicationHandler, InvalidJSONError
from pyplas.utils import get_logger , globals as g

logger = get_logger(__name__)

class CategoryHandler(ApplicationHandler):
    
    def prepare(self):
        logger.info(f"{self.request.method} {self.request.uri}")

    def get(self, cat_id: Optional[str]=None):
        """
        PATH
            * /category → カテゴリ一覧の表示
        """
        try:
            if cat_id is None:
                sql = r"""SELECT * FROM categories"""
                categories = g.db.get_from_db(sql)
                self.render("category_edit.html", categories=categories)
            else:
                self.redirect("/category", permanent=True)
        except Exception as e:
            logger.error(e)
            self.write_error(500)

    def post(self, cat_id: Optional[str]=None):
        """
        PATH
            * /category/new
            * /category/<cat_id>
        """
        if cat_id == None:
            self.set_status(404, reason=f"{self.request.uri} is not found.")
            self.finish()
        
        else:
            try:
                if cat_id == "new":
                    self.load_json(validate=True, schema="category_edit.json")
                    self.add_category()
                else:
                    self.load_json(validate=True, schema="category_edit.json")
                    self.edit_category(cat_id=cat_id)
            except (InvalidJSONError, sqlite3.Error) as e:
                logger.error(e, exc_info=True)
                self.set_status(400, reason="Invalid request body")
                self.finish()

    def add_category(self):
        """受け取ったJSONから新たなカテゴリを追加する"""
        sql = r"""INSERT INTO categories(cat_name, logo_url, description) VALUES(
        :cat_name,
        CASE 
            WHEN :logo_url = "" THEN NULL 
            ELSE :logo_url
        END,
        CASE 
            WHEN :description = "" THEN NULL
            ELSE :description
        END
        )"""
        g.db.write_to_db(sql, **self.json)
        self.write(self.json | {"DESCR": f"new category \"{self.json['cat_name']}\" is successfully added."})

    def edit_category(self, cat_id: str):
        """受け取ったJSONから既存のカテゴリを編集する"""
        sql = r"""UPDATE categories SET cat_name=:cat_name,
        logo_url = CASE 
            WHEN :logo_url = "" THEN NULL
            ELSE :logo_url
        END,
        description = CASE
            WHEN :description = "" THEN NULL
            ELSE :description
        END
        WHERE cat_id = :cat_id"""
        g.db.write_to_db(sql, cat_id=cat_id, **self.json)
        self.write(self.json | {"DESCR": f"category \"{self.json['cat_name']}\" is successfully edited."})

    def delete(self, cat_id: Optional[str]=None):
        """
        PATH
            * /category/<cat_id>
        """
        if cat_id is None:
            self.set_status(404, reason=f"{self.request.uri} is not found.")
            self.finish()
        else:
            try:
                self.del_category(cat_id=cat_id)
            except sqlite3.Error as e:
                logger.error(e, exc_info=True)
                self.set_status(400, reason="Invalid request body")
                self.finish()
    
    def del_category(self, cat_id:str):
        """指定されたcat_idのカテゴリを削除する"""
        sql = r"""DELETE FROM categories WHERE cat_id = :cat_id"""
        g.db.write_to_db(sql, cat_id=cat_id)
        self.write({"DESCR": f"category(cat_id={cat_id}) is successfully deleted."})

