'use strict';

let GIN = require('../generate.js');
let GAME = require('../game.js');

const DEBUG_ON = true;
let nodeUtil = require('util');

function var_dump(variable) {
    if (DEBUG_ON) {
        console.log(nodeUtil.inspect(variable, {showHidden: true, depth: null, colors: true}));
    }
}

function serializeMatrix(matrix) {
    let out = new Array(matrix.length);
    for (let h = 0; h < matrix.length; h++) {
        out[h] = '';
        for (let w = 0; w < matrix[h].length; w++) {
            out[h] += (matrix[h][w].walkable) ? ' ' : '#';
        }
    }
    return out;
}

///================================================================================================
// Node
class Node {
    constructor(x, y, walkable) {
        this._x = x;
        this._y = y;
        this._walkable = ((walkable === undefined) ? true : walkable);
    }

    get x() {
        return this._x;
    }

    get y() {
        return this._y;
    }

    get walkable() {
        return this._walkable;
    }

    set walkable(walk) {
        this._walkable = walk;
    }
}

//==================================================================================================
// Decode path from finder

function backtrace(node) {
    let path = [[node.x, node.y]];
    while (node.parent) {
        node = node.parent;
        path.push([node.x, node.y]);
    }
    return path.reverse();
}

/**
 * Given the start and end coordinates, return all the coordinates lying
 * on the line formed by these coordinates, based on Bresenham's algorithm.
 * http://en.wikipedia.org/wiki/Bresenham's_line_algorithm#Simplification
 * @param {number} x0 Start x coordinate
 * @param {number} y0 Start y coordinate
 * @param {number} x1 End x coordinate
 * @param {number} y1 End y coordinate
 * @return {Array<Array<number>>} The coordinates on the line
 */
function interpolate(x0, y0, x1, y1) {
    let abs  = Math.abs,
        line = [],
        sx, sy, dx, dy, err, e2;

    dx = abs(x1 - x0);
    dy = abs(y1 - y0);

    sx = (x0 < x1) ? 1 : -1;
    sy = (y0 < y1) ? 1 : -1;

    err = dx - dy;

    while (true) {
        line.push([x0, y0]);

        if (x0 === x1 && y0 === y1) {
            break;
        }

        e2 = 2 * err;
        if (e2 > -dy) {
            err = err - dy;
            x0 = x0 + sx;
        }
        if (e2 < dx) {
            err = err + dx;
            y0 = y0 + sy;
        }
    }

    return line;
}

/**
 * Given a compressed path, return a new path that has all the segments
 * in it interpolated.
 * @param {Array<Array<number>>} path The path
 * @return {Array<Array<number>>} expanded path
 */
function expandPath(path) {
    let expanded = [],
        len      = path.length,
        coord0, coord1,
        interpolated,
        interpolatedLen,
        i, j;

    if (len < 2) {
        return expanded;
    }

    for (i = 0; i < len - 1; ++i) {
        coord0 = path[i];
        coord1 = path[i + 1];

        interpolated = interpolate(coord0[0], coord0[1], coord1[0], coord1[1]);
        interpolatedLen = interpolated.length;
        for (j = 0; j < interpolatedLen - 1; ++j) {
            expanded.push(interpolated[j]);
        }
    }
    expanded.push(path[len - 1]);

    return expanded;
}

//==================================================================================================
//Heuristic.js
/**
 * Manhattan distance.
 * @param {number} dx - Difference in x.
 * @param {number} dy - Difference in y.
 * @return {number} dx + dy
 */
function manhattan(dx, dy) {
    return dx + dy;
}

/**
 * Euclidean distance.
 * @param {number} dx - Difference in x.
 * @param {number} dy - Difference in y.
 * @return {number} sqrt(dx * dx + dy * dy)
 */
