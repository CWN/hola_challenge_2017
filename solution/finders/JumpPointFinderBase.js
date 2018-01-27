'use strict';
/**
 * @author imor / https://github.com/imor
 */
let Heap = require('../heap.js');
let Util = require('../Util.js');
let Heuristic = require('../Heuristic.js');
let DiagonalMovement = require('../DiagonalMovement.js');

let debugTools = require('./../DebugUtils.js');

class JumpPointFinderBase {
    constructor(opt) {
        opt = opt || {};
        this.heuristic = opt.heuristic || Heuristic.chebyshev;
        this.trackJumpRecursion = opt.trackJumpRecursion || false;
    }

    findPath(startX, startY, endX, endY, grid) {
        let openList = this.openList = new Heap.Heap(Heap.HT_MINI_HEAP, function (nodeA, nodeB) {
            return nodeA.f - nodeB.f;
        });

        let startNode = this.startNode = grid.getNodeAt(startX, startY);
        let endNode = this.endNode = grid.getNodeAt(endX, endY);
        let node;

        this.grid = grid;

        // set the `g` and `f` value of the start node to be 0
        startNode.g = 0;
        startNode.f = 0;

        // push the start node into the open list
        openList.insert(startNode);
        startNode.opened = true;

        //debugTools.var_dump(openList);
        //debugTools.var_dump(openList.empty());
        // while the open list is not empty
        while (!openList.empty()) {
            // pop the position of node which has the minimum `f` value.
            node = openList.extractTop();
           //debugTools.var_dump(openList);
            //debugTools.var_dump('current');
           // debugTools.var_dump(grid.isWalkableAt(node.x, node.y + 1));
            node.closed = true;

            if (node === endNode) {
                return Util.expandPath(Util.backtrace(endNode));
            }

            this._identifySuccessors(node);
            //debugTools.var_dump(openList);
        }

        // fail to find the path
        return [];
    }

    _identifySuccessors(node) {
        //debugTools.var_dump(node);
        let grid      = this.grid,
            heuristic = this.heuristic,
            openList  = this.openList,
            endX      = this.endNode.x,
            endY      = this.endNode.y;

        let neighbors, neighbor, jumpPoint, i, l;
        let x = node.x, y = node.y;

        let jx, jy, dx, dy, d, ng, jumpNode;
        let abs = Math.abs, max = Math.max;

        neighbors = this._findNeighbors(node);
        //debugTools.var_dump(neighbors);

        for (i = 0, l = neighbors.length; i < l; ++i) {
            neighbor = neighbors[i];
            jumpPoint = this._jump(neighbor[0], neighbor[1], x, y);
            //debugTools.var_dump(jumpPoint);
            if (jumpPoint) {

                jx = jumpPoint[0];
                jy = jumpPoint[1];
                jumpNode = grid.getNodeAt(jx, jy);

                if (jumpNode.closed) {
                    continue;
                }

                // include distance, as parent may not be immediately adjacent:
                d = Heuristic.octile(abs(jx - x), abs(jy - y));
                ng = node.g + d; // next `g` value

                if (!jumpNode.opened || ng < jumpNode.g) {
                    jumpNode.g = ng;
                    jumpNode.h = jumpNode.h || heuristic(abs(jx - endX), abs(jy - endY));
                    jumpNode.f = jumpNode.g + jumpNode.h;
                    jumpNode.parent = node;

                    if (!jumpNode.opened) {
                        openList.insert(jumpNode);
                        jumpNode.opened = true;
                    } else {
                        openList.insert(jumpNode);//updateItem(jumpNode);
                    }
                }
            }
        }
    }

    _jump(x, y, px, py) {
        let grid            = this.grid,
            dx = x - px, dy = y - py;

        if (!grid.isWalkableAt(x, y)) {
            return null;
        }

        if (this.trackJumpRecursion === true) {
            grid.getNodeAt(x, y).tested = true;
        }

        if (grid.getNodeAt(x, y) === this.endNode) {
            return [x, y];
        }

        if (dx !== 0) {
            if ((grid.isWalkableAt(x, y - 1) && !grid.isWalkableAt(x - dx, y - 1)) ||
                (grid.isWalkableAt(x, y + 1) && !grid.isWalkableAt(x - dx, y + 1))) {
                return [x, y];
            }
        }
        else if (dy !== 0) {
            if ((grid.isWalkableAt(x - 1, y) && !grid.isWalkableAt(x - 1, y - dy)) ||
                (grid.isWalkableAt(x + 1, y) && !grid.isWalkableAt(x + 1, y - dy))) {
                return [x, y];
            }
            //When moving vertically, must check for horizontal jump points
            if (this._jump(x + 1, y, x, y) || this._jump(x - 1, y, x, y)) {
                return [x, y];
            }
        }
        else {
            throw new Error("Only horizontal and vertical movements are allowed");
        }

        return this._jump(x + dx, y + dy, x, y);
    };

    /**
     * Find the neighbors for the given node. If the node has a parent,
     * prune the neighbors based on the jump point search algorithm, otherwise
     * return all available neighbors.
     * @return {Array<Array<number>>} The neighbors found.
     */
    _findNeighbors(node) {
        let parent        = node.parent,
            x = node.x, y = node.y,
            grid          = this.grid,
            px, py, nx, ny, dx, dy,
            neighbors     = [], neighborNodes, neighborNode, i, l;

        // directed pruning: can ignore most neighbors, unless forced.
        if (parent) {
            px = parent.x;
            py = parent.y;
            // get the normalized direction of travel
            dx = (x - px) / Math.max(Math.abs(x - px), 1);
            dy = (y - py) / Math.max(Math.abs(y - py), 1);

            if (dx !== 0) {
                if (grid.isWalkableAt(x, y - 1)) {
                    neighbors.push([x, y - 1]);
                }
                if (grid.isWalkableAt(x, y + 1)) {
                    neighbors.push([x, y + 1]);
                }
                if (grid.isWalkableAt(x + dx, y)) {
                    neighbors.push([x + dx, y]);
                }
            }
            else if (dy !== 0) {
                if (grid.isWalkableAt(x - 1, y)) {
                    neighbors.push([x - 1, y]);
                }
                if (grid.isWalkableAt(x + 1, y)) {
                    neighbors.push([x + 1, y]);
                }
                if (grid.isWalkableAt(x, y + dy)) {
                    neighbors.push([x, y + dy]);
                }
            }
        }
        // return all neighbors
        else {
            neighborNodes = grid.getNeighbors(node, DiagonalMovement.Never);
            for (i = 0, l = neighborNodes.length; i < l; ++i) {
                neighborNode = neighborNodes[i];
                neighbors.push([neighborNode.x, neighborNode.y]);
            }
        }

        return neighbors;
    };

}

module.exports = {JumpPointFinderBase};
