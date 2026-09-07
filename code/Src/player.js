/*
	player.js
	Contains the player class and its variants
	exports { RealPlayer, RandomPlayer, HeuristicPlayer }
*/

//Imports
import { rankValue } from "./game.js";

//Parent class
class Player {
	constructor(id) {
		this.id = id;
		this.hand = [];
	}

	bid() {
		throw new Error(`bid() not implemented for base Player`);
	}

	trick() {
		throw new Error(`trick() not implemented for base Player`);
	}

	observeSignal() {
		throw new Error(`observeSignal() not implemented for base Player`);
	}
}

//Sub class - for multiplayer and real players
class RealPlayer extends Player {
	constructor(id) {
		super(id);
	}

	//Bid returns action said player wants to do
	//Real players will return null as the server needs to wait for their action
	bid() {
		return null;
	}

	//Trick returns action said player wants to do
	//Real players will return null as the server needs to wait for their action
	trick() {
		return null;
	}
}

//Difficulty -1 - totally random but legal plays
class RandomPlayer extends Player {
	constructor(id) {
		super(id);
	}

	//Bid returns action said player wants to do
	//Random players will return to pass if they aren't the dealer - if they are then they'll make a random bid
	bid(game) {
		//Checks if there is a prior bid and if so will pass
		if (game.currentDeal.trump != null) return `bid(pass)`;

		//There is no prior deal thus will open
		const trump = Math.floor(Math.random() * 5); // 0-4
		const num = Math.floor(Math.random() * 7) + 1; // 1-7

		//Will return their deal
		return `bid(${trump},${num})`;
	}

	//Trick returns action said player wants to do
	//Random players will find any card they can legaly play and return it
	trick(game) {
		const legalCard =
			this.hand.find((c) => c.suit == game.leadSuit) || // lead suit
			this.hand.find((c) => c.suit == game.currentDeal.trump) || // trump suit
			this.hand[0]; // other
		//Return their legal card
		return `trick(${legalCard.suit},${legalCard.pip})`;
	}

	// //Observe a card to infer a meaning
	// //Random players don't have memory so just return null
	// observeSignal() {
	// 	return null;
	// }
}

//Difficulty 0-2 - not the best robot opponent but makes a good enough guess
class HeuristicPlayer extends Player {
	constructor(id, difficulty = 2, aggression = 0.5, supportiveness = 0.5, riskAversion = 0.5) {
		super(id);
		//Controls how the player behaves and their general skill
		this.difficulty = difficulty;
		this.personality = { aggression, supportiveness, riskAversion };
		this.signalMemory = {}; // {playerId: {suit: +1 (like) / -1 (dislike)}}
		this.projectedTricks = 0;
		this.hasConceded = false;
	}