function euclidean(dx, dy) {
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Octile distance.
 * @param {number} dx - Difference in x.
 * @param {number} dy - Difference in y.
 * @return {number} sqrt(dx * dx + dy * dy) for grids
 */
function octile(dx, dy) {
    let F = Math.SQRT2 - 1;
    return (dx < dy) ? F * dx + dy : F * dy + dx;
}

/**
 * Chebyshev distance.
 * @param {number} dx - Difference in x.
 * @param {number} dy - Difference in y.
 * @return {number} max(dx, dy)
 */
function chebyshev(dx, dy) {
    return Math.max(dx, dy);
}

//==================================================================================================
//heap.js
/**
 * Двоичная куча
 */

const HT_MINI_HEAP = 1, HT_MAXI_HEAP = -1;
const HT_INIT_SIZE = 10;

class Heap {
    constructor(type, compareFunc) {
        if (type !== HT_MAXI_HEAP && type !== HT_MINI_HEAP) {
            type = HT_MINI_HEAP;
        }

        this.compareFunc = compareFunc;
        this.type = type;
        this.last = 0;
        this.heap = new Array(HT_INIT_SIZE + 1);
        this._increaseMemorySize();
    }

    // help utils
    _increaseMemorySize() {
        if (this.last > this.heap.length) {
            this.heap.length *= 2;
        }
    }

    _minmax(aIndex, bIndex) {
        return (this.comparator(aIndex, bIndex) < 0 ? aIndex : bIndex);
    }

    comparator(aIndex, bIndex) {
        if (this.compareFunc === undefined) {
            return this.type * (this.heap[aIndex] - this.heap[bIndex]);
        }
        return this.type * (this.compareFunc(this.heap[aIndex], this.heap[bIndex]));
    }

    swap(aIndex, bIndex) {
        if (aIndex === bIndex) {
            return;
        }

        let tmp = this.heap[aIndex];
        this.heap[aIndex] = this.heap[bIndex];
        this.heap[bIndex] = tmp;
    }

    clear() {
        this.last = 0;
    }

    isEmpty() {
        return this.last === 0;
    }

    size() {
        return this.last;
    }

    // work methods
    push(value) {
        this.last++;
        this._increaseMemorySize();
        this.heap[this.last] = value;

        this._shiftUp();
    }

    pop() {
        if (this.last < 1) {
            return undefined;
        }

        let value = this.heap[1];
        this.heap[1] = this.heap[this.last];
        this.last--;

        this._shiftDown();

        return value;
    }

    // internal work methods
    _shiftUp() {
        if (this.last === 1) {
            return;
        }

        let index = this.last;
        let parentIndex = index;

        do {
            this.swap(index, parentIndex);
            index = parentIndex;
            parentIndex = index >> 1;
            if (parentIndex === 0) {
                break;
            }
        } while (this.comparator(index, parentIndex) < 0);
    }

    _shiftDown() {
        if (this.last <= 1) {
            return;
        }

        let index = 1;
        let workChildIndex = 1;

        do {
            this.swap(index, workChildIndex);
            index = workChildIndex;

            let childIndex1 = index << 1;
            if (childIndex1 > this.last) {
                break;
            }

            let childIndex2 = childIndex1 + 1;
            if (childIndex2 > this.last) {
                workChildIndex = childIndex1;
            } else {
                workChildIndex = this._minmax(childIndex1, childIndex2);
            }

        } while (this.comparator(index, workChildIndex) > 0)
    }
}

//==================================================================================================
// Grid.js

/**
 * The Grid class, which serves as the encapsulation of the layout of the nodes.
 * @constructor
 * @param {number|Array<Array<(number|boolean)>>} width_or_matrix Number of columns of the grid, or matrix
 * @param {number} height Number of rows of the grid.
 * @param {Array<Array<(number|boolean)>>} [matrix] - A 0-1 matrix
 *     representing the walkable status of the nodes(0 or false for walkable).
 *     If the matrix is not supplied, all the nodes will be walkable.  */
class Grid {
    constructor(height, width) {
        this.height = height;
        this.width = width;
        this._buildNodes();
    }

    clear() {
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                this.setWalkableAt(x, y, true);
            }
        }
    }

    _buildNodes() {
        this.nodes = new Array(this.height);

        for (let y = 0; y < this.height; y++) {
            this.nodes[y] = new Array(this.width);
            for (let x = 0; x < this.width; x++) {
                this.nodes[y][x] = new Node(x, y, true);
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
     */
    getWalkableNeighbors(node) {
        let x         = node.x,
            y         = node.y,
            neighbors = [];

        // ↑
        if (this.isWalkableAt(x, y - 1)) {
            neighbors.push(this.nodes[y - 1][x]);
        }
        // →
        if (this.isWalkableAt(x + 1, y)) {
            neighbors.push(this.nodes[y][x + 1]);
        }
        // ↓
        if (this.isWalkableAt(x, y + 1)) {
            neighbors.push(this.nodes[y + 1][x]);
        }
        // ←
        if (this.isWalkableAt(x - 1, y)) {
            neighbors.push(this.nodes[y][x - 1]);
        }

        return neighbors;
    }

    /**
     * Get the neighbors of the given node.
     */
    getNeighbors(node, radius) {

        let neighbors = [];
        if (radius === undefined) {
            radius = 1;
        }
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                let x = node.x + dx;
                let y = node.y + dy;

                if (!this.isInside(x, y)) {
                    continue;
                }

                neighbors.push(this.nodes[y][x]);
            }
        }

        return neighbors;
    }

    clone() {
        let i, j,
            thisNodes = this.nodes,

            newGrid   = new Grid(this.height, this.width),
            newNodes  = new Array(this.height);

        for (i = 0; i < this.height; ++i) {
            newNodes[i] = new Array(this.width);
            for (j = 0; j < this.width; ++j) {
                newNodes[i][j] = new Node(j, i, thisNodes[i][j].walkable);
            }
        }

        newGrid.nodes = newNodes;

        return newGrid;
    }
}

