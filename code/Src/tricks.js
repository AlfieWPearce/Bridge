/*
	tricks.js
	Contains the logic for a trick
	exports { trick }
*/

//Imports
import { nextTurn, rankValue } from "./game.js";
import { addScore } from "./score.js";

function trick(game, play) {
	if (game.state != game.gameStates.trick) return { success: false, msg: `Wrong state` };
	const player = game.players[game.currentPlayer];

	//Vallidate card ownership
	const cardIdx = player.hand.findIndex((c) => c.pip == play.pip && c.suit == play.suit);
	if (cardIdx == -1) return { success: false, msg: `You don't have that card` };

	//Enforce following suit
	if (game.leadSuit != null) {
		const canFollow = player.hand.some((c) => c.suit == game.leadSuit);
		if (canFollow && play.suit != game.leadSuit) return { success: false, msg: `You must follow suit if possible` };
	}

	//Play card
	const [card] = player.hand.splice(cardIdx, 1);
	game.currentTrick.push({ player: game.currentPlayer, card });

	//Set lead suit if first card
	if (game.leadSuit == null) game.leadSuit = card.suit;

	//Trick complete
	if (game.currentTrick.length == 4) {
		const winner = evaluateTrick(game.currentTrick, game.leadSuit, game.currentDeal.trump);
		let txt = `Player ${winner + 1} wins the trick\n`;

		//Score trick for pairs
		const declaringPairIdx = game.getPairIndex(game.declarer);
		const defendingPairIdx = 1 - declaringPairIdx;

		const pairWon = game.pairs[declaringPairIdx].players.some((p) => p.id == winner);
		if (pairWon) game.tricksWon[declaringPairIdx]++;
		else game.tricksWon[defendingPairIdx]++;

		//Set next turn
		game.currentPlayer = winner;
		game.currentTrick = [];
		game.leadSuit = null;

		//Advance trick count
		game.tricksAmount++;

		//Deal complete
		if (game.tricksAmount == 13) {
			game.state = game.gameStates.score;
			const result = addScore(game, game.currentDeal, game.tricksWon[declaringPairIdx], game.declarer);
			txt = result.txt;
			game = result.game;
		}
		return { success: true, scoreTxt: txt, msg: txt, clear: true, game, dummy: game.tricksAmount != 13 && game.currentPlayer != game.dummy };
	}
	//Trick not complete
	const prevPlayer = game.currentPlayer + 1;
	game.currentPlayer = nextTurn(game.currentPlayer);
	return { success: true, msg: `Player ${prevPlayer} plays ${card.toString()}`, game };
}

function evaluateTrick(trick, leadSuit, trumpSuit) {
	let best = trick[0];
	for (const play of trick) {
		const card = play.card;

		//Ignore irrelevant suits
		if (card.suit != trumpSuit && card.suit != leadSuit) continue;

		//Trump beats everything
		if (best.card.suit != trumpSuit && card.suit == trumpSuit) {
			best = play;
			continue;
		}

		//Higher card of same suit
		if (best.card.suit == card.suit && rankValue(card.pip) > rankValue(best.card.pip)) {
			best = play;
		}
	}

	return best.player;
}

export { trick };
