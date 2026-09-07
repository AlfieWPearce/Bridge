/** @format */

//Helper Functions
const formatContract = (suit, num, dbl) => `${num}${SUITS[suit]}${DOUBLES[dbl] ?? ""}`;

// Draws the Canvas - whilst in the game state
function drawGame() {
	const isMobile = width < 600; //rough breakpoint for portrait screens

	//Sets some display variables based on the size of the screen and allowing for cross-platform displays
	updateDisplay(isMobile);

	//Draws Baize background
	drawBackground();

	//Draws the hands
	hands.draw(display.screen.cx, display.screen.cy);

	//Draws the centre
	centre.draw(isMobile, display.screen.cx, display.screen.cy);

	//Draws the edges of the table if too large of a monitor
	if (width > 1000) table.sides((width - 1000) / 2);
	if (height > 1100) table.bottom(height - 1100);

	//Draws the header
	drawHeader();

	//Simplifies if statements
	//Game's phase
	const isAuction = app.data.phase == 1;
	const isTrick = app.data.phase == 2;
	const isResults = app.data.phase == 3;
	//Viewport size
	const narrow = width < 580;

	//Draws auction table
	if (isAuction) bid.draw(display.screen.cx, display.screen.cy - 50);

	//Draws the scoresheet
	const scoreSheetSize = display.scoreSheetSize;
	const scoreSheetSizeModifier = display.scoreSheetSizeModifier;
	//Draws scoresheet during a trick
	if (isTrick && !narrow) score.draw(display.screen.cx + display.screen.size.w / 2 - scoreSheetSize[0] * scoreSheetSizeModifier * 0.5, display.screen.size.h - scoreSheetSize[1] * scoreSheetSizeModifier * 0.5, scoreSheetSize[0] * scoreSheetSizeModifier, scoreSheetSize[1] * scoreSheetSizeModifier);
	//Draws scoresheet after a trick
	if (isResults) score.draw(display.screen.cx, display.screen.cy, scoreSheetSize[0], scoreSheetSize[1]);
}
//Updates some display variables to allow for resizing screen and cross-platform
function updateDisplay(isMobile) {
	//Updates size of cards
	display.cardScalePlayer = isMobile ? 3 : 3.5;
	display.cardScaleOpponent = isMobile ? 1.5 : 2;
	display.cardScaleBid = 3;
	//Update angle of fan of card
	display.fanAngle = PI / (isMobile ? 4 : 3);
	//Sets values about the screen eg the centre of the screen
	display.screen = {
		size: { w: min(1000, width), h: min(1100, height) },
		cx: width / 2,
		cy: min(1100, height) / 2,
	};
	//Calculates the distance from the centre to each hand
	const cardH = display.cardSize[1] * display.cardScaleOpponent;
	display.centreDist = isMobile ? [(display.screen.size.w - cardH) / 2, (display.screen.size.h - cardH) / 2 - 22] : [min(250, display.screen.size.w / 3), min(346, display.screen.size.h / 2.5)];
}
//Draws the Baize background pattern
function drawBackground(w = 64, h = 64) {
	//Background is split up into square cells which are looped through
	for (let x = 0; x < width + w / 2; x += w) {
		for (let y = 0; y < height + h / 2; y += h) {
			//Draw the baize pattern in each cell
			image(spriteSheet, x, y, w, h, 416, 160, 32, 32);
		}
	}
}
//Draws the header - which displays data and buttons - eventually
function drawHeader() {
	rectMode(CENTER);
	noStroke();

	//Bottom Border
	fill(70, 40, 0);
	rect(width / 2, 20, width + 20, 105);

	//Main fill
	fill(100, 60, 0);
	rect(width / 2, 20, width + 20, 75);

	//Current Deal
	if (!app.data.currentDeal) return; //Guard clause if no deal currently
	ellipseMode(CENTER);
	textAlign(CENTER);
	textSize(50);

	//Simplifies output code
	const trumpSuit = app.data.currentDeal.trump;
	const contract = formatContract(trumpSuit, app.data.currentDeal.num, app.data.currentDeal.doubled);

	const isAuction = app.data.phase == 0;

	const [x, y] = [width / 2, 10];
	const w = app.data.currentDeal ? max(120, textWidth(contract)) : 120;

	//Cuurent Trick counter background
	fill(200, !isAuction ? 150 : 0);
	rect(x, y + 10, w * 2.5, 75, 20);

	//Current Deal
	//Background
	fill(120, 80, 0);
	ellipse(x, y, w + 30, w + 25);
	//Text
	fill(0);
	text(contract, x, 32);

	textAlign(CENTER);

	//Currrent Trick Counter
	if (app.data.phase < 2) return;
	const dist = 50;
	const tricksNeeded = app.data.currentDeal.num + 6;

	//North & South pair
	const nsColour = app.data.me % 2 == 0 ? display.myColour : display.oppColour;
	//Heading text
	textSize(25);
	fill(nsColour);
	text(`N-S`, x - w / 2 - dist, 15);
	//Scores test
	textSize(30);
	text(`${app.data.tricksWon[0]}/${app.data.declarer % 2 == 0 ? tricksNeeded : 14 - tricksNeeded}`, x - w / 2 - (dist / 5) * 4, 40);

	//East & West Pair
	const ewColour = app.data.me % 2 == 1 ? display.myColour : display.oppColour;
	//Heading text
	textSize(25);
	fill(ewColour);
	text(`E-W`, x + w / 2 + dist, 15);
	//Scores test
	textSize(30);
	text(`${app.data.tricksWon[1]}/${app.data.declarer % 2 == 1 ? tricksNeeded : 14 - tricksNeeded}`, x + w / 2 + (dist / 5) * 4, 40);

	textAlign(CENTER);
}
//Draws table edges
const table = {
	//Side edges - if width is large
	sides: (edgeWidth) => {
		rectMode(CENTER);

		noStroke();
		fill(100, 60, 0);
		rect(0, height / 2, edgeWidth * 2, height); //Left
		rect(width, height / 2, edgeWidth * 2, height); //Right
	},
	//Bottom edge - if height is large
	bottom: (edgeHeight) => {
		rectMode(CENTER);

		noStroke();
		fill(100, 60, 0);
		rect(width / 2, height, width, edgeHeight);
	},
};
//Draws players' hands
const hands = {
	//Main - draws the hands
	draw: (cx, cy) => {
		clickableCards = []; //Array of cards that can be clicked

		//List of positions (meta data about each hand's fanning)
		const positions = [
			{ x: cx, y: cy + display.centreDist[1] - 20, type: `fan`, angle: 0 }, //S
			{ x: cx - display.centreDist[0], y: cy, type: `stack`, angle: -HALF_PI }, //W
			{ x: cx, y: cy - display.centreDist[1] + 50, type: `stack`, angle: 0 }, //N
			{ x: cx + display.centreDist[0], y: cy, type: `stack`, angle: HALF_PI }, //E
		];

		//Rotates the positions array
		const rotated = hands.rotate(positions, app.data.me);

		//Loops through the seats
		for (let seat = 0; seat < 4; seat++) {
			const pos = rotated[seat];
			if (!pos) continue; //No pos (error probably)
			const hand = hands.find(seat);
			if (app.data.handLengths[seat] == 0) continue; //Empty
			if (!hand || hand == null) continue; //No hand (error probably)

			//Draws main player's hand
			if (pos.type == `fan`) hands.fan(hand, pos);
			//Draws other players' hands
			else hands.stack(seat, hand, pos);
		}
	},
	//Rotates array so every player's is to their south
	rotate: (array, shift) => {
		const n = array.length;
		const result = [];
		//Loops through arrays
		for (let idx = 0; idx < 4; idx++) {
			let shiftedIdx = (idx - shift + 4) % n;
			if (shiftedIdx == -1) shiftedIdx = n - 1;
			result.push(array[shiftedIdx]);
		}
		return result;
	},
	//Returns with the hand - having had the seat index
	find: (seat) => {
		//Player
		if (seat === app.data.me) return app.data.currentHand;
		//Dummy
		const isAuction = app.data.phase == 1;
		if (seat === app.data.dummyPlr && !isAuction) return app.data.dummyHand;
		//All else
		return Array.from({ length: app.data.handLengths[seat] }, () => ({ pip: 0, suit: 0 }));
	},
	//Draws player hand (south)
	fan: (hand, position) => {
		//(Has to be a playable hand - only the players)

		const total = hand.length;

		//Only one card
		if (total == 1) {
			const { x, y, angle } = position;
			const { pip, suit } = hand[0];

			hands.oneCard(0, {
				x,
				y,
				angle,
				scale: display.cardScalePlayer,
				pip,
				suit,
			});
			return;
		}

		//Sets values for how the fan will look
		const spread = map(total, 1, 13, 0, display.fanAngle); //fan angle
		const xRadius = 350; //Curvature Radii
		const yRadius = 300;
		//Loops through cards
		for (let idx = 0; idx < total; idx++) {
			//Gets angle and positions
			const theta = map(idx, 0, total - 1, -spread / 2, spread / 2);
			const x = position.x + sin(theta) * xRadius;
			const y = position.y - cos(theta) * yRadius + yRadius;
			//Creates card
			const c = new Card(hand[idx].pip, hand[idx].suit, true, x, y, position.angle + theta, display.cardScalePlayer);
			//Adds card to clickable list
			clickableCards.push(c);
			//Draws card
			c.draw();
		}
	},
	//Draws all other hands
	stack: (seat, hand, position) => {
		const total = hand.length;

		//Only one card
		if (total == 1) {
			const { x, y, angle } = position;
			const { pip, suit } = hand[0];

			hands.oneCard(seat, {
				x,
				y,
				angle,
				scale: display.cardScaleOpponent,
				pip,
				suit,
			});
			return;
		}

		//Sets values for how the stack will look
		const spread = map(total, 1, 13, 0, 300);
		//Loops through cards
		for (let idx = 0; idx < total; idx++) {
			//Gets position of card
			const delta = map(idx, 0, total - 1, -spread / 2, spread / 2);
			const x = position.x + cos(position.angle) * delta;
			const y = position.y + sin(position.angle) * delta;
			//Creates card
			const c = new Card(hand[idx].pip, hand[idx].suit, hand[idx].pip != 0, x, y, position.angle, display.cardScaleOpponent);
			//If dummy then adds card to clickable list
			if (seat == app.data.dummyPlr && seat == 2) clickableCards.push(c);
			//Draws card
			c.draw();
		}
	},
	//Draws hand - when only one card in said hand
	oneCard: (seat, card) => {
		//Creates new card
		const c = new Card(card.pip, card.suit, card.pip != 0, card.x, card.y, card.angle, card.scale);
		//If card is for seat 0 (player) or dummy (2 - playable by player) then add to clickable
		if ((seat == app.data.dummyPlr && seat == 2) || seat == 0) clickableCards.push(c);
		//Draw card
		c.draw();
	},
};
//Draws the cetral area of the table
const centre = {
	//Main - draws the centre
	draw: (isMobile, cx, cy) => {
		//Avatar & Names
		centre.avatar(isMobile, cx, cy);

		//Current Trick
		//Stops if there is no trick
		if (!app.data.currentTrick) return;
		//Loops through al of the cards currently played
		for (let idx = 0; idx < app.data.currentTrick.length; idx++) {
			//Displays said card
			centre.trick(idx, cx, cy);
		}
	},
	//Displays the avatar images and name texts and current player
	avatar: (isMobile, cx, cy) => {
		noFill();
		strokeWeight(6);
		//Distance from hands to positions
		const yPos = 120;
		const xPos = 75;
		//Mobile main-direction offset
		const offset = isMobile ? 10 : 0;
		//Mobile sub-direction offset
		const offset2 = offset + isMobile ? 15 : 0;
		//Calculates the positions and angles of the 4 players' avatars and names
		const avatarPos = [
			{ x: cx - display.centreDist[0] / 2 - offset2, y: cy + display.centreDist[1] - yPos + offset, left: false, angle: 0 }, //S
			{ x: cx - display.centreDist[0] + xPos - offset, y: cy - display.centreDist[1] / 2 - offset2, left: true, angle: -PI / 2 }, //W
			{ x: cx + display.centreDist[0] / 2 + offset2, y: cy - display.centreDist[1] + yPos - offset, left: true, angle: 0 }, //N
			{ x: cx + display.centreDist[0] - xPos + offset, y: cy + display.centreDist[1] / 2 + offset2, left: true, angle: PI / 2 }, //E
		];
		//Calculates who the current player is based on this player being south
		const relativeCurrentPlayer = (app.data.currentPlayer - app.data.me + 4) % 4;
		//Calculates the colours of the 4 avatars and names
		const nsColour = app.data.me % 2 == 0 ? display.myColour : display.oppColour;
		const ewColour = app.data.me % 2 == 1 ? display.myColour : display.oppColour;

		//Loops through each seat
		avatarPos.forEach((pos, seat) => {
			//Calculates who they actually are
			const relativeSeat = (seat + app.data.me + 4) % 4;
			const player = app.data.playerAvatars[relativeSeat];

			//Positions avatar and name
			push();
			translate(pos.x, pos.y);
			rotate(pos.angle); //Rotates for both avatar and name

			//Avatar
			//Highlight active player
			stroke(seat == relativeCurrentPlayer ? [212, 175, 55] : [0, 0]);
			ellipse(0, 0, 30);

			//Figures out this seat's colour
			const colour =
				relativeSeat % 2 == 0 //this pair is 0 or 2 then n/s else e/w
					? nsColour
					: ewColour;
			//Calculates the y position of the avatar (for the tile atlas)
			let sy = (player.avatar == 2 ? 3 : player.avatar == 3 ? 2 : player.avatar) * 16;
			//Changes positions if the seat is black
			if (colour === 0) sy += 4 * 16;
			//Draws the avatar
			image(spriteSheet, 0, 0, 30, 30, 464, sy, 16, 16);

			//Name
			noStroke();
			fill(colour);
			textSize(20);
			//Gets name to display
			const name = player.name;
			//Calculates the central positon of the name and thus the x location from the avatar's position
			const halfW = textWidth(name) / 2;
			const padding = 20;
			let x = (pos.left ? -1 : 1) * (halfW + padding);
			//Draws name
			text(name, x, 0);

			pop();
		});
	},
	//Displays a card in the centre
	trick: (idx, cx, cy) => {
		//Figures which card to display
		const card = app.data.currentTrick[idx].card;
		if (!card) return; //Skip empty slots if they exist (shouldn't but just in case)

		//Global index of the player who played this card
		const globalIdx = app.data.currentTrick[idx].player;
		//Relative to the viewer's PoV
		const relativeIdx = (globalIdx - app.data.me + 4) % 4;

		//Calculates the sizing of the cards
		const w = display.cardSize[0] * display.cardScalePlayer;
		const h = display.cardSize[1] * display.cardScalePlayer;
		//Offset by seat
		const ySpacing = h / 2;
		const xSpacing = 0;

		//Base positions - centre of the screen
		let x = cx;
		let y = cy;

		//Calculates final positions based on which seat played it
		switch (relativeIdx) {
			case 0:
				y += ySpacing;
				x += (xSpacing / 3) * 2;
				break; //S
			case 1:
				x -= ySpacing;
				y += (xSpacing / 3) * 2;
				break; //W
			case 2:
				y -= ySpacing;
				x -= (xSpacing / 3) * 2;
				break; //N
			case 3:
				x += ySpacing;
				y -= (xSpacing / 3) * 2;
				break; //E
		}

		push();
		translate(x, y);
		rotate(relativeIdx * HALF_PI); //90* per seat

		//Calculates where in the tile atlas the card is
		const sx = display.cardSize[0] * (card.pip - 1);
		const sy = display.cardSize[1] * card.suit;
		//Displays said card
		image(spriteSheet, 0, 0, w, h, sx, sy, display.cardSize[0], display.cardSize[1]);

		pop();
	},
};
//Draws the auction (bid) table
const bid = {
	//List of buttons for the bid table
	buttons: [],
	//Main - draws the table
	draw: (cx, cy) => {
		stroke(0);
		strokeWeight(1);

		//Background
		fill(50);
		rect(cx, cy, display.cardSizeBid[0] * display.cardScaleBid * 8, 440, 20);

		bid.drawButtons(cx, cy);
		bid.drawButtonCover(cx);

		bid.drawPastBids(cx, cy + 50); //50 is the offset for the whole table
	},
	//Display and create the buttons for the different bidding actions
	drawButtons: (cx, cy) => {
		//Calculates the top of the buttons (due to padding)
		const top = cy - 180;
		//Calculates the distance between buttons
		const seperation = display.cardSizeBid[0] * display.cardScaleBid * 1.4;
		//Resets button list
		bid.buttons = [];
		//Loops through all suits (0.4)
		for (let idx = 0; idx < 5; idx++) {
			//Calculates the x position of said column
			const x = cx - 2 * seperation + idx * seperation;
			//Loops through all values (1..6)
			for (let yIdx = 0; yIdx < 7; yIdx++) {
				//Calculates size of button
				const w = display.cardSizeBid[0] * display.cardScaleBid;
				const h = display.cardSizeBid[1] * display.cardScaleBid;
				//Calculates y position of said row
				const y = top + yIdx * h;
				//Calcualtes the position of the button in the tile atlas
				const sx = 416 + idx * display.cardSizeBid[0];
				const sy = 48 + yIdx * display.cardSizeBid[1];

				//Store data for clicking
				bid.buttons.push({ x, y, w, h, suit: suit.toServerSide(idx), value: yIdx + 1 });
				//Draws the button
				image(spriteSheet, x, y, w, h, sx, sy, display.cardSizeBid[0], display.cardSizeBid[1]);
				//Hover Animation
				if (isHovering({ x: mouseX, y: mouseY }, { x, y, w, h })) {
					//if the mouse is hovering the button
					//If can't bid said value then skip it
					if (app.data.currentDeal && app.data.currentDeal.num >= yIdx + 1) continue;
					//Display highlight rectangle
					noStroke();
					fill(50, 150);
					rect(x - 1, y - 1, w + 2, h + 2);
				}
			}
		}
	},
	//Covering up impossible buttons
	drawButtonCover: (cx) => {
		//Checks if there is a current deal
		if (!app.data.currentDeal || app.data.currentDeal.trump === null) return;

		fill(50, 150);
		noStroke();
		//Get position of a rectangle thatt will cover all unplayable buttons
		const w = display.cardSizeBid[0] * display.cardScaleBid * 7.5;
		const h = display.cardSizeBid[1] * display.cardScaleBid * app.data.currentDeal.num;
		//And position
		const y = top + h / 2 - (display.cardSizeBid[1] * display.cardScaleBid) / 2;
		//Display said rectangle
		rect(cx, y, w, h);
	},
	//Display us to 4 past bids
	drawPastBids: (cx, cy) => {
		//Loop through all (up to one each) current bids played this round
		app.data.bid.forEach((bid, idx) => {
			//If there is no bid then end (shouldn't happen but just in case)
			if (!bid) return;
			//Calculates the relative seat
			const relSeat = (idx - app.data.me + 4) % 4;
			//Sets starting positions
			let [x, y] = [cx, cy];
			//Set new position based on what seat it is
			switch (relSeat) {
				case 0:
					y += display.centreDist[1];
					break; //You
				case 1:
					x -= display.centreDist[0];
					break; //Left
				case 2:
					y -= display.centreDist[1] - 50;
					break; //Opposite
				case 3:
					x += display.centreDist[0];
					break; //Right
			}
			//The text to display
			const txt = typeof bid == `object` ? `${bid.num}${SUITS[bid.trump]}${DOUBLES[bid.doubled]}` : `${bid}`;

			textSize(20);
			//Calculates the width of the text to display + padding size
			const w = textWidth(txt) + 20;

			//Draws background
			strokeWeight(1);
			stroke(0);
			fill(50, 150);
			rect(x, y, w, 30, 10);

			//Draws the text
			noStroke();
			fill(255);
			text(txt, x, y);
		});
	},
};
//Draws the scorecard
const score = {
	//Main - draws the scorecard
	draw: (cx, cy, w, h) => {
		//Calculates and setsthe size of the text
		const txtSize = h * 0.05;
		textSize(txtSize);

		//Calculates the centre of both columns
		const leftCentre = cx - w / 4;
		const rightCentre = cx + w / 4;

		//displays the background
		score.drawBackground(cx, cy, w, h, { we: leftCentre, they: rightCentre }, txtSize);

		//Sets variables to simplify later code
		const { metadata, rounds } = app.data.score;
		const { gameLines, rubberOver } = metadata;
		//Calculates which pair this user is a part of
		const pair = app.data.me % 2;
		//Calculates what x side they are and their opp is on
		const x = pair == 0 ? { we: leftCentre, they: rightCentre } : { they: leftCentre, we: rightCentre };

		const totals = score.drawRounds(cx, cy, w, h, x, rounds, gameLines);

		//Draw Totals
		text(totals.we, x.we, cy + h / 2 - 10);
		text(totals.they, x.they, cy + h / 2 - 10);

		//Displays end of the Rubber
		//Checks if the rubber is over
		if (rubberOver) {
			//Draws a RUBBER OVER text
			textSize(txtSize * 2);
			push();
			translate(cx, cy);
			rotate(PI / 4);
			text(`Rubber Over`, 0, 0);
			pop();
		}
	},
	//Displays the background
	drawBackground: (cx, cy, w, h, x) => {
		//Draws the background
		noStroke();
		fill(255, 255, 238);
		rect(cx, cy, w, h);

		//Draws the lines
		stroke(56, 59, 62);
		strokeWeight(1);
		//Draws the we / them seperator
		line(cx, cy - h / 2, cx, cy + h / 2);
		//Draws the horizontal lines - for above and below the lines
		line(cx - w / 2, cy, cx + w / 2, cy);

		//Draws the headers 'we' and 'they'
		textAlign(CENTER);
		noStroke();
		fill(56, 59, 62);
		text(`we`, x.we, cy - h / 2 + 10);
		text(`they`, x.they, cy - h / 2 + 10);
	},
	//Dsiplays the numbers for each round - points above and blow the line as well as penalties and totals
	drawRounds(cx, cy, w, h, x, rounds, gameLines, totals = [0, 0]) {
		//Sets default positions
		let yUnder = cy;
		let yOver = { we: cy, they: cy };
		let yPenalty = { we: cy - h / 2 + 20, they: cy - h / 2 + 20 };

		fill(56, 59, 62);
		//Loops through each round
		rounds.forEach((round, idx) => {
			//Sets which pair the declarer is on and which they are against
			const declarer = round.declarer;
			const side = declarer % 2;
			const opp = 1 - side;

			//Contract made - add points to declarer's side
			if (round.contractMade) {
				//Points under
				//Iterates position
				yUnder += 16;
				noStroke();
				//Draws the number of points under
				text(round.pointsUnder, x[declarer == 0 ? `we` : `they`], yUnder);
				//Adds to totals
				totals[side] += round.pointsUnder;

				//Draws gamelines - if one exists here
				if (gameLines.includes(idx + 1)) {
					stroke(56, 59, 62);
					strokeWeight(2);
					line(cx - w / 2, yUnder + 10, cx + w / 2, yUnder + 10);
					//Iterates position further
					yUnder += 20;
				}

				//Draws points above the line
				if (round.pointsAbove > 0) {
					//Iterates position
					yOver[declarer == 0 ? `we` : `they`] -= 16;
					noStroke();
					text(round.pointsAbove, x[declarer == 0 ? `we` : `they`], yOver[declarer == 0 ? `we` : `they`]);
					//Adds to totals
					totals[side] += round.pointsAbove;
				}

				//Contract not made - add penalty poitns to other side
			} else {
				//Penalty points
				yPenalty[opp == 0 ? `we` : `they`] += 16;
				noStroke();
				text(round.pointsPenalty, x[opp == 0 ? `we` : `they`], yPenalty[declarer == 0 ? `we` : `they`]);
				//Adds to totals
				totals[opp] += round.pointsPenalty;
			}
		});
		//Return totals to be displayed
		return totals;
	},
};