	//Bid returns action said player wants to do
	//Heuristic players will return the best bid that they can according to their hand
	bid(game) {
		//Analyse Hand
		const { hcp, suitLength, distributionalPoints } = this.evaluateHand();
		const totalPoints = hcp + distributionalPoints;

		const longestSuit = suitLength.indexOf(Math.max(...suitLength));
		const shapeSignature = [...suitLength].sort((a, b) => b - a).join(`,`);
		const balancedShapes = [`4,3,3,3`, `4,4,3,2`, `5,3,3,2`];
		const isBalanced = balancedShapes.includes(shapeSignature);

		//Bidding context
		const partnerId = (this.id + 2) % 4;
		const partnerIsDeclarer = game.declarer == partnerId;

		const { num: currentLevel, trump: currentTrump, doubled } = game.currentDeal;
		const noBidsYet = currentTrump == null;

		// const nextLevel = currentLevel + 1;

		//Bid legality check
		// if (nextLevel > 7) return `bid(pass)`;

		//Difficulty & personality adjustments
		// - beginners have more uncertain estimations - more noise
		const noise = this.noiseForDifficulty();

		//Personality nudges
		const { aggression: aggr, riskAversion: risk, supportiveness: support } = this.personality;
		const adjustedPoints = totalPoints + noise + (aggr - risk) * 2;

		//Use trump index for projected tricks
		const trumpIndexForEstimate = noBidsYet || currentTrump == 4 ? longestSuit : currentTrump;

		//Simple trick projection & winnability
		//Rough estimate - 6 default plus HCP/3 plus 0.3 per card baring 4 cards - then rounded to 1dp
		this.projectedTricks = this.estimateTricks(adjustedPoints, suitLength[trumpIndexForEstimate]);

		const safeFor = (target) => {
			const margin = risk * 0.6 - aggr * 0.4; //Risk increases margin, aggression reduces it
			return this.projectedTricks + margin >= target + 6.5 && target < 8;
		};
		// const safetyMargin = risk * 0.6 - aggr * 0.4;
		// const safeForLevel = (targetLevel) =>

		//Bidding Logic

		//Opener
		if (noBidsYet) {
			if (adjustedPoints < 10) return `bid(pass)`;

			//Balanced 15-17 -> 1NT
			if (isBalanced && hcp > 14 && hcp < 18) return `bid(4,1)`;

			//Strong suit 13-19pts
			if (adjustedPoints > 12 && adjustedPoints < 20) return `bid(${longestSuit},1)`;

			//Preemptive weak 6-10pts & 6+ card suit
			if (hcp < 11 && suitLength[longestSuit] > 5 && Math.random() < 0.5 + aggr * 0.5) return `bid(${longestSuit},2)`;

			//Very strong 20+pts -> placeholder
			if (adjustedPoints > 19) return `bid(${longestSuit},2)`;

			return `bid(pass)`;
		}

		///Consider double/redouble
		if (!partnerIsDeclarer) {
			const opponentsLikelyMake = this.projectedTricks >= currentLevel + 6 - 0.8;
			if (!opponentsLikelyMake && adjustedPoints > 15 && Math.random() < 0.2 + aggr * 0.6 && game.currentDeal.doubled == 0) return `bid(double)`;
		} else if (game.currentDeal.doubled == 1 && adjustedPoints > 12) {
			if (Math.random() < 0.2 + aggr * 0.5) return `bid(double)`;
		}

		//Responder
		if (partnerIsDeclarer) {
			//check fit
			const fit = suitLength[currentTrump] > 2;

			if (fit) {
				//Simple raise
				if (adjustedPoints > 5 && adjustedPoints < 10 && safeFor(currentLevel + 1)) return `bid(${currentTrump},${currentLevel + 1})`;

				//Jump raise
				if (adjustedPoints > 9 && safeFor(currentLevel + 2)) return `bid(${currentTrump},${currentLevel + 2})`;

				//If suuportive but marginal points - could raise
				if (support > 0.7 && adjustedPoints > 4 && Math.random() < support * 0.4 && safeFor(currentLevel + 1)) return `bid(${currentTrump},${currentLevel + 1})`;
			}

			//NT
			if (!fit && isBalanced && adjustedPoints > 13 && safeFor(currentLevel)) return `bid(4,${currentLevel})`;

			return `bid(pass)`;
		}

		//Over-calller
		if (!partnerIsDeclarer) {
			//Overcall if strong and long suit
			if (adjustedPoints > 14 && suitLength[longestSuit] > 4) {
				//If aggressive stretch to overcall even if marginal
				if (aggr > 0.6 && Math.random() < aggr * 0.5 && safeFor(currentLevel + 1)) return `bid(${longestSuit},${currentLevel + 1})`;
			}
		}

		return `bid(pass)`;
	}

