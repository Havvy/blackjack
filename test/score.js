// const sinon = require("sinon");
const assert = require("better-assert");
// const equal = require("deep-eql");
const inspect = require("util").inspect;
const format = require("util").format;

const debug = false;
const logfn = debug ? console.log.bind(console) : function () {};

const Score = require("../lib/score.js");

describe("Score type", function () {
    it("wraps a value", function() {
        var score = Score(21);
        assert(score.deref() === 21);
        assert(!score.isBust());
    });

    it("wraps 'bust' as a string.", function () {
        var score = Score("bust");
        assert(score.deref() === "bust");
        assert(score.isBust());
    });
});
