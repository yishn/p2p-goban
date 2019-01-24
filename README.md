# p2p-goban

Connect to multiple peers and play/analyze on a shared Goban. This is a proof of concept and I hope that all functionalities will eventually be integrated into [Sabaki](https://github.com/SabakiHQ/Sabaki).

![Screenshot](./screenshot.png)

First, you connect to a server to see who's there. Then, peers share the game tree with each other peer-to-peer. There's no centralized server that saves your game. We use WebRTC, so all communication between peers are encrypted.

## Features

- Connect to other people peer-to-peer
- Play a game or analyze games together in real time
- Chat with other peers
- Upload SGF files
- Download game as an SGF file
- Follow a peer to see what they see
- Right-click to highlight vertices to signal peers what you're looking at

## Related Projects

- [Shudan](https://github.com/SabakiHQ/Shudan) - A highly customizable, low-level Preact Goban component.
- [crdt-gametree](https://github.com/SabakiHQ/crdt-gametree) - A conflict-free replicated game tree data type.
- [sgf](https://github.com/SabakiHQ/sgf) - A library for parsing and creating SGF files.
