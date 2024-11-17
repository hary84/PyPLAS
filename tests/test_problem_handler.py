import json
import unittest.main
import uuid

from pyplas.app import clean_up
from tests import helper

POST_HEADER = {"Content-type": "application/json"}

class TestProblemHandlerGET(helper.MyHTTPTestCase):
    """ProblemHandlerのテスト (GET)"""
    @classmethod
    def setUpClass(cls):
        cls.testDB = helper.DummyDB()
        cls.cate_records = [
            helper.CategoryDummyRecord(cat_name="numpy"), # cat_id=1
            helper.CategoryDummyRecord(cat_name="pandas") # cat_id=2
        ]
        cls.page_records = [
            helper.PagesDummyRecord(category=1, status=1),
            helper.PagesDummyRecord(category=1, status=0),
            helper.PagesDummyRecord(category=2, status=1)
        ]
        cls.testDB.set_problemDB(categories=cls.cate_records,
                                 pages=cls.page_records)
        return super().setUpClass()

    def test_redirect_root(self):
        "/problemsへのアクセスはルートにリダイレクトする"
        response = self.fetch("/problems")
        self.assertEqual(302, response.code)
        
    def test_render_problem(self):
        """問題を表示"""
        problem = self.page_records[0]
        response = self.fetch(f"/problems/{problem.p_id}")

        self.assertEqual(200, response.code)

    def test_render_nonexist_problem(self):
        """存在しない問題を表示"""
        response = self.fetch("/problems/aaa")

        self.assertEqual(404, response.code)
        
    def test_get_problem_info(self):
        """問題の詳細を取得"""
        problem = self.page_records[0]
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
        problem = self.page_records[1]
        response = self.fetch(f"/problems/{problem.p_id}/info")

        self.assertEqual(404, response.code)

    def test_get_problem_user_answer(self):
        """ユーザの過去の解答を取得"""
        problem = self.page_records[0]
        response = self.fetch(f"/problems/{problem.p_id}/save")
        rcv: dict = json.loads(response.body)

        self.assertEqual(200, response.code)
        self.assertEqual(problem.p_id, rcv["p_id"])
        self.assertEqual("{}", rcv["savedAnswers"])
        self.assertTrue("DESCR" in rcv.keys())

    def test_get_nonexist_problem_user_answer(self):
        """存在しない問題についてユーザの過去の解答を取得"""
        response = self.fetch("/problems/aaa/save")
        rcv: dict = json.loads(response.body)

        self.assertEqual(200, response.code)
        self.assertEqual("aaa", rcv["p_id"])
        self.assertEqual("{}", rcv["savedAnswers"])
        self.assertTrue("DESCR" in rcv.keys())        

    def test_get_private_probelm_user_answer(self):
        """非公開の問題についてユーザの過去の解答を取得"""
        problem = self.page_records[1]
        response = self.fetch(f"/problems/{problem.p_id}/save")

        self.assertEqual(404, response.code)

    @classmethod
    def tearDownClass(cls) -> None:
        clean_up()
        cls.testDB.clean_up()
        return super().tearDownClass()

# class TestProblemHandlerPOST(helper.MyHTTPTestCase):
#     """ProblemHandlerのテスト (POST)"""
#     @classmethod
#     def setUpClass(cls):
#         cls.testDB = helper.DummyDB()
#         cls.cate_records = [
#             helper.CategoryDummyRecord(cat_name="numpy"), # cat_id=1
#             helper.CategoryDummyRecord(cat_name="pandas") # cat_id=2
#         ]
#         cls.page_records = [
#             helper.PagesDummyRecord(category=1, status=1),
#             helper.PagesDummyRecord(category=1, status=0),
#             helper.PagesDummyRecord(category=2, status=1)
#         ]
#         cls.testDB.set_problemDB(categories=cls.cate_records,
#                                  pages=cls.page_records)
#         return super().setUpClass()

