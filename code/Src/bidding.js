/*
	bidding.js
	Contains the logic for a bid
	exports { bid }
*/

//Imports
import { doubleTxt, nextTurn, suits } from "./game.js";
import { RealPlayer } from "./player.js";

//Lambda expressions
var returnCard = (card) => `${card.num}${suits[card.trump]}${card.doubled ? doubleTxt[card.doubled] : ``}`;

/**
 * Runs the bid validation and resultant algorithm
 *
 * @param {Game} game The game that the socket belongs to
 * @param {args} input The input that the player wants to bid
 * @returns Result of the bid
 */
function bid(game, input) {
	//Vallidation
	if (game.state != game.gameStates.bid) return { success: false, msg: `Wrong state` };

	//If the input is a card
	if (typeof input == `object`) {
		return bidType.object(game, input);

		//If the input is a pass
	} else if (input == `pass`) {
		return bidType.pass(game);

		//If the input is a dobule or a redouble
	} else if ((input == `double` || input == `redouble`) && game.currentDeal.trump != null) {
		return bidType.double(game);

		//If the input is invalid
	} else {
		return { success: false, msg: `Invalid bid` };
	}
}

/** Handles the different types of bid */
const bidType = {
	/** Handles bidding a card */
	object: (game, input) => {
		//Validation
		if (!Number.isInteger(input.num) || input.num < 1 || input.num > 7) return { success: false, msg: `Invalid num` };
		if (!Number.isInteger(input.trump) || input.trump < 0 || input.trump > 4) return { success: false, msg: `Invalid Trump` };
		if (input.num < game.currentDeal.num || (input.num == game.currentDeal.num && input.trump != 4 && game.currentDeal.trump != 4)) {
			return { success: false, msg: `Bid must be highter then current or trump NO TRUMP` };
		}
		//Valid card

		//Sets the deal
		game.currentDeal = { num: input.num, trump: input.trump, doubled: game.currentDeal.doubled };
		game.declarer = game.currentPlayer;
		//Resets the pass counter
		game.passCount = 0;

		const prevPlayer = game.currentPlayer + 1; //the previous player to display it
		//Clalculates who the next player is
		game.currentPlayer = nextTurn(game.currentPlayer);

		return { success: true, bid: game.currentDeal, msg: `Player ${prevPlayer} plays: ${returnCard(game.currentDeal)}`, game };
	},

	/** Handles bidding a pass */
	pass: (game) => {
		//Incremenets the pass counter
		game.passCount++;

		//If there is a deal and 3 passes have happened then end bidding
		if (game.passCount == 3 && game.currentDeal.trump != null) {
			//Start trick-taking
			game.state = game.gameStates.trick;

			//Whoever won the bid plays first
			game.currentPlayer = game.declarer;

			//Calculates who the dummy && declarer are
			game.dummy = (game.declarer + 2) % 4;
			const dummy = game.players[game.dummy];
			const declarer = game.players[game.declarer];
			//If the dummy is a real player and the declarer is a bot the switch hands
			if (dummy instanceof RealPlayer && !(declarer instanceof RealPlayer)) {
				//Switch hands
				[game.players[game.declarer].hand, game.players[game.dummy].hand] = [game.players[game.dummy].hand, game.players[game.declarer].hand];
				//Switch dummy and declarer idxs
				[game.dummy, game.declarer] = [game.declarer, game.dummy];
			}

			return { success: true, bid: `pass`, msg: `\nBidding finished. Moving to Trick Taking`, clear: true, game, dummy: game.currentPlayer != game.dummy };

			//If there is no deal and there are 4 passes then redeal
		} else if (game.passCount == 4 && game.currentDeal.trump == null) {
			const prevPlayer = game.currentPlayer + 1; //the previous player to display it
			//Restart the game
			game.initialise();
			return { success: true, bid: `pass`, msg: `Player ${prevPlayer} passes\nFour passes - re-deal`, game };
		}

		const prevPlayer = game.currentPlayer + 1; //the previous player to display it
		//Clalculates who the next player is
		game.currentPlayer = nextTurn(game.currentPlayer);

		return { success: true, bid: `pass`, msg: `Player ${prevPlayer} passes`, game };
	},

	/** Handles bidding a double or a redouble */
	double: (game) => {
		//Increments the double but clamps at 2
		game.currentDeal.doubled = Math.min(2, game.currentDeal.doubled + 1);
		//Resets the pass counter
		game.passCount = 0;

		const prevPlayer = game.currentPlayer + 1; //the previous player to display it
		//Clalculates who the next player is
		game.currentPlayer = nextTurn(game.currentPlayer);

		return { success: true, bid: game.currentDeal.doubled == 2 ? `redouble` : `double`, msg: `Player ${prevPlayer}: ${game.currentDeal.doubled == 2 ? `redoubles` : `doubles`} the bid`, game };
	},
};

export { bid };