	//Trick returns action said player wants to do
	//Heuristic players will return the best card that they can legally play based on their hand and prior cards played
	trick(game) {
		//Suit awareness
		const trumpSuit = game.currentDeal.trump;
		const leadSuit = game.leadSuit;
		const isLeader = leadSuit == null;

		//Hand awareness
		const handSorted = [...this.hand].sort((a, b) => rankValue(b.pip) - rankValue(a.pip));
		const cardsBySuit = {
			follow: handSorted.filter((c) => c.suit == leadSuit),
			trump: handSorted.filter((c) => c.suit == trumpSuit),
			off: handSorted.filter((c) => c.suit != leadSuit && c.suit != trumpSuit),
		};

		this.suitLength = this.evaluateHand().suitLength;

		//Self awareness
		const persona = this.adjustPersonality(game);

		if (isLeader) return this.leadCard();

		// Following suit
		if (cardsBySuit.follow.length > 0) {
			return this.followSuit(game, cardsBySuit, persona);
		}

		// Ruffing / trumping
		if (cardsBySuit.trump.length > 0 && trumpSuit != 4) {
			return this.ruff(game, cardsBySuit, persona);
		}

		// Discard
		return this.discard(cardsBySuit);
	}
	//General Helper
	evaluateHand() {
		let hcp = 0;
		let suitLength = [0, 0, 0, 0];
		let distributionalPoints = 0;

		//Point maps
		const hcpMap = { 1: 4, 13: 3, 12: 2, 11: 1 }; //A,K,Q,J
		const distributionalMap = { 0: 3, 1: 2, 2: 1 }; //Void, Singleton, Doubleton

		//Count points

		//Loops through cards of hand
		for (let card of this.hand) {
			//Calculate HCP value of hand
			hcp += hcpMap[card.pip] || 0;

			//Calculate length of each suit
			suitLength[card.suit]++;
		}

		//Loops through the suits
		for (let length of suitLength) {
			//Calculates the distributional points
			distributionalPoints += distributionalMap[length] || 0;
		}

		return { hcp, suitLength, distributionalPoints };
	}

	//BIDDING helpers
	noiseForDifficulty() {
		let noise = 0;
		if (this.difficulty == 0) noise = Math.random() * 4 - 2; //-2 -> 2
		if (this.difficulty == 1) noise = Math.random() * 2 - 1; //-1 -> 1
		return noise;
	}
	estimateTricks(adjustedPoints, suitLength) {
		return Math.round((6 + adjustedPoints / 3 + (suitLength - 4) * 0.3) * 10) / 10;
	}

	//TRICK
	adjustPersonality(game) {
		let { aggression: aggr, riskAversion: risk } = this.personality;
		const progress = game.tricksAmount / 13;
		const fatigue = progress * 0.01; //Raise agression and lower caution in time
		aggr = Math.min(1, aggr + fatigue);
		risk = Math.max(0, risk - fatigue);
		return { aggr, risk };
	}
	//Trick Functions
	leadCard() {
		const suitLen = this.suitLength;

		let suitChoice = suitLen.indexOf(Math.max(...suitLen));

		//Fall back if empty
		let options = this.hand.filter((c) => c.suit == suitChoice);
		if (options.length == 0) options = this.hand;

		const card = this.hasConceded ? options[0] : options.at(-1);
		return `trick(${card.suit},${card.pip})`;
	}
	followSuit(game, cards, persona) {
		const { follow } = cards;
		const lead = game.leadSuit;

		const highestLead = this.highestOnTable(game, lead);
		const canWin = follow.some((c) => rankValue(c.pip) > rankValue(highestLead));

		const wants = Math.random() < 0.3 + persona.aggr * 0.5;
		const card = this.hasConceded ? follow[0] : canWin && wants ? follow.find((c) => rankValue(c.pip) > rankValue(highestLead)) : follow.at(-1);

		return `trick(${lead},${card.pip})`;
	}
	ruff(game, cards, persona) {
		const { trump } = game.currentDeal;
		const { trump: trumpCards } = cards;

		const highestTrump = this.highestOnTable(game, trump);
		const overTrumps = trumpCards.filter((c) => rankValue(c.pip) > rankValue(highestTrump));

		const bold = Math.random() < 0.4 + persona.aggr * 0.4 - persona.risk * 0.3;

		const chosen = this.hasConceded ? trumpCards[0] : overTrumps.length > 0 ? overTrumps.at(-1) : bold ? trumpCards[0] : trumpCards.at(-1);

		return `trick(${chosen.suit},${chosen.pip})`;
	}
	discard(cards) {
		const { off } = cards;
		const playable = off.length > 0 ? off : this.hand;
		const chosen = this.hasConceded ? playable[0] : playable.at(-1);
		return `trick(${chosen.suit},${chosen.pip})`;
	}

	highestOnTable(game, suit) {
		return game.currentTrick
			.filter((c) => c.card.sui == suit)
			.reduce((best, cur) => (rankValue(cur.card.pip) > rankValue(best.card.pip) ? cur : best), {
				card: { pip: 0 },
			}).card.pip;
	}
}

export { HeuristicPlayer, RandomPlayer, RealPlayer };
