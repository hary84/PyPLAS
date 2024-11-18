import sqlite3
import time
import unittest.main

from pyplas.app import clean_up
from tests import helper

class TestMainHandlerWithoutCategory(helper.MyHTTPTestCase):
    """
    categoriesテーブルが空のときのmain_handlerのテスト
    """
    @classmethod
    def setUpClass(cls):
        page_records = [
            helper.PagesDummyRecord(category=None, status=1),
            helper.PagesDummyRecord(category=None, status=1)
        ]
        cls.testdb = helper.DummyDB()
        cls.testdb.set_problemDB(pages=page_records)
        cls.conn = sqlite3.connect(helper.TEST_DB_PATH)
        return super().setUpClass()

    def test_get_category_list(self):
        """カテゴリ一覧を表示"""
        response = self.fetch("/")
        self.assertEqual(200, response.code)

    def test_get_nonexist_category_problems(self):
        """存在しないカテゴリの問題一覧を表示"""
        response = self.fetch("/?category=aaaaa")
        self.assertEqual(404, response.code)

    def test_get_None_cateogry_problems(self):
        """どのカテゴリにも属さない問題の一覧を表示"""
        response = self.fetch("/?category=None")
        self.assertEqual(200, response.code) # どのカテゴリにも属さない問題が存在する

    @classmethod
    def tearDownClass(cls) -> None:
        time.sleep(.5)
        clean_up()
        cls.testdb.clean_up()
        return super().tearDownClass()
    
class TestMainHandlerWithCategory(helper.MyHTTPTestCase):
    """categoriesテーブルが空ではないときのmain_handlerのテスト"""
    @classmethod
    def setUpClass(cls):
        cls.testdb = helper.DummyDB()
        cate_records = [
            helper.CategoryDummyRecord(cat_name="numpy"), # cat_id = 1
            helper.CategoryDummyRecord(cat_name="pandas") # cat_id = 2
        ]
        page_records = [
            helper.PagesDummyRecord(category=1, status=1),
            helper.PagesDummyRecord(category=2, status=0)
        ]
        cls.testdb.set_problemDB(categories=cate_records, pages=page_records)
        cls.conn = sqlite3.connect(helper.TEST_DB_PATH)
        return super().setUpClass()
    
    def test_get_category_list(self):
        """カテゴリーの一覧を表示"""
        response = self.fetch("/")
        self.assertEqual(200, response.code)

    def test_get_empty_category_problems(self):
        """空の問題一覧を表示"""
        response1 = self.fetch("/?category=pandas")
        self.assertEqual(404, response1.code)

        response2 = self.fetch("/?category=None")
        self.assertEqual(404, response2.code)

    def test_get_problems(self):
        """空ではない問題一覧を表示"""
        response = self.fetch("/?category=numpy")
        self.assertEqual(200, response.code)
    
    @classmethod
    def tearDownClass(cls) -> None:
        time.sleep(.5)
        clean_up()
        cls.testdb.clean_up()
        return super().tearDownClass()
    
    
if __name__ == '__main__':
    unittest.main()