# BENCHMARK EXECUTED ON MacBook Pro (16-inch, 2021) with Apple M1 Max chip and 32GB of RAM.


## Benchmark Results
The benchmarks are grouped by algorithm type.

### Algorithm: A* Navigation Pathfinding

The benchmark time result is the sum of the time taken to compute the path from a starting position to each valid tile in the map, averaged over multiple iterations.

The starting tile is randomly generated every benchmark iteration.


| Deliveoo Map Name       | Time (ms) | Valid Tiles | Iterations |
|-------------------------|-----------|-------------|------------|
| empty_30                | 21.45     | 900         | 300        |
| circuit_directional     | 16.20     | 485         | 300        |
| hallways_interconnected | 8.56      | 465         | 300        |
| caothic_maze            | 7.16      | 432         | 300        |
| wide_path               | 12.14     | 526         | 300        |
| two_obstacles           | 11.36     | 524         | 300        |
| crates_one_way          | 0.31      | 47          | 300        |

> Considering the move duration for each map is no less than 50ms, the A* pathfinding algorithm performs well within the required time frame for all tested maps.