#     def test_save_user_input(self):
#         """解答の一時保存"""
#         problem = self.page_records[2]
#         body = json.dumps({
#             "q_content": {
#                 "1": ["aaa", "bbb"],
#                 "2": ["bbb", "ccc", "ddd"]
#             }
#         })
#         response = self.fetch(f"/problems/{problem.p_id}/save",
#                               method="POST",
#                               body=body)
#         rcv: dict = json.loads(response.body)

#         self.assertEqual(200, response.code)
#         self.assertEqual(body, rcv["body"])
#         self.assertTrue("DESCR" in rcv.keys())

#     def test_save_user_input_about_nonexist_problem(self):
#         """存在しない問題に対して解答を一時保存"""
#         response = self.fetch("/problems/aaa/save",
#                               method="POST",
#                               body=json.dumps({
#                                   "q_content": {
#                                       "1": ["100", "200"]
#                                   }
#                               }))
#         self.assertEqual(404, response.code)

#     def test_save_user_input_about_private_problem(self):
#         """非公開の問題に対して解答を一時保存"""
#         problem = self.page_records[1]
#         response = self.fetch(f"/problems/{problem.p_id}/save",
#                               method="POST",
#                               body=json.dumps({
#                                   "q_content": {
#                                       "aa": [] 
#                                   }
#                               }))
        
#         self.assertEqual(404, response.code)

#     def test_save_user_input_with_invalid_request_body1(self):
#         """無効なRequest-Bodyフォーマットで解答を一時保存1"""
#         problem = self.page_records[2]
#         response = self.fetch(f"/problems/{problem.p_id}/save",
#                               method="POST",
#                               body=json.dumps({
#                                   "1": ["aaa"]
#                               }))
#         self.assertEqual(400, response.code)

#     def test_save_user_input_with_invalid_request_body2(self):
#         """無効なRequest-Bodyフォーマットで解答を一時保存2"""
#         problem = self.page_records[2]
#         response = self.fetch(f"/problems/{problem.p_id}/save",
#                               method="POST",
#                               body=json.dumps({
#                                   "q_content": {
#                                       "a": [100, 200]
#                                   }
#                               }))
#         self.assertEqual(400, response.code)

#     def test_scoring_word_problem_correct(self):
#         """word problemを採点する(正解)"""
#         problem = self.page_records[2]
#         BODY = {
#             "q_id": "1",
#             "ptype": 0,
#             "answers": ["1", "2"],
#             "kernel_id": str(uuid.uuid4())
#         }
#         response = self.fetch(f"/problems/{problem.p_id}/scoring",
#                               method="POST",
#                               body=json.dumps(BODY))
#         rcv: dict = json.loads(response.body)
        
#         self.assertEqual(200, response.code)
#         self.assertEqual(2, rcv["progress"])
#         self.assertTrue("content" in rcv.keys())
#         self.assertTrue("DESCR" in rcv.keys())

#     def test_scoring_word_problem_wrong(self):
#         """word problemを採点する(不正解)"""
#         problem = self.page_records[2]
#         BODY = {
#             "q_id": "1",
#             "ptype": 0,
#             "answers": ["1", "20"],
#             "kernel_id": str(uuid.uuid4())
#         }
#         response = self.fetch(f"/problems/{problem.p_id}/scoring",
#                               method="POST",
#                               body=json.dumps(BODY))
#         rcv: dict = json.loads(response.body)
        
#         self.assertEqual(200, response.code)
#         self.assertEqual(1, rcv["progress"])
#         self.assertTrue("content" in rcv.keys())
#         self.assertTrue("DESCR" in rcv.keys())
    
#     def test_scoring_coding_problem_correct(self):
#         """code problemを採点する(正解)"""
#         problem = self.page_records[2]
#         BODY = {
#             "q_id": "2",
#             "ptype": 1,
#             "answers": ["a=1"],
#             "kernel_id": str(uuid.uuid4())
#         }
#         response = self.fetch(f"/problems/{problem.p_id}/scoring",
#                               method="POST",
#                               body=json.dumps(BODY))
#         rcv: dict = json.loads(response.body)

