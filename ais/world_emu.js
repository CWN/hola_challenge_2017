'use strict';
/*jslint node:true*/
const DEBUG_ON = true;
let nodeUtil = require('util');

function var_dump(variable) {
    if (DEBUG_ON) {
        console.log(nodeUtil.inspect(variable, {showHidden: true, depth: null, colors: true}));
    }
}

///=============================

const UP = 0, RIGHT = 1, DOWN = 2, LEFT = 3;

function cw(dir) {
    return (dir + 1) % 4;
}

function ccw(dir) {
    return (dir + 3) % 4;
}

class Point {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        //   Object.freeze(this);
    }

    up() {
        return new Point(this.x, this.y - 1);
    }

    right() {
        return new Point(this.x + 1, this.y);
    }

    down() {
        return new Point(this.x, this.y + 1);
    }

    left() {
        return new Point(this.x - 1, this.y);
    }

    upright() {
        return new Point(this.x + 1, this.y - 1);
    }

    upleft() {
        return new Point(this.x - 1, this.y - 1);
    }

    downright() {
        return new Point(this.x + 1, this.y + 1);
    }

    downleft() {
        return new Point(this.x - 1, this.y + 1);
    }

    step(dir) {
        switch (dir) {
            case UP:
                return this.up();
            case RIGHT:
                return this.right();
            case DOWN:
                return this.down();
            case LEFT:
                return this.left();
        }
    }
}

class Thing { // it would be a bad idea to name a class Object :-)
    constructor(world) {
        this.world = world;
        this.point = undefined;
        this.mark = world.frame;
    }

    place(point) {
        this.point = point;
    }

    move(to) {
        if (this.point)
            this.world.set(this.point);
        if (to)
            this.world.set(to, this);
    }

    update() {
        this.mark = this.world.frame;
    }

    get_char() {
    }

    get_color() {
    }

    is_rounded() {
        return false;
    } // objects roll off it?
    is_consumable() {
        return false;
    } // consumed by explosions?
    is_settled() {
        return true;
    } // no need to postpone game-over?
    hit() {
    } // hit by explosion or falling object
    walk_into(dir) {
        return false;
    } // can walk into?
}

class SteelWall extends Thing {
    get_char() {
        return '#';
    }

    get_color() {
        return '37;46';
    } // white on cyan
}

class BrickWall extends Thing {
    get_char() {
        return '+';
    }

    get_color() {
        return '30;41';
    } // black on red
    is_rounded() {
        return true;
    }

    is_consumable() {
        return true;
    }
}

class Dirt extends Thing {
    get_char() {
        return ':';
    }

    get_color() {
        return '37';
    } // white on black
    is_consumable() {
        return true;
    }

    walk_into(dir) {
        return true;
    }
}

class LooseThing extends Thing { // an object affected by gravity
    constructor(world) {
        super(world);
        this.falling = false;
    }

    update() {
        super.update();
        let under = this.point.down();
        let target = this.world.get(under);
        if (target && target.is_rounded()) {
            if (this.roll(this.point.left()) || this.roll(this.point.right()))
                return;
        }
        if (target && this.falling) {
            target.hit();
            this.falling = false;
        }
        else if (!target) {
            this.falling = true;
            this.move(under);
        }
    }

    roll(to) {
        if (this.world.get(to) || this.world.get(to.down()))
            return false;
        this.falling = true;
        this.move(to);
        return true;
    }

    is_rounded() {
        return !this.falling;
    }

    is_consumable() {
        return true;
    }

    is_settled() {
        return !this.falling;
    }
}

class Boulder extends LooseThing {
    get_char() {
        return 'O';
    }

    get_color() {
        return '1;34';
    } // bright blue on black
    walk_into(dir) {
        if (this.falling || dir == UP || dir == DOWN)
            return false;
        let to = this.point.step(dir);
        if (!this.world.get(to)) {
            this.move(to);
            return true;
        }
        return false;
    }
}

class Diamond extends LooseThing {
    get_char() {
        return '*';
    }

