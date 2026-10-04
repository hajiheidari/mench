# Offline practice bots (M13)

@mench/game-bot is a separate pure package. It receives a public GameState, difficulty and caller-provided tie entropy; it returns an index from legalMoves or null. It never generates dice, performs network/database operations, mutates state, sees future rolls or receives account/purchase inputs. Candidate outcomes are evaluated through applyAction.

Easy chooses among legal moves. Normal values victory, home arrival, captures, entering and progress. Hard also values safe/home cells and penalizes destinations reachable within an opponent's next1–6 steps. This is a transparent heuristic, not perfect play, a full expected-value model or a claim that levels always have ordered win rates. Engine rules govern all evaluated actions.

Web and Expo practice views expose bots and easy/normal/hard. Human controls seat0; other selected seats act after450ms per action with the same locally sampled dice routine as humans. Timers cancel on state/difficulty changes and unmount; human controls disable during bot actions. Offline bot matches never call result/ranking/reward APIs. Local dice have no online proof guarantee.

Tests freeze inputs, verify legal-only choices, exercise capture/safety preferences and complete180 deterministic2/3/4-player simulations across difficulties. Browser acceptance verifies automatic bot rolls/moves/turn return and disabled human controls. Expo exports verify compilation; native device testing remains externally blocked.
