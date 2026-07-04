import os
import sys
import unittest

sys.path.append(os.path.dirname(__file__))
from main import build_deterministic_plan


class DeterministicPlanTests(unittest.TestCase):
    def test_supported_algorithms_sort_sample_arrays(self):
        cases = [
            [8, 3, 1, 7],
            [5, 1, 4, 2, 8],
            [64, 25, 12, 22, 11],
            [3, 2, 1],
            [4, 3, 2, 1],
        ]
        algorithms = [
            "bubble sort",
            "selection sort",
            "insertion sort",
            "merge sort",
            "quick sort",
            "heap sort",
            "cycle sort",
            "3-way merge sort",
        ]

        for algorithm in algorithms:
            for data in cases:
                plan = build_deterministic_plan(algorithm, data)
                final_result = plan["steps"][-1]["result"] if plan.get("steps") else None
                self.assertEqual(final_result, sorted(data), f"{algorithm} failed for {data}")


if __name__ == "__main__":
    unittest.main()