    get_color() {
        return '1;33';
    } // bright yellow on black
    walk_into(dir) {
        this.world.diamond_collected();
        return true;
    }
}

class Explosion extends Thing {
    constructor(world) {
        super(world);
        this.stage = 0;
    }

    get_char() {
        return '*';
    }

    get_color() {
        return ['37;47', '1;31;47', '1;31;43', '1;37'][this.stage];
    }

    update() {
        if (++this.stage > 3)
            this.world.set(this.point, new Diamond(this.world));
    }

    is_settled() {
        return false;
    }
}

class Butterfly extends Thing {
    constructor(world) {
        super(world);
        this.dir = UP;
        this.alive = true;
    }

    get_char() {
        return '/|\\-'[this.world.frame % 4];
    }

    get_color() {
        return '1;35';
    } // bright magenta on black
    update() {
        super.update();
        let points = new Array(4);
        for (let i = 0; i < 4; i++)
            points[i] = this.point.step(i);
        let neighbors = points.map(p => this.world.get(p));
        let locked = true;
        for (let neighbor of neighbors) {
            if (!neighbor)
                locked = false;
            else if (neighbor === this.world.player)
                return this.explode();
        }
        if (locked)
            return this.explode();
        let left = ccw(this.dir);
        if (!neighbors[left]) {
            this.move(points[left]);
            this.dir = left;
        }
        else if (!neighbors[this.dir])
            this.move(points[this.dir]);
        else
            this.dir = cw(this.dir);
    }

    is_consumable() {
        return true;
    }

    hit() {
        if (this.alive)
            this.explode();
    }

    explode() {
        this.alive = false;
        let x1 = this.point.x - 1, x2 = this.point.x + 1;
        let y1 = this.point.y - 1, y2 = this.point.y + 1;
        for (let y = y1; y <= y2; y++) {
            for (let x = x1; x <= x2; x++) {
                let point = new Point(x, y);
                let target = this.world.get(point);
                if (target) {
                    if (!target.is_consumable())
                        continue;
                    if (target !== this)
                        target.hit();
                }
                this.world.set(point, new Explosion(this.world));
            }
        }
        this.world.butterfly_killed();
    }
}

class Player extends Thing {
    constructor(world) {
        super(world);
        this.alive = true;
        this.control = undefined;
    }

    get_char() {
        return this.alive ? 'A' : 'X';
    }

    get_color() {
        if (this.world.frame < 24 && (this.world.frame % 4 < 2))
            return '30;42';
        return '1;32'; // bright green on black
    }

    update() {
        super.update();
        if (!this.alive || this.control === undefined)
            return;
        let to = this.point.step(this.control);
        let target = this.world.get(to);
        if (!target || target.walk_into(this.control))
            this.move(to);
        this.control = undefined;
    }

    is_consumable() {
        return true;
    }

    hit() {
        this.alive = false;
    }
}

class World {
    constructor(w, h) {
        this.width = w;
        this.height = h;
        this.frame = 0;
        this.settled = false;
        this.player = new Player(this);
        this.score = 0;
        this.streak = 0;
        this.streak_expiry = 0;
        this.streak_message = '';
        this.streaks = 0;
        this.longest_streak = 0;
        this.diamonds_collected = 0;
        this.butterflies_killed = 0;
        this.cells = new Array(h);
        for (let y = 0; y < h; y++)
            this.cells[y] = new Array(w);
    }

    * [Symbol.iterator]() {
        for (let y = 0; y < this.height; y++) {
            let row = this.cells[y];
            for (let x = 0; x < this.width; x++)
                yield [new Point(x, y), row[x]];
        }
    }

    get (point) {
        return this.cells[point.y][point.x];
    }

    set (point, thing) {
        let old = this.cells[point.y][point.x];
        if (old === thing)
            return;
        if (old)
            old.place();
        this.cells[point.y][point.x] = thing;
        if (thing)
            thing.place(point);
    }

