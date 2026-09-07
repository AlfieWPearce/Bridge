/*
	game.js
	Contains the class for a game
	exports { Game }
*/

//Imports
import { bid } from "./bidding.js";
import { HeuristicPlayer, RealPlayer } from "./player.js";
import { addScore, createScoreObject } from "./score.js";
import { trick } from "./tricks.js";

//Global variables
const suits = [`♠️`, `♥️`, `♦️`, `♣️`, `NT`];
const doubleTxt = [``, `x`, `xx`];

// Lambda expressions
var nextTurn = (i) => (i + 1) % 4;
var rankValue = (pip) => (pip == 1 ? 14 : pip);

// Classes
class Card {
	constructor(suit, pip) {
		this.suit = suit;
		this.pip = pip;
	}
	toString() {
		const pips = [null, `A`, `2`, `3`, `4`, `5`, `6`, `7`, `8`, `9`, `10`, `J`, `Q`, `K`];
		return `${pips[this.pip]}${suits[this.suit]}`;
	}
}

class Game {
	constructor(playerMap) {
		// Game Data
		const totalSeats = 4;
		this.players = Array.from({ length: totalSeats }, (_, seatId) => {
			//Check if this seat belongs to a real player
			const isReal = Object.values(playerMap).includes(seatId);

			if (isReal) {
				//Person
				return new RealPlayer(seatId);
			} else {
				//Bot
				return new HeuristicPlayer(seatId, 2, Math.random(), Math.random(), Math.random());
			}
		});
		this.playerAvatars = new Array(4).fill({ name: ``, avatar: -1 });

		this.gameStates = { deal: 0, bid: 1, trick: 2, score: 3 };
		this.gameOver = false;

		// Player Data
		this.dealer = null;

		//Set new deal
		this.initialise();

		//Create new score object
		this.score = createScoreObject();

		//Set final data
		const redTeam = Math.round(Math.random());
		this.colour = redTeam == 0 ? [1, 0] : [0, 1];
		this.pairs = [
			{ id: 0, players: [this.players[0], this.players[2]], score: this.createScore(), vulnerable: false },
			{ id: 1, players: [this.players[1], this.players[3]], score: this.createScore(), vulnerable: false },
		];
	}

	initialise() {
		//Create deck and set hands
		const hands = this.dealCards();
		this.players.forEach((p, i) => {
			p.hand = hands[i];
		});

		//Player Data
		if (this.dealer == null) this.dealer = Math.floor(Math.random() * 4);
		else this.dealer = nextTurn(this.dealer);

		this.declarer = null;
		this.dummy = null;
		this.currentPlayer = this.dealer;

		this.playable = [];

		//Bid Data
		this.currentDeal = { num: 0, trump: null, doubled: 0 };

		//Trick Data
		this.currentTrick = [];
		this.leadSuit = null;
		this.tricksAmount = 0;
		this.tricksWon = [0, 0];
		this.passCount = 0;

		//Game Data
		this.state = this.gameStates.bid;
		this.currentGame = 0;
	}

	dealCards() {
		//Create Deck of 52 cards
		const deck = [];
		for (let suit = 0; suit < 4; suit++) {
			for (let pip = 1; pip <= 13; pip++) {
				deck.push(new Card(suit, pip));
			}
		}
		//Fisher-Yates Shuffle
		for (let idx = 51; idx > 0; idx--) {
			let pos = Math.floor(Math.random() * (idx + 1));
			[deck[idx], deck[pos]] = [deck[pos], deck[idx]];
		}
		console.log(deck);
		//Deal to 4 hands and order
		const hands = [];
		for (let idx = 0; idx < 4; idx++) {
			const hand = deck.splice(0, 13).sort((a, b) => {
				return a.suit == b.suit ? rankValue(a.pip) - rankValue(b.pip) : a.suit - b.suit;
			});
			hands.push(hand);
		}
		//Return 4 hands
		return hands;
	}

	//Parser Methods
	processActionFromNetwork(cmd, args) {
		let action = "";
		if (cmd == `bid`) {
			if (args.length == 2) action = { trump: Number(args[0]), num: Number(args[1]) };
			else action = args[0];
			return bid(this, action);
		} else if (cmd == `trick`) {
			action = { suit: Number(args[0]), pip: Number(args[1]) };
			return trick(this, action);
		} else if (cmd == `concede`) {
			return concede(this, this.currentPlayer);
		}
		return { success: false, msg: `Unknown remote action: ${cmd}(${args.join(`,`)})` };
	}

	nextDeal() {
		if (this.state != this.gameStates.score || this.gameOver) return { success: false, msg: `You can't start a deal until this one is complete` };
		this.state = this.gameStates.bid;
		this.initialise();
		return { success: true, msg: `New deal started. Begin bidding!`, clear: true, game: this };
	}

