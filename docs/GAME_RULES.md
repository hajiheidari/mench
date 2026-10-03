# Engine rules (M1)

Pure, immutable transitions with explicit dice input. Yard=-1, shared ring=0..51 relative to each seat, private home lane=52..56, finish=57. Two players occupy opposite seats; three use seats 0/1/2; four use all seats. Four pawns each.
Default entry six; safe global cells 0,8,13,21,26,34,39,47. All opponents on an unsafe landing cell are captured. Friendly stacks are permitted; blockade rules are not part of this initial ruleset. Finish must be exact. Six/capture/finish grants another roll; third consecutive six forfeits the current turn (prior moves are retained). No legal moves advances unless extra-six applies. Rules are configurable.
Connection actions preserve match/turn; timeout forfeits the active turn. Server timers and grace periods are adapters, not engine clocks. Roll/connection/timeout are trusted server actions; clients may not supply authoritative values. replay(initial, actions) reproduces state exactly.