    diamond_collected() {
        this.score++;
        this.diamonds_collected++;
        this.streak++;
        this.streak_expiry = 20;
        this.scored_expiry = 8;
        if (this.streak < 3)
            return;
        if (this.streak == 3)
            this.streaks++;
        if (this.longest_streak < this.streak)
            this.longest_streak = this.streak;
        for (let i = 2; i * i <= this.streak; i++) {
            if (this.streak % i == 0)
                return;
        }
        // streak is a prime number
        this.streak_message = `${this.streak}x HOT STREAK!`;
        this.score += this.streak;
    }

    butterfly_killed() {
        if (!this.player.alive) // no reward if player killed
            return;
        this.butterflies_killed++;
        this.score += 10;
        this.scored_expiry = 8;
    }

    update() {
        this.frame++;

        if (this.streak && !--this.streak_expiry) {
            this.streak = 0;
            this.streak_message = '';
        }
        if (this.scored_expiry)
            this.scored_expiry--;
        this.settled = !this.streak_message;
        for (let [point, thing] of this) {
            if (!thing)
                continue;
            if (thing.mark < this.frame)
                thing.update();
            if (!thing.is_settled())
                this.settled = false;
        }
    }

    control(c) {
        this.player.control = c;
    }

    is_playable() {
        return this.player.alive;
    }

    is_final() {
        return !this.player.alive && this.settled;
    }

    ///=====
    // walkable grid
    getWalkableGrid() {
        let grd = new Grid(this.height, this.width);
        for (let [point, thing] of this) {
            if (!thing) {
                grd.setWalkableAt(point.x, point.y, true);
            } else {
                grd.setWalkableAt(point.x, point.y, thing.walk_into(UP));
            }
        }
        return grd;
    }
}

class NewWorld {
    constructor(width, height, raw) {
        this.width = width;
        this.height = height;

        this.diamonds = new Heap(Heap.HT_MINI_HEAP,
            function (diamondA, diamondB) {
                return diamondA.distance - diamondB.distance;
            });

        this.butterflies = new Heap(Heap.HT_MINI_HEAP,
            function (butterflyA, butterflyB) {
                return butterflyA.distance - butterflyB.distance;
            });

        if (raw !== undefined) {
            this.width = raw[0].length;
            this.height = raw.length - 1;
        }

        this.cells = new Array(h);
        for (let y = 0; y < this.height; y++)
            this.cells[y] = new Array(this.width);

        if (raw !== undefined) {
            this.from_ascii(raw);
        }
    }

    from_ascii(raw) {
        this.butterflyList = [];
        this.diamondsList = [];

        for (let y = 0; y < this.height; y++) {
            let row = raw[y];

            for (let x = 0; x < this.width; x++) {
                let c = row[x];
                let point = new Point(x, y);
                switch (c) {
                    case ' ':
                        break;
                    case '#':
                        world.set(point, new SteelWall(world));
                        break;
                    case '+':
                        world.set(point, new BrickWall(world));
                        break;
                    case ':':
                        world.set(point, new Dirt(world));
                        break;
                    case 'O':
                        world.set(point, new Boulder(world));
                        break;
                    case '*':
                        world.set(point, new Diamond(world));
                        this.diamondsList.push(point);
                        break;
                    case '-':
                    case '/':
                    case '|':
                    case '\\':
                        world.set(point, new Butterfly(world));
                        break;
                    case 'A':
                        if (world.player.point)
                            throw new Error('More than one player position found');
                        world.set(point, world.player);
                        break;
                }
            }
        }
        if (!world.player.point)
            throw new Error('Player position not found');

        this.player = world.player.point;
        this._calculateDistance(this.diamonds, this.diamondsList);

        return world;
    }
}

