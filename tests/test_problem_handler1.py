import json
import unittest.main
from urllib.parse import urlparse

from pyplas.app import clean_up
from tests import helper

class TestProblemHandlerGET(helper.MyHTTPTestCase):
    """ProblemHandlerのテスト (GET)"""
    @classmethod
    def setUpClass(cls):
        cls.testDB = helper.DummyDB()
        cate_records = [
            helper.CategoryDummyRecord(cat_name="numpy"), # cat_id=1
        ]
        page_records = [
            helper.PagesDummyRecord(category=1, status=1),
            helper.PagesDummyRecord(category=1, status=0),
            helper.PagesDummyRecord(category=None, status=1)
        ]
        cls.testDB.set_problemDB(categories=cate_records,
                                 pages=page_records,
                                 progress=[helper.ProgressDummyRecord(p_id=page_records[2].p_id,
                                                                      q_ids=["1", "2", "3"])])

        return super().setUpClass()

    def test_redirect_root(self):
        "/problemsへのアクセスはルートにリダイレクトする"
        response = self.fetch("/problems")
        self.assertEqual("/", urlparse(response.effective_url).path)
        self.assertEqual(200, response.code)
        
    def test_render_problem(self):
        """問題を表示"""
        problem = self.testDB.page_records[0]
        response = self.fetch(f"/problems/{problem.p_id}")

        self.assertEqual(200, response.code)

    def test_render_nonexist_problem(self):
        """存在しない問題を表示"""
        response = self.fetch("/problems/aaa")

        self.assertEqual(404, response.code)

    def test_render_private_problem(self):
        """非公開の問題を表示"""
        problem = self.testDB.page_records[1]
        response = self.fetch(f"/problems/{problem.p_id}")

        self.assertEqual(404, response.code)
        
    def test_get_problem_info(self):
        """問題の詳細を取得"""
        problem = self.testDB.page_records[2]
        response = self.fetch(f"/problems/{problem.p_id}/info")
        rcv: dict = json.loads(response.body)

        self.assertEqual(200, response.code)
        self.assertEqual(problem.p_id, rcv["p_id"])
        self.assertEqual(problem.title, rcv["title"])
        self.assertEqual(problem.category, rcv["category"])
        self.assertEqual(problem.page, rcv["page"])
        self.assertTrue("DESCR" in rcv.keys())

    def test_get_nonexist_problem_info(self):
        """存在しない問題の詳細を取得"""
        response = self.fetch("/problems/aaa/info")

        self.assertEqual(404, response.code)

    def test_get_private_problem_info(self):
        """非公開の問題の詳細を取得"""
        problem = self.testDB.page_records[1]
        response = self.fetch(f"/problems/{problem.p_id}/info")

        self.assertEqual(404, response.code)

    def test_get_problem_user_answer(self):
        """ユーザの過去の解答を取得"""
        problem = self.testDB.page_records[2]
        response = self.fetch(f"/problems/{problem.p_id}/save")
        rcv: dict = json.loads(response.body)

        self.assertEqual(200, response.code)
        self.assertEqual(problem.p_id, rcv["p_id"])
        self.assertEqual(json.loads(self.testDB.progress_records[0].q_content), 
                         json.loads(rcv["savedAnswers"]))
        self.assertTrue("DESCR" in rcv.keys())

    def test_get_nonexist_problem_user_answer(self):
        """存在しない問題についてユーザの過去の解答を取得"""
        response = self.fetch("/problems/aaa/save")
        self.assertEqual(404, response.code)

    def test_get_private_probelm_user_answer(self):
        """非公開の問題についてユーザの過去の解答を取得"""
        problem = self.testDB.page_records[1]
        response = self.fetch(f"/problems/{problem.p_id}/save")

        self.assertEqual(404, response.code)

    @classmethod
    def tearDownClass(cls) -> None:
        clean_up()
        cls.testDB.clean_up()
        return super().tearDownClass()

if __name__ == '__main__':
    unittest.main()