//==================================================================================================
//JumpPointFinderBase.js

class JumpPointFinderBase {
    constructor(opt) {
        opt = opt || {};
        this.heuristic = opt.heuristic || chebyshev;
        this.trackJumpRecursion = opt.trackJumpRecursion || false;
    }

    findPath(startX, startY, endX, endY, grid) {
        let openList = this.openList = new Heap(Heap.HT_MINI_HEAP,
            function (nodeA, nodeB) {
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
        openList.push(startNode);
        startNode.opened = true;

        // while the open list is not empty
        while (!openList.isEmpty()) {
            // pop the position of node which has the minimum `f` value.
            node = openList.pop();
            node.closed = true;

            if (node === endNode) {
                return expandPath(backtrace(endNode));
            }

            this._identifySuccessors(node);
        }

        // fail to find the path
        return [];
    }

    _identifySuccessors(node) {
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

        for (i = 0, l = neighbors.length; i < l; ++i) {
            neighbor = neighbors[i];
            jumpPoint = this._jump(neighbor[0], neighbor[1], x, y);
            if (jumpPoint) {

                jx = jumpPoint[0];
                jy = jumpPoint[1];
                jumpNode = grid.getNodeAt(jx, jy);

                if (jumpNode.closed) {
                    continue;
                }

                // include distance, as parent may not be immediately adjacent:
                d = octile(abs(jx - x), abs(jy - y));
                ng = node.g + d; // next `g` value

                if (!jumpNode.opened || ng < jumpNode.g) {
                    jumpNode.g = ng;
                    jumpNode.h = jumpNode.h || heuristic(abs(jx - endX), abs(jy - endY));
                    jumpNode.f = jumpNode.g + jumpNode.h;
                    jumpNode.parent = node;

                    if (!jumpNode.opened) {
                        openList.push(jumpNode);
                        jumpNode.opened = true;
                    } else {
                        openList.push(jumpNode);//updateItem(jumpNode);
                    }
                }
            }
        }
    }

    _jump(x, y, px, py) {
        let grid = this.grid,
            dx   = x - px,
            dy   = y - py;

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
            neighborNodes = grid.getWalkableNeighbors(node);
            for (i = 0, l = neighborNodes.length; i < l; ++i) {
                neighborNode = neighborNodes[i];
                neighbors.push([neighborNode.x, neighborNode.y]);
            }
        }

        return neighbors;
    };

}

//==================================================================================================
//solution
///=================

const DIR_UP = 1;
const DIR_RIGHT = 2;
const DIR_DOWN = 3;
const DIR_LEFT = 4;

class Player {
    constructor(screen) {
        this.screen = screen;
        this.heigth = screen.length - 1;
        this.width = screen[0].length;
        this.player = {x: -1, y: -1};
        this.grid = new Grid(this.heigth, this.width);

        this.butterflyList = [];
        this.butterflies = new Heap(Heap.HT_MINI_HEAP,
            function (butterflyA, butterflyB) {
                return butterflyA.distance - butterflyB.distance;
            });

        this.diamondsList = [];
        this.diamonds = new Heap(Heap.HT_MINI_HEAP,
            function (diamondA, diamondB) {
                return diamondA.distance - diamondB.distance;
            });

        this.path = [];
        this.tickCounter = 0;
        this.butterflyHunter = false;
    }

