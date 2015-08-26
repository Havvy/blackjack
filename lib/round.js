var format = require("util").format;
var result = require("r-result");
var Ok = result.Ok;
var Fail = result.Fail;

var cards = require("cards");
var Scores = require("./scores");
var Score = require("./score");

/// unsafe fn drawReshuffleIfNeeded(deck: Deck) -> Card
/// Draw a card from the deck. If the deck is empty, shuffle the discard pile
/// into the deck, and then draw a card from the deck.
///
/// Warning: This function is not safe. It assumes that either the deck or the
/// discard pile is not empty. If you change code that uses this function,
/// please make sure that either the deck or discard pile is non-empty.
var drawReshuffleIfNeeded = function (deck) {
    if (deck.deck.length === 0) {
        deck.shuffleDiscard();

        // assert(d.deck.length > 0)
    }

    return deck.draw();
}

/// A BlackjackRound takes the following struct.
///
/// struct BlackjackRoundOptions {
///     deck: cards::PokerDeck,
///     playerCount: JSNumber, // Max: 8
///     timeout: Option<JSNumber>, // Default: 2 * 60 * 1e3
///     timeoutAction: "stay" | "lose" // Default: "lose"
/// }
///
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
///
/// Internally, a BlackjackRound is the following struct:
/// struct BlackJackRound {
///     endOfRoundPromise: Promise<BlackjackRoundResults, ()>,
///     resolveRound: Function<BlackjackRoundResults>,
///     timeout: Timeout
///     timeoutTime: Number,
///     timeoutAction: enum { "stay", "lose" },
///     deck: Deck,
///     playerCount: Number, // 1...8
///     dealerCards: [Card],
///     players: [Player],
/// }
var BlackjackRound = function (opts) {
    // We check to see if everybody is done playing. When they are
    // done playing, we perform the end of round actions on the next
    // turn.
    //
    // This is done for flexibility. It's a lot easier to think
    // about consequences of what endOfRound does if it happens
    // without being in the middle of a bunch of other calls.
    function checkEndOfRound () {
        if (players.all(function (p) { return !p.isPlaying })) {
            setImmediate(endOfRound);
        }
    }

    // BlackJackRound returns a promise for when the round ends.
    // Since we can't determine when that happens as a chain of promises,
    // we lift the resolve function from a promise out into a variable
    // owned by the round. I'd make a function to do this, but without
    // destructuring, it wouldn't make the call site look cleaner, nor would
    // it help readability.
    var resolveRound;
    var endOfRoundPromise = new Promise(function (resolve) {
        resolveRound = resolve;
    });

    function endOfRound () {
        var dealerScore = function dealerPlay () {
            var highDealerScore = Score.highestfromHand(dealerCards);

            while (!highDealerScore.isBust() && highDealerScore.compare(Score(16)) < 0) {
                dealerCards.push(drawReshuffleIfNeeded(deck));
                highDealerScore = Score.highestFromHand(dealerCards);
            }

            return Score.highestfromHand(dealerCards);
        }();

        resolveRound({
            dealer: {
                cards: dealerCards,
                score: dealerScore
            },

            players: players.map(function (player) {
                var playerScore = Score.highestFromHand(player.cards);

                return {
                    win: !playerScore.isBust() && playerScore.compare(dealerScore) > 0,
                    cards: player.cards,
                    score: playerScore
                };
            })
        });

        dealerCards.forEach(deck.discard.bind(deck));
        players.forEach(function (player) {
            player.cards.forEach(deck.discard.bind(deck));
        });
    }

    var deck = opts.deck;

    var playerCount = opts.playerCount;
    // Note(Havvy): We assume playerCount is between 1 and 8.
    // assert(playerCount >= 1 && playerCount <= 8)

    var timeoutTime = opts.timeout || 2 * 60 * 1e3;

    var timeoutAction = opts.timeoutAction || "lose";
    if (timeoutAction !== "stay" || timeoutAction !== "lose") {
        throw new TypeError(format("BlackjackRound's timeoutAction must be either 'stay' or 'lose'. Got %s instead.", timeoutAction));
    }

    var dealerCards = [drawReshuffleIfNeeded(deck), drawReshuffleIfNeeded(deck)];

    var players = [];
    for (var ix = 0; ix < playerCount; ix++) {
        /// struct Player {
        ///     cards: [Card],
        ///     isPlaying: boolean
        /// }
        var player = {
            cards: [drawReshuffleIfNeeded(deck), drawReshuffleIfNeeded(deck)],

            // Whether or not the player is still able to perform actions.
            isPlaying: true
        };

        // A natural 21 means the player is no longer playing.
        // It's not possible for a player to go bust.
        if (Scores.fromHand(player.cards).canPlayerPlay()) {
            player.isPlaying = false;
            checkEndOfRound
        }

        players.push(player);
    }

    var timeout = setTimeout(function () {
        players
        .filter(function (player) { return player.isPlaying; })
        .forEach(function (player) { 
            if (timeoutAction === "stay") {
                player.isPlaying = false;
            } else if (timeoutAction === "lose") {
                // TODO(Havvy): Figure out how to represent losing by fiat.
                player.isPlaying = false;
            }
        });

        checkEndOfRound();
    }, timeoutTime);

    return {
        /// fn dealerCard() => Card
        /// Returns the visible card that the dealer has.
        dealerCard () {
            return dealerCards[0];
        },

        /// fn playerCards(playerNumber: Number): [Card]
        /// Returns a copy of the player's cards.
        playerCards (playerNumber) {
            return players[playerNumber].cards.slice();
        },

        /// fn hit(playerNumber: Number): Result<{card: Card, score: [Number]}, "player-cannot-hit">
        /// If the player is not playing, this function fails with the
        /// "player-cannot-hit" string. Otherwise, a card will be drawn from the
        /// deck and given to the player. The player's newly drawn card and
        /// recalculated score will be returned. If the score is greater than
        /// 21 (a bust), the player will not be allowed to hit in the future.
        hit (playerNumber) {
            var player = players[playerNumber];

            if (!player.isPlaying) {
                return Fail("player-cannot-hit");
            }

            var card = drawReshuffleIfNeeded(deck);
            player.cards.push(card);

            var scores = Scores.fromHand(player.cards);

            if (scores.canPlayerPlay()) {
                player.isPlaying = false;
                checkEndOfRound();
            }

            return Ok({
                card: card,
                scores: scores
            });
        },

        /// fn stay(playerNumber: Number)
        /// Stops the player from hitting in the future,
        /// and lets the round know that the player is finished.
        stay (playerNumber) {
            players[playerNumber].isPlaying = false;
            checkEndOfRound();
        },

        /// Promise<RoundResult, ()>
        /// This promise is resolved at the end of the round
        /// detailing which users won and what cards that the
        /// dealer and players had.
        ///
        /// struct BlackjackPlayerRoundResult {
        ///     win: boolean,
        ///     cards: [Card],
        ///     score: Number            
        /// }
        ///
        /// struct BlackjackRoundResult {
        ///     dealer: { cards: [Card], score: Number },
        ///     players: [BlackjackPlayerRoundResult]    
        /// }
        endOfRound: endOfRoundPromise
    }
};

module.exports = BlackjackRound;