from dataclasses import asdict, dataclass
import os
from typing import Optional

from .app_handler import DevHandler, InvalidJSONError
from pyplas.utils import globals as g

IMAGE_ALLOWED = ["jpg", "jpeg", "png", "webp"]

@dataclass
class EditCategoryBody():
    """POST /edit/categories/<cat_id>のRequest Body"""
    cat_name: str
    logo_url: str
    description: str

class CategoryHandler(DevHandler):
    
    def get(self, cat_id: Optional[str]=None):
        """
        - `/edit/categories`  :カテゴリ一覧の表示
        """
        try:
            if cat_id is None:
                self.render_category_list()
            else:
                self.set_status(404, reason=f"{self.request.uri} is not found.")
                self.finish()
        except Exception as e:
            self.logger.error(e)
            self.set_status(500, "Internal Server Error")
            self.finish()

    def post(self, cat_id: Optional[str]=None):
        """
        - `/edit/categories/new`      :新規カテゴリを登録する
        - `/edit/categories/<cat_id>  :カテゴリ情報を編集する
        """
        try:
            if cat_id == None:
                self.set_status(404, reason=f"{self.request.uri} is not found.")
                self.finish()
            else:
                self.json = EditCategoryBody(**self.decode_request_body(validate="category_edit.json"))
                self.register_category(cat_id)
        except InvalidJSONError as e:
            self.set_status(400, reason="Invalid request body")
            self.finish()
        except AssertionError as e:
            self.set_status(404, reason=str(e))
            self.finish()
        except Exception as e:
            self.logger.error(e)
            self.set_status(500, "Internal Server Error")
            self.finish()

    def delete(self, cat_id: Optional[str]=None):
        """
        - `.edit/categories/<cat_id>`  :カテゴリを削除する
        """
        try:
            if cat_id is None:
                self.set_status(404, reason=f"{self.request.uri} is not found.")
                self.finish()
            else:
                self.del_category(cat_id=cat_id)
        except AssertionError as e:
            self.set_status(404, reason=str(e))
            self.finish()
        except Exception as e:
            self.logger.error(e)
            self.set_status(500, "Internal Server Error")
            self.finish()

    def render_category_list(self):
        """
        すべてのcategoryの一覧を表示
        """
        sql = r"""SELECT * FROM categories"""
        cates = g.db.execute(sql)
        image_paths = self.get_logo_paths()
        self.render("category_edit.html", categories=cates, image_paths=image_paths)

    def get_logo_paths(self) -> list[str]:
        """
        `/static/img/logo/` 以下にある画像ファイルのパスのリストを返す
        """
        paths = []
        logo_path = os.path.join(self.settings["static_path"], "img", "logo") 
        for filename in os.listdir(logo_path):
            extension = filename.lower().split(".")[-1]
            if extension in IMAGE_ALLOWED:
                paths.append(f"img/logo/{filename}")
        return paths
    
    def register_category(self, cat_id: str):
        """
        カテゴリの登録を行う. 

        カテゴリが存在しない場合, `AssertionError`を投げる
        """
        if cat_id == "new":
            SQL = r"""INSERT INTO categories(cat_name, logo_url, description) VALUES(
                    :cat_name, :logo_url, :description 
                ) RETURNING * """
            res: dict = g.db.execute(SQL, **asdict(self.json))[0]

            res["DESCR"] = f"Create new category"
            self.write(res)
            self.logger.info(f"Create new Category(cat_name='{self.json.cat_name}')")
        else:
            SQL = r"""UPDATE categories SET
                cat_name = :cat_name,
                logo_url = :logo_url,
                description = :description
            WHERE cat_id=:cat_id
            RETURNING * """
            res_list = g.db.execute(SQL, cat_id=cat_id, **asdict(self.json))
            assert len(res_list) == 1, f"Category(cat_id={cat_id}) is not found."

            res = res_list[0]
            res["DESCR"] = f"Edit the category(cat_id={cat_id})"
            self.write(res)
            self.logger.info(f"Edit Category(cat_name='{self.json.cat_name}'")
    
    def del_category(self, cat_id:str):
        """
        指定されたcat_idのカテゴリを削除する

        カテゴリが存在しない場合, `AssertionError`を投げる
        """
        SQL = r"""DELETE FROM categories WHERE cat_id = :cat_id
        RETURNING * """
        res_list = g.db.execute(SQL, cat_id=cat_id)
        assert len(res_list) == 1, f"Category(cat_id={cat_id}) is not found."

        res = res_list[0]
        res["DESCR"] = f"Delete the Category(cat_id={cat_id})"
        self.write(res)
        self.logger.info(f"Delete Category(cat_name={res['cat_name']})")




