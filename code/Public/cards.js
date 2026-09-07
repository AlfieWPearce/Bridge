/*
	cards.js
	Contains the class which displays a card
*/

//Pixel size of card art
const cardSize = [32, 48];

//Every card is an instance of this class
class Card {
	constructor(pip, suit, faceUp, x, y, angle, scale) {
		//Sets basic values about the card and its visibility
		Object.assign(this, { pip, suit, faceUp, x, y, angle, scale });

		//Calculates the initial size of the card
		this.w = cardSize[0] * this.scale;
		this.h = cardSize[1] * this.scale;
	}
	//Draws the card
	draw() {
		push();
		translate(this.x, this.y);
		rotate(this.angle);

		//Calculates where the card is in the tile atlas
		const sx = this.faceUp ? (this.pip - 1) * cardSize[0] : 13 * cardSize[0];
		const sy = this.faceUp ? this.suit * cardSize[1] : 0;

		//Draws the image (the card)
		image(spriteSheet, 0, 0, this.w, this.h, sx, sy, cardSize[0], cardSize[1]);

		pop();
	}
}

/*
Could have added hover effect where when hover card expands and moves upwards
*/
