var cards = require("cards");
var format = require("util").format;
var result = require("r-result");
var Ok = result.Ok;
var Fail = result.Fail;

var drawReshuffleIfNeeded = function (deck) {
    if (deck.deck.length === 0) {
        deck.shuffleDiscard();

        // assert(d.deck.length > 0)
    }

    return deck.draw();
}

/*
struct BlackjackGameOptions {
    deck: cards::PokerDeck,
    playerCount: JSNumber, // Max: 8
    timeout: Option<JSNumber>, // Default: 2 * 60 * 1e3
    timeoutAction: "stay" | "lose" // Default: "lose"
}
*/

/// A BlackjackGame takes the above struct.
/// It will take two cards from the deck for the dealer
/// and another two cards for each player.
///
/// Then it'll wait until the players have all `stay`ed,
/// reached `21`, or gone `bust`. If the players do not
/// do so within the timeout, they'll automatically lose.
/// If you want automatic `stay`, pass "stay" to timeoutAction.
/// For no timeout, pass `Infinity` for the timeout value.
///
/// Should the deck run out of cards, all of the cards
/// in the discard will be placed into the deck and shuffled.
///
/// You will notice that a single game does not care about
/// points. That is for the BlackjackServer to take care of.
var BlackjackRound = function (opts) {
    function cardNumericValue (card) {
        // TODO(Havvy): Return an array of possible values.
        switch (card.value) {
            case "A": return 1, // [1, 11 || 10]
            case "2": return 2,
            case "3": return 3,
            case "4": return 4,
            case "5": return 5,
            case "6": return 6,
            case "7": return 7,
            case "8": return 8,
            case "9": return 9,
            default: return 10
        }
    }

    function score (cards) {
        // TODO(Havvy): Return an array of scores.
        cards.reduce(function (acc, card) {
            return acc + cardNumericValue(card);
        });
    }

    function checkEndOfRound () {
        if (players.all(function (p) { return !p.isPlaying })) {
            setImmediate(endOfRound);
        }
    }

    function endOfRound () {
        // TODO(Havvy): Write me.
    }

    var deck = opts.deck;

    // Note(Havvy): We assume playerCount is between 1 and 8.
    var playerCount = opts.playerCount;

    var timeoutTime = opts.timeout || 2 * 60 * 1e3;

    var timeoutAction = opts.timeoutAction || "lose";
    if (timeoutAction !== "stay" || timeoutAction !== "lose") {
        throw new TypeError(format("BlackjackRound's timeoutAction must be either 'stay' or 'lose'. Got %s instead.", timeoutAction));
    }

    var dealerCards = [drawReshuffleIfNeeded(deck), drawReshuffleIfNeeded(deck)];

    var players = [];
    for (var ix = 0; ix < playerCount; ix++) {
        var player = {
            cards: [drawReshuffleIfNeeded(deck), drawReshuffleIfNeeded(deck)],

            // Whether or not the player is still able to perform actions.
            isPlaying: true
        };

        if (score(player.cards) === 21) {
            player.isPlaying = false;
        }

        players.push(player);
    }

    var timeout = setTimeout(function () {
        // TODO(cause players to timeoutAction)
    }, timeoutTime);

    return {
        /// fn dealerCard() => Card
        /// Returns the visible card that the dealer has.
        dealerCard: function () {
            return dealerCards[0];
        },

        /// fn playerCards(playerNumber: Number): [Card]
        /// Returns a copy of the player's cards.
        playerCards: function (playerNumber) {
            return players[playerNumber].cards.slice();
        },

        /// fn hit(playerNumber: Number): Result<{card: Card, score: Number}, "player-cannot-hit">
        /// If the player is not playing, this function fails with the "player-cannot-hit" string.
        /// Otherwise, a card will be drawn from the deck and given to the player. The player's
        /// newly drawn card and recalculated score will be returned. If the score is greater than
        /// than 21 (a bust), the player will not be allowed to hit in the future.
        hit: function (playerNumber) {
            var player = players[playerNumber];

            if (!player.isPlaying) {
                return Fail("player-cannot-hit");
            }

            var card = drawReshuffleIfNeeded(deck);
            player.cards.push(card);

            var score = score(player.cards);

            if (score >= 21) {
                player.isPlaying = false;
                checkEndOfRound();
            }

            return Ok({
                card: card,
                score: score
            });
        },

        /// fn stay(playerNumber: Number)
        /// Stops the player from hitting in the future,
        /// and lets the round know that the player is finished.
        stay: function (playerNumber) {
            players[playerNumber].isPlaying = false;
            checkEndOfRound();
        }
    }
}