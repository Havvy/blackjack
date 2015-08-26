var Score = require("./score");

var cross = function (arrayLeft, arrayRight, op) {
    var result = [];

    arrayLeft.forEach(function (left) {
        arrayRight.forEach(function (right) {
            result.push(op(left, right));
        });
    });

    return result;
};

/// Scores holds operations based on a list of Score values.
var Scores = function (scores) {
    return {
        /// fn sum(self, other: [Score]) => [Score]
        add (other) {
            return cross(scores, other, function (leftScore, rightScore) {
                return leftScore.add(rightScore);
            });
        },

        /// fn isBust(self) => boolean
        isBust () {
            return scores.every(function (score) {
                return score.isBust();
            });
        },


        /// fn canPlayerPlay(self) => boolean
        canPlayerPlay () {
            var high = scores.high().deref();

            return !(high === 21 || high === "bust");
        },

        /// fn high(self) => Score
        high () {
            return scores.reduce(function (currentHighest, score) {
                return currentHighest.higherOf(score);
            }, Score("bust"))
        }
    };
};

/// fn fromCard(card: Card) => [Score]
Scores.fromCard = function () {
    var cardToScoreMap = new Map();

    cardToScoreMap.add("A", Scores([Score(1), Score(11)]));
    cardToScoreMap.add("2", Scores([Score(2)]));
    cardToScoreMap.add("3", Scores([Score(3)]));
    cardToScoreMap.add("4", Scores([Score(4)]));
    cardToScoreMap.add("5", Scores([Score(5)]));
    cardToScoreMap.add("6", Scores([Score(6)]));
    cardToScoreMap.add("7", Scores([Score(7)]));
    cardToScoreMap.add("8", Scores([Score(8)]));
    cardToScoreMap.add("9", Scores([Score(9)]));
    cardToScoreMap.add("10", Scores([Score(10)]));
    cardToScoreMap.add("J", Scores([Score(10)]));
    cardToScoreMap.add("Q", Scores([Score(10)]));
    cardToScoreMap.add("K", Scores([Score(10)]));

    return function (card) {
        return cardToScoreMap.get(card.value);
    };
}();

/// fn fromHand(hand: [Card]) => [Score]
Scores.fromHand = function (hand) {
    return cards.reduce(function (scores, card) {
        scores.add(Scores.fromCard(card));
    });
};

module.exports = Scores;