	//Robot Methods
	robotAction() {
		const plr = this.players[this.currentPlayer];
		if (plr instanceof RealPlayer) return null; // player is human

		switch (this.state) {
			case this.gameStates.bid:
				return plr.bid(this);
			case this.gameStates.trick:
				return plr.trick(this);
		}

		return null;
	}

	//Serialisable output
	exportState() {
		return {
			state: this.state,
			currentPlayer: this.currentPlayer,
			me: this.playable,
			declarer: this.declarer,
			dummy: this.dummy,
			deal: this.currentDeal,
			tricksWon: this.tricksWon,
			hands: this.players.map((p) =>
				p.hand.map((c) => ({
					suit: c.suit,
					pip: c.pip,
					name: c.toString(),
				}))
			),
			scores: this.pairs.map((p) => p.score),
		};
	}

	//Player setup
	newPlayerAvatars() {
		this.playerAvatars = [];
		for (let idx = 0; idx < 4; idx++) {
			let player = { name: ``, avatar: -1 };

			player.avatar = Math.floor(Math.random() * 4);

			const pool = namePool[player.avatar];
			const adj = pool.adj[Math.floor(Math.random() * pool.adj.length)];
			const noun = pool.noun[Math.floor(Math.random() * pool.noun.length)];
			const num = Math.floor(Math.random() * 99);
			player.name = `${adj}${noun}${num}`;

			this.playerAvatars.push(player);
		}
	}

	//Helper Methods
	getPairIndex(plrId) {
		return [0, 2].includes(plrId) ? 0 : 1;
	}
	createScore() {
		return { below: [0, 0, 0], above: 0, penalty: 0, bonus: 0 };
	}
}

function concede(game, player) {
	game.gameOver = true;
	//Identify who concedes and who benefits
	const concedingPair = game.getPairIndex(player);
	const winningPair = 1 - concedingPair;

	//Tally remaining tricks as won by opponents
	const remainingTricks = 13 - game.tricksAmount;
	game.tricksWon[winningPair] += remainingTricks;

	//Finalise score
	const scoring = addScore(game, game.currentDeal, game.tricksWon[game.getPairIndex(game.declarer)]);

	//Change game state
	scoring.game.state = game.gameStates.score;

	return {
		success: true,
		msg: `Pair ${winningPair + 1} has claimed the remaining ${remainingTricks} tricks and won the score by concession.\n${scoring.txt}`,
		game: scoring.game,
		clear: true,
	};
}

const namePool = {
	0: {
		//King
		adj: ["Grand", "Iron", "Golden", "Stout", "Crimson"],
		noun: ["Crown", "Sceptre", "Throne", "Banner", "Hammer"],
	},
	1: {
		//Queen
		adj: ["Silver", "Velvet", "Scarlet", "Silent", "Emerald"],
		noun: ["Rose", "Lace", "Moon", "Crown", "Mirror"],
	},
	2: {
		//Pauper
		adj: ["Dusty", "Hungry", "Patchy", "Crooked", "Rusty"],
		noun: ["Sock", "Boot", "Bowl", "Spoon", "Rat"],
	},
	3: {
		//Joker
		adj: ["Mad", "Wild", "Sneaky", "Twisty", "Baffled"],
		noun: ["Banana", "Card", "Dice", "Goose", "Duck"],
	},
};

export { doubleTxt, Game, nextTurn, rankValue, suits };

/*
Issues:
3 players fixed by changing from do-while to while
fisher yates shuffle wrong - shouldn't go idx 0-length and set j to random(0-length) should be length-0 and j is random(0-idx+1)
Added dummy
Added Heuristic opponents
Errors and todos
-/ Dummy doesn't show sometimes on first trick or just after a trick - fixed via making another dummy draw check
-/ Score doesn't show - fixed but idk how lol
-/ next() doesn't work - fixed by removing a guard clause
-/ Show player's card on bid - not working when player 2 starts and probably others - fixed by adding first turn

-/ Shouldn't show dummy after deal is done - very simple fix just set dummy to if deal is not done
-/ Swap Src and Public folder - serve public not src
-/ Move all public (global) functions and variables from game.js into the game class to limit global clutter and neaten code - so robotAction, processAction and gamestates

-/ Dummy's hand appears twice if player was dummy - fixed by setting dummy to player != dummy
-/ only 3 players play - all four play they just don't get a chance to report it before the next trick starts

-? Heurstic origninally had this problematc output Heuristic 1 — HCP:NaN, Dist:NaN, AdjPts:NaN, Shape:4,3,3,3, Long:0 - fixed by setting them to results of maps || 0
*/