    distance(from, to) {
        let dx = Math.abs(from.x - to.x);
        let dy = Math.abs(from.y - to.y);

        return chebyshev(dx, dy);
    }

    _calculateDistance(heap, sourceList) {
        heap.clear();
        for (let i = 0; i < sourceList.length; i++) {
            sourceList[i].distance = this.distance(this.player, sourceList[i]);
            heap.push(sourceList[i]);
        }
    }

    initGrid() {
        let dx, dy;

        this.butterflyList = [];
        this.diamondsList = [];

        this.grid.clear();

        for (let y = 0; y < this.heigth; y++) {
            for (let x = 0; x < this.width; x++) {
                switch (this.screen[y][x]) {
                    case ' ':
                        break;
                    case ':':
                        //let dirt = {x: x, y: y, type: -1};
                        //this.diamondsList.push(dirt);
                        break;
                    case 'A' :
                        this.player = {x: x, y: y};
                        break;
                    case  '*':
                        let diamond = {x: x, y: y, type: 0};
                        this.grid.setWalkableAt(x, y, true);
                        this.diamondsList.push(diamond);

                        /*if (this.grid.isInside(x, y + 1)) {
                            // if (this.screen[y + 1][x] === ' ') {
                            this.grid.setWalkableAt(x, y + 1, false);
                            // }
                        } */

                        /*
                        dy = y + 1;
                        while (this.grid.isInside(x, dy) && this.screen[dy][x] === ' ') {
                            this.grid.setWalkableAt(x, dy, false);
                            dy++;
                        } */
                        break;
                    case '+':
                    case '#':
                        this.grid.setWalkableAt(x, y, false);
                        break;
                    case 'O':
                        this.grid.setWalkableAt(x, y, false);
                        /*dy = y + 1;
                        while (this.grid.isInside(x, dy) && this.screen[dy][x] === ' ') {
                            this.grid.setWalkableAt(x, dy, false);
                            dy++;
                        } */

                        if (this.grid.isInside(x, y + 1)) {
                            if (this.screen[y + 1][x] === ' ') {
                                this.grid.setWalkableAt(x, y + 1, false);
                            }
                        }

                        break;
                    case '|':
                    case '\\':
                    case '/':
                    case '-':
                        let butterfly = {x: x, y: y, type: 1};
                        this.butterflyList.push(butterfly);

                        if (!this.butterflyHunter) {
                            let neighbors = this.grid.getNeighbors(butterfly, 1);

                            for (let n = 0; n < neighbors.length; n++) {
                                this.grid.setWalkableAt(neighbors[n].x, neighbors[n].y, false);
                            }
                        }

                        break;
                }
            }
        }
        // var_dump(this.player);
        this.grid.setWalkableAt(this.player.x, this.player.y, true);

        this._calculateDistance(this.diamonds, this.diamondsList);
        this._calculateDistance(this.butterflies, this.butterflyList);
    }

