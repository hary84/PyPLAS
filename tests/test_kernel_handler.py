import json
import time
import unittest.main

from jupyter_core.utils import run_sync

from pyplas.app import clean_up
from pyplas.utils import globals as g 
from tests import helper

class TestKernelHandlerAlreadyKernelExists(helper.MyHTTPTestCase):
    """
    kernel_handlerのテスト

    すでに稼働しているカーネルを操作する(GET, POST)
    """
    @classmethod
    def setUpClass(cls):
        cls.kernel_id = "This-is-test-kernel"
        run_sync(g.km.start_kernel)(kernel_id=cls.kernel_id)
        cls.test_db = helper.DummyDB()
        cls.test_db.set_problemDB(categories=0, pages=0)
        return super().setUpClass()
    
    def test_get_kernel_list(self):
        """稼働しているカーネルの一覧をリストで取得"""
        response = self.fetch("/kernel")
        rcv_json: dict = json.loads(response.body)

        self.assertEqual(200, response.code) # レスポンスコードのチェック
        # レスポンスボディのチェック
        self.assertEqual([self.kernel_id], rcv_json["kernel_ids"]) 
        self.assertTrue("DESCR" in rcv_json.keys())

    def test_kernel_is_alive(self):
        """指定したkernel_idのカーネルが稼働しているかを確認する(稼働しているとき)"""
        response = self.fetch(f"/kernel/{self.kernel_id}")
        rcv_json: dict = json.loads(response.body)

        self.assertEqual(200, response.code) # コードのチェック
        # ボディのチェック
        self.assertEqual(self.kernel_id, rcv_json["kernel_id"])
        self.assertEqual(True, rcv_json["is_alive"])
        self.assertTrue("DESCR" in rcv_json.keys())

    def test_kernel_is_not_alive(self):
        """指定したkernel_idのカーネルが稼働しているかを確認する(稼働していないとき)"""
        nonexist_kernel_id = "not-exist-kernel-id"
        response = self.fetch(f"/kernel/{nonexist_kernel_id}")
        rcv_json: dict = json.loads(response.body)

        self.assertEqual(200, response.code) # コードのチェック
        # ボディのチェック
        self.assertEqual(nonexist_kernel_id, rcv_json["kernel_id"])
        self.assertEqual(False, rcv_json["is_alive"])
        self.assertTrue("DESCR" in rcv_json.keys())

    def test_start_kernel_with_random_id(self):
        """ランダムなIDで新しいカーネルを起動する"""
        response = self.fetch("/kernel", method="POST", body="")
        rcv_json: dict = json.loads(response.body)

        self.assertEqual(200, response.code) # コードのチェック
        # ボディのチェック
        self.assertTrue("kernel_id" in rcv_json.keys())
        self.assertTrue("DESCR" in rcv_json.keys())

    def test_start_kernel_with_specified_id(self):
        """IDを指定してカーネルを起動する"""
        my_id = "This-is-my-kernel-id"
        response = self.fetch(f"/kernel/{my_id}", method="POST", body="")
        rcv_json: dict = json.loads(response.body)

        self.assertEqual(200, response.code)
        self.assertEqual(my_id, rcv_json["kernel_id"])
        self.assertTrue("DESCR" in rcv_json.keys())

    def test_start_kernel_duplicated_id(self):
        """重複したカーネルidを指定してカーネルを起動する"""
        response = self.fetch(f"/kernel/{self.kernel_id}", method="POST", body="")
        self.assertEqual(409, response.code)

    def test_restart_kernel(self):
        """カーネルを再起動する"""
        response = self.fetch(f"/kernel/{self.kernel_id}/restart", 
                              method="POST",
                              body="")
        rcv_json: dict = json.loads(response.body)

        self.assertEqual(200, response.code)
        self.assertEqual(self.kernel_id, rcv_json["kernel_id"])
        self.assertTrue("DESCR" in rcv_json.keys())

    def test_restart_idle_kernel(self):
        """動いていないカーネルに対して再起動命令を出す"""
        idle_kernel_id = "idle-kernel"
        response = self.fetch(f"/kernel/{idle_kernel_id}/restart", 
                              method="POST",
                              body="")
        self.assertEqual(404, response.code)

    def test_interrupt_kernel(self):
        """コード実行中のカーネルを中断する"""
        response = self.fetch(f"/kernel/{self.kernel_id}/interrupt",
                              method="POST",
                              body="")
        rcv_json: dict = json.loads(response.body)

        self.assertEqual(200, response.code)
        self.assertEqual(self.kernel_id, rcv_json["kernel_id"])
        self.assertTrue("DESCR" in rcv_json.keys())

    def test_interrupt_idle_kernel(self):
        """動いていないカーネルに中断指示を出す"""
        idle_kernel = "idle-kernel"
        response = self.fetch(f"/kernel/{idle_kernel}/interrupt", 
                              method="POST",
                              body="")
        self.assertEqual(404, response.code)

    def test_undefined_GET_action(self):
        """未定義のパスへGETメソッドを投げる"""
        response = self.fetch("/kernel/aaa/bbb")
        self.assertEqual(404, response.code)

    def test_undefined_POST_action(self):
        """未定義のパスへPOSTメソッドを投げる"""
        response = self.fetch("/kernel/aaaaa/bbbb",
                              method="POST",
                              body="")
        self.assertEqual(404, response.code)

    @classmethod
    def tearDownClass(cls) -> None:
        # wait for all kernel is ready
        time.sleep(3)
        clean_up()
        cls.test_db.clean_up()
        return super().tearDownClass()
    
class TestKernelHandlerDeleteRequest(helper.MyHTTPTestCase):
    """
    kernel_handlerのテスト

    Deleteリクエストに関するテスト
    """
    @classmethod
    def setUpClass(cls):
        cls.kernel_id = "This-is-test-kernel"
        run_sync(g.km.start_kernel)(kernel_id=cls.kernel_id)
        cls.test_db = helper.DummyDB()
        cls.test_db.set_problemDB(categories=0, pages=0)
        return super().setUpClass()
    
    def test_stop_kernel(self):
        "カーネルを停止する"
        response = self.fetch(f"/kernel/{self.kernel_id}",
                              method="DELETE")
        rcv_json: dict = json.loads(response.body)

        self.assertEqual(200, response.code)
        self.assertEqual(self.kernel_id, rcv_json["kernel_id"])
        self.assertTrue("DESCR" in rcv_json.keys())

    def test_stop_idle_kernel(self):
        """存在しないカーネルに停止命令を出す"""
        idle_kernel = "idle-kernel"
        response = self.fetch(f"/kernel/{idle_kernel}",
                              method="DELETE")
        self.assertEqual(404, response.code)

    def test_undefined_DELETE_action(self):
        """未定義のパスにDELETEリクエストを投げる"""
        response = self.fetch("/kernel/aaa/bbb",
                              method="DELETE")
        self.assertEqual(404, response.code)
    
    @classmethod 
    def tearDownClass(cls) -> None:
        time.sleep(3)
        cls.test_db.clean_up()
        clean_up()
        return super().tearDownClass()
    
if __name__ == '__main__':
    unittest.main()