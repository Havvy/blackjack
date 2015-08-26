var Scores = require("./scores");

/// enum Score {
///     "bust",
///     (Number)
/// }
var ScoreGenerator = function (value) {
    var self = Object.freeze({
        deref () {
            return value;
        },

        isBust () {
            return value === "bust";
        },

        compare (other) {
            var otherValue = other.deref();

            if (value === otherValue) {
                return 0;
            }

            if (value === "bust") {
                return -1;
            }

            if (otherValue === "bust") {
                return 1;
            }

            return value - otherValue;
        },

        higherOf (other) {
            return self.compare(other) >= 0 ? self : other;
        },

        add (other) {
            var otherValue = other.deref();

            if (value === "bust" || otherValue === "bust") {
                return Score("bust");
            } else if (value + otherValue > 21) {
                return Score("bust");
            } else {
                return Score(value + otherValue);
            }
        },

        toString () {
            return String(value);
        }
    });

    return self;
};

var scoreMap = new Map();

scoreMap.add("bust", ScoreGenerator("bust"));
for (var ix = 1; ix <= 21; ix++) {
    scoreMap.add(ix, ScoreGenerator(ix));
}

var Score = function (value) {
    return scoreMap.get(value);
};

/// fn highestFromHand (hand: [Card]) => Score
Score.highestFromHand = function (hand) {
    return Scores.fromHand(hand).high();
};

module.exports = Score;