    decode(direction) {
        switch (direction) {
            case DIR_UP:
                return 'u';
            case DIR_RIGHT:
                return 'r';
            case DIR_DOWN:
                return 'd';
            case DIR_LEFT:
                return 'l';
        }
        return 's';
    }

    directionToPoint(point) {
        if (point.x < this.player.x) {
            return DIR_LEFT;
        }

        if (point.x > this.player.x) {
            return DIR_RIGHT;
        }

        if (point.y < this.player.y) {
            return DIR_UP;
        }

        if (point.y > this.player.y) {
            return DIR_DOWN;
        }
    }

    nextStep() {
        let next = this.path.shift();
        if (next === undefined) {
            return undefined;
        }

        return this.directionToPoint({x: next[0], y: next[1]});
    }

    ////====================
    isButterfly(point) {
        let char = this.screen[point.y][point.x];
        switch (char) {
            case '|':
            case '\\':
            case '/':
            case '-':
                return true;
            default:
                return false;
        }
    }

    isButterflyNear() {
        let neighbors = this.grid.getNeighbors(this.player, true);
        for (let i = 0; i < neighbors.length; i++) {
            if (this.isButterfly(neighbors[i])) {
                return neighbors[i];
            }

        }
        return undefined;
    }

    reverseStep(direction) {
        switch (direction) {
            case DIR_UP:
                return DIR_DOWN;
                break;
            case DIR_RIGHT:
                return DIR_LEFT;
                break;
            case DIR_DOWN:
                return DIR_UP;
                break;
            case DIR_LEFT:
                return DIR_RIGHT;
                break;
        }
        return DIR_STAY;
    }

    ///=====================

    move(screen) {
        this.tickCounter++;

        let virtualWorld = GIN.from_ascii(screen.slice(0, screen.length - 1), {frames: 10, fps: 10});
        virtualWorld.control(moveCommand);
        virtualWorld.update();
        this.screen = virtualWorld.render(false, true);
        var_dump(this.screen);

        this.initGrid();

        let moveCommand = this.nextStep();

        // butterfly
        /*
        let bt = this.isButterflyNear();
        if (bt !== undefined) {
            if (this.butterflyHunter) {
                moveCommand = this.reverseStep(this.directionToPoint(bt));
            } else {
                moveCommand = undefined; //this.reverseStep(this.directionToPoint(bt));
            }

            //this.path = [];
            //moveCommand = this.reverseStep(moveCommand);
        } */
        // end butterfly

        // var_dump(this.isButterflyNear());
        //if (moveCommand === undefined) {

        let diamondsCount = this.diamonds.size();
        let nearDiamond = this.diamonds.pop();
        if (nearDiamond === undefined) {
            return 'q';
        }

        do {
            if (nearDiamond === undefined) {
                /*if (diamondsCount < 3) {
                    this.butterflyHunter = true;
                    nearDiamond = this.butterflies.pop();
                    if (nearDiamond === undefined) {
                        return 's';
                    }
                } else {
                    return 's';
                } */
                if (diamondsCount < 3) {
                    return 'q';
                }
                return 's';
            }

            let finder = new JumpPointFinderBase({
                heuristic: manhattan
            });

            let grd = this.grid.clone();

            this.path = finder.findPath(this.player.x, this.player.y, nearDiamond.x, nearDiamond.y, grd);

            nearDiamond = this.diamonds.pop();
        } while (this.path.length === 0);

        //var_dump(serializeMatrix(this.grid.nodes));

        this.path.shift();
        moveCommand = this.nextStep();
        //  }
        //var_dump(serializeMatrix(this.grid.nodes));

        /*
        if (this.tickCounter < 5) {
            return 's';
        } */

        return this.decode(moveCommand);
    }
}

//==================================================================================================

//==================================================================================================
let PlayerAI;

exports.play = function* (screen) {
    if (PlayerAI === undefined) {
        PlayerAI = new Player(screen);
    }
    while (true) {
        yield PlayerAI.move(screen); //moves[Math.floor(Math.random() * moves.length)];
    }
};

