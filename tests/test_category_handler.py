import json
import unittest.main

from pyplas.app import clean_up
from tests import helper

POST_HEADER = {"Content-type": "application/json"}

class TestCategoryHandlerWithUserMode(helper.MyHTTPTestCase):
    """ユーザモードでのCategoryHandlerのテスト"""
    @classmethod
    def setUpClass(cls):
        cls.testDB = helper.DummyDB()
        cls.testDB.set_problemDB(categories=0, pages=0)
        return super().setUpClass()

    def test_get_category_info(self):
        """カテゴリの詳細を取得"""
        response = self.fetch(f"/create/category/1")
        self.assertEqual(403, response.code)
        
    def test_create_new_category(self):
        """新しいカテゴリを定義"""
        send_msg = {
            "cat_name": "demo category",
            "logo_url": "",
            "description": "aaa"
        }
        response = self.fetch("/create/category/new", 
                             headers={"Content-type": "application/json"},
                             method="POST",
                             body=json.dumps(send_msg))
        
        self.assertEqual(403, response.code)

    @classmethod
    def tearDownClass(cls) -> None:
        clean_up()
        cls.testDB.clean_up()
        return super().tearDownClass()

class TestCategoryHandlerWithDevMode(helper.MyHTTPTestCase):
    """開発モードでのCategoryHandlerのテスト"""
    @classmethod
    def setUpClass(cls):
        cls.testDB = helper.DummyDB()
        category_records = [
            helper.CategoryDummyRecord(cat_name="numpy", logo_url=None), # to get
            helper.CategoryDummyRecord(cat_name="pandas", description=None), # to delete 
            helper.CategoryDummyRecord(cat_name="matpltolib") # to edit 
        ]
        cls.testDB.set_problemDB(categories=category_records, pages=10)
        return super().setUpClass()
    
    def get_app(self):
        return super().get_app(develop=True)
    
    def test_display_category_list(self):
        """カテゴリ一覧画面を表示"""
        response = self.fetch("/create/category/")
        self.assertEqual(200, response.code)
    
    def test_get_category_info(self):
        """カテゴリの詳細を取得"""
        response = self.fetch(f"/create/category/1")
        rcv_json: dict = json.loads(response.body)

        self.assertEqual(200, response.code)
        self.assertEqual(1, rcv_json["cat_id"])
        self.assertEqual("numpy", rcv_json["cat_name"])
        self.assertEqual(None, rcv_json["logo_url"])
        self.assertTrue("description" in rcv_json.keys())

    def test_get_nonexist_category_info(self):
        """存在しないカテゴリの詳細を取得"""
        response = self.fetch(f"/create/category/-1")
        self.assertEqual(404, response.code)
        
    def test_create_new_category(self):
        """新しいカテゴリを定義"""
        new_cate = helper.CategoryDummyRecord(cat_name="demo category", 
                                              logo_url="",
                                              description="aaaaaaaaa"
                                              ).params
        post = self.fetch("/create/category/new", 
                          headers=POST_HEADER,
                          method="POST",
                          body=json.dumps(new_cate))
        rcv_json: dict = json.loads(post.body)

        self.assertEqual(200, post.code)
        self.assertEqual(new_cate["cat_name"], rcv_json["cat_name"])
        self.assertEqual(new_cate["logo_url"], rcv_json["logo_url"])
        self.assertEqual(new_cate["description"], rcv_json["description"])
        self.assertTrue("DESCR" in rcv_json.keys())
    
    def test_create_category_with_invalid_json(self):
        """無効なJSON形式を用いて新しいカテゴリを定義"""
        invalid_cate = helper.CategoryDummyRecord().params
        invalid_cate["unexpected_key"] = 100

        post = self.fetch("/create/category/new", 
                          headers=POST_HEADER,
                          method="POST",
                          body=json.dumps(invalid_cate))
        self.assertEqual(400, post.code)

    def test_edit_category(self):
        """既存のカテゴリを編集"""
        edit_cate = helper.CategoryDummyRecord().params

        response = self.fetch("/create/category/3", 
                             headers=POST_HEADER,
                             method="POST",
                             body=json.dumps(edit_cate))
        rcv_json: dict = json.loads(response.body)

        self.assertEqual(200, response.code)
        self.assertEqual(edit_cate["cat_name"], rcv_json["cat_name"])
        self.assertEqual(edit_cate["logo_url"], rcv_json["logo_url"])
        self.assertEqual(edit_cate["description"], rcv_json["description"])
        self.assertTrue("DESCR" in rcv_json.keys())

    def test_edit_nonexist_category(self):
        """存在しないカテゴリを編集"""
        nonexist_cate = helper.CategoryDummyRecord().params
        response = self.fetch("/create/category/-1", 
                             headers=POST_HEADER,
                             method="POST",
                             body=json.dumps(nonexist_cate))
        self.assertEqual(404, response.code)
    
    def test_edit_category_with_invalid_json(self):
        """無効なJSON形式でカテゴリを編集"""
        new_cate = helper.CategoryDummyRecord().params
        del new_cate["logo_url"]
        response = self.fetch("/create/category/3",
                              headers={"Content-Type": "application/json"},
                              method="POST",
                              body=json.dumps(new_cate))
        self.assertEqual(400, response.code)

    def test_delete_category(self):
        """カテゴリを削除"""
        delete = self.fetch("/create/category/2", method="DELETE")
        rcv: dict = json.loads(delete.body)

        self.assertEqual(200, delete.code)
        self.assertEqual(2, rcv["cat_id"])
        self.assertTrue("DESCR" in rcv.keys())

    def test_delete_nonexist_category(self):
        """存在しないカテゴリを削除"""
        delete = self.fetch("/create/category/-1", method="DELETE")
        self.assertEqual(404, delete.code)

    def test_undefined_POST_action(self):
        """未定義のパスにPOSTリクエストを投げる"""
        response = self.fetch("/create/category",
                              method="POST",
                              body="")
        self.assertEqual(404, response.code)

    def test_undefined_DELETE_action(self):
        """未定義のパスにDELETEリクエストを投げる"""
        response = self.fetch("/create/category",
                              method="DELETE")
        self.assertEqual(404, response.code)

    @classmethod
    def tearDownClass(cls) -> None:
        clean_up()
        cls.testDB.clean_up()
        return super().tearDownClass()

if __name__ == '__main__':
    unittest.main()