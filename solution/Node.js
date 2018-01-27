/**
 *
 */
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

module.exports = {Node};
