'use strict';
/*jslint node:true*/

let PF = require('../solution/PathFinding');
let debugTools = require('../solution/DebugUtils.js');
let path = [];

function findNeighborDiamonds(player, diamonds) {
    let min = -1;
    let minIndex = -1;
    for (let i = 0; i < diamonds.length; i++) {
        let dx = player.x - diamonds[i].x;
        let dy = player.y - diamonds[i].y;

        let distance = dx * dx + dy * dy;

        if (-1 === min) {
            min = distance;
            minIndex = i;
            continue;
        }

        if (distance < min) {
            min = distance;
            minIndex = i;
        }
    }

    if (minIndex < 0) {
        return {x: -1, y: -1};
    }

    return diamonds[minIndex];
}

function getNeighbors(point, screen) {

    let neighbors = [];
    for (let dx = -1; dx < 2; dx++) {
        for (let dy = -1; dy < 2; dy++) {
            let x = point.x + dx;
            let y = point.y + dy;

            if (x < 0) {
                continue;
            }
            if (y < 0) {
                continue;
            }

            if (x > screen[0].length) {
                continue;
            }

            if (y > screen.length) {
                continue;
            }

            let neighbor = {x: x, y: y};
            neighbors.push(neighbor);
        }
    }

    return neighbors;
}

function findPah(screen) {

    let matrix = new Array(screen.length);
    let diamonds = [];
    let butterflies = [];
    let neighbor = [];

    let player = {x: 0, y: 0};
    for (let h = 0; h < screen.length; h++) {
        matrix[h] = new Array(screen[h].length).fill(0);
    }

    for (let h = 0; h < screen.length; h++) {
        for (let w = 0; w < screen[h].length; w++) {
            matrix[h][w] = 0;

            switch (screen[h][w]) {
                case ' ':
                case ':':
                    matrix[h][w] |= 0;
                    break;
                case 'A' :
                    player = {x: w, y: h};
                    matrix[h][w] |= 0;
                    break;
                case  '*':
                    let diamond = {x: w, y: h};
                    diamonds.push(diamond);
                    matrix[h][w] |= 0;
                    break;
                case '+':
                case '#':
                    matrix[h][w] |= 1;
                    break;
                case 'O':
                    matrix[h][w] |= 1;

                    if (h + 1 < screen.length) {
                        if (screen[h + 1][w] === ' ') {
                            matrix[h][w] |= 1;
                        }
                    }

                    break;
                case '|':
                case '\\':
                case '/':
                case '-':
                    let butterfly = {x: w, y: h};
                    butterflies.push(butterfly);
                    matrix[h][w] |= 1;

                    let neighbors = getNeighbors(butterfly, screen);
                    for (let neighbor of neighbors) {
                        matrix[neighbor.y][neighbor.x] |= 1;
                    }
                    break;
            }
        }
    }

    if (path.length < 1) {
        let grid = new PF.Grid.Grid(matrix);
        let to = findNeighborDiamonds(player, diamonds);
        if (-1 === to.x) {
            return 'q';
        }

        //debugTools.var_dump(grid);
        let finder = new PF.JumpPointFinder.JumpPointFinderBase({
            allowDiagonal: false,
            heuristic    : PF.Heuristic.chebyshev
        });

        path = finder.findPath(player.x, player.y, to.x, to.y, grid);
        path.unshift();
    }

    let next = path.shift();
    //debugTools.var_dump(player);
    //debugTools.var_dump(to);

    debugTools.var_dump(path);
    debugTools.var_dump(next);
    //exit;

    if (next !== undefined) {
        if (next[0] < player.x) {
            return 'l';
        }

        if (next[0] > player.x) {
            return 'r';
        }

        if (next[1] < player.y) {
            return 'u';
        }

        if (next[1] > player.y) {
            return 'd';
        }
    } else {
        return 's';
    }

}

function find_player(screen) {
    for (let y = 0; y < screen.length; y++) {
        let row = screen[y];
        for (let x = 0; x < row.length; x++) {
            if (row[x] == 'A')
                return {x, y};
        }
    }
}

exports.play = function* (screen) {
    while (true) {
        /*let {x, y} = find_player(screen);
        let moves = '';
        if (' :*'.includes(screen[y - 1][x]))
            moves += 'u';
        if (' :*'.includes(screen[y + 1][x]))
            moves += 'd';
        if (' :*'.includes(screen[y][x + 1])
            || screen[y][x + 1] == 'O' && screen[y][x + 2] == ' ') {
            moves += 'r';
        }
        if (' :*'.includes(screen[y][x - 1])
            || screen[y][x - 1] == 'O' && screen[y][x - 2] == ' ') {
            moves += 'l';
        } */
        yield findPah(screen); //moves[Math.floor(Math.random() * moves.length)];
    }
};
