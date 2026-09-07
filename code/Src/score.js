/*
	score.js
	Contains the logic for scoring
	exports { addScore, createScoreObject }
*/

//Global Variables
const trickValues = { 0: 30, 1: 30, 2: 20, 3: 30, 4: 30 };
let pointsThisGame = 0;

//Initialise a new score object
function createScoreObject() {
	pointsThisGame = 0;
	return {
		metadata: {
			rubberOver: false,
			gameLines: [],
			gamesWon: [0, 0],
		},
		rounds: [],
	};
}

/**
 * Calculate and apply the score for a completed contract
 *
 * @param {Game} game - The current game object
 * @param {object} deal - Contains num, trump, doubled
 * @param {number} tricks - Tricks made by the declarer
 * @returns {{ txt: string; game: object }}
 */
function addScore(game, deal, tricks) {
	const declaringPair = game.getPairIndex(game.declarer);
	const defendingPair = 1 - declaringPair;

	const score = game.pairs[declaringPair].score;
	const oppScore = game.pairs[defendingPair].score;

	const { num: level, trump, doubled } = deal;
	const required = 6 + level;
	const made = tricks >= required;
	const vulnerable = game.pairs[declaringPair].vulnerable;

	let txt = ``;

	//Prepare a round object for the score sheet
	const round = {
		declarer: game.declarer,
		contractMade: made,
		pointsUnder: 0,
		pointsAbove: 0,
		pointsPenalty: 0,
	};

	if (made) {
		const overtricks = tricks - required;

		//Base contract points
		const basePoints = contractPoints(level, trump, doubled);
		score.below[game.currentGame] += basePoints;
		round.pointsUnder = basePoints;

		//Overtricks and bonuses
		let overPoints = 0,
			bonuses = 0;
		if (overtricks > 0) {
			overPoints = overtrickPoints(overtricks, trump, doubled, vulnerable);
			score.above += overPoints;
			round.pointsAbove = overPoints;
		}

		//Small / grand slam bonuses
		if (doubled > 0) bonuses += 50 * doubled;

		if (level == 6) bonuses += vulnerable ? 750 : 500;
		if (level == 7) bonuses += vulnerable ? 1500 : 1000;
		score.bonus += bonuses;

		//Game completion check
		pointsThisGame += score.below[game.currentGame];
		if (pointsThisGame >= 100) {
			pointsThisGame = 0;
			game.currentGame++;
			game.pairs[declaringPair].vulnerable = true;

			//Add line
			game.score.metadata.gameLines.push(game.score.rounds.length + 1);

			//Mark game won
			game.score.metadata.gamesWon[game.declarer % 2]++;
		}

		//Rubber completion check
		const gamesWon = score.below.filter((v) => v >= 100).length;
		if (gamesWon >= 2) {
			game.gameOver = true;
			const rubberBonus = 700 + (vulnerable ? 500 : 0);
			score.bonus += rubberBonus;
			game.score.metadata.rubberOver = true;

			txt += `\nDeclarer pair wins the rubber! Bonus awarded.\n`;
		}

		game.pairs[declaringPair].score = score;
	} else {
		//Contract failed
		const undertricks = required - tricks;
		const penaltyPointsValue = penaltyPoints(undertricks, doubled, vulnerable);
		oppScore.penalty += penaltyPointsValue;
		round.pointsPenalty = penaltyPointsValue;

		game.pairs[defendingPair].score = oppScore;
	}

	game.score.rounds.push(round);

	return { txt, game };
}

//Base contract points - below-the-line
function contractPoints(level, trump, doubled) {
	let base = trump == 4 ? 40 + (level - 1) * 30 : trickValues[trump] * level;
	if (doubled > 0) base *= 2 * doubled;
	return base;
}

//Points for overtricks
function overtrickPoints(overtricks, trump, doubled, vulnerable) {
	if (doubled > 0) return overtricks * (vulnerable ? 2 : 1) * 100 * doubled;
	return overtricks * trickValues[trump];
}

//Points for failed contracts
function penaltyPoints(undertricks, doubled, vulnerable) {
	const base = doubled == 0 ? 50 : doubled == 1 ? (vulnerable ? 200 : 100) : vulnerable ? 400 : 200;
	return base * undertricks;
}

export { addScore, createScoreObject };