#         self.assertEqual(200, response.code)
#         self.assertEqual(2, rcv["progress"])
#         self.assertTrue("content" in rcv.keys())
#         self.assertTrue("DESCR" in rcv.keys())

#     def test_scoring_coding_problem_wrong(self):
#         """code problemを採点する(不正解)"""
#         problem = self.page_records[2]
#         BODY = {
#             "q_id": "2",
#             "ptype": 1,
#             "answers": ["a=2"],
#             "kernel_id": str(uuid.uuid4())
#         }
#         response = self.fetch(f"/problems/{problem.p_id}/scoring",
#                               method="POST",
#                               body=json.dumps(BODY))
#         rcv: dict = json.loads(response.body)

#         self.assertEqual(200, response.code)
#         self.assertEqual(1, rcv["progress"])
#         self.assertTrue("content" in rcv.keys())
#         self.assertTrue("DESCR" in rcv.keys())

#     def test_scoring_nonexist_problem_id(self):
#         """存在しないp_idで採点"""
#         response = self.fetch("/problems/aaa/scoring",
#                               method="POST",
#                               body=json.dumps({
#                                   "q_id": "1",
#                                   "ptype": 0,
#                                   "answers": ["1"],
#                                   "kernel_id": str(uuid.uuid4())
#                               }))
#         self.assertEqual(404, response.code)

#     def test_scoring_private_problem(self):
#         """非公開の問題で採点"""
#         problem = self.page_records[1]
#         response = self.fetch(f"/problems/{problem.p_id}/scoring",
#                               method="POST",
#                               body=json.dumps({
#                                   "q_id": "1",
#                                   "ptype": 0,
#                                   "answers": ["1"],
#                                   "kernel_id": str(uuid.uuid4())
#                               }))
#         self.assertEqual(404, response.code)

#     def test_scoring_with_invalid_request_body1(self):
#         """
#         無効なRequest-bodyフォーマットで採点する
        
#         `answers`属性のリストの長さが不一致
#         """
#         problem = self.page_records[2]
#         BODY = {
#             "q_id": "1",
#             "ptype": 0,
#             "answers": ["1"],
#             "kernel_id": str(uuid.uuid4())
#         }
#         response = self.fetch(f"/problems/{problem.p_id}/scoring",
#                               method="POST",
#                               body=json.dumps(BODY))
        
#         self.assertEqual(400, response.code)
    
#     def test_scoring_with_invalid_request_body2(self):
#         """
#         無効なRequest-bodyフォーマットで採点する
        
#         存在しない`q_id`属性を指定する
#         """
#         problem = self.page_records[2]
#         BODY = {
#             "q_id": "3",
#             "ptype": 0,
#             "answers": ["1", "300"],
#             "kernel_id": str(uuid.uuid4())
#         }
#         response = self.fetch(f"/problems/{problem.p_id}/scoring",
#                               method="POST",
#                               body=json.dumps(BODY))
        
#         self.assertEqual(400, response.code)

#     def test_scoring_with_invalid_request_body3(self):
#         """
#         無効なRequest-bodyフォーマットで採点する
        
#         `ptype`属性が0, 1以外の値
#         """
#         problem = self.page_records[2]
#         BODY = {
#             "q_id": "3",
#             "ptype": 2,
#             "answers": ["1", "300"],
#             "kernel_id": str(uuid.uuid4())
#         }
#         response = self.fetch(f"/problems/{problem.p_id}/scoring",
#                               method="POST",
#                               body=json.dumps(BODY))
        
#         self.assertEqual(400, response.code)

#     @classmethod
#     def tearDownClass(cls) -> None:
#         clean_up()
#         cls.testDB.clean_up()
#         return super().tearDownClass()


if __name__ == '__main__':
    unittest.main()