# Development dice simulation

100000 deterministic fixture rolls. Counts (1–6): 16726, 16524, 16699, 16662, 16734, 16655. Chi-square (5 degrees of freedom): 1.776680; acceptance threshold <30. PASS. Reproducible source fixture is packages/fair-dice/src/index.test.ts.

This checks approximate distribution and regression, not production fairness or operator honesty. Secure entropy generation and proof interoperability have separate tests. Production threshold is at least 1000000 rolls before release.
