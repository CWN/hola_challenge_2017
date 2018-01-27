#!/usr/bin/env node
'use strict';

/**
 * Тест кучи
 */
const SIZE = 11;
const utils = require('../DebugUtils.js');
const heap = require('./../heap.js');

let hp = new heap.Heap(heap.HT_MINI_HEAP);
let src = [];

for (let i = 1; i < SIZE; i++) {
    let vr = Math.floor(Math.random() * 100);
    src.push(vr);
    hp.insert(vr);
}

utils.var_dump('Source');
utils.var_dump(src);

let top = hp.extractTop();

let out = [];
do {
    out.push(top);
    top = hp.extractTop();
} while (top !== undefined);

utils.var_dump('Standard sort');

function compareNumbers(a, b) {
    return a - b;
}

utils.var_dump(src.sort(compareNumbers));

utils.var_dump('Sort on heap');
utils.var_dump(out);


