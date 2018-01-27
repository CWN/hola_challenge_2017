'use strict';
let Node = require('./Node.js');
let DiagonalMovement = require('./DiagonalMovement.js');

/**
 * The Grid class, which serves as the encapsulation of the layout of the nodes.
 * @constructor
 * @param {number|Array<Array<(number|boolean)>>} width_or_matrix Number of columns of the grid, or matrix
 * @param {number} height Number of rows of the grid.
 * @param {Array<Array<(number|boolean)>>} [matrix] - A 0-1 matrix
 *     representing the walkable status of the nodes(0 or false for walkable).
 *     If the matrix is not supplied, all the nodes will be walkable.  */
class Grid {
    constructor(width_or_matrix, height, matrix) {

        if (typeof  width_or_matrix !== 'object') {
            this.width = width_or_matrix;
            this.height = height;
            this.matrix = matrix;
        } else {
            this.height = width_or_matrix.length;
            this.width = width_or_matrix[0].length;
            this.matrix = width_or_matrix;
        }
        this.buildNodes(this.width, this.height, this.matrix)
    }

    buildNodes(width, height, matrix) {
        let i, j, walkable;

        if (matrix !== undefined) {
            if (matrix.length !== height || matrix[0].length !== width) {
                throw new Error('Matrix size does not fit');
            }
        }

        this.nodes = new Array(height);

        for (i = 0; i < height; ++i) {
            this.nodes[i] = new Array(width);

            for (j = 0; j < width; ++j) {
                walkable = (matrix === undefined) ? true : !Boolean(matrix[i][j]);
                this.nodes[i][j] = new Node.Node(j, i, walkable);
            }
        }
    }

    getNodeAt(x, y) {
        return this.nodes[y][x];
    }

    isInside(x, y) {
        return (x >= 0 && x < this.width) && (y >= 0 && y < this.height);
    }

    isWalkableAt(x, y) {
        return (this.isInside(x, y) && this.nodes[y][x].walkable);
    }

    setWalkableAt(x, y, walkable) {
        this.nodes[y][x].walkable = walkable;
    }

    /**
     * Get the neighbors of the given node.
     *
     *     offsets      diagonalOffsets:
     *  +---+---+---+    +---+---+---+
     *  |   | 0 |   |    | 0 |   | 1 |
     *  +---+---+---+    +---+---+---+
     *  | 3 |   | 1 |    |   |   |   |
     *  +---+---+---+    +---+---+---+
     *  |   | 2 |   |    | 3 |   | 2 |
     *  +---+---+---+    +---+---+---+
     *
     *  When allowDiagonal is true, if offsets[i] is valid, then
     *  diagonalOffsets[i] and
     *  diagonalOffsets[(i + 1) % 4] is valid.
     * @param {Node} node
     * @param {DiagonalMovement} diagonalMovement
     */
    getNeighbors(node, diagonalMovement) {
        let x         = node.x,
            y         = node.y,
            neighbors = [];

        let s0 = false, d0 = false;
        let s1 = false, d1 = false;
        let s2 = false, d2 = false;
        let s3 = false, d3 = false;

        // ↑
        if (this.isWalkableAt(x, y - 1)) {
            neighbors.push(this.nodes[y - 1][x]);
            s0 = true;
        }
        // →
        if (this.isWalkableAt(x + 1, y)) {
            neighbors.push(this.nodes[y][x + 1]);
            s1 = true;
        }
        // ↓
        if (this.isWalkableAt(x, y + 1)) {
            neighbors.push(this.nodes[y + 1][x]);
            s2 = true;
        }
        // ←
        if (this.isWalkableAt(x - 1, y)) {
            neighbors.push(this.nodes[y][x - 1]);
            s3 = true;
        }

        if (diagonalMovement === DiagonalMovement.Never) {
            return neighbors;
        }

        if (diagonalMovement === DiagonalMovement.OnlyWhenNoObstacles) {
            d0 = s3 && s0;
            d1 = s0 && s1;
            d2 = s1 && s2;
            d3 = s2 && s3;
        } else if (diagonalMovement === DiagonalMovement.IfAtMostOneObstacle) {
            d0 = s3 || s0;
            d1 = s0 || s1;
            d2 = s1 || s2;
            d3 = s2 || s3;
        } else if (diagonalMovement === DiagonalMovement.Always) {
            d0 = true;
            d1 = true;
            d2 = true;
            d3 = true;
        } else {
            throw new Error('Incorrect value of diagonalMovement');
        }

        // ↖
        if (d0 && this.isWalkableAt(x - 1, y - 1)) {
            neighbors.push(this.nodes[y - 1][x - 1]);
        }
        // ↗
        if (d1 && this.isWalkableAt(x + 1, y - 1)) {
            neighbors.push(this.nodes[y - 1][x + 1]);
        }
        // ↘
        if (d2 && this.isWalkableAt(x + 1, y + 1)) {
            neighbors.push(this.nodes[y + 1][x + 1]);
        }
        // ↙
        if (d3 && this.isWalkableAt(x - 1, y + 1)) {
            neighbors.push(this.nodes[y + 1][x - 1]);
        }

        return neighbors;
    }

    clone() {
        let i, j,

            width     = this.width,
            height    = this.height,
            thisNodes = this.nodes,

            newGrid   = new Grid(width, height),
            newNodes  = new Array(height);

        for (i = 0; i < height; ++i) {
            newNodes[i] = new Array(width);
            for (j = 0; j < width; ++j) {
                newNodes[i][j] = new Node(j, i, thisNodes[i][j].walkable);
            }
        }

        newGrid.nodes = newNodes;

        return newGrid;
    }
}

module.exports = {Grid};
