# Bridge

> A full-stack multiplayer implementation of the card game Bridge, developed for A-Level Computer Science coursework (67 / 70 marks)

### Demonstration

![Demo](video.gif)

- This is the demonstration video submitted to the exam board as evidence of the completed system and functionality.

### Overview

Bridge is a real-time multiplayer web application that allows four players to play the traditional card game Bridge through a browser.  

The project was researched, designed, developed, tested, evaluated and documented as part of my A-Level Computer Science coursework. Development followed an iteratice Agile-inspired approach with frequent testing, feedback and refinement throughout the project lifecycle. It focuses on client-server communication, game-state management, validation and reliable multiplayer gameplay.  

> [!NOTE]
> Due to A-Level examination restrictions and academic integrity requirements, the source code and full (193) page documentation cannot be published until results day in August 2026. They can be provided upon release of examination materials.

## Technologies Used

- HTML, CSS
- JavaScript: Node.js, Express, Socket.io, p5.js
- Ngrok - allows for non-local connection (used due to extreme limitations in linux container and college wifi)
- Visual Studio Code, Microsoft Word, Flat.io, Aseprite

---

## Features

- Real-time multiplayer gameplay
- Up to four player lobby system
- Car dealing and trick resolution
- Bidding and scoring systems
- Server-authoritative game state
- Input validation and sanitisation
- Session management
- Cross-device multiplayer support

---

## Technical Highlights

### Real-Time Communication

The application uses Socket.io to maintain live communication between connected clients and the server.  

This allows:
- Immediate game updates
- Synchronise player actions
- Event-driven gameplay
- Reduced page refreshes

### Server-side validation

All server requests are validated and sanitised before being parsed.  

This helps ensure:
- Consistent game state
- Prevention of invalid moves
- Reliable multiplayer behaviour

### State Management

One of the main challenges was maintaining a consistent game state across multiple connected players.

The system handles:
- Turn progression
- Card Ownership
- Trick resolution
- Score tracking
- Player connectivity

---

## Development Process

The project followed a structured software development process:
1. Analysis of problem - Introduction and Stakeholders
2. Research of Bridge and existing implementations
3. Discussions with primary stakeholder
4. Project Specification
5. Design - Decomposition, UI, Data storage, Algorithms
6. Development - Iteration plan, proofs of concepts, actual iterations
7. Testing - according to Project specification, Stakeholder testing
8. Evaluation - Success Criteria, Usability, Robustness, Limitations, Mainenance Issues, Future

---

## Challenges & Solutions

### Maintaining State Consistency

A key challenge was ensuring all connected clients saw the same game state, addressed via:
- Server-authoritative logic
- Event (request) validation
- Controlled state updates
- Synchronised broadcasts

### Multiplayer Debugging

Debugging asynchronous multiplayer behaviour required extensive testing across multiple devices and network conditions. This involved reproducing race conditions, validating event ordering and ensuring game-state consistency during simultaneous player interactions.

---

## What I learned

This project provided practical experience with:

- Full-stack web development
- Client-server architecture
- Real-time networking
- Software testing
- Debugging distributed systems
- Technical documentation
- Software development lifecycle practices
