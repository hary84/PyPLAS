import json
import sqlite3
import unittest.main

from tornado.testing import AsyncHTTPTestCase

from pyplas.app import make_app
from tests import helper

def set_value_in_test_db():
    conn = sqlite3.connect(helper.TEST_DB_PATH)
    sql = r"""INSERT INTO categories(cat_name, logo_url, description)
            VALUES(:name, :url, :descr)"""
    conn.executemany(sql, [{"name": "numpy", "url": None, "descr": "aaaa"},
                           {"name": "pandas", "url": "/fasdfas/fdas", "descr": None}] )
    conn.commit()
    return conn

class TestCategoryHandlerWithUserMode(AsyncHTTPTestCase):
    """ユーザモードでのCategoryHandlerのテスト"""
    @classmethod
    def setUpClass(cls):
        helper.setup_database()
        set_value_in_test_db()
        return super().setUpClass()

    def get_app(self):
        return make_app(develop=False)

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
        helper.clean_up_database()
        return super().tearDownClass()

class TestCategoryHandlerWithDevMode(AsyncHTTPTestCase):
    """開発モードでのCategoryHandlerのテスト"""
    @classmethod
    def setUpClass(cls):
        helper.setup_database()
        set_value_in_test_db()
        return super().setUpClass()

    def get_app(self):
        return make_app(develop=True)
    
    def test_get_category_info(self):
        """カテゴリの詳細を取得"""
        response = self.fetch(f"/create/category/1")
        rcv_json = json.loads(response.body)

        self.assertEqual(200, response.code)
        self.assertEqual(4, len(rcv_json))

    def test_cannot_get_category_info(self):
        """存在しないカテゴリの詳細を取得"""
        response = self.fetch(f"/create/category/-1")
        self.assertEqual(404, response.code)
        
    def test_create_new_category(self):
        """新しいカテゴリを定義"""
        send_msg = {
            "cat_name": "demo category",
            "logo_url": "",
            "description": "aaa"
        }
        post = self.fetch("/create/category/new", 
                             headers={"Content-type": "application/json"},
                             method="POST",
                             body=json.dumps(send_msg))
        rcv_json = json.loads(post.body)
        self.assertEqual(200, post.code)
        self.assertEqual(4, len(rcv_json))
    
    def test_create_category_with_invalid_json(self):
        """無効なJSON形式を用いて新しいカテゴリを定義"""
        send_msg = {
            "cat_name": "demo cat",
            "logo_url": "/",
            "description": "aaa",
            "cat_id": "10",
        }
        post = self.fetch("/create/category/new", 
                          headers={"Content-Type": "application/json"},
                          method="POST",
                          body=json.dumps(send_msg))
        self.assertEqual(400, post.code)

    def test_edit_category(self):
        """既存のカテゴリを編集"""
        send_msg = {
            "cat_name": "demo category",
            "logo_url": "",
            "description": "aaa"
        }
        response = self.fetch("/create/category/1", 
                             headers={"Content-type": "application/json"},
                             method="POST",
                             body=json.dumps(send_msg))
        rcv_json = json.loads(response.body)
        self.assertEqual(200, response.code)
        self.assertEqual(4, len(rcv_json))

    def test_cannot_edit_category(self):
        """存在しないカテゴリを編集"""
        send_msg = {
            "cat_name": "demo category",
            "logo_url": "",
            "description": "aaa"
        }
        response = self.fetch("/create/category/-1", 
                             headers={"Content-type": "application/json"},
                             method="POST",
                             body=json.dumps(send_msg))
        self.assertEqual(404, response.code)
    
    def test_edit_category_with_invalid_json(self):
        """無効なJSON形式でカテゴリを編集"""
        msg = {
            "cat_name": "demo",
            "description": ""
        }
        response = self.fetch("/create/category/1",
                              headers={"Content-Type": "application/json"},
                              method="POST",
                              body=json.dumps(msg))
        self.assertEqual(400, response.code)

    def test_delete_category(self):
        """カテゴリを削除"""
        delete = self.fetch("/create/category/2", method="DELETE")
        rcv = json.loads(delete.body)
        self.assertEqual(200, delete.code)
        self.assertEqual(1, len(rcv))

    def test_cannot_delete_category(self):
        """存在しないカテゴリを削除"""
        delete = self.fetch("/create/category/-1", method="DELETE")
        self.assertEqual(404, delete.code)

    @classmethod
    def tearDownClass(cls) -> None:
        helper.clean_up_database()
        return super().tearDownClass()

if __name__ == '__main__':
    unittest.main()