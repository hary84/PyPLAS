import os
import sqlite3
from typing import Optional

from .app_handler import ApplicationHandler, InvalidJSONError
from pyplas.utils import get_logger , globals as g

logger = get_logger(__name__)
IMAGE_ALLOWED = ["jpg", "jpeg", "png", "webp"]

class CategoryHandler(ApplicationHandler):
    
    def prepare(self):
        logger.debug(f"{self.request.method} {self.request.uri}")
        if not self.is_dev_mode:
            self.write_error(403, reason="server is not developer mode.")

    def get(self, cat_id: Optional[str]=None):
        """
        PATH
            * create/category           :カテゴリ一覧の表示
            * create/category/<cat_id>  :<cat_id>のcat_id, cat_name, logo_url, descriptionを返す
        """
        try:
            if cat_id is None:
                self.get_cate_list()
            else:
                self.get_cate_info(cat_id)
        except AssertionError as e:
            logger.error(e)
            self.write_error(404, reason=str(e))
        except Exception as e:
            logger.error(e)
            self.write_error(500)

    def get_cate_list(self):
        """
        すべてのcategoryの一覧を表示
        """
        sql = r"""SELECT * FROM categories"""
        cates = g.db.get_from_db(sql)
        image_names = self.get_logo_paths()
        self.render("category_edit.html", categories=cates, images=image_names)

    def get_logo_paths(self) -> list:
        """
        /static/img/logo/ 以下にある画像ファイルのパスのリストを返す
        """
        paths = []
        logo_path = os.path.join(self.settings["static_path"], "img", "logo") 
        for filename in os.listdir(logo_path):
            extension = filename.lower().split(".")[-1]
            if extension in IMAGE_ALLOWED:
                paths.append(f"/static/img/logo/{filename}")
        return paths

    def get_cate_info(self, cat_id: str):
        """
        DBから,指定したcat_idの全属性を返す
        """
        sql = r"""SELECT * FROM categories WHERE cat_id = :cat_id"""
        cate_info = g.db.get_from_db(sql, cat_id=cat_id)
        assert len(cate_info) != 0, f"There is no category(cat_id={cat_id})"
        self.write(cate_info[0])

    def post(self, cat_id: Optional[str]=None):
        """
        PATH
            * create/category/new
            * create/category/<cat_id>
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
        logger.info(f"New Category `{self.json['cat_name']}` is added.")

    def edit_category(self, cat_id: str):
        """受け取ったJSONから既存のカテゴリを編集する"""
        if not exist_cat_id(cat_id):
            self.set_status(404, reason=f"There is no category(cat_id={cat_id}) in DB")
            self.finish()
            return 
        
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
        logger.info(f"Category(cat_id={cat_id}) is updated.")

    def delete(self, cat_id: Optional[str]=None):
        """
        PATH
            * create/category/<cat_id>
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
        """
        指定されたcat_idのカテゴリを削除する
        """
        if (not exist_cat_id(cat_id)):
            self.set_status(404, reason=f"There is no category(cat_id={cat_id}) in DB.")
            self.finish()
            return 
        
        sql = r"""DELETE FROM categories WHERE cat_id = :cat_id"""
        g.db.write_to_db(sql, cat_id=cat_id)
        self.write({"DESCR": f"category(cat_id={cat_id}) is successfully deleted."})
        logger.info(f"Category(cat_id={cat_id}) is deleted.")


def exist_cat_id(cat_id:str) -> bool:
    """categoriesテーブルに指定したcat_idがあるかどうかを確認する"""
    sql_check_cat_id_exist = r"""SELECT * FROM categories WHERE cat_id=:cat_id"""
    res = g.db.get_from_db(sql_check_cat_id_exist, cat_id=cat_id)
    return len(res) != 0