//=======================================================================
// node for pathfinder
class Node {
    constructor(x, y, walkable) {
        this.x = x;
        this.y = y;
        this.walkable = ((walkable === undefined) ? true : walkable);
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

/////==============================================
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

//================================================================
class AI {
    constructor(screen) {
        this.path = [];
        this.player = {};

        this.diamonds = new Heap(Heap.HT_MINI_HEAP,
            function (diamondA, diamondB) {
                return diamondA.distance - diamondB.distance;
            });

        this.world = this.from_ascii(screen);
    }

    from_ascii(rows) {
        //var_dump(rows);
        this.butterflyList = [];
        this.diamondsList = [];

        let w = rows[0].length, h = rows.length - 1;
        if (w < 3 || h < 3)
            throw new Error('Cave dimensions are too small');
        let world = new World(w, h);
        for (let y = 0; y < h; y++) {
            let row = rows[y];
            if (row.length != w)
                throw new Error('All rows must have the same length');
            for (let x = 0; x < w; x++) {
                let c = row[x];
                let point = new Point(x, y);
                switch (c) {
                    case ' ':
                        break;
                    case '#':
                        world.set(point, new SteelWall(world));
                        break;
                    case '+':
                        world.set(point, new BrickWall(world));
                        break;
                    case ':':
                        world.set(point, new Dirt(world));
                        break;
                    case 'O':
                        world.set(point, new Boulder(world));
                        break;
                    case '*':
                        world.set(point, new Diamond(world));
                        this.diamondsList.push(point);
                        break;
                    case '-':
                    case '/':
                    case '|':
                    case '\\':
                        world.set(point, new Butterfly(world));
                        break;
                    case 'A':
                        if (world.player.point)
                            throw new Error('More than one player position found');
                        world.set(point, world.player);
                        break;
                }
            }
        }
        if (!world.player.point)
            throw new Error('Player position not found');

        this.player = world.player.point;
        this._calculateDistance(this.diamonds, this.diamondsList);

        return world;
    }

    distance(from, to) {
        let dx = Math.abs(from.x - to.x);
        let dy = Math.abs(from.y - to.y);

        return euclidean(dx, dy);
    }

    _calculateDistance(heap, sourceList) {
        heap.clear();

        for (let i = 0; i < sourceList.length; i++) {
            sourceList[i].distance = this.distance(this.player, sourceList[i]);
            heap.push(sourceList[i]);
        }
    }

    encodeMovement(moveDirection) {
        switch (moveDirection) {
            case UP:
                return 'u';
            case RIGHT:
                return 'r';
            case DOWN:
                return 'd';
            case LEFT:
                return 'l';
        }

        return 's';
    }

    findPath(dest) {
        let finder = new JumpPointFinderBase({
            heuristic: manhattan
        });

        let grd = this.world.getWalkableGrid();

        this.path = finder.findPath(this.player.x, this.player.y, dest.x, dest.y, grd);

        this.path.shift();
    }

    directionToPoint(point) {
        if (point.x < this.player.x) {
            return LEFT;
        }

        if (point.x > this.player.x) {
            return RIGHT;
        }

        if (point.y < this.player.y) {
            return UP;
        }

        if (point.y > this.player.y) {
            return DOWN;
        }

        return 5;
    }

    nextStep() {
        let next = this.path.shift();
        if (next === undefined) {
            return undefined;
        }

        return this.directionToPoint({x: next[0], y: next[1]});
    }

    move(screen) {
        this.world = this.from_ascii(screen);

        let moveCommand = this.nextStep();

        if (moveCommand === undefined) {
            let bf = this.diamonds.pop();
            if (bf === undefined) {
                return 'q';
            }

            this.findPath(bf);

            moveCommand = this.nextStep();
            this.world.control(moveCommand);
            this.world.update();
            if (!this.world.player.alive) {
                this.path = [];
                return 's';
            }
        }
        return this.encodeMovement(moveCommand);
    }
}

//==================================================================================================
let PlayerAI;

exports.play = function* (screen) {
    if (PlayerAI === undefined) {
        PlayerAI = new AI(screen);
    }
    while (true) {
        yield PlayerAI.move(screen); //moves[Math.floor(Math.random() * moves.length)];
    }
};
