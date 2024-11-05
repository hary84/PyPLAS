import random
import unittest 
import numpy as np 
import pandas as pd 

from pyplas.utils import scoring 

class MyTestCase(unittest.TestCase):
    pass 

class TestCheckNumEqual(MyTestCase):
    """
    scoring.check_num_equal関数のテスト
    """
    def test_equals_int(self):
        """equal int and int"""
        self.assertTrue(scoring.check_num_equal(10, int(10.0)))
        self.assertTrue(scoring.check_num_equal(10, np.int8(10)))

    def test_equals_values(self):
        """equal int and float"""
        self.assertTrue(scoring.check_num_equal(30, float(30)))
        self.assertTrue(scoring.check_num_equal(30, np.float64(30)))

    def test_equals_float(self):
        """equal float and float (64bit)"""
        self.assertTrue(scoring.check_num_equal(10.1, np.float64(10.1)))

    def test_not_equals(self):
        """not equals"""
        with self.assertRaises(AssertionError):
            scoring.check_num_equal(10, 20)
        with self.assertRaises(AssertionError):
            scoring.check_num_equal(10.1, np.float16(10.1))

    def test_edge_case(self):
        """ edge cases """
        # large number 
        self.assertTrue(scoring.check_num_equal(1e13, np.float64(1e13)))

        # not a number
        non_nums = [{"a": 10}, np.arange(10), [1, 2, 3], "10", True, pd.NA]
        for target in non_nums:
            with self.assertRaises(AssertionError):
                scoring.check_num_equal(10, target)
        
class TestCheckNumApproxEqual(MyTestCase):
    """
    scoring.check_num_approx_equal関数のテスト
    """
    def test_equals_float(self):
        """equal float and float"""
        # e.g.
        self.assertTrue(scoring.check_num_approx_equal(15.68, 15.6791, ndigits=2))
        self.assertTrue(scoring.check_num_approx_equal(-0.98, -0.985, ndigits=2))

        # random value
        floats = [random.uniform(-100, 100) for _ in range(1000)]
        for i in floats:
            self.assertTrue(scoring.check_num_approx_equal(i, round(i, 2)+random.uniform(-0.004, 0.005), ndigits=2))
            self.assertTrue(scoring.check_num_approx_equal(i, np.float128(i), ndigits=2))

    def test_not_equals_float(self):
        """ not equal """
        # e.g. 
        with self.assertRaises(AssertionError) as e:
            scoring.check_num_approx_equal(4.35, 4.356, ndigits=2)
            print(str(e))

        # random value
        floats = [random.uniform(-100, 100) for _ in range(10)]
        for i in floats:
            with self.assertRaises(AssertionError) as e:
                scoring.check_num_approx_equal(i, round(i, 3)+0.00051, ndigits=3)
                print(str(e))

    def test_edge_case(self):
        """ edge cases """
        # large number 
        self.assertTrue(scoring.check_num_approx_equal(12345.68, np.float64(12345.6831), ndigits=2))

        # is not Real type
        isnt_real= [{"a": 10}, np.arange(10), [1, 2, 3], "10", True, pd.NA, 4+1j]
        for target in isnt_real:
            with self.assertRaises(AssertionError) as cm:
                scoring.check_num_equal(10, target)
                self.assertEqual("変数には数値を代入してください", cm.exception)
    
if __name__ == "__main__":
    unittest.main()