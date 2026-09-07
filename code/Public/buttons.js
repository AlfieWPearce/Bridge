/*
	buttons.js
	Contains the class to create and use buttons
*/

//All buttons will be a button instance
class Button {
	constructor(label, x, y, w, h, onClick, colour = [212, 175, 55], hover = [181, 146, 31], textColour = [36, 64, 52]) {
		//Sets basic values about location, colour, and functions
		Object.assign(this, { label, x, y, w, h, onClick, colour, hover, textColour });
		//Stores the state of animations
		this.anim = 0;
		this.scale = 1;
	}

	//Changes the current state of animations
	update() {
		const hovered = this.isHovered();
		this.anim = lerp(this.anim, hovered ? 1 : 0, 0.1);
		this.scale = 1 + this.anim * 0.08;
	}

	//Draws the button
	draw() {
		this.update();

		//Moves button to the class's position and scale
		rectMode(CENTER);
		textAlign(CENTER);
		push();
		translate(this.x, this.y);
		scale(this.scale);

		noStroke();

		//Background fade
		fill(lerpColor(color(...this.colour), color(...this.hover), this.anim));
		//Draws the background
		rect(0, 0, this.w, this.h, 10);
		//Sets to text colour
		fill(this.textColour);
		//Sets size of text based on size of button
		textSize(min(this.w, this.h) * 0.55);
		//Draws the text
		text(this.label, 0, 0);

		pop();
	}

	//Returns if the mouse is within the button's bounds
	isHovered() {
		//Calculates half the size so to caluclte the buttons bounding box
		const halfW = (this.w * this.scale) / 2;
		const halfH = (this.h * this.scale) / 2;
		//Returns if the mouse is within said bounding box
		return mouseX > this.x - halfW && mouseX < this.x + halfW && mouseY > this.y - halfH && mouseY < this.y + halfH;
	}
	//Handles a mouse click
	click() {
		//Checks if the mouse is hoveing over this button and there is a click function
		if (this.isHovered() && this.onClick) {
			//Makes small
			this.scale = 0.95;
			//Makes normal size after 100ms
			setTimeout(() => (this.scale = 1.08), 100);
			//Plays a noise
			playButtonSound();
			//Runs said function
			this.onClick();
		}
	}